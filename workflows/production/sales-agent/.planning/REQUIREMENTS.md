# Requirements: Sales Agent — KI-gestützter B2B Sales Automation System

**Defined:** 2026-03-08
**Core Value:** Jeder qualifizierte Lead (Score ≥ 30) erhält automatisch eine personalisierte 4-E-Mail-Sequenz mit LinkedIn-Begleitung.

---

## v1 Requirements

### Triggers & Inputs

- [ ] **TRIG-01**: Master-Orchestrator startet täglich um 08:00 Uhr via Cron UND manuell per Button
- [ ] **TRIG-02**: Alle Sub-Workflows (WF1–WF6) werden vom Master via Execute Workflow / Webhook aufgerufen
- [ ] **TRIG-03**: WF7 (Inbox Monitor) läuft eigenständig alle 15 Minuten via Cron
- [ ] **TRIG-04**: WF7 (Termin-Vorbereitung) läuft täglich um 07:00 Uhr via separaten Cron-Node

### Data Processing

- [ ] **DATA-01**: Master liest alle Leads aus Google Sheets Tab "Leads" und filtert nach Status = "Neu" ODER "In Sequenz"
- [ ] **DATA-02**: WF1 prüft ob Lead eine Website hat → Tavily-Suche; ob LinkedIn-URL → Apify LinkedIn Scraper
- [ ] **DATA-03**: WF2 wendet 5-Schichten-Framework an und routet nach Score: < 30 = Kalt (stop), 30–79 = Standard, ≥ 80 = Premium
- [ ] **DATA-04**: WF3 generiert 4 E-Mails mit unterschiedlicher Methode (BASHO, SPIN, Klaff, Gitomer) basierend auf Score-Klassifikation
- [ ] **DATA-05**: WF4 prüft `antwort_erhalten` und `nächster_kontakt` vor jedem E-Mail-Versand — kein Senden wenn Antwort vorliegt
- [ ] **DATA-06**: WF7 gleicht Absender-E-Mail jeder eingehenden Mail gegen Tab "Leads" ab — unbekannte Absender werden ignoriert
- [ ] **DATA-07**: WF7 baut Thread-Kontext auf (chronologisch sortiert) und lädt alle Lead-Daten aus Sheet
- [ ] **DATA-08**: WF7 prüft `draft_erstellt` via `messageId` im Sequenz_Log — kein Doppel-Draft
- [ ] **DATA-09**: Zwischen jedem Lead im Master-Loop 3–5 Sekunden warten (Gmail Rate Limiting)

### External APIs

- [ ] **API-01**: Tavily Search API — Website-Analyse (`search_depth: advanced`) + Unternehmens-Herausforderungen-Suche
- [ ] **API-02**: Apify LinkedIn Profile Scraper (Actor: `apify/linkedin-profile-scraper`) — Async-Pattern: starten → polling → Ergebnis
- [ ] **API-03**: Gmail API — Senden, Draft erstellen, Nachrichten lesen, Thread laden, als gelesen markieren
- [ ] **API-04**: Google Calendar API — Freebusy-Query für 5 Werktage (09:00–17:00), Termin anlegen mit Attendee + Reminder
- [ ] **API-05**: Google Sheets API — Lesen (alle Leads), Schreiben (einzelne Zellen), Zeile suchen via lead_id, Append (Log + Termine)

### AI / LLM

- [ ] **AI-01**: WF2: Lead-Scoring — Claude antwortet als JSON mit score, klassifikation, begründung, empfohlene_ansprache, hauptschmerz, kaufmotiv
- [ ] **AI-02**: WF3: E-Mail 1 (BASHO) — inkl. 3 A/B-testbarer Betreffzeilen, max. 120 Wörter
- [ ] **AI-03**: WF3: E-Mail 2 (SPIN) — Follow-up ohne Antwort, Implikationsfrage, max. 100 Wörter
- [ ] **AI-04**: WF3: E-Mail 3 (Klaff Pitch) — Before/After-Story, konkreter CTA, max. 130 Wörter
- [ ] **AI-05**: WF3: E-Mail 4 (Gitomer Break-up) — ehrlich, Türe offen, max. 80 Wörter
- [ ] **AI-06**: WF5: LinkedIn-DM — max. 300 Zeichen, kein Pitch, modernes Deutsch
- [ ] **AI-07**: WF5: LinkedIn-Post-Idee — Hook + 3–5 Absätze + Community-Frage, 150–250 Wörter
- [ ] **AI-08**: WF7: Terminwunsch-Erkennung — Claude antwortet als JSON mit terminwunsch_erkannt, konfidenz, vorgeschlagene_zeiten
- [ ] **AI-09**: WF7: Antwort-Draft-Generierung — kontextbewusst, Thread-aware, mit/ohne Terminbestätigung, JSON-Output
- [ ] **AI-10**: WF7: Gesprächsvorbereitung — SPIN-Fragenset, Einwände, Gesprächsziel, Einstiegssatz, max. 300 Wörter
- [ ] **AI-11**: Alle Claude-Calls verwenden `claude-sonnet-4-20250514`, max_tokens 1000, 5-Schichten-Framework als System-Kontext

