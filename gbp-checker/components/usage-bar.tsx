'use client'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Usage } from '@/types/database'

interface UsageBarProps {
  used?: number
  limit?: number
  plan?: string
  usage?: Usage
}

export default function UsageBar({ used: usedProp, limit: limitProp, plan, usage }: UsageBarProps) {
  const used = usedProp ?? usage?.audits_used ?? 0
  const limit = limitProp ?? usage?.audits_limit ?? 1
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0

  const indicatorColor =
    percentage >= 90
      ? 'bg-score-bad'
      : percentage >= 70
        ? 'bg-score-medium'
        : 'bg-primary'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">
          {used} von {limit} Audits verwendet
        </span>
        <span
          className={cn(
            'font-medium',
            percentage >= 90
              ? 'text-score-bad'
              : percentage >= 70
                ? 'text-score-medium'
                : 'text-text-secondary'
          )}
        >
          {plan}
        </span>
      </div>
      <Progress value={percentage} indicatorClassName={indicatorColor} />
    </div>
  )
}
