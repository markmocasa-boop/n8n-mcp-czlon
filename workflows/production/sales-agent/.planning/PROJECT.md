# Sales Agent — KI-gestützter B2B Sales Automation System

## What This Is

Vollautomatischer KI-Sales-Agent für DACH-B2B-Vertrieb. Liest Leads aus Google Sheets, reichert sie an (Website via Tavily, LinkedIn via Apify), bewertet sie nach einem 5-Schichten-Framework (Claude), generiert personalisierte 4-stufige E-Mail-Sequenzen und LinkedIn-Nachrichten, sendet E-Mails zeitgesteuert via Gmail, überwacht den Posteingang auf Antworten, erkennt Terminwünsche, trägt Termine in Google Calendar ein und erstellt Antwort-Drafts — fertig zum manuellen Absenden.

## Core Value

Jeder qualifizierte Lead (Score ≥ 30) erhält automatisch eine personalisierte 4-E-Mail-Sequenz mit LinkedIn-Begleitung — ohne manuelle Texterstellung.

## n8n Environment

- **Instance**: meinoffice.app.n8n.cloud
- **Version**: n8n Cloud (aktuell)
- **Credentials available**:
  - Google Sheets OAuth2: `gw0DIdDENFkpE7ZW`
  - Google Sheets Trigger OAuth2: `Qa2WgxqaJEKVUVwy`
  - Gmail OAuth2 (selbe Google-App, zusätzliche Scopes: gmail.modify, gmail.compose)
  - Google Calendar OAuth2 (selbe Google-App, Scopes: calendar, calendar.events)
  - Anthropic (Claude) — neu einzurichten
  - Tavily API — neu einzurichten
  - Apify API: `wWgQDWC9aV3UcUEJ`
- **Existing workflows**: SEO Content Agent, Lead-Gen Enrichment & Scoring (andere Projekte)

## Workflows

### Planned

| # | Workflow Name | Purpose | Trigger |
|---|---|---|---|
| WF0 | Master Orchestrator | Lead-Loop, Sub-WF-Aufrufe, Status-Management | Cron 08:00 + Manuell |
| WF1 | Lead Enrichment (SW-01) | Website-Analyse via Tavily, LinkedIn via Apify | Webhook vom Master |
| WF2 | Lead Scoring (SW-02) | 5-Schichten-Scoring mit Claude (0–100) | Webhook vom Master |
| WF3 | E-Mail Sequenz Generator (SW-03) | 4 personalisierte E-Mails via Claude | Webhook vom Master |
| WF4 | E-Mail Sender (SW-04) | Zeitgesteuerter Gmail-Versand mit Antwort-Check | Webhook vom Master |
| WF5 | LinkedIn Content Generator (SW-05) | DM + Post-Idee via Claude | Webhook vom Master |
| WF6 | CRM Updater (SW-06) | Google Sheets Updates + Sequenz_Log | Webhook von allen Sub-WFs |
| WF7 | Inbox & Calendar Manager (SW-07) | Gmail-Monitoring, Terminwunsch-Erkennung, Calendar, Drafts | Cron 15 Min + Cron 07:00 |

### Deployed

(None yet)

### Out of Scope

| Feature | Reason |
|---|---|
| Automatisches Senden von Antworten | Sicherheit: immer manuelles Review erforderlich |
| A/B-Test-Auswertung | v2 |
| Mehrsprachige Sequenzen | nur Deutsch im MVP |
| Stripe / Bezahlschranke | v2 |
| Automatisches Calendly-Booking | Google Calendar wird direkt verwendet |
| Sentiment-Analyse auf Antworten | nur Terminwunsch-Erkennung im MVP |

## Data Flow

```
[Cron 08:00] → WF0 (Master)
  → Google Sheets: alle Leads lesen (Tab "Leads")
  → Filter: Status = "Neu" ODER "In Sequenz"
  → Loop pro Lead:
      → WF1 (Webhook) → angereicherte Daten zurück an Master
      → WF2 (Webhook) → Score + Klassifikation zurück
      → IF Score >= 30:
          → IF Status = "Neu":
              → WF3 (Webhook) → 4 E-Mail-Texte zurück
              → WF4 (Webhook) → E-Mail 1 senden
              → WF5 (Webhook) → LinkedIn-Inhalte zurück
          → IF Status = "In Sequenz":
              → WF4 (Webhook) → nächste E-Mail prüfen & senden
      → WF6 (Webhook) → CRM-Update + Log-Eintrag

[Cron alle 15 Min] → WF7 (Inbox-Monitoring)
  → Gmail: ungelesene E-Mails abrufen
  → Abgleich mit Leads-Tab (bekannter Absender?)
  → Thread laden → Claude: Terminwunsch erkennen
  → IF Terminwunsch: Google Calendar → Termin anlegen → Tab "Termine" befüllen
  → Claude: Antwort-Draft generieren → Gmail: Draft speichern
  → WF6: CRM-Update (antwort_erhalten = TRUE, draft_erstellt = TRUE)

[Cron täglich 07:00] → WF7 (Termin-Vorbereitung)
  → Tab "Termine": Termine für morgen laden
  → Claude: SPIN-Fragenset + Einwände + Einstiegssatz generieren
  → Tab "Termine": Agenda speichern
```

## Google Sheets Struktur

- **Tab "Leads"**: 28 Spalten (A–AB) — Lead-Stammdaten + CRM-Status
- **Tab "Sequenz_Log"**: 5 Spalten — Aktivitätsprotokoll aller Sub-WF-Aktionen
- **Tab "Termine"**: 15 Spalten (A–O) — Kalendertermine + Agenden

## Constraints

- **API Limits**: Gmail: 3–5 Sek. Pause zwischen Leads; Anthropic: max_tokens 1000/Call
- **Webhook Timeout**: n8n Default 30s — WF1 (Apify async!) separat handhaben
- **Apify**: Async-Pattern (Actor starten → Polling → Ergebnis) — kein synchroner Aufruf
- **Credentials**: Google OAuth2 braucht Scopes: gmail.modify + gmail.compose + calendar + calendar.events + sheets
- **Cost**: Claude claude-sonnet-4-20250514 (~8 Calls/Lead: Scoring, 4 E-Mails, LinkedIn x2, Draft) × Lead-Anzahl
- **Umlaute**: Spaltennamen mit Umlauten (nächster_kontakt, score_begründung) → Expression-Syntax prüfen

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Anthropic Node statt HTTP Request | Nativer n8n Langchain Node verfügbar | Anthropic Chat Model Node |
| Apify nativer Node | Apify Node in n8n vorhanden | Apify Node statt HTTP Request |
| Google Sheets nativer Node | Standard n8n Node | Google Sheets Node |
| Gmail nativer Node | Standard n8n Node | Gmail Node |
| Google Calendar nativer Node | Standard n8n Node | Google Calendar Node |
| Tavily via HTTP Request | Kein nativer Tavily Node in n8n | HTTP Request bleibt |
| Sub-WF Kommunikation via Webhook | Entkopplung + Wiederverwendbarkeit | Execute Workflow Node (n8n-intern) |

---
*Last updated: 2026-03-08 — Projekt-Initialisierung*