### Output & Delivery

- [ ] **OUT-01**: WF4 sendet E-Mails via Gmail-Node mit korrektem Absender, Betreff, Text
- [ ] **OUT-02**: WF4 schreibt `email_X_gesendet = TRUE`, `letzter_kontakt`, `nächster_kontakt` ins Google Sheet
- [ ] **OUT-03**: WF6 aktualisiert alle relevanten Felder im Leads-Tab via lead_id-Lookup
- [ ] **OUT-04**: WF6 schreibt Eintrag in Tab "Sequenz_Log" (timestamp, lead_id, aktion, inhalt, status)
- [ ] **OUT-05**: WF7 erstellt Gmail-Draft (NICHT senden) — manuelles Absenden erforderlich
- [ ] **OUT-06**: WF7 schreibt Termin in Tab "Termine" (alle 15 Felder) + setzt `termin_vereinbart = TRUE` im Leads-Tab
- [ ] **OUT-07**: WF7 speichert Gesprächsvorbereitung in Tab "Termine" Spalte `agenda`
- [ ] **OUT-08**: WF5 schreibt generierte LinkedIn-Nachricht in Spalte V (`linkedin_nachricht`) des Leads-Tab

### Error Handling

- [ ] **ERR-01**: Alle API-Calls in Try/Catch-Blöcken — bei Fehler: Status = "Fehler – [Workflow-Name]" ins Sheet
- [ ] **ERR-02**: WF4: Bei Gmail-Fehler 2x retry mit 30 Minuten Pause; bei dauerhaftem Fehler: Slack/E-Mail-Benachrichtigung
- [ ] **ERR-03**: WF1: Apify-Polling mit Timeout — nach max. 3 Minuten abbrechen und ohne LinkedIn-Daten weitermachen
- [ ] **ERR-04**: Alle Sub-Workflows: 2 Versuche mit 5 Minuten Pause vor Fehler-Status
- [ ] **ERR-05**: WF7: Score < 30 → `status = "Kalt"`, kein Sequenz-Start, kein E-Mail-Versand

---

## v2 Requirements

### Erweiterte Features

- **V2-01**: A/B-Test-Auswertung der 3 Betreffzeilen (Tracking via Pixel oder Open-Rate-Analyse)
- **V2-02**: Mehrsprachige Sequenzen (DE + EN)
- **V2-03**: Sentiment-Analyse auf eingehende Antworten (positiv/negativ/neutral)
- **V2-04**: Automatisches Calendly-Booking als Alternative zu Google Calendar
- **V2-05**: Stripe-Integration für Bezahlschranke vor Demo-Termin

---

## Out of Scope

| Feature | Reason |
|---|---|
| Automatisches Senden von E-Mail-Antworten | Sicherheit — immer manuelles Review |
| A/B-Test-Auswertung Betreffzeilen | v2 |
| Mehrsprachige Sequenzen | nur Deutsch im MVP |
| Stripe / Bezahlschranke | v2 |
| Automatisches Calendly-Booking | Google Calendar direkt |
| Sentiment-Analyse | nur Terminwunsch-Erkennung |

---

## Traceability

| Requirement | Phase | Workflow | Status |
|---|---|---|---|
| TRIG-01, TRIG-02, DATA-01, DATA-09 | Phase 1 | WF0 Master | Pending |
| OUT-03, OUT-04, ERR-01 | Phase 1 | WF6 CRM Updater | Pending |
| API-01, API-02, DATA-02 | Phase 2 | WF1 Enrichment | Pending |
| AI-01, DATA-03, ERR-05 | Phase 2 | WF2 Scoring | Pending |
| AI-02–AI-05, DATA-04 | Phase 3 | WF3 Sequenz Generator | Pending |
| API-03, DATA-05, OUT-01, OUT-02, ERR-02 | Phase 3 | WF4 E-Mail Sender | Pending |
| AI-06, AI-07, OUT-08 | Phase 4 | WF5 LinkedIn Generator | Pending |
| TRIG-03, TRIG-04, DATA-06–DATA-08 | Phase 5 | WF7 Inbox & Calendar | Pending |
| API-04, OUT-05, OUT-06, OUT-07 | Phase 5 | WF7 Inbox & Calendar | Pending |
| AI-08–AI-11, ERR-03, ERR-04 | Phase 5 | WF7 Inbox & Calendar | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
