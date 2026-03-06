# Requirements: SocialPulse

**Defined:** 2026-03-03
**Core Value:** Wöchentlicher datenbasierter Social Media Report mit Handlungsempfehlungen und Content-Vorschlägen — vollautomatisch für 6 Plattformen.

## v1 Requirements

### Triggers & Inputs

- [ ] **TRIG-01**: Master-Workflow startet per Schedule (Montag 9:00) oder manuell per Webhook
- [ ] **TRIG-02**: Jeder Sub-Workflow ist eigenständig per Webhook auslösbar und liest seine Konfig selbst
- [ ] **TRIG-03**: Master liest Konfig-Tab aus Google Sheet und bestimmt welche Module/Plattformen aktiv sind
- [ ] **TRIG-04**: Dual-Trigger-Logik: Sub-Workflows erkennen ob sie vom Master oder eigenständig gestartet wurden

### Data Processing

- [ ] **DATA-01**: Konfig-Tab lesen: Projektname, aktive Plattformen, aktive Module, Empfänger, Markeninfos
- [ ] **DATA-02**: Plattform-Accounts-Tab lesen: Account-Names, IDs, URLs für aktive Plattformen
- [ ] **DATA-03**: Wettbewerber-Tab lesen: bis zu 3 Wettbewerber pro Plattform, gefiltert nach aktiven Plattformen
- [ ] **DATA-04**: Meta Ads Konfig-Tab lesen: Ad Account ID, Kampagnen-Filter, Zeitraum
- [ ] **DATA-05**: Performance-Daten normalisieren: Alle 6 Plattformen in einheitliches Format (Followers, Impressions, Reach, Engagement, etc.)
- [ ] **DATA-06**: Wochen-zu-Wochen-Vergleich berechnen: Aktuelle Woche vs. Vorwoche (absolut + prozentual)
- [ ] **DATA-07**: 4-Wochen-Durchschnitt berechnen für Trend-Erkennung
- [ ] **DATA-08**: Cross-Plattform-Metriken aggregieren (Engagement-Rate-Ranking, beste/schlechteste Plattform)

### External APIs

- [ ] **API-01**: Instagram-Metriken via Apify Actor (Followers, Posts, Impressions, Reach, Engagement, Story Views, Reels Views)
- [ ] **API-02**: Facebook-Metriken via Graph API Native Node (Page Likes, Post Reach, Engagement, Video Views)
- [ ] **API-03**: TikTok-Metriken via Apify Actor (Followers, Video Views, Likes, Comments, Shares)
- [ ] **API-04**: LinkedIn-Metriken via Apify Actor (Followers, Impressions, Engagement, Clicks)
- [ ] **API-05**: YouTube-Metriken via Native Node + Apify (Subscribers, Views, Watch Time, Impressions, CTR)
- [ ] **API-06**: X/Twitter-Metriken via Apify Actor (Followers, Impressions, Likes, Retweets, Replies)
- [ ] **API-07**: Meta Ads via Graph API (Kampagnen, Anzeigengruppen, Anzeigen: Spend, ROAS, CTR, CPC, Conversions)
- [ ] **API-08**: Wettbewerber-Posts scrapen via Apify (letzte 20 Posts pro Wettbewerber/Plattform, Top 3 nach Engagement)
- [ ] **API-09**: Wettbewerber-Kommentare scrapen via Apify (Top 20 Kommentare pro Top-Post)
- [ ] **API-10**: Bilder generieren via Imagen 4 (Gemini API) — plattformspezifische Auflösungen (IG 1080×1350, FB 1080×1350, LI 1200×627, X 1600×900)
- [ ] **API-11**: Videos generieren via Veo 3 (Gemini API) — 9:16 Format für TikTok (15-30s) und YouTube Shorts (15-60s)

### AI / LLM

- [ ] **AI-01**: Content-Texte generieren via Claude Sonnet 4.5 — pro aktive Plattform, mit plattformspezifischen Regeln (Länge, Ton, Hashtags, CTA)
- [ ] **AI-02**: Meta Ads Performance-Analyse via Claude — Top/Bottom Anzeigen, Budget- und Targeting-Empfehlungen
- [ ] **AI-03**: Wettbewerber-Analyse via Claude — Content-Strategie-Analyse, Sentiment, abgeleitete Content-Ideen (3-5 pro Wettbewerber)
- [ ] **AI-04**: Report-Narrativ generieren via Claude — Executive Summary, Plattform-Performance, Cross-Platform-Vergleich, Empfehlungen, Action Items

### Output & Delivery

- [ ] **OUT-01**: Performance-Daten in Supabase `performance_weekly` schreiben (UPSERT auf project_name + platform + kw + year)
- [ ] **OUT-02**: Performance-Daten in Google Sheet Tab "Performance Aktuell" schreiben
- [ ] **OUT-03**: Meta Ads-Daten in Supabase `meta_ads_weekly` schreiben
- [ ] **OUT-04**: Wettbewerber-Daten in Supabase `competitor_weekly` + Google Sheet Tab "Competitor Insights" schreiben
- [ ] **OUT-05**: Content-Vorschläge in Supabase `content_generated` + Google Sheet Tab "Content Plan" schreiben
- [ ] **OUT-06**: Run-Log in Google Sheet Tab "Run Log" + Supabase `workflow_runs` schreiben
- [ ] **OUT-07**: HTML-Report generieren mit Markenfarben, Trend-Pfeilen, KPI-Tabellen, responsive Design
- [ ] **OUT-08**: PDF-Report aus HTML generieren
- [ ] **OUT-09**: Report per Gmail versenden: HTML-Body + PDF-Anhang an Empfänger + CC aus Konfig-Tab

