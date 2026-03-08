# Roadmap: Sales Agent — KI-gestützter B2B Sales Automation System

## Overview

8 Workflows (1 Master + 7 Sub-Workflows) bilden einen vollautomatischen B2B-Sales-Agenten für den DACH-Markt. Der Master-Orchestrator koordiniert Lead-Enrichment, KI-Scoring, E-Mail-Sequenz-Generierung und -Versand sowie LinkedIn-Content-Erstellung. Ein eigenständiger Inbox-Manager überwacht den Posteingang, erkennt Terminwünsche und erstellt Antwort-Drafts. Das Endresultat: Kein Lead unter Score 30 wird kontaktiert, jeder qualifizierte Lead erhält eine personalisierte 4-E-Mail-Sequenz mit LinkedIn-Begleitung — vollautomatisch, mit manuellem Review aller ausgehenden Antworten.

**Phasen-Logik:**
- Phase 1: Fundament (Master + CRM-Updater) — WF6 muss zuerst deployed sein, da alle anderen WFs es aufrufen
- Phase 2: Datenanreicherung & Scoring (WF1 + WF2) — hängt von WF6 ab
- Phase 3: E-Mail-Maschinerie (WF3 + WF4) — hängt von WF1+WF2 ab
- Phase 4: LinkedIn-Content (WF5) — parallel zu Phase 3 möglich, aber nach Phase 2
- Phase 5: Inbox & Calendar Manager (WF7) — komplex, eigenständig, letzter Schritt

## Phases

- [x] **Phase 1: Fundament** — Master Orchestrator + CRM Updater deploybar, Loop-Struktur valide ✓ VERIFIED 2026-03-08
- [x] **Phase 2: Enrichment & Scoring** — Lead-Anreicherung via Tavily/Apify + Claude-Scoring funktioniert ✓ VERIFIED 2026-03-08
- [x] **Phase 3: E-Mail-Maschinerie** — 4-E-Mail-Sequenz wird generiert und zeitgesteuert versendet ✓ VERIFIED 2026-03-08
- [x] **Phase 4: LinkedIn Content** — DM + Post-Idee werden generiert und ins CRM geschrieben ✓ VERIFIED 2026-03-08
- [ ] **Phase 5: Inbox & Calendar Manager** — Posteingang-Monitoring, Termin-Erkennung, Draft-Erstellung

---

## Phase Details

### Phase 1: Fundament

**Goal**: WF0 (Master Orchestrator) und WF6 (CRM Updater) sind deployed und valide. Der Master liest Leads, filtert, loopt und kann Sub-Workflows aufrufen. WF6 kann Google Sheets-Updates und Log-Einträge schreiben.
**Depends on**: Nichts (erste Phase)
**Workflows**: WF0 Master Orchestrator, WF6 CRM Updater
**Requirements**: TRIG-01, TRIG-02, DATA-01, DATA-09, OUT-03, OUT-04, ERR-01

**Success Criteria**:
1. WF0 deployt, validiert ohne Fehler, startet manuell + via Cron
2. WF0 liest Leads-Tab und filtert korrekt nach Status "Neu"/"In Sequenz"
3. WF0 Loop iteriert über jeden Lead mit 3–5 Sek. Pause
4. WF6 empfängt Update-Payload (lead_id + Felder), findet die richtige Sheet-Zeile, schreibt Updates
5. WF6 schreibt Sequenz_Log-Eintrag (timestamp, lead_id, aktion, inhalt, status)

**Tasks:**
- [ ] 01-01: Templates recherchieren — Google Sheets Loop-Pattern + Sub-WF-Aufruf-Pattern
- [ ] 01-02: WF6 (CRM Updater) JSON bauen — Webhook-Trigger, Sheet-Lookup via lead_id, Update, Log
- [ ] 01-03: WF6 optimieren (native Nodes prüfen) + Credentials setzen
- [ ] 01-04: WF6 validieren und deployen
- [ ] 01-05: WF0 (Master Orchestrator) JSON bauen — Cron + Manuell, Sheets-Read, Filter, Loop, Execute Workflow Calls
- [ ] 01-06: WF0 optimieren + Credentials setzen (WF6-URL als Variable)
- [ ] 01-07: WF0 validieren und deployen

---

### Phase 2: Enrichment & Scoring

