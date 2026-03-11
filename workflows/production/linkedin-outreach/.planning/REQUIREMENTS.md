# Requirements: LinkedIn Outreach Automation

**Defined:** 2026-03-11
**Core Value:** Personalisierte DM pro gefiltertem Kontakt, basierend auf LinkedIn-Profil-Analyse

## v1 Requirements

### Triggers & Inputs

- [ ] **TRIG-01**: n8n Form Trigger mit 4 Feldern: Position (Text), Region (Text), Branche (Text), Mitarbeiteranzahl (Text/Auswahl) — manuell auslösbar
- [ ] **TRIG-02**: Google Sheets enthält importierte LinkedIn-Connections mit Spalten: FirstName, LastName, EmailAddress, Company, Position, ConnectedOn, LinkedInURL

### Data Processing

- [ ] **DATA-01**: Filter-Node wendet Formular-Parameter auf Kontaktliste an (Position ENTHÄLT, Branche ENTHÄLT, Region ENTHÄLT, Mitarbeiteranzahl ENTHÄLT) — Leerfelder = kein Filter auf dieser Spalte
- [ ] **DATA-02**: Loop über gefilterte Kontakte (SplitInBatches, 1 Item pro Batch um Rate Limits zu respektieren)
- [ ] **DATA-03**: Apify-Response wird geparst: Headline, Summary/About, aktuelle Position, Unternehmen, Skills, letzte Posts (wenn vorhanden)

### External APIs

- [ ] **API-01**: Apify LinkedIn Profile Scraper — Input: LinkedIn URL, Output: Profil-JSON (Headline, About, Experience, Skills)
- [ ] **API-02**: Google Sheets lesen — Source Sheet mit Connections-Daten
- [ ] **API-03**: Google Sheets schreiben — Output Sheet mit generierten DMs

### AI / LLM

- [ ] **AI-01**: OpenAI gpt-4o-mini analysiert LinkedIn-Profil-Daten und generiert personalisierte DM (max. 300 Wörter) mit: Bezug auf Profil, Dienstleistung "Effizienz/Effizienzsteigerung", mögliche Pain-Points, Gemeinsamkeiten, 1 offene Frage am Ende
- [ ] **AI-02**: DM-Prompt enthält Kontext: Absender ist Markus, bietet Effizienzdienstleistungen an, Ton: professionell aber persönlich, kein Spam-Gefühl

### Output & Delivery

- [ ] **OUT-01**: Ergebnis-Row in Google Sheets schreiben: FirstName, LastName, Company, Position, LinkedInURL, GeneratedDM, Status="Entwurf", GeneratedAt (Timestamp)
- [ ] **OUT-02**: Falls Apify-Scraping fehlschlägt: DM trotzdem generieren aus verfügbaren Sheets-Daten (Name, Firma, Position) ohne Profil-Details

### Error Handling

- [ ] **ERR-01**: Apify-Fehler (kein Profil gefunden, Rate Limit): Fallback auf Basis-DM aus Sheets-Daten, Status="Fallback" in Output-Sheet
- [ ] **ERR-02**: Kontakte ohne LinkedInURL überspringen (IF-Node), Status="Kein URL" im Sheet

## v2 Requirements

### Erweiterungen (nach erstem Einsatz)

- **V2-01**: Deduplizierung — bereits angeschriebene Kontakte nicht erneut generieren (Status-Check)
- **V2-02**: A/B-Testing — 2 DM-Varianten pro Kontakt generieren
- **V2-03**: Automatischer LinkedIn-Versand (wenn ToS-Bedenken geklärt)

## Out of Scope

| Feature | Reason |
|---|---|
| LinkedIn-Versand | Manuell gewünscht, ToS |
| E-Mail-Outreach | Nicht angefragt |
| CRM-Integration | v2 |

## Traceability

| Requirement | Phase | Workflow | Status |
|---|---|---|---|
| TRIG-01 | Phase 1 | WF1 | Pending |
| TRIG-02 | Phase 1 | WF1 | Pending |
| DATA-01 | Phase 1 | WF1 | Pending |
| DATA-02 | Phase 1 | WF1 | Pending |
| DATA-03 | Phase 1 | WF1 | Pending |
| API-01 | Phase 1 | WF1 | Pending |
| API-02 | Phase 1 | WF1 | Pending |
| API-03 | Phase 1 | WF1 | Pending |
| AI-01 | Phase 1 | WF1 | Pending |
| AI-02 | Phase 1 | WF1 | Pending |
| OUT-01 | Phase 1 | WF1 | Pending |
| OUT-02 | Phase 1 | WF1 | Pending |
| ERR-01 | Phase 1 | WF1 | Pending |
| ERR-02 | Phase 1 | WF1 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
