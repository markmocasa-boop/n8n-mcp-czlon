# LinkedIn Outreach Automation

## What This Is

Automatisierter LinkedIn-Outreach-Workflow: Ein n8n Form-Trigger nimmt Filterkriterien entgegen (Position, Region, Branche, Mitarbeiteranzahl), liest passende Kontakte aus Google Sheets (LinkedIn-Connections-Export), scrapt deren LinkedIn-Profile via Apify, generiert mit OpenAI personalisierte DM-Nachrichten und schreibt alles zurück in Google Sheets zur manuellen Versendung.

## Core Value

Für jeden gefilterten Kontakt wird eine personalisierte DM generiert, die auf dessen LinkedIn-Profil basiert — mit Pain-Points, Gemeinsamkeiten und einer abschließenden Frage.

## n8n Environment

- **Instance**: meinoffice.app.n8n.cloud
- **Credentials available**: OpenAI (vorhanden), Google Sheets OAuth2 (`gw0DIdDENFkpE7ZW`), Apify (`wWgQDWC9aV3UcUEJ`)
- **Existing workflows**: SEO Content Agent, Lead-Gen Enrichment & Scoring, Social Pulse

## Workflows

### Planned

| # | Workflow Name | Purpose | Trigger |
|---|---|---|---|
| WF1 | LinkedIn Outreach Generator | Filterformular → Kontakte lesen → Profile scrapen → DM generieren → in Sheets schreiben | n8n Form Trigger (manuell) |

### Deployed

(None yet)

### Out of Scope

| Feature | Reason |
|---|---|
| Automatischer LinkedIn-Versand | LinkedIn ToS — manueller Versand gewünscht |
| LinkedIn Sales Navigator | Explizit ausgeschlossen |
| E-Mail-Outreach | Nicht angefragt |

## Data Flow

```
n8n Form Trigger (Filter: Position, Region, Branche, Mitarbeiter)
  → Google Sheets lesen (alle Connections)
  → Filter-Node (nach Formular-Parametern)
  → Loop über gefilterte Kontakte
      → Apify LinkedIn Profile Scraper (via LinkedIn URL)
      → OpenAI: Profil analysieren + DM schreiben
  → Google Sheets: Ergebnis-Row schreiben (Name, Firma, URL, DM-Text, Status=Entwurf)
```

## Constraints

- **API Limits**: Apify — kostenpflichtig pro Scraping-Run, LinkedIn-URLs müssen im Sheet vorhanden sein
- **Data**: LinkedIn-Export CSV enthält: FirstName, LastName, EmailAddress, Company, Position, ConnectedOn, LinkedInURL (Platzhalter bis CSV eintrifft)
- **Credentials**: OpenAI + Google Sheets + Apify vorhanden
- **Cost**: Ca. $0.01-0.05 pro Kontakt (OpenAI gpt-4o-mini + Apify-Credits)

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Manueller Versand via Sheets | LinkedIn ToS, Sicherheit | OUT-Spalte "Status=Entwurf" |
| Apify für Profil-Scraping | Kein nativer LinkedIn-Scraper in n8n | HTTP Request → Apify API |
| gpt-4o-mini für DM-Generierung | Kostengünstig, ausreichend für DMs | Pending |
| n8n Form Trigger statt Webhook | On-Demand, kein externen Caller nötig | Pending |

---
*Last updated: 2026-03-11 — Project initialized*
