import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface N8nWebhookBody {
  audit_id: string
  status: 'completed' | 'failed' | 'processing'
  gesamt_score?: number
  score_label?: string
  report_json?: Record<string, unknown>
  report_html?: string
  error_message?: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret')

    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    // 2. Parse body
    const body: N8nWebhookBody = await request.json()

    if (!body.audit_id || !body.status) {
      return NextResponse.json({ error: 'Missing audit_id or status' }, { status: 400 })
    }

    // 3. Use service client (server-to-server, no auth needed)
    const serviceClient = createServiceClient()

    // 4. Log to webhook_logs
    await serviceClient
      .from('webhook_logs')
      .insert({
        source: 'n8n',
        event_type: body.status,
        payload: body as unknown as Record<string, unknown>,
        status: 'received',
      })

    // 5. Handle status updates
    if (body.status === 'completed') {
      const { error: updateError } = await serviceClient
        .from('audits')
        .update({
          status: 'completed',
          gesamt_score: body.gesamt_score ?? null,
          score_label: body.score_label ?? null,
          report_json: body.report_json ?? null,
          report_html: body.report_html ?? null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', body.audit_id)

      if (updateError) {
        console.error('Audit update error (completed):', updateError)
        return NextResponse.json({ error: 'Failed to update audit' }, { status: 500 })
      }
    } else if (body.status === 'failed') {
      const { error: updateError } = await serviceClient
        .from('audits')
        .update({
          status: 'failed',
          error_message: body.error_message ?? 'Unknown error',
        })
        .eq('id', body.audit_id)

      if (updateError) {
        console.error('Audit update error (failed):', updateError)
        return NextResponse.json({ error: 'Failed to update audit' }, { status: 500 })
      }
    } else if (body.status === 'processing') {
      const { error: updateError } = await serviceClient
        .from('audits')
        .update({ status: 'processing' })
        .eq('id', body.audit_id)

      if (updateError) {
        console.error('Audit update error (processing):', updateError)
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('n8n webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
