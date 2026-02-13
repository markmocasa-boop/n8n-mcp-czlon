'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, AlertCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import ScoreCircle from '@/components/score-circle'
import FactorCard from '@/components/factor-card'
import PriorityList from '@/components/priority-list'
import Navbar from '@/components/navbar'
import { getScoreLabel, getScoreColor } from '@/lib/constants'
import type { Audit } from '@/types/database'

export default function AuditReportPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const auditId = params.id as string

  const [audit, setAudit] = useState<Audit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit/${auditId}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Audit nicht gefunden.')
          return
        }
        setError('Fehler beim Laden des Audits.')
        return
      }
      const data: Audit = await res.json()
      setAudit(data)
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setLoading(false)
    }
  }, [auditId])

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      fetchAudit()
    }

    checkAuth()
  }, [router, supabase.auth, fetchAudit])

  // Poll for updates if audit is pending/processing
  useEffect(() => {
    if (!audit || audit.status === 'completed' || audit.status === 'failed') {
      return
    }

    const channel = supabase
      .channel(`audit-${auditId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'audits',
          filter: `id=eq.${auditId}`,
        },
        (payload) => {
          setAudit(payload.new as Audit)
        }
      )
      .subscribe()

    // Fallback polling every 5 seconds
    const interval = setInterval(() => {
      fetchAudit()
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [audit, auditId, supabase, fetchAudit])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-card border border-score-bad/30 bg-score-bad/10 px-6 py-4 text-score-bad">
            {error}
          </div>
        </main>
      </div>
    )
  }

  if (!audit) return null

  // Pending / Processing state
  if (audit.status === 'pending' || audit.status === 'processing') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="flex flex-col items-center justify-center rounded-card border border-border bg-surface px-6 py-16 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            <h1 className="mt-6 text-xl font-bold text-text">
              {audit.status === 'pending'
                ? 'Audit wird vorbereitet...'
                : 'KI analysiert dein Profil...'}
            </h1>
            <p className="mt-2 text-text-secondary">
              {audit.status === 'pending'
                ? 'Dein Audit wird in Kuerze gestartet.'
                : 'Die Analyse laeuft. Dies kann bis zu 2 Minuten dauern.'}
            </p>
            <p className="mt-4 text-xs text-text-muted">
              Diese Seite aktualisiert sich automatisch.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Failed state
  if (audit.status === 'failed') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="flex flex-col items-center justify-center rounded-card border border-score-bad/30 bg-score-bad/5 px-6 py-16 text-center">
            <AlertCircle className="h-12 w-12 text-score-bad" />
            <h1 className="mt-6 text-xl font-bold text-text">
              Audit fehlgeschlagen
            </h1>
            <p className="mt-2 text-text-secondary">
              {audit.error_message ||
                'Bei der Analyse ist ein Fehler aufgetreten. Bitte versuche es erneut.'}
            </p>
            <Button
              className="mt-6"
              onClick={() => router.push('/audit/new')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Completed state — full report
  const report = audit.report_json
  const score = audit.gesamt_score ?? 0
  const scoreLabel = audit.score_label || getScoreLabel(score)
  const scoreColor = getScoreColor(score)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-text">
              {audit.firmenname}
            </h1>
            <p className="mt-1 text-text-secondary">
              {audit.stadt} &middot; {audit.branche} &middot;{' '}
              {new Date(audit.created_at).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Als PDF herunterladen
          </Button>
        </div>

        {/* Score */}
        <div className="mt-10 flex flex-col items-center">
          <ScoreCircle score={score} />
          <p className={`mt-4 text-xl font-bold ${scoreColor}`}>
            {scoreLabel}
          </p>
        </div>

        {/* Zusammenfassung */}
        {report?.zusammenfassung && (
          <div className="mt-10 rounded-card border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text">
              Zusammenfassung
            </h2>
            <p className="mt-3 text-text-secondary leading-relaxed">
              {report.zusammenfassung}
            </p>
          </div>
        )}

        {/* Faktoren */}
        {report?.faktoren && report.faktoren.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-text">
              10-Faktor-Analyse
            </h2>
            <div className="mt-4 space-y-4">
              {report.faktoren.map((faktor) => (
                <FactorCard key={faktor.nummer} faktor={faktor} />
              ))}
            </div>
          </section>
        )}

        {/* Prioritaeten */}
        {report?.prioritaeten && report.prioritaeten.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-text">
              Priorisierte Massnahmen
            </h2>
            <div className="mt-4">
              <PriorityList prioritaeten={report.prioritaeten} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
