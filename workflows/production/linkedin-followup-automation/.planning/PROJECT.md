# LinkedIn Follow-up Automation

## What This Is

Vollautomatischer täglicher LinkedIn Follow-up Workflow: Startet täglich um 05:00 Uhr (Europe/Berlin), liest die LinkedIn-Inbox via Apify aus, erkennt neue Connections und importiert sie ins Google Sheet, teilt bestehende Leads in 4 Follow-up-Kategorien ein und generiert KI-gestützte Nachrichtenvorschläge nach der Hormozi 100M Leads Methode. Ergebnis: täglicher HTML-Report per Gmail + Sheet-Update + Report-Log.

## Core Value

Jeden Morgen liegt ein priorisierter Follow-up-Report mit konkreten, personalisierten Nachrichtenvorschlägen im Posteingang — ohne manuelle Analyse.

## n8n Environment

- **Instance**: meinoffice.app.n8n.cloud
- **Version**: n8n 2.36.1 (cloud)
- **Credentials available**:
  - `google_sheets_oauth` → Google Sheets OAuth2 (ID: `gw0DIdDENFkpE7ZW`)
  - `gmail_oauth` → Gmail OAuth2 (vorhanden)
  - `apify_api_key` → Apify API Key (ID: `wWgQDWC9aV3UcUEJ`)
  - `openai_api_key` → OpenAI API Key (vorhanden)
- **Existing workflows**: SEO Content Agent, Lead-Gen Enrichment & Scoring, Social Pulse, LinkedIn Outreach (BaGtkUOzmbsC2pvF)

## Workflows

### Planned

| # | Workflow Name | Purpose | Trigger |
|---|---|---|---|
| WF1 | LinkedIn Follow-up Master | Schedule → Branch A (neue Leads) + Branch B (Report) parallel | Schedule Trigger 05:00 Europe/Berlin |

### Deployed

(None yet)

### Out of Scope

| Feature | Reason |
|---|---|
| Automatisches LinkedIn-Nachrichtenversand | LinkedIn ToS — nur Vorschläge, kein Auto-Send |
| CRM-Integration (HubSpot/Salesforce) | PRD explizit ausgeschlossen |
| Mehrere LinkedIn-Accounts | PRD ausgeschlossen |
| Mobile Push-Benachrichtigungen | PRD ausgeschlossen |
| Echtzeit-Antwort-Erkennung | Nur 1x täglich 05:00 Uhr |
| Kampagnen-Management | PRD ausgeschlossen |

## Data Flow

```
[Schedule Trigger 05:00 Europe/Berlin]
         |
         |──── BRANCH A: Neue Leads erkennen (parallel)
         |       [HTTP Request: Apify Connections Actor starten]
         |       [Wait 20s]
         |       [HTTP Request Loop: Apify Status prüfen]
         |       [HTTP Request: Connections-Daten abrufen]
         |       [Code: Abgleich mit Sheet — nur neue URLs]
         |       [Google Sheets: Neue Leads appenden]
         |
         |──── BRANCH B: Follow-up Report (parallel)
                 [Google Sheets: Alle Leads laden]
                 [HTTP Request: Apify Inbox Actor starten]
                 [Wait 20s]
                 [HTTP Request Loop: Apify Status prüfen]
                 [HTTP Request: Inbox-Daten abrufen]
                 [Code: Daten zusammenführen + 4 Kategorien]
                 [OpenAI: GPT-4o Hormozi-Analyse (1 Call)]
                 [Code: AI-Antwort parsen + zusammenführen]
                 [Code: HTML-Report generieren]
                 |──── [Gmail: Report senden]
                 |──── [Google Sheets: Leads aktualisieren]
                 |──── [Google Sheets: Report-Log schreiben]
```

**Google Sheet:** `LinkedIn Leads`
- Tab 1: `Leads` (13 Spalten: Name, LinkedIn_URL, Unternehmen, Position, Erstkontakt_Datum, Letzter_Reply_Datum, Anzahl_Nachrichten, Status, Stern, Letzte_Kategorie, Letzter_Report, Zuletzt_gesehen, Quelle)
- Tab 2: `Report-Log` (8 Spalten: Datum, Anzahl pro Kategorie, Gesamt, Report_gesendet, Fehler)

## Constraints

- **API Limits**: Apify — kostenpflichtig pro Run (ca. 0,28–0,60 € / Tag gesamt); LinkedIn-Cookie `li_at` läuft nach Wochen ab
- **n8n Cloud**: Kein nativer LinkedIn-Inbox/Connections-Scraper → HTTP Request zu Apify API
- **Polling-Loops**: n8n hat kein natives Loop-Construct → Wait + IF + Merge-Node Muster
- **Switch Node**: typeVersion 3/3.2 und rules.values-Format crashen Canvas in n8n 2.36.1 → typeVersion 2 + rules.rules-Format verwenden
- **OpenAI fixedCollection**: `"prompt": {"messages": [...]}` (kein extra `values`-Wrapper)
- **Cost**: GPT-4o ca. 0,03–0,05 € / Tag bei ~3.000 Tokens
- **Umgebungsvariablen**: `LINKEDIN_COOKIE`, `REPORT_EMAIL`, `GOOGLE_SHEET_ID` in n8n Settings hinterlegen

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| 1 Workflow (kein Split in WF1/WF2) | Branch A + B laufen parallel im selben Workflow; einfacher zu deployen und zu verwalten | WF1 mit parallelen Branches |
| HTTP Request für Apify | Kein nativer Apify-Node auf n8n cloud verfügbar | HTTP Request mit Header Auth |
| 1 GPT-4o Call für alle Kontakte | Kostenoptimierung: alle Kategorien in einem Prompt | Code-Node für JSON-Aggregation vorher |
| Google Sheets Update per LinkedIn_URL | Eindeutiger Identifier für Row-Update | URL-basiertes Lookup-Feld |
| Polling-Loop als Wait+IF+Merge | n8n native Loop-Architektur ohne Community-Nodes | Max. 20 Versuche × 15s |

---
*Last updated: 2026-03-13 — Project initialized*
