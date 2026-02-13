import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Reichweite, Ladenlokal } from '@/types/database'
import { PLANS } from '@/lib/constants'
import type { Plan } from '@/types/database'

// In-memory rate limiter
const rateLimiter = new Map<string, number[]>()

function checkRateLimit(userId: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now()
  const timestamps = rateLimiter.get(userId) || []
  const recent = timestamps.filter(t => now - t < windowMs)
  if (recent.length >= maxRequests) return false
  recent.push(now)
  rateLimiter.set(userId, recent)
  return true
}

interface TriggerAuditBody {
  firmenname: string
  stadt: string
  branche: string
  reichweite: Reichweite
  ladenlokal: Ladenlokal
  kontakt_email: string
  kontakt_name?: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Get session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Rate limit check
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // 3. Get current usage
    const serviceClient = createServiceClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: usage, error: usageError } = await serviceClient
      .from('usage')
      .select('*')
      .eq('user_id', user.id)
      .lte('period_start', today)
      .gt('period_end', today)
      .single()

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('Usage query error:', usageError)
      return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 })
    }

    // 4. Check limits
    if (usage && usage.audits_used >= usage.audits_limit) {
      // Determine next tier suggestion
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()

      const currentPlan = (profile?.plan || 'free') as Plan
      const suggestedPlan = currentPlan === 'free' ? 'pro' : currentPlan === 'pro' ? 'business' : null

      return NextResponse.json(
        {
          error: 'limit_reached',
          message: 'Audit limit for this period reached.',
          suggested_plan: suggestedPlan,
        },
        { status: 403 }
      )
    }

    // 5. Parse and validate body
    const body: TriggerAuditBody = await request.json()

    const requiredFields: (keyof TriggerAuditBody)[] = [
      'firmenname', 'stadt', 'branche', 'reichweite', 'ladenlokal', 'kontakt_email',
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: 'validation_error', message: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // 6. Insert audit (using auth client - RLS allows insert)
    const { data: audit, error: insertError } = await supabase
      .from('audits')
      .insert({
        user_id: user.id,
        status: 'pending',
        firmenname: body.firmenname,
        stadt: body.stadt,
        branche: body.branche,
        reichweite: body.reichweite,
        ladenlokal: body.ladenlokal,
        kontakt_email: body.kontakt_email,
        kontakt_name: body.kontakt_name || null,
      })
      .select('id')
      .single()

    if (insertError || !audit) {
      console.error('Audit insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
    }

    // 7. Increment usage (using service client)
    if (usage) {
      const { error: updateError } = await serviceClient
        .from('usage')
        .update({ audits_used: usage.audits_used + 1 })
        .eq('user_id', user.id)
        .eq('id', usage.id)

      if (updateError) {
        console.error('Usage update error:', updateError)
      }
    }

    // 8. Trigger n8n webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audit_id: audit.id,
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/n8n`,
            callback_secret: process.env.N8N_WEBHOOK_SECRET,
            firmenname: body.firmenname,
            stadt: body.stadt,
            branche: body.branche,
            reichweite: body.reichweite,
            ladenlokal: body.ladenlokal,
            email: body.kontakt_email,
            name: body.kontakt_name || null,
          }),
        })
      } catch (webhookError) {
        console.error('n8n webhook error:', webhookError)
        // Don't fail the request - the audit is created, n8n can retry
      }
    }

    // 9. Return response
    return NextResponse.json({ audit_id: audit.id, status: 'pending' })
  } catch (error) {
    console.error('Audit trigger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