**Goal**: WF1 (Lead Enrichment) und WF2 (Lead Scoring) sind deployed. Ein Lead wird angereichert (Website-Analyse + LinkedIn-Daten) und erhält einen validen Score mit JSON-Rückgabe an den Master.
**Depends on**: Phase 1 (WF6 deployed)
**Workflows**: WF1 Lead Enrichment, WF2 Lead Scoring
**Requirements**: API-01, API-02, DATA-02, AI-01, DATA-03, ERR-03, ERR-04, ERR-05

**Success Criteria**:
1. WF1 empfängt Lead-Daten via Webhook, führt Tavily-Suche durch (wenn Website vorhanden)
2. WF1 startet Apify-Actor async, pollt bis Ergebnis verfügbar (max. 3 Min Timeout)
3. WF1 gibt strukturiertes JSON zurück (unternehmens_beschreibung, aktuelle_herausforderungen, linkedin_headline, linkedin_about)
4. WF2 empfängt Lead + Enrichment-Daten, ruft Claude auf, erhält valides Score-JSON
5. WF2 routet korrekt: Score < 30 → Kalt-Status, 30–79 → Standard, ≥ 80 → Premium

**Tasks:**
- [ ] 02-01: Templates recherchieren — Apify Async-Pattern + Tavily HTTP-Request-Pattern
- [ ] 02-02: WF1 JSON bauen — Webhook, IF-Nodes für Website/LinkedIn, Tavily HTTP Request, Apify Node (async)
- [ ] 02-03: WF1 optimieren (Apify nativer Node prüfen) + Credentials setzen
- [ ] 02-04: WF1 validieren und deployen
- [ ] 02-05: WF2 JSON bauen — Webhook, Anthropic Chat Model Node, JSON-Parser, IF-Routing nach Score
- [ ] 02-06: WF2 optimieren + Credentials setzen (Anthropic Credential)
- [ ] 02-07: WF2 validieren und deployen
- [ ] 02-08: WF0 updaten — WF1+WF2 Webhook-URLs als $vars eintragen

---

### Phase 3: E-Mail-Maschinerie

**Goal**: WF3 (Sequenz Generator) und WF4 (E-Mail Sender) sind deployed. Ein Lead mit Score ≥ 30 erhält eine 4-E-Mail-Sequenz, E-Mail 1 wird sofort gesendet, Folge-E-Mails werden zeitgesteuert geplant.
**Depends on**: Phase 2 (WF1+WF2 deployed, Score-Routing funktioniert)
**Workflows**: WF3 E-Mail Sequenz Generator, WF4 E-Mail Sender
**Requirements**: AI-02, AI-03, AI-04, AI-05, DATA-04, API-03, DATA-05, OUT-01, OUT-02, ERR-02, AI-11

**Success Criteria**:
1. WF3 generiert 4 E-Mails als valides JSON (inkl. 3 Betreff-Varianten für E-Mail 1)
2. WF3 verwendet korrekten Ton je nach Score-Klassifikation (Standard vs. Premium)
3. WF4 prüft `antwort_erhalten` vor jedem Versand — stoppt Sequenz wenn TRUE
4. WF4 prüft `nächster_kontakt` Datum — sendet nur wenn Datum = heute
5. WF4 setzt `email_X_gesendet = TRUE`, `letzter_kontakt`, `nächster_kontakt` via WF6
6. WF4 retry-Logik: 2x bei Gmail-Fehler, 30 Min Pause

**Tasks:**
- [ ] 03-01: Templates recherchieren — Gmail AI Auto-Responder Template als Basis, Claude-Prompt-Patterns
- [ ] 03-02: WF3 JSON bauen — Webhook, 4× Anthropic Chat Model Nodes (sequenziell), JSON-Aggregation
- [ ] 03-03: WF3 optimieren (Anthropic nativer Node) + Credentials setzen
- [ ] 03-04: WF3 validieren und deployen
- [ ] 03-05: WF4 JSON bauen — Webhook, Sheet-Check (antwort_erhalten + Datum), Gmail Node, WF6-Call, Retry-Logik
- [ ] 03-06: WF4 optimieren + Credentials setzen (Gmail OAuth2)
- [ ] 03-07: WF4 validieren und deployen
- [ ] 03-08: WF0 updaten — WF3+WF4 URLs einbinden, E-Mail-Versandzeitplan-Logik

---

### Phase 4: LinkedIn Content

**Goal**: WF5 (LinkedIn Content Generator) ist deployed. Pro Lead werden eine LinkedIn-DM (max. 300 Zeichen) und eine LinkedIn-Post-Idee generiert und ins CRM geschrieben.
**Depends on**: Phase 2 (Score + Enrichment-Daten vorhanden)
**Workflows**: WF5 LinkedIn Content Generator
**Requirements**: AI-06, AI-07, OUT-08, AI-11

