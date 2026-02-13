'use client'

import { PLANS } from '@/lib/constants'
import type { Plan } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PricingTableProps {
  currentPlan?: Plan
  onSelectPlan?: (plan: Plan) => void
}

const planOrder: Plan[] = ['free', 'pro', 'business']

export default function PricingTable({ currentPlan, onSelectPlan }: PricingTableProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {planOrder.map((planKey) => {
        const plan = PLANS[planKey]
        const isHighlighted = planKey === 'pro'
        const isCurrent = currentPlan === planKey

        return (
          <Card
            key={planKey}
            className={cn(
              'relative flex flex-col',
              isHighlighted && 'border-primary ring-1 ring-primary'
            )}
          >
            {isHighlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-white">
                Beliebt
              </div>
            )}

            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-3xl font-bold text-text">
                  {plan.price}&euro;
                </span>
                {plan.price > 0 && (
                  <span className="text-sm text-text-muted">/Monat</span>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <Check className="h-4 w-4 shrink-0 text-score-good" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={isHighlighted ? 'default' : 'outline'}
                disabled={isCurrent}
                onClick={() => onSelectPlan?.(planKey)}
              >
                {isCurrent ? 'Aktueller Plan' : 'Auswählen'}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
