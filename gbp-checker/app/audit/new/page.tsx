'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuditForm from '@/components/audit-form'
import UpgradeModal from '@/components/upgrade-modal'
import Navbar from '@/components/navbar'
import type { Usage } from '@/types/database'

export default function NewAuditPage() {
  const router = useRouter()
  const supabase = createClient()

  const [usage, setUsage] = useState<Usage | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
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

        setUserEmail(user.email || '')

        const usageRes = await fetch('/api/usage')
        if (usageRes.ok) {
          const usageData: Usage = await usageRes.json()
          setUsage(usageData)

          if (usageData.audits_used >= usageData.audits_limit) {
            setShowUpgradeModal(true)
          }
        }
      } catch {
        setError('Fehler beim Laden der Daten.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, supabase.auth])

  async function handleSubmit(formData: {
    firmenname: string
    stadt: string
    branche: string
    reichweite: string
    ladenlokal: string
    kontakt_email: string
    kontakt_name?: string
  }) {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/audit/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Fehler beim Starten des Audits.')
        return
      }

      const data = await res.json()
      router.push(`/audit/${data.id}`)
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-text">Neuen Audit starten</h1>
        <p className="mt-2 text-text-secondary">
          Gib die Daten des Google Business Profils ein, das du analysieren
          moechtest.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-score-bad/30 bg-score-bad/10 px-4 py-3 text-sm text-score-bad">
            {error}
          </div>
        )}

        <div className="mt-8">
          <AuditForm
            onSubmit={handleSubmit}
            loading={submitting}
            defaultEmail={userEmail}
          />
        </div>
      </main>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  )
}
