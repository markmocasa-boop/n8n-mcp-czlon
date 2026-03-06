# Roadmap: SocialPulse

## Overview

SocialPulse besteht aus 7 Workflows (1 Master + 6 Sub-Workflows) die in 5 Phasen aufgebaut werden. Jede Phase liefert deploybare Workflows mit eigenständiger Webhook-Auslösung. Phase 5 verbindet alles über den Master-Workflow. Endresultat: Vollautomatische wöchentliche Social Media Analyse + Content-Erstellung + Reporting für 6 Plattformen.

## Phases

- [ ] **Phase 1: Performance Data Foundation** - WF1 Performance Collector + Supabase Schema + Google Sheet Setup
- [ ] **Phase 2: Data Sources** - WF2 Meta Ads Analyzer + WF3 Competitor Monitor
- [ ] **Phase 3: AI Content Creation** - WF4 Content Creator (Text + Bilder + Videos)
- [ ] **Phase 4: Reporting & Delivery** - WF5 Report Generator + WF6 Report Sender
- [ ] **Phase 5: Master Orchestrator** - WF7 SocialPulse Controller + End-to-End Integration

## Phase Details

### Phase 1: Performance Data Foundation

**Goal**: WF1 Performance Collector deployed und funktional. Supabase-Tabellen erstellt. Google Sheet mit 8 Tabs konfiguriert. Performance-Daten von 6 Plattformen werden gesammelt, normalisiert, in Supabase + Google Sheet geschrieben.
**Depends on**: Nothing (Grundlage für alles)
**Workflows**: WF1
**Requirements**: TRIG-02, TRIG-04, DATA-01, DATA-02, DATA-05, API-01, API-02, API-03, API-04, API-05, API-06, OUT-01, OUT-02, ERR-01, ERR-02, ERR-03
**Credentials needed**: Google Sheets, Supabase, Apify, Meta OAuth, YouTube OAuth
**Success Criteria**:
  1. Supabase-Tabellen `performance_weekly` + `workflow_runs` existieren
  2. Google Sheet mit allen 8 Tabs existiert (Konfig befüllt, Rest leer)
  3. WF1 deployed, validiert ohne Fehler
  4. WF1 per Webhook auslösbar, liest Konfig aus Sheet
  5. Performance-Daten für mindestens 1 Plattform in Supabase + Sheet geschrieben
  6. Fehler-Isolation: Ausfall einer Plattform stoppt nicht die anderen

**Tasks:**
- [ ] 01-01: Supabase-Tabellen erstellen (performance_weekly, workflow_runs, + Schema für spätere Tabellen)
- [ ] 01-02: Google Sheet erstellen mit 8 Tabs + Konfig-Tab befüllen
- [ ] 01-03: Templates recherchieren + Node-Verfügbarkeit prüfen für WF1
- [ ] 01-04: WF1 Performance Collector bauen (Dual-Trigger, Konfig-Lesen, 6 Plattform-Branches)
- [ ] 01-05: Nodes optimieren (HTTP Requests → native Nodes wo möglich)
- [ ] 01-06: Validierung + Deployment WF1

### Phase 2: Data Sources

**Goal**: WF2 Meta Ads Analyzer + WF3 Competitor Monitor deployed. Ads-Daten und Wettbewerber-Insights werden gesammelt, via Claude analysiert, in Supabase + Sheet gespeichert.
**Depends on**: Phase 1 (Google Sheet + Supabase Schema + Konfig-Struktur)
**Workflows**: WF2, WF3
**Requirements**: TRIG-02, TRIG-04, DATA-03, DATA-04, API-07, API-08, API-09, AI-02, AI-03, OUT-03, OUT-04, ERR-02, ERR-05
**Credentials needed**: Meta OAuth (Ads), Anthropic API Key, Apify
**Success Criteria**:
  1. Supabase-Tabellen `meta_ads_weekly` + `competitor_weekly` existieren
  2. WF2 deployed, liest Meta Ads Konfig aus Sheet, liefert Kampagnen-Analyse
  3. WF3 deployed, scrapt Wettbewerber via Apify, generiert Content-Ideen via Claude
  4. Beide per Webhook einzeln auslösbar
  5. Apify Rate Limiting implementiert (2 concurrent, 5s Pause)

**Tasks:**
- [ ] 02-01: Supabase-Tabellen meta_ads_weekly + competitor_weekly erstellen
- [ ] 02-02: Templates recherchieren für Ads-Analyse + Competitor Monitoring
- [ ] 02-03: WF2 Meta Ads Analyzer bauen (Graph API, Claude-Analyse, Supabase-Write)
- [ ] 02-04: WF3 Competitor Monitor bauen (Apify Scraping, Claude-Analyse, Rate Limiting)
- [ ] 02-05: Nodes optimieren für WF2 + WF3
- [ ] 02-06: Validierung + Deployment WF2 + WF3

### Phase 3: AI Content Creation

