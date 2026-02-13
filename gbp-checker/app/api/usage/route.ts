import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PLAN_LIMITS } from '@/lib/constants'
import type { Plan } from '@/types/database'

export async function GET() {
  try {
    // 1. Get session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get profile for plan info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, monthly_audit_limit')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const plan = profile.plan as Plan

    // 3. Get current usage period
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
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
    }

    // 4. If no current usage period, create one
    if (!usage) {
      const periodStart = new Date()
      periodStart.setDate(1) // First day of current month
      const periodEnd = new Date(periodStart)
      periodEnd.setMonth(periodEnd.getMonth() + 1) // First day of next month

      const limit = PLAN_LIMITS[plan] ?? 1

      const { data: newUsage, error: createError } = await serviceClient
        .from('usage')
        .insert({
          user_id: user.id,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          audits_used: 0,
          audits_limit: limit,
        })
        .select('*')
        .single()

      if (createError || !newUsage) {
        console.error('Usage create error:', createError)
        return NextResponse.json({ error: 'Failed to create usage period' }, { status: 500 })
      }

      return NextResponse.json({
        audits_used: newUsage.audits_used,
        audits_limit: newUsage.audits_limit,
        period_start: newUsage.period_start,
        period_end: newUsage.period_end,
        plan,
      })
    }

    // 5. Return usage data
    return NextResponse.json({
      audits_used: usage.audits_used,
      audits_limit: usage.audits_limit,
      period_start: usage.period_start,
      period_end: usage.period_end,
      plan,
    })
  } catch (error) {
    console.error('Usage error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
