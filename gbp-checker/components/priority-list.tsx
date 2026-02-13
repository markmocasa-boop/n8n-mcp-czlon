import type { Prioritaet } from '@/types/database'
import { cn } from '@/lib/utils'

interface PriorityListProps {
  prioritaeten: Prioritaet[]
}

export default function PriorityList({ prioritaeten }: PriorityListProps) {
  return (
    <div className="space-y-4">
      {prioritaeten.map((p) => (
        <div
          key={p.rang}
          className="rounded-card border border-border bg-surface p-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {p.rang}
            </span>

            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-text">{p.titel}</h4>

              <div className="mt-1.5 flex flex-wrap gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    'bg-surface-light text-text-secondary'
                  )}
                >
                  Aufwand: {p.aufwand}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    'bg-surface-light text-text-secondary'
                  )}
                >
                  Wirkung: {p.wirkung}
                </span>
              </div>

              <p className="mt-2 text-sm text-text-secondary">
                {p.beschreibung}
              </p>

              {p.sofort_tipp && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-sm text-text">
                    <span className="font-medium text-primary">
                      Sofort-Tipp:{' '}
                    </span>
                    {p.sofort_tipp}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
