'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import UsageBar from '@/components/usage-bar'
import AuditCard from '@/components/audit-card'
import type { AuditListItem, Usage } from '@/types/database'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [audits, setAudits] = useState<AuditListItem[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const [usageRes, auditsRes] = await Promise.all([
          fetch('/api/usage'),
          fetch('/api/audits'),
        ])

        if (usageRes.ok) {
          const usageData = await usageRes.json()
          setUsage(usageData)
        }

        if (auditsRes.ok) {
          const auditsData = await auditsRes.json()
          setAudits(auditsData)
        }
      } catch {
        setError('Fehler beim Laden der Daten.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, supabase.auth])

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-card border border-score-bad/30 bg-score-bad/10 px-6 py-4 text-score-bad">
          {error}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <Button asChild>
          <Link href="/audit/new">
            <Plus className="mr-2 h-4 w-4" />
            Neuen Audit starten
          </Link>
        </Button>
      </div>

      {usage && (
        <div className="mt-8">
          <UsageBar usage={usage} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text">Deine Audits</h2>

        {audits.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-card border border-border bg-surface px-6 py-16 text-center">
            <p className="text-lg font-medium text-text">
              Starte deinen ersten Audit
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Analysiere dein Google Business Profil und erhalte einen
              detaillierten Report.
            </p>
            <Button asChild className="mt-6">
              <Link href="/audit/new">
                <Plus className="mr-2 h-4 w-4" />
                Neuen Audit starten
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {audits.map((audit) => (
              <AuditCard key={audit.id} audit={audit} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
