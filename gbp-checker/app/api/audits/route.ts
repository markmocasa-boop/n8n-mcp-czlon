import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // 1. Get session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Query audits for user, ordered by created_at desc
    // Select only list fields (no report_html for performance)
    const { data: audits, error: queryError } = await supabase
      .from('audits')
      .select('id, user_id, status, firmenname, stadt, branche, gesamt_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (queryError) {
      console.error('Audits query error:', queryError)
      return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
    }

    // 3. Return array of audits
    return NextResponse.json(audits)
  } catch (error) {
    console.error('List audits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
