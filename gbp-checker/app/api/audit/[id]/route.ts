import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Get session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Query audit by id where user_id matches
    const { data: audit, error: queryError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (queryError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // 3. Return full audit object including report_json and report_html
    return NextResponse.json(audit)
  } catch (error) {
    console.error('Get audit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
