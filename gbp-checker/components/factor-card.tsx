'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Faktor } from '@/types/database'
import { cn } from '@/lib/utils'

interface FactorCardProps {
  faktor: Faktor
}

export default function FactorCard({ faktor }: FactorCardProps) {
  const [open, setOpen] = useState(false)
  const percentage =
    faktor.max_score > 0
      ? Math.round((faktor.score / faktor.max_score) * 100)
      : 0

  const scoreColor =
    percentage >= 70
      ? 'text-score-good'
      : percentage >= 40
        ? 'text-score-medium'
        : 'text-score-bad'

  const barColor =
    percentage >= 70
      ? 'bg-score-good'
      : percentage >= 40
        ? 'bg-score-medium'
        : 'bg-score-bad'

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <div className="rounded-card border border-border bg-surface">
        <Collapsible.Trigger asChild>
          <button className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-light/50">
            <span className="text-xl">{faktor.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-text">
                  {faktor.name}
                </span>
                <span className={cn('shrink-0 text-sm font-semibold', scoreColor)}>
                  {faktor.score}/{faktor.max_score}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-light">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-text-muted transition-transform',
                open && 'rotate-180'
              )}
            />
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div className="border-t border-border px-4 pb-4 pt-3">
            <p className="mb-3 text-sm text-text-secondary">
              {faktor.zusammenfassung}
            </p>

            {faktor.details.length > 0 && (
              <ul className="space-y-2">
                {faktor.details.map((detail, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="mt-0.5 shrink-0">{detail.status}</span>
                    <div>
                      <span className="font-medium text-text">
                        {detail.check}
                      </span>
                      {detail.kommentar && (
                        <p className="mt-0.5 text-text-muted">
                          {detail.kommentar}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  )
}
