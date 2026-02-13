import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripe, PRICE_IDS } from '@/lib/stripe'

interface CheckoutBody {
  plan: 'pro' | 'business'
}

export async function POST(request: NextRequest) {
  try {
    // 1. Get session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse body
    const body: CheckoutBody = await request.json()

    if (!body.plan || !['pro', 'business'].includes(body.plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "pro" or "business".' },
        { status: 400 }
      )
    }

    const priceId = PRICE_IDS[body.plan]

    // 3. Get profile to check for existing stripe_customer_id
    const serviceClient = createServiceClient()

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    let stripeCustomerId = profile.stripe_customer_id

    // 4. If no stripe_customer_id, create Stripe customer
    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      })

      stripeCustomerId = customer.id

      // 5. Update profile with stripe_customer_id
      await serviceClient
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id)
    }

    // 6. Create Stripe checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/settings`,
      metadata: { user_id: user.id, plan: body.plan },
    })

    // 7. Return session URL
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
