'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import UsageBar from '@/components/usage-bar'
import PricingTable from '@/components/pricing-table'
import { PLANS } from '@/lib/constants'
import type { Profile, Usage, Plan } from '@/types/database'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPricingDialog, setShowPricingDialog] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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

        setEmail(user.email || '')

        const [profileRes, usageRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/usage'),
        ])

        if (profileRes.ok) {
          const profileData: Profile = await profileRes.json()
          setProfile(profileData)
          setFullName(profileData.full_name || '')
        }

        if (usageRes.ok) {
          const usageData: Usage = await usageRes.json()
          setUsage(usageData)
        }
      } catch {
        setError('Fehler beim Laden der Einstellungen.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, supabase.auth])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      })

      if (!res.ok) {
        setError('Fehler beim Speichern des Profils.')
        return
      }

      setSuccess('Profil erfolgreich aktualisiert.')
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword !== confirmPassword) {
      setError('Die Passwoerter stimmen nicht ueberein.')
      return
    }

    if (newPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    setSaving(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess('Passwort erfolgreich geaendert.')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setSaving(false)
    }
  }

  async function handleManageBilling() {
    try {
      const res = await fetch('/api/billing-portal', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        setError('Fehler beim Oeffnen des Zahlungsportals.')
      }
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    }
  }

  async function handlePlanChange(plan: Plan) {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        setError('Fehler beim Starten des Checkouts.')
      }
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    )
  }

  const currentPlan = profile?.plan || 'free'
  const planInfo = PLANS[currentPlan]

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-text">Einstellungen</h1>

      {error && (
        <div className="mt-6 rounded-lg border border-score-bad/30 bg-score-bad/10 px-4 py-3 text-sm text-score-bad">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-lg border border-score-good/30 bg-score-good/10 px-4 py-3 text-sm text-score-good">
          {success}
        </div>
      )}

      {/* Account Section */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text">Konto</h2>

        <form
          onSubmit={handleSaveProfile}
          className="mt-4 rounded-card border border-border bg-surface p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Name
            </label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dein Name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              E-Mail
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="opacity-60 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-text-muted">
              Die E-Mail-Adresse kann nicht geaendert werden.
            </p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Wird gespeichert...' : 'Profil speichern'}
          </Button>
        </form>

        {/* Password Change */}
        <form
          onSubmit={handleChangePassword}
          className="mt-4 rounded-card border border-border bg-surface p-6 space-y-4"
        >
          <h3 className="text-base font-medium text-text">
            Passwort aendern
          </h3>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Neues Passwort
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              minLength={6}
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Passwort bestaetigen
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              minLength={6}
              required
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Wird geaendert...' : 'Passwort aendern'}
          </Button>
        </form>
      </section>

      {/* Abo & Zahlung Section */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text">
          Abo &amp; Zahlung
        </h2>

        <div className="mt-4 rounded-card border border-border bg-surface p-6 space-y-6">
          {/* Current Plan */}
          <div>
            <p className="text-sm text-text-secondary">Aktueller Plan</p>
            <p className="mt-1 text-lg font-semibold text-text">
              {planInfo.name}{' '}
              {planInfo.price > 0 && (
                <span className="text-text-secondary font-normal text-base">
                  — {planInfo.price} EUR / Monat
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {planInfo.description}
            </p>
          </div>

          {/* Usage Bar */}
          {usage && <UsageBar usage={usage} />}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPricingDialog(true)}
            >
              Plan wechseln
            </Button>
            {currentPlan !== 'free' && (
              <Button variant="outline" onClick={handleManageBilling}>
                Zahlungsmethode verwalten
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Dialog */}
      {showPricingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-4xl rounded-card border border-border bg-surface p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text">
                Plan wechseln
              </h2>
              <button
                onClick={() => setShowPricingDialog(false)}
                className="text-text-muted hover:text-text transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <PricingTable
              currentPlan={currentPlan}
              onSelectPlan={handlePlanChange}
            />
          </div>
        </div>
      )}
    </main>
  )
}