### Error Handling

- [ ] **ERR-01**: Plattform-Fehler-Isolation: Wenn eine Plattform fehlschlägt, laufen die anderen weiter
- [ ] **ERR-02**: Exponential Backoff Retry: 15s → 30s → 60s, max 3 Versuche bei API-Fehlern
- [ ] **ERR-03**: Strukturierte Fehler-Rückgabe: Jeder Sub-WF gibt `{ success, data, errors }` zurück
- [ ] **ERR-04**: Run-Logging: Alle Fehler in Google Sheet "Run Log" + Supabase `workflow_runs` mit Fehler-Details
- [ ] **ERR-05**: Apify Rate Limiting: Max 2 concurrent Runs, 5s Pause zwischen Aufrufen, 30s Warte bei Rate-Limit

## v2 Requirements

### Multi-Brand

- **MB-01**: Multi-Brand-Unterstützung: Mehrere Projekte/Marken in einem System

### Auto-Publishing

- **PUB-01**: Automatisches Posten der freigegebenen Inhalte auf alle Plattformen
- **PUB-02**: Integration mit Scheduling Tools (Buffer, Hootsuite)

### Advanced Ads

- **ADS-01**: A/B-Test-Automatisierung für Meta Ads
- **ADS-02**: Automatische Budget-Optimierung basierend auf ROAS

### Interface

- **UI-01**: Chatbot-Interface für Abfragen und Ad-hoc-Reports
- **UI-02**: Content Approval Workflow mit Freigabe-Prozess

## Out of Scope

| Feature | Reason |
|---|---|
| SaaS-Frontend | MVP — reine n8n-Automation, kein Next.js/Stripe |
| Auto-Posting | Nur Vorschläge, kein Publishing im v1 |
| Echtzeit-Monitoring | Wöchentliche Batch-Verarbeitung reicht für MVP |
| Multi-Brand | 1 Sheet = 1 Projekt im MVP |
| A/B-Tests für Ads | Komplexität zu hoch für v1 |
| Chatbot/Interface | Google Sheet als UI |
| Budget-Optimierung | Nur Analyse im v1 |
| Scheduling-Tools | Kein Buffer/Hootsuite im v1 |

## Traceability

| Requirement | Phase | Workflow | Status |
|---|---|---|---|
| TRIG-01 | Phase 5 | WF7 Master | Pending |
| TRIG-02 | Phase 1-4 | WF1-WF6 | Pending |
| TRIG-03 | Phase 5 | WF7 Master | Pending |
| TRIG-04 | Phase 1-4 | WF1-WF6 | Pending |
| DATA-01 | Phase 1 | WF1 | Pending |
| DATA-02 | Phase 1 | WF1 | Pending |
| DATA-03 | Phase 2 | WF3 | Pending |
| DATA-04 | Phase 2 | WF2 | Pending |
| DATA-05 | Phase 1 | WF1 | Pending |
| DATA-06 | Phase 4 | WF5 | Pending |
| DATA-07 | Phase 4 | WF5 | Pending |
| DATA-08 | Phase 4 | WF5 | Pending |
| API-01 | Phase 1 | WF1 | Pending |
| API-02 | Phase 1 | WF1 | Pending |
| API-03 | Phase 1 | WF1 | Pending |
| API-04 | Phase 1 | WF1 | Pending |
| API-05 | Phase 1 | WF1 | Pending |
| API-06 | Phase 1 | WF1 | Pending |
| API-07 | Phase 2 | WF2 | Pending |
| API-08 | Phase 2 | WF3 | Pending |
| API-09 | Phase 2 | WF3 | Pending |
| API-10 | Phase 3 | WF4 | Pending |
| API-11 | Phase 3 | WF4 | Pending |
| AI-01 | Phase 3 | WF4 | Pending |
| AI-02 | Phase 2 | WF2 | Pending |
| AI-03 | Phase 2 | WF3 | Pending |
| AI-04 | Phase 4 | WF5 | Pending |
| OUT-01 | Phase 1 | WF1 | Pending |
| OUT-02 | Phase 1 | WF1 | Pending |
| OUT-03 | Phase 2 | WF2 | Pending |
| OUT-04 | Phase 2 | WF3 | Pending |
| OUT-05 | Phase 3 | WF4 | Pending |
| OUT-06 | Phase 5 | WF7 | Pending |
| OUT-07 | Phase 4 | WF5 | Pending |
| OUT-08 | Phase 4 | WF5 | Pending |
| OUT-09 | Phase 4 | WF6 | Pending |
| ERR-01 | Phase 1 | WF1 | Pending |
| ERR-02 | Phase 1 | WF1-WF6 | Pending |
| ERR-03 | Phase 1 | WF1-WF6 | Pending |
| ERR-04 | Phase 5 | WF7 | Pending |
| ERR-05 | Phase 2 | WF3 | Pending |

**Coverage:**
- v1 Requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
