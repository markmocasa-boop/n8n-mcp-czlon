# Roadmap: LinkedIn Outreach Automation

## Overview

Ein einzelner n8n-Workflow (WF1) der via Form Trigger manuell ausgelöst wird, LinkedIn-Connections aus Google Sheets filtert, Profile per Apify scrapt, mit OpenAI personalisierte DMs generiert und die Ergebnisse zurück in Google Sheets schreibt. Kleines Projekt — 1 Workflow, 1 Phase.

## Phases

- [ ] **Phase 1: Core Workflow** - Form Trigger → Filter → Apify Scraping → OpenAI DM → Google Sheets Output

## Phase Details

### Phase 1: Core Workflow

**Goal**: WF1 ist deployed und funktionsfähig — Formular ausfüllen, Workflow läuft, personalisierte DMs landen im Google Sheet
**Depends on**: Nichts (erste Phase)
**Workflows**: WF1
**Requirements**: TRIG-01, TRIG-02, DATA-01, DATA-02, DATA-03, API-01, API-02, API-03, AI-01, AI-02, OUT-01, OUT-02, ERR-01, ERR-02

**Success Criteria:**
1. Form Trigger öffnet Formular mit 4 Feldern (Position, Region, Branche, Mitarbeiteranzahl)
2. Kontakte aus Google Sheets werden korrekt nach Filterparametern gefiltert
3. Apify scrapt LinkedIn-Profil und gibt Headline, About, Position zurück
4. OpenAI generiert eine personalisierte DM (max. 300 Wörter) mit Profil-Bezug und Frage am Ende
5. Output-Sheet erhält neue Zeile: Name, Firma, URL, DM, Status="Entwurf", Timestamp
6. Fehlerfall (kein URL / Apify-Fehler) wird behandelt, kein Workflow-Absturz

**Tasks:**
- [ ] 01-01: Templates recherchieren (Sales Cold Calling Pipeline + LinkedIn Content Template als Referenz)
- [ ] 01-02: Node-Verfügbarkeit prüfen (Apify, Google Sheets, Form Trigger, OpenAI)
- [ ] 01-03: WF1 Workflow JSON bauen
- [ ] 01-04: Node-Optimierung (HTTP Requests durch native/Community Nodes ersetzen)
- [ ] 01-05: Credentials setzen (Google Sheets, Apify, OpenAI)
- [ ] 01-06: Validierung via n8n-MCP
- [ ] 01-07: Deployment via n8n-MCP
- [ ] 01-08: JSON lokal speichern + GitHub push

## Progress

| Phase | Workflows | Tasks | Status | Deployed |
|---|---|---|---|---|
| 1. Core Workflow | WF1 | 0/8 | Not started | - |
