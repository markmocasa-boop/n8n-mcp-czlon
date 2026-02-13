import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripe, getPlanFromPriceId } from '@/lib/stripe'
import { PLAN_LIMITS } from '@/lib/constants'
import type { Plan } from '@/types/database'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  try {
    // 1. Get raw body and verify signature
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = getStripe().webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Stripe signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // 2. Use service client for DB updates
    const serviceClient = createServiceClient()

    // 3. Log to webhook_logs
    await serviceClient
      .from('webhook_logs')
      .insert({
        source: 'stripe',
        event_type: event.type,
        payload: event.data.object as unknown as Record<string, unknown>,
        status: 'received',
      })

    // 4. Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan as Plan | undefined

        if (!userId || !plan) {
          console.error('Missing metadata in checkout session:', session.id)
          break
        }

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id

        const limit = PLAN_LIMITS[plan] ?? 1

        // Update profile
        await serviceClient
          .from('profiles')
          .update({
            plan,
            stripe_customer_id: typeof session.customer === 'string'
              ? session.customer
              : session.customer?.id ?? null,
            stripe_subscription_id: subscriptionId ?? null,
            monthly_audit_limit: limit,
          })
          .eq('id', userId)

        // Create new usage period with updated limit
        const periodStart = new Date()
        periodStart.setDate(1)
        const periodEnd = new Date(periodStart)
        periodEnd.setMonth(periodEnd.getMonth() + 1)

        const today = new Date().toISOString().split('T')[0]

        // Update existing period or create new one
        const { data: existingUsage } = await serviceClient
          .from('usage')
          .select('id')
          .eq('user_id', userId)
          .lte('period_start', today)
          .gt('period_end', today)
          .single()

        if (existingUsage) {
          await serviceClient
            .from('usage')
            .update({ audits_limit: limit })
            .eq('id', existingUsage.id)
        } else {
          await serviceClient
            .from('usage')
            .insert({
              user_id: userId,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
              audits_used: 0,
              audits_limit: limit,
            })
        }

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id
        const priceId = subscription.items.data[0]?.price?.id

        if (!priceId) {
          console.error('No price ID found in subscription update:', subscriptionId)
          break
        }

        const newPlan = getPlanFromPriceId(priceId)

        if (!newPlan) {
          console.error('Unknown price ID:', priceId)
          break
        }

        const limit = PLAN_LIMITS[newPlan]

        // Find profile by stripe_subscription_id
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .single()

        if (!profile) {
          console.error('No profile found for subscription:', subscriptionId)
          break
        }

        // Update profile plan and limit
        await serviceClient
          .from('profiles')
          .update({
            plan: newPlan,
            monthly_audit_limit: limit,
          })
          .eq('id', profile.id)

        // Update current usage period limit
        const today = new Date().toISOString().split('T')[0]

        await serviceClient
          .from('usage')
          .update({ audits_limit: limit })
          .eq('user_id', profile.id)
          .lte('period_start', today)
          .gt('period_end', today)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id

        // Find profile by stripe_subscription_id
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .single()

        if (!profile) {
          console.error('No profile found for deleted subscription:', subscriptionId)
          break
        }

        // Set plan to free, clear subscription
        await serviceClient
          .from('profiles')
          .update({
            plan: 'free',
            monthly_audit_limit: 0,
            stripe_subscription_id: null,
          })
          .eq('id', profile.id)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.error('Payment failed for invoice:', invoice.id, 'customer:', invoice.customer)
        // Future: send notification to user
        break
      }

      default:
        // Unhandled event type - log but don't error
        console.log('Unhandled Stripe event type:', event.type)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
