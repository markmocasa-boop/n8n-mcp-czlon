# SocialPulse — KI-gestützter Social Media Manager

## What This Is

SocialPulse ist ein n8n Workflow-System das wöchentlich automatisch Social Media Performance-Daten von 6 Plattformen sammelt, Wettbewerber beobachtet, plattformspezifischen Content (Text + Bilder + Videos) via KI erstellt und einen umfassenden Wochenreport per E-Mail versendet. Steuerung über ein zentrales Google Sheet. Zielgruppe: SEO-Agenturen, Social Media Agenturen und E-Commerce im DACH-Markt. Alle Texte auf Deutsch.

## Core Value

**Wöchentlicher datenbasierter Social Media Report mit konkreten Handlungsempfehlungen und Content-Vorschlägen — vollautomatisch für 6 Plattformen.**

## n8n Environment

- **Instance**: https://meinoffice.app.n8n.cloud
- **Version**: 2.35.5
- **Credentials verfügbar**:
  - Google OAuth2 (Sheets + Gmail) ✅
  - Anthropic API Key (Claude Sonnet 4.5) ✅
  - Supabase API (Key + URL) ✅
  - Apify API Token ✅
  - Google Gemini API Key (Imagen 4 + Veo 3) ❌ noch einrichten
  - Meta (Facebook) OAuth (Graph API + Ads) ❌ noch einrichten
  - YouTube OAuth (Data API v3) ❌ noch einrichten
  - LinkedIn OAuth (optional) ❌ noch einrichten
- **Bestehende Workflows**: SEO Content Agent (9 WFs), Lead-Gen Enrichment (2 WFs)

## Workflows

### Planned

| # | Workflow Name | Purpose | Trigger |
|---|---|---|---|
| WF1 | Performance Collector | Performance-Metriken von 6 Plattformen sammeln | Webhook (Master) + eigener Webhook |
| WF2 | Meta Ads Analyzer | Facebook + Instagram Ads Performance auswerten | Webhook (Master) + eigener Webhook |
| WF3 | Competitor Monitor | Wettbewerber-Profile scrapen, Top-Posts + Kommentare analysieren | Webhook (Master) + eigener Webhook |
| WF4 | Content Creator | Plattformspez. Content: Text (Claude), Bilder (Imagen 4), Videos (Veo 3) | Webhook (Master) + eigener Webhook |
| WF5 | Report Generator | Wochenreport mit Vergleichen (Vorwoche + 4 Wochen) + Empfehlungen | Webhook (Master) + eigener Webhook |
| WF6 | Report Sender | HTML-E-Mail + PDF-Anhang an Empfänger versenden | Webhook (Master) + eigener Webhook |
| WF7 | SocialPulse Controller (Master) | Orchestriert Sub-Workflows basierend auf Konfig-Tab | Schedule (Mo 9:00) + Webhook |

### Deployed

| # | Workflow Name | n8n ID | Nodes | Deployed |
|---|---|---|---|---|
| WF1 | SocialPulse WF1: Performance Collector | gPlbmjGXwadiLN1N | 29 | 2026-03-03 |

### Out of Scope

| Feature | Reason |
|---|---|
| SaaS-Frontend / User-Registrierung | MVP — reine n8n-Automation |
| Automatisches Posten | Nur Content-Vorschläge, kein Publishing |
| Echtzeit-Monitoring | Nur wöchentliche Batch-Verarbeitung |
| Multi-Brand in einem Sheet | 1 Sheet = 1 Marke/Projekt |
| A/B-Test für Ads | Zukünftige Erweiterung |
| Chatbot/Interface | Steuerung über Google Sheet + manuelle Trigger |
| Budget-Optimierung Meta Ads | Nur Analyse, keine automatische Steuerung |
| Content Approval Workflow | Content als "Entwurf" gespeichert |
| Scheduling-Tool-Integration | Kein Buffer/Hootsuite etc. |

## Data Flow

```
Google Sheet (Konfig) ──────────────────────────────────────────┐
                                                                 │
WF7 Master ──┬── WF1 Performance ──┬── Google Sheet (Aktuell)  │
             │                      └── Supabase (historisch)    │
             ├── WF2 Meta Ads ─────┬── Supabase                 │
             │                      └── (Ergebnis → WF5)        │
             ├── WF3 Competitor ───┬── Google Sheet (Insights)   │
             │                      ├── Supabase                 │
             │                      └── (Ideen → WF4 + WF5)     │
             │                                                    │
             ├── WF4 Content ──────┬── Google Sheet (Plan)       │
             │   (braucht WF1+WF3) ├── Supabase                 │
             │                      └── (Vorschläge → WF5)      │
             │                                                    │
             ├── WF5 Report ───────── HTML + PDF                 │
             │   (braucht WF1-4)                                  │
             │                                                    │
             └── WF6 Sender ──────── Gmail → Empfänger           │
                 (braucht WF5)                                    │
```

**Ausführungsreihenfolge:**
1. WF1 + WF2 + WF3 → parallel (Datensammlung)
2. WF4 → nach Schritt 1 (braucht Performance + Competitor-Daten)
3. WF5 → nach Schritt 1+2 (braucht alle Daten + Content-Vorschläge)
4. WF6 → nach Schritt 3 (braucht fertigen Report)

## Tech Stack

