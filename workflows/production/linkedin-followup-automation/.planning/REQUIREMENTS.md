# Requirements: LinkedIn Follow-up Automation

**Defined:** 2026-03-13
**Core Value:** Jeden Morgen priorisierter Follow-up-Report mit Hormozi-Nachrichtenvorschlägen im Posteingang.

## v1 Requirements

### Triggers & Inputs

- [ ] **TRIG-01**: Schedule Trigger startet täglich um 05:00 Uhr Timezone Europe/Berlin und löst beide Branches gleichzeitig aus
- [ ] **TRIG-02**: Branch A empfängt Apify Connections-Daten (Name, LinkedIn_URL, Unternehmen, Position) als Input
- [ ] **TRIG-03**: Branch B empfängt alle Leads aus Google Sheet Tab `Leads` + Apify Inbox-Daten als Input

### Data Processing

- [ ] **DATA-01**: Branch A — Code-Node gleicht Apify Connections-URLs mit bestehenden Sheet-URLs ab (normalisiert: lowercase, kein trailing slash) und gibt nur neue Einträge zurück
- [ ] **DATA-02**: Branch B — Code-Node merged Sheet-Leads mit Apify Conversations (URL-Key), berechnet Tages-Differenzen und klassifiziert jeden Lead in eine von 4 Kategorien: `Stern`, `Unbeantwortet`, `3 Tage still`, `5 Tage still`
- [ ] **DATA-03**: Branch B — Kategorisierungs-Logik: Stern (manuelle Markierung Spalte I = "JA"), Unbeantwortet (nie geantwortet + ≥3 Tage seit Erstkontakt), 3 Tage (letzter Reply 2–4 Tage her), 5 Tage (letzter Reply 4–6 Tage her)
- [ ] **DATA-04**: Branch B — Code-Node parsed GPT-4o JSON-Antwort robust (inkl. Backtick-Cleanup) und merged AI-Ergebnisse (Zusammenfassung + Nachrichtenvorschlag) zu den kategorisierten Leads
- [ ] **DATA-05**: Branch B — Code-Node generiert vollständigen HTML-Report mit 4 farbcodierten Sektionen, Header-Statistiken, verlinkten Namen und Hormozi-Vorschlägen

### External APIs

- [ ] **API-01**: Apify Connections Actor `curious_coder~linkedin-profile-scraper` starten (POST) mit LinkedIn-Cookie aus Umgebungsvariable `LINKEDIN_COOKIE`
- [ ] **API-02**: Apify Inbox Actor `curious_coder~linkedin-messages-scraper` starten (POST) mit Cookie + `includeMessageHistory: true`
- [ ] **API-03**: Polling-Loop für Connections Actor: GET Status alle 15s, max. 20 Versuche (= 5 Min.), bei SUCCEEDED weiter, bei FAILED Error-Handler
- [ ] **API-04**: Polling-Loop für Inbox Actor: GET Status alle 15s, max. 60 Versuche (= 15 Min.), bei FAILED Report trotzdem ausführen mit Fehlerhinweis
- [ ] **API-05**: Apify Dataset Items abrufen (GET) nach erfolgreichem Actor-Run via `defaultDatasetId`

### AI / LLM

- [ ] **AI-01**: Genau 1 GPT-4o API-Call für ALLE Kontakte aus allen 4 Kategorien (Batch-Verarbeitung zur Kostenoptimierung)
- [ ] **AI-02**: System-Prompt definiert 4 Hormozi-Methoden: Soft Opener (Unbeantwortet), High-Value Direct (Stern), Value Drop (3 Tage), Breakup Message (5 Tage)
- [ ] **AI-03**: GPT-4o gibt reines JSON-Array zurück (kein Markdown), ein Objekt pro Kontakt mit `linkedinUrl`, `zusammenfassung`, `nachrichtenvorschlag`
- [ ] **AI-04**: Personalisierung Pflicht: Name, Unternehmen oder Position müssen in jedem Vorschlag vorkommen, max. 3 Sätze, kein Corporate-Speak
- [ ] **AI-05**: Bei GPT-4o Fehler: Fallback `zusammenfassung: "KI-Analyse nicht verfügbar"` und `nachrichtenvorschlag: "Bitte manuell prüfen"` — Report läuft trotzdem

### Output & Delivery

