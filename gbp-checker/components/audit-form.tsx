'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Reichweite, Ladenlokal } from '@/types/database'

interface AuditFormData {
  firmenname: string
  stadt: string
  branche: string
  reichweite: Reichweite
  ladenlokal: Ladenlokal
  kontakt_email: string
  kontakt_name: string
}

interface AuditFormProps {
  userEmail?: string
  defaultEmail?: string
  loading?: boolean
  onSubmit: (data: AuditFormData) => void | Promise<void>
}

export default function AuditForm({ userEmail, defaultEmail, loading: externalLoading, onSubmit }: AuditFormProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const loading = externalLoading ?? internalLoading
  const email = userEmail ?? defaultEmail ?? ''
  const [formData, setFormData] = useState<AuditFormData>({
    firmenname: '',
    stadt: '',
    branche: '',
    reichweite: 'Lokal',
    ladenlokal: 'Ja',
    kontakt_email: email,
    kontakt_name: '',
  })

  const handleChange = (field: keyof AuditFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInternalLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="firmenname">Firmenname *</Label>
        <Input
          id="firmenname"
          required
          placeholder="z.B. Muster GmbH"
          value={formData.firmenname}
          onChange={(e) => handleChange('firmenname', e.target.value)}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stadt">Stadt *</Label>
          <Input
            id="stadt"
            required
            placeholder="z.B. Berlin"
            value={formData.stadt}
            onChange={(e) => handleChange('stadt', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="branche">Branche *</Label>
          <Input
            id="branche"
            required
            placeholder="z.B. Restaurant"
            value={formData.branche}
            onChange={(e) => handleChange('branche', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Reichweite</Label>
          <Select
            value={formData.reichweite}
            onValueChange={(value) =>
              handleChange('reichweite', value as Reichweite)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Lokal">Lokal</SelectItem>
              <SelectItem value="Regional">Regional</SelectItem>
              <SelectItem value="Bundesweit">Bundesweit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ladenlokal</Label>
          <Select
            value={formData.ladenlokal}
            onValueChange={(value) =>
              handleChange('ladenlokal', value as Ladenlokal)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ja">Ja</SelectItem>
              <SelectItem value="Nein">Nein</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kontakt_email">E-Mail *</Label>
          <Input
            id="kontakt_email"
            type="email"
            required
            placeholder="name@beispiel.de"
            value={formData.kontakt_email}
            onChange={(e) => handleChange('kontakt_email', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kontakt_name">Name (optional)</Label>
          <Input
            id="kontakt_name"
            placeholder="Kontaktperson"
            value={formData.kontakt_name}
            onChange={(e) => handleChange('kontakt_name', e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Wird gestartet...' : 'Audit starten'}
      </Button>
    </form>
  )
}