**Goal**: WF4 Content Creator deployed. Generiert plattformspezifischen Content (Text via Claude, Bilder via Imagen 4, Videos via Veo 3) basierend auf Performance-Daten und Competitor-Insights.
**Depends on**: Phase 1 (Performance-Daten) + Phase 2 (Competitor-Insights)
**Workflows**: WF4
**Requirements**: TRIG-02, TRIG-04, API-10, API-11, AI-01, OUT-05
**Credentials needed**: Anthropic API Key, Google Gemini API Key
**Success Criteria**:
  1. Supabase-Tabelle `content_generated` existiert
  2. WF4 deployed, generiert Content für mindestens 1 Plattform
  3. Plattformspezifische Regeln umgesetzt (Textlänge, Hashtags, Format, Ton)
  4. Bilder in korrekter Auflösung generiert (IG 1080×1350, LI 1200×627, etc.)
  5. Video-Konzepte für TikTok/YouTube erstellt (Veo 3)
  6. Content als "Entwurf" in Sheet + Supabase gespeichert

**Tasks:**
- [ ] 03-01: Supabase-Tabelle content_generated erstellen
- [ ] 03-02: Templates recherchieren für Multi-Platform Content + Imagen/Veo
- [ ] 03-03: WF4 Content Creator bauen (Claude-Prompts, plattformspezifische Regeln)
- [ ] 03-04: Imagen 4 Bild-Generierung integrieren (Gemini API, 4 Plattformen)
- [ ] 03-05: Veo 3 Video-Generierung integrieren (TikTok + YouTube Shorts)
- [ ] 03-06: Nodes optimieren für WF4
- [ ] 03-07: Validierung + Deployment WF4

### Phase 4: Reporting & Delivery

**Goal**: WF5 Report Generator + WF6 Report Sender deployed. Wöchentlicher HTML+PDF-Report mit Vergleichen (Vorwoche + 4 Wochen), Cross-Platform-Analyse und Empfehlungen wird generiert und per Gmail versendet.
**Depends on**: Phase 1-3 (alle Datenquellen + Content-Vorschläge)
**Workflows**: WF5, WF6
**Requirements**: DATA-06, DATA-07, DATA-08, AI-04, OUT-07, OUT-08, OUT-09
**Credentials needed**: Anthropic API Key, Gmail OAuth
**Success Criteria**:
  1. WF5 deployed, generiert HTML-Report mit KPI-Tabellen und Trend-Pfeilen
  2. WF5 berechnet WoW-Vergleiche + 4-Wochen-Durchschnitte korrekt
  3. PDF-Version des Reports wird generiert
  4. WF6 deployed, versendet E-Mail mit HTML-Body + PDF-Anhang
  5. Empfänger + CC aus Konfig-Tab gelesen
  6. Betreff-Format: "SocialPulse Report | {Marke} | KW {kw}/{jahr}"

**Tasks:**
- [ ] 04-01: Templates recherchieren für Report-Generierung + HTML-to-PDF
- [ ] 04-02: WF5 Report Generator bauen (Supabase-Reads, Vergleichslogik, Claude-Analyse)
- [ ] 04-03: HTML-Report-Template erstellen (responsive, Markenfarben, Trend-Pfeile, Tabellen)
- [ ] 04-04: PDF-Generierung integrieren (HTML-to-PDF)
- [ ] 04-05: WF6 Report Sender bauen (Gmail, Empfänger aus Konfig, PDF-Anhang)
- [ ] 04-06: Nodes optimieren für WF5 + WF6
- [ ] 04-07: Validierung + Deployment WF5 + WF6

### Phase 5: Master Orchestrator

**Goal**: WF7 SocialPulse Controller deployed. Orchestriert alle 6 Sub-Workflows in korrekter Reihenfolge (parallel wo möglich), basierend auf Konfig-Tab. End-to-End Test des gesamten Systems.
**Depends on**: Phase 1-4 (alle Sub-Workflows deployed)
**Workflows**: WF7
**Requirements**: TRIG-01, TRIG-03, OUT-06, ERR-04
**Credentials needed**: Google Sheets
**Success Criteria**:
  1. WF7 deployed mit Schedule-Trigger (Montag 9:00) + Webhook
  2. Konfig-Tab steuert welche Module ausgeführt werden
  3. Ausführungsreihenfolge korrekt: WF1+WF2+WF3 → WF4 → WF5 → WF6
  4. Parallele Ausführung von WF1+WF2+WF3 funktioniert
  5. Status-Update + Run Log nach jedem Durchlauf
  6. End-to-End: Vom Trigger bis zur E-Mail mit Report — alles funktioniert

**Tasks:**
- [ ] 05-01: WF7 Master Controller bauen (Schedule, Webhook, Konfig-Lesen, Sub-WF-Aufrufe)
- [ ] 05-02: Parallele + sequentielle Ausführungslogik implementieren
- [ ] 05-03: Error Handling + Status-Updates + Run Log
- [ ] 05-04: Nodes optimieren für WF7
- [ ] 05-05: Validierung + Deployment WF7
- [ ] 05-06: End-to-End Test: Kompletter Durchlauf mit echten Daten

## Progress

| Phase | Workflows | Tasks | Status | Deployed |
|---|---|---|---|---|
| 1. Performance Data Foundation | WF1 | 0/6 | Not started | - |
| 2. Data Sources | WF2, WF3 | 0/6 | Not started | - |
| 3. AI Content Creation | WF4 | 0/7 | Not started | - |
| 4. Reporting & Delivery | WF5, WF6 | 0/7 | Not started | - |
| 5. Master Orchestrator | WF7 | 0/6 | Not started | - |
