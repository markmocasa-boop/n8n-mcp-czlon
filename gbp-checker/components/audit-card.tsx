import Link from 'next/link'
import type { AuditListItem, AuditStatus } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { getScoreColor } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface AuditCardProps {
  audit: AuditListItem
}

const statusConfig: Record<
  AuditStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Ausstehend',
    className: 'bg-score-medium/10 text-score-medium',
  },
  processing: {
    label: 'Wird verarbeitet',
    className: 'bg-primary/10 text-primary',
  },
  completed: {
    label: 'Abgeschlossen',
    className: 'bg-score-good/10 text-score-good',
  },
  failed: {
    label: 'Fehlgeschlagen',
    className: 'bg-score-bad/10 text-score-bad',
  },
}

export default function AuditCard({ audit }: AuditCardProps) {
  const status = statusConfig[audit.status]
  const formattedDate = new Date(audit.created_at).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Link href={`/audit/${audit.id}`}>
      <Card className="transition-colors hover:border-border-light hover:bg-surface-light/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-text">
                {audit.firmenname}
              </h3>
              <p className="mt-0.5 truncate text-sm text-text-secondary">
                {audit.stadt} &middot; {audit.branche}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              {audit.gesamt_score !== null && (
                <span
                  className={cn(
                    'text-xl font-bold',
                    getScoreColor(audit.gesamt_score)
                  )}
                >
                  {audit.gesamt_score}
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  status.className
                )}
              >
                {status.label}
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs text-text-muted">{formattedDate}</div>
        </CardContent>
      </Card>
    </Link>
  )
}