| Komponente | Technologie | n8n Node |
|---|---|---|
| Text-Generierung | Claude Sonnet 4.5 | `nodes-langchain.lmChatAnthropic` |
| Bild-Generierung | Imagen 4 | `nodes-langchain.googleGemini` (HTTP Fallback) |
| Video-Generierung | Veo 3 | HTTP Request (Google Gemini API) |
| Web Scraping | Apify | `@apify/n8n-nodes-apify` (Community, Official) |
| Steuerung & Konfig | Google Sheets | `nodes-base.googleSheets` |
| Historische Daten | Supabase (PostgreSQL) | `nodes-base.supabase` |
| Report-Versand | Gmail | `nodes-base.gmail` |
| Facebook/Instagram | Meta Graph API | `nodes-base.facebookGraphApi` |
| YouTube | YouTube Data API v3 | `nodes-base.youTube` |
| LinkedIn | LinkedIn API | `nodes-base.linkedIn` (begrenzt) |
| TikTok | Apify Actor | `@apify/n8n-nodes-apify` |
| X/Twitter | Apify Actor | `@apify/n8n-nodes-apify` |
| Sub-Workflow-Aufrufe | n8n Execute Workflow | `nodes-base.executeWorkflow` |

## Node-Verfügbarkeit

| Plattform | Native Node | Gaps → Lösung |
|---|---|---|
| Google Sheets | ✅ Voll | — |
| Gmail | ✅ Voll | — |
| Claude/Anthropic | ✅ LangChain | — |
| Supabase | ✅ Voll (CRUD) | — |
| Facebook Graph | ✅ Basis | Ads-Insights → spezifische Graph API Endpoints |
| YouTube | ✅ Channels/Playlists | Analytics → HTTP Request oder Apify |
| LinkedIn | ⚠️ Nur Post-Erstellung | Analytics → Apify Actor |
| Instagram | ⚠️ Community Node | Analytics → Apify Actor |
| TikTok | ⚠️ Community (unverified) | Alles → Apify Actor (zuverlässiger) |
| X/Twitter | ⚠️ Basis (Tweets) | Analytics → Apify Actor |
| Google Gemini | ✅ LangChain (Text) | Imagen 4 / Veo 3 → HTTP Request (REST API) |
| Apify | ✅ Official Community | — |

## Datenbank (Supabase)

5 Tabellen:
- `performance_weekly` — Plattform-Metriken pro KW (UPSERT)
- `meta_ads_weekly` — Kampagnen/Anzeigengruppen/Anzeigen
- `competitor_weekly` — Wettbewerber-Daten + Content-Ideen
- `content_generated` — Erstellte Content-Vorschläge
- `workflow_runs` — Ausführungs-Log

## Google Sheets

8 Tabs:
1. Konfig — Projekteinstellungen + Modul-Aktivierung
2. Plattform-Accounts — Social Media Account-Daten
3. Wettbewerber — Bis zu 3 pro Plattform (max 18)
4. Meta Ads Konfig — Ad Account ID + Filter
5. Performance Aktuell — Automatisch befüllt (WF1)
6. Content Plan — Automatisch befüllt (WF4)
7. Competitor Insights — Automatisch befüllt (WF3)
8. Run Log — Ausführungs-Historie

## Constraints

- **API Limits**: Apify max 2 concurrent runs, 5s Pause zwischen Scraping-Aufrufen
- **Apify**: Rate-Limit-Fehler → 30s warten, max 3 Retries
- **Claude Tokens**: ~4-5 LLM-Aufrufe pro Run (Content + Analysis + Report) — Kostenkontrolle beachten
- **Gemini**: Imagen 4 (Bilder) + Veo 3 (Videos) → API-Kosten pro generiertem Asset
- **Webhook Timeout**: n8n Cloud Standard-Timeout beachten bei langen Scraping-Runs
- **Google Sheets**: Rate Limits bei vielen Schreib-Operationen → Batch-Writes
- **Sprache**: ALLE Texte, Prompts, Reports auf Deutsch

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Apify statt direkte APIs für TikTok/X/Instagram | Kein offizieller API-Zugang oder limitierte native Nodes | Apify Actors für Scraping |
| Google Sheets als Steuerung | Einfach, kein Custom-Frontend nötig, sofort nutzbar | 8-Tab-Struktur |
| Supabase für Historie | Historische Vergleiche brauchen relationale DB | 5 Tabellen, UPSERT-Logik |
| Jeder Sub-WF eigenständig auslösbar | Flexibilität: einzelne Module testen/nutzen ohne Master | Dual-Trigger (Master + eigener Webhook) |
| Claude für Text, Gemini für Media | Beste Qualität je Domäne, kein Single-Vendor-Lock | 2 AI-Provider |

## Relevante Templates

| Template | Quelle | Relevant für |
|---|---|---|
| Multi-Platform Social Media Content Creation | haunchen #3066 | WF4 Content Creator — Multi-Plattform Content-Pipeline |
| AI-Powered Multi Social Media Post Automation | haunchen #4352 | WF1/WF4 — Trend-basierter Content + Sheets-Tracking |
| Generate AI Videos with Veo3 + Blotato | haunchen #5035 | WF4 — Veo3 Video-Generierung |
| Social Media Analysis + Email Generation | enescingoz | WF5/WF6 — Analytics + E-Mail-Report |
| Competitor Research with Exa.ai + AI Agents | enescingoz | WF3 — Competitor Intelligence Pipeline |
| Deep Research Agent with Apify + OpenAI | enescingoz | WF3 — Apify-basierte Recherche |
| Supabase Insertion & Upsertion & Retrieval | enescingoz | Alle WFs — Supabase CRUD-Pattern |

---
*Last updated: 2026-03-03 after project initialization*
