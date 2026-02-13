import type { Plan } from '@/types/database'

export const PLANS: Record<Plan, {
  name: string
  price: number
  monthlyAudits: number
  description: string
  features: string[]
}> = {
  free: {
    name: 'Free',
    price: 0,
    monthlyAudits: 1,
    description: '1 Audit zum Testen',
    features: [
      '1 Audit (einmalig)',
      'Dashboard',
      'Report-Historie',
      'Report als PDF',
    ],
  },
  pro: {
    name: 'Pro',
    price: 39,
    monthlyAudits: 50,
    description: 'Für Freelancer & kleine Agenturen',
    features: [
      '50 Audits / Monat',
      'Dashboard',
      'Report-Historie',
      'Report als PDF',
    ],
  },
  business: {
    name: 'Business',
    price: 69,
    monthlyAudits: 100,
    description: 'Für Agenturen mit vielen Kunden',
    features: [
      '100 Audits / Monat',
      'Dashboard',
      'Report-Historie',
      'Report als PDF',
    ],
  },
}

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 1,
  pro: 50,
  business: 100,
}

export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-score-good'
  if (score >= 40) return 'text-score-medium'
  return 'text-score-bad'
}

export function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-score-good'
  if (score >= 40) return 'bg-score-medium'
  return 'bg-score-bad'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Sehr gut'
  if (score >= 70) return 'Gut'
  if (score >= 50) return 'Ausbaufähig'
  if (score >= 40) return 'Verbesserungswürdig'
  return 'Kritisch'
}

export function getScoreStrokeColor(score: number): string {
  if (score >= 70) return '#22C55E'
  if (score >= 40) return '#F59E0B'
  return '#EF4444'
}
