'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/constants'
import type { Plan } from '@/types/database'
import { Check } from 'lucide-react'

interface UpgradeModalProps {
  currentPlan?: Plan
  suggestedPlan?: Plan
  isOpen?: boolean
  open?: boolean
  onClose: () => void
}

export default function UpgradeModal({
  currentPlan = 'free',
  suggestedPlan = 'pro',
  isOpen,
  open,
  onClose,
}: UpgradeModalProps) {
  const current = PLANS[currentPlan]
  const suggested = PLANS[suggestedPlan]
  const isDialogOpen = open ?? isOpen ?? false

  return (
    <Dialog open={isDialogOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Audit-Limit erreicht</DialogTitle>
          <DialogDescription>
            Du hast das Limit deines {current.name}-Plans erreicht. Upgrade auf{' '}
            {suggested.name}, um weitere Audits durchzuführen.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-4">
          <div className="rounded-card border border-border-light bg-surface-light p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-text">
                {suggested.name}
              </span>
              <span className="text-lg font-bold text-primary">
                {suggested.price}&euro;/Monat
              </span>
            </div>
            <ul className="space-y-2">
              {suggested.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm text-text-secondary"
                >
                  <Check className="h-4 w-4 shrink-0 text-score-good" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center text-xs text-text-muted">
            Aktuell: {current.name} ({current.monthlyAudits} Audits/Monat)
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button asChild>
            <a href="/settings?tab=billing">Jetzt upgraden</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