**Success Criteria**:
1. WF5 generiert LinkedIn-DM ≤ 300 Zeichen (kein Pitch, modernes Deutsch)
2. WF5 generiert LinkedIn-Post-Idee (Hook + Absätze + Community-Frage, 150–250 Wörter)
3. WF5 schreibt DM-Text via WF6 in Spalte V (linkedin_nachricht) des Leads-Tab
4. WF5 loggt Aktivität im Sequenz_Log

**Tasks:**
- [ ] 04-01: WF5 JSON bauen — Webhook, 2× Anthropic Chat Model Nodes (DM + Post), WF6-Call für CRM-Update
- [ ] 04-02: WF5 optimieren + Credentials setzen
- [ ] 04-03: WF5 validieren und deployen
- [ ] 04-04: WF0 updaten — WF5 in Master-Loop einbinden (parallel zu WF3/WF4 für "Neu"-Leads)

---

### Phase 5: Inbox & Calendar Manager

**Goal**: WF7 ist deployed mit beiden Cron-Triggern. Eingehende Lead-E-Mails werden erkannt, Thread-Kontext aufgebaut, Terminwünsche erkannt, Google Calendar-Termin angelegt, Antwort-Draft erstellt. Termin-Vorbereitung läuft täglich um 07:00.
**Depends on**: Phase 1–4 (CRM-Updater + alle Lead-Daten vorhanden)
**Workflows**: WF7 Inbox & Calendar Manager
**Requirements**: TRIG-03, TRIG-04, DATA-06, DATA-07, DATA-08, API-03, API-04, API-05, AI-08, AI-09, AI-10, OUT-05, OUT-06, OUT-07, ERR-03, ERR-04

**Success Criteria**:
1. WF7 (15-Min-Cron) ruft ungelesene E-Mails ab und filtert bekannte Leads
2. Thread-Kontext wird vollständig aufgebaut (chronologisch sortiert)
3. Claude erkennt Terminwunsch korrekt (JSON mit terminwunsch_erkannt + konfidenz)
4. Google Calendar: Freebusy-Query + Termin anlegen mit Attendee + 2 Reminders
5. Tab "Termine" wird vollständig befüllt (alle 15 Felder)
6. Gmail-Draft erstellt (NICHT gesendet), `draft_erstellt = TRUE` im Sheet
7. Deduplizierung: kein Doppel-Draft für selbe messageId
8. WF7 (07:00-Cron) lädt Termine für morgen, generiert Vorbereitung, speichert in Agenda-Spalte

**Tasks:**
- [ ] 05-01: Templates recherchieren — Gmail AI Auto-Responder + Google Calendar Patterns
- [ ] 05-02: WF7 Inbox-Teil JSON bauen — Cron, Gmail Trigger (unread), Sheets-Lookup, Thread-Fetch, Merge
- [ ] 05-03: WF7 Claude-Knoten bauen — Terminwunsch-Erkennung + Draft-Generierung (mit/ohne Termin)
- [ ] 05-04: WF7 Calendar-Teil bauen — Freebusy-Query, Termin anlegen, Tab "Termine" Append
- [ ] 05-05: WF7 Draft-Teil bauen — Gmail createDraft, Deduplizierung via messageId, WF6-Update
- [ ] 05-06: WF7 Termin-Vorbereitung bauen — 07:00-Cron, Termine-Tab lesen, Claude, Agenda schreiben
- [ ] 05-07: WF7 optimieren (native Nodes: Gmail, Google Calendar, Google Sheets) + Credentials
- [ ] 05-08: WF7 validieren und deployen mit Test-E-Mail-Adresse

---

## Progress

| Phase | Workflows | Tasks | Status | Deployed |
|---|---|---|---|---|
| 1. Fundament | WF0, WF6 | 7/7 | ✓ Verified | 2026-03-08 |
| 2. Enrichment & Scoring | WF1, WF2 | 8/8 | ✓ Verified | 2026-03-08 |
| 3. E-Mail-Maschinerie | WF3, WF4 | 8/8 | ✓ Verified | 2026-03-08 |
| 4. LinkedIn Content | WF5 | 4/4 | ✓ Verified | 2026-03-08 |
| 5. Inbox & Calendar Manager | WF7 | 0/8 | Not started | - |

**Gesamt**: 8 Workflows, 35 Tasks, 0% abgeschlossen

---
*Roadmap erstellt: 2026-03-08*