- [ ] **OUT-01**: Branch A — Neue Leads werden per Google Sheets Append Row in Tab `Leads` eingetragen (alle 13 Felder, `Quelle: "auto-import"`, `Status: "Offen"`)
- [ ] **OUT-02**: Branch A — Node läuft nur wenn neue Leads gefunden wurden (IF-Bedingung `length > 0`)
- [ ] **OUT-03**: Branch B — Gmail sendet HTML-Report an `REPORT_EMAIL` mit Subject `LinkedIn Report [Datum] – [N] Kontakte`
- [ ] **OUT-04**: Branch B — Google Sheets Update Row aktualisiert für alle kategorisierten Leads: `Anzahl_Nachrichten`, `Letzter_Reply_Datum`, `Letzte_Kategorie`, `Letzter_Report`, `Zuletzt_gesehen` (Lookup über `LinkedIn_URL`)
- [ ] **OUT-05**: Branch B — Google Sheets Append Row schreibt Eintrag in Tab `Report-Log` (8 Felder: Datum, 4× Anzahl, Gesamt, Report_gesendet=JA, Fehler=leer)

### Error Handling

- [ ] **ERR-01**: Bei Apify Connections Actor FAILED: Branch A überspringen, kein Sheet-Eintrag, kein Fehler-Mail (stilles Skip)
- [ ] **ERR-02**: Bei Apify Inbox Actor FAILED oder Timeout: Branch B Report trotzdem generieren mit verfügbaren Sheet-Daten + Hinweis im Report, Report-Log mit `Fehler`-Eintrag
- [ ] **ERR-03**: Bei GPT-4o Fehler: Continue on Fail, Fallback-Texte in Code-Node, Report enthält Hinweis
- [ ] **ERR-04**: Error-Notification-Gmail: bei kritischem Workflow-Fehler E-Mail an `REPORT_EMAIL` mit Subject `⚠️ LinkedIn Automation Fehler – [Datum]` und Fehlertext
- [ ] **ERR-05**: Report-Log schreibt `Report_gesendet: NEIN` wenn Gmail-Versand fehlschlägt

## v2 Requirements

### Erweiterte Features (nach Bedarf)

- **V2-01**: LinkedIn-Cookie-Ablauf-Detektion: Auth-Fehler bei Apify-Run erkennen und separates Warning-Mail senden
- **V2-02**: Mehrere LinkedIn-Accounts parallel (separates Credential-Set pro Account)
- **V2-03**: Kampagnen-Tracking: Welche Nachrichtenvorschläge wurden tatsächlich versendet (manuell im Sheet markieren)
- **V2-04**: Wöchentlicher Zusammenfassungs-Report (KPIs: Antwortrate, Konversionsrate pro Kategorie)
- **V2-05**: Automatische Reaktivierung von Leads aus Status `Abgeschlossen` nach 90 Tagen

## Out of Scope

| Feature | Reason |
|---|---|
| Automatischer LinkedIn-Versand | LinkedIn ToS — manueller Versand gewünscht |
| CRM-Integration | PRD explizit ausgeschlossen |
| Mobile Push-Notifications | PRD ausgeschlossen |
| Echtzeit-Verarbeitung | Nur 1× täglich 05:00 Uhr |
| Sequenz-Planung / Kampagnen | PRD ausgeschlossen |

## Traceability

| Requirement | Phase | Workflow | Status |
|---|---|---|---|
| TRIG-01 | Phase 1 | WF1 | Pending |
| TRIG-02 | Phase 1 | WF1 | Pending |
| TRIG-03 | Phase 1 | WF1 | Pending |
| DATA-01 | Phase 1 | WF1 | Pending |
| DATA-02 | Phase 1 | WF1 | Pending |
| DATA-03 | Phase 1 | WF1 | Pending |
| DATA-04 | Phase 1 | WF1 | Pending |
| DATA-05 | Phase 1 | WF1 | Pending |
| API-01 | Phase 1 | WF1 | Pending |
| API-02 | Phase 1 | WF1 | Pending |
| API-03 | Phase 1 | WF1 | Pending |
| API-04 | Phase 1 | WF1 | Pending |
| API-05 | Phase 1 | WF1 | Pending |
| AI-01 | Phase 1 | WF1 | Pending |
| AI-02 | Phase 1 | WF1 | Pending |
| AI-03 | Phase 1 | WF1 | Pending |
| AI-04 | Phase 1 | WF1 | Pending |
| AI-05 | Phase 1 | WF1 | Pending |
| OUT-01 | Phase 1 | WF1 | Pending |
| OUT-02 | Phase 1 | WF1 | Pending |
| OUT-03 | Phase 1 | WF1 | Pending |
| OUT-04 | Phase 1 | WF1 | Pending |
| OUT-05 | Phase 1 | WF1 | Pending |
| ERR-01 | Phase 1 | WF1 | Pending |
| ERR-02 | Phase 1 | WF1 | Pending |
| ERR-03 | Phase 1 | WF1 | Pending |
| ERR-04 | Phase 1 | WF1 | Pending |
| ERR-05 | Phase 1 | WF1 | Pending |

**Coverage:**
- v1 Requirements: 28 total
- Mapped to phases: 28 (alle Phase 1)
- v2 Requirements: 5 (deferred)
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
