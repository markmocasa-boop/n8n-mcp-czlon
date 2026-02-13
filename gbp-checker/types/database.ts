export type Plan = 'free' | 'pro' | 'business'

export interface Profile {
  id: string
  full_name: string | null
  company_name: string | null
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  monthly_audit_limit: number
  created_at: string
  updated_at: string
}

export type AuditStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type Reichweite = 'Lokal' | 'Regional' | 'Bundesweit'
export type Ladenlokal = 'Ja' | 'Nein'

export interface Audit {
  id: string
  user_id: string
  status: AuditStatus
  firmenname: string
  stadt: string
  branche: string
  reichweite: Reichweite
  ladenlokal: Ladenlokal
  kontakt_email: string
  kontakt_name: string | null
  gesamt_score: number | null
  score_label: string | null
  report_json: ReportJson | null
  report_html: string | null
  error_message: string | null
  n8n_execution_id: string | null
  created_at: string
  completed_at: string | null
}

export interface AuditListItem {
  id: string
  user_id: string
  status: AuditStatus
  firmenname: string
  stadt: string
  branche: string
  gesamt_score: number | null
  created_at: string
}

export interface Usage {
  id: string
  user_id: string
  period_start: string
  period_end: string
  audits_used: number
  audits_limit: number
  created_at: string
}

export interface WebhookLog {
  id: string
  source: 'n8n' | 'stripe'
  event_type: string | null
  payload: Record<string, unknown>
  status: 'received' | 'processed' | 'failed'
  error_message: string | null
  created_at: string
}

export interface ReportJson {
  gesamt_score: number
  gesamt_score_label: string
  zusammenfassung: string
  faktoren: Faktor[]
  prioritaeten: Prioritaet[]
}

export interface Faktor {
  nummer: number
  name: string
  score: number
  max_score: number
  status: string
  emoji: string
  zusammenfassung: string
  details: FaktorDetail[]
}

export interface FaktorDetail {
  check: string
  status: string
  kommentar: string
}

export interface Prioritaet {
  rang: number
  titel: string
  faktor: string
  aufwand: string
  wirkung: string
  beschreibung: string
  sofort_tipp: string
}
