# Roadmap: LinkedIn Follow-up Automation

## Overview

Wir bauen einen einzelnen n8n-Workflow (`WF1`) mit zwei parallelen Branches. Branch A erkennt neue LinkedIn-Connections und importiert sie automatisch ins Google Sheet. Branch B analysiert bestehende Leads, kategorisiert sie nach Follow-up-Dringlichkeit (4 Kategorien) und generiert mit GPT-4o personalisierte Nachrichtenvorschläge nach der Hormozi 100M Leads Methode. Output: täglicher HTML-Report per Gmail + Sheet-Update + Report-Log. Das Projekt wird in 3 Phasen geliefert.

## Phases

- [ ] **Phase 1: Branch A — Neue Leads erkennen** — Apify Connections Actor, Polling-Loop, Sheet-Abgleich, Auto-Import
- [ ] **Phase 2: Branch B — Analyse & KI-Report** — Apify Inbox Actor, 4-Kategorien-Logik, GPT-4o Hormozi-Analyse, HTML-Report, Gmail, Sheet-Updates
- [ ] **Phase 3: Integration & Error-Handling** — Parallele Branches zusammenführen, vollständiges Error-Handling, Error-Notification-Mail, finales Deploy + Verify

## Phase Details

### Phase 1: Branch A — Neue Leads erkennen

**Goal**: Branch A ist vollständig deploybar und testbar — Schedule Trigger startet, Apify Connections Actor läuft durch, neue LinkedIn-Verbindungen landen automatisch im Google Sheet.
**Depends on**: Nichts (erste Phase)
**Workflows**: WF1 (Branch A)
**Requirements**: TRIG-01, TRIG-02, API-01, API-03, API-05, DATA-01, OUT-01, OUT-02, ERR-01

**Success Criteria:**
1. WF1 deployt und validiert ohne Errors
2. Schedule Trigger feuert um 05:00 Europe/Berlin
3. Apify Connections Actor wird gestartet und polled bis SUCCEEDED
4. Connections-Daten werden abgerufen und mit Sheet-URLs abgeglichen
5. Neue Leads erscheinen als neue Zeilen im Google Sheet Tab `Leads` mit `Quelle: "auto-import"`
6. Bei 0 neuen Leads: keine Aktion, kein Fehler

**Tasks:**
- [ ] 01-01: Templates und vorhandene LinkedIn-Workflows prüfen (`linkedin-dm-tracking-workflow.json`); Apify Actor-Slugs auf apify.com/store verifizieren
- [ ] 01-02: Branch A Workflow JSON bauen (Schedule Trigger → HTTP Request Apify Start → Wait → Polling Loop [IF + Wait 15s + Merge] → HTTP Request Dataset → Code Abgleich → IF → Google Sheets Append)
- [ ] 01-03: Node-Optimierung: HTTP Requests prüfen, ob nativer Apify-Node auf cloud verfügbar (INDEX.md); Credentials setzen
- [ ] 01-04: Validate (n8n-MCP validate_workflow) + Deploy (n8n_create_workflow) + Test-Execution prüfen

---

### Phase 2: Branch B — Analyse & KI-Report

**Goal**: Branch B generiert täglich einen vollständigen HTML-Report mit GPT-4o Hormozi-Vorschlägen, sendet ihn per Gmail und aktualisiert das Google Sheet.
**Depends on**: Phase 1 (WF1 existiert bereits, Branch B wird hinzugefügt)
**Workflows**: WF1 (Branch B ergänzen)
**Requirements**: TRIG-03, DATA-02, DATA-03, DATA-04, DATA-05, API-02, API-04, API-05, AI-01–AI-05, OUT-03, OUT-04, OUT-05

**Success Criteria:**
1. Google Sheets Read lädt alle Leads korrekt (alle 13 Spalten)
2. Apify Inbox Actor läuft durch, Conversations werden korrekt gemappt
3. Kategorisierungs-Logik weist alle 4 Kategorien korrekt zu (Stern / Unbeantwortet / 3 Tage / 5 Tage)
4. GPT-4o liefert valides JSON mit personalisierten Vorschlägen für alle Kontakte
5. HTML-Report ist vollständig und korrekt formatiert (4 Sektionen, Header-Stats, LinkedInURL verlinkt)
6. Gmail-Report kommt an (Subject mit Datum + Anzahl Kontakte)
7. Google Sheet `Leads`: Letzte_Kategorie, Letzter_Report, Zuletzt_gesehen aktualisiert
8. Google Sheet `Report-Log`: neuer Eintrag mit korrekten Zählern

**Tasks:**
- [ ] 02-01: Apify Inbox Actor-Slug verifizieren; OpenAI Message-Node Parameter-Format aus Memory prüfen (fixedCollection kein `values`-Wrapper)
- [ ] 02-02: Branch B Nodes bauen: Google Sheets Read → HTTP Request Apify Inbox → Wait → Polling Loop → HTTP Request Dataset → Code (Merge+Kategorisierung) → OpenAI Node → Code (Parse+Merge) → Code (HTML-Report) → Gmail Send + Google Sheets Update + Google Sheets Append
- [ ] 02-03: Node-Optimierung: nativer Gmail-Node verwenden, nativer Google Sheets-Node verwenden, OpenAI native Node (`@n8n/n8n-nodes-langchain.openAi` oder `nodes-base.openAi`)
- [ ] 02-04: Validate + Update Workflow (n8n_update_full_workflow) + Test mit Dummy-Daten

---

### Phase 3: Integration & Error-Handling

**Goal**: Beide Branches laufen parallel, vollständiges Error-Handling aktiv, Workflow ist produktionsbereit und dokumentiert.
**Depends on**: Phase 1 + Phase 2
**Workflows**: WF1 (final)
**Requirements**: ERR-01, ERR-02, ERR-03, ERR-04, ERR-05

**Success Criteria:**
1. Branch A und Branch B starten parallel nach Schedule Trigger (korrekte Merge/Split-Architektur)
2. Error-Handler-Node feuert bei kritischen Fehlern und sendet Gmail-Notification
3. Report-Log schreibt `Report_gesendet: NEIN` + Fehlertext bei Apify-Ausfall
4. Continue-on-Fail aktiv für Apify Polling + GPT-4o Node
5. Workflow validiert ohne Errors und ohne kritische Warnings
6. Lokale JSON-Datei gespeichert + GitHub Push

**Tasks:**
- [ ] 03-01: Parallele Branch-Architektur prüfen: Split nach Schedule Trigger, beide Branches unabhängig (kein gemeinsamer Merge am Ende nötig)
- [ ] 03-02: Error-Handler-Node hinzufügen (Gmail Notification bei Fehler); Continue-on-Fail aktivieren für Apify Polling + GPT-4o
- [ ] 03-03: Report-Log Fehler-Pfad implementieren (bei Apify FAILED: Report-Log mit `Report_gesendet: NEIN` + Fehlertext)
- [ ] 03-04: Finales Validate (validate_workflow, alle Warnings gegen FALSE_POSITIVES prüfen) + Update Deploy
- [ ] 03-05: JSON lokal speichern unter `workflows/production/linkedin-followup-automation/WF1-LinkedIn-Followup-Master.json` + GitHub Push

## Progress

| Phase | Workflows | Tasks | Status | Deployed |
|---|---|---|---|---|
| 1. Branch A — Neue Leads | WF1 (Branch A) | 0/4 | Not started | - |
| 2. Branch B — KI-Report | WF1 (Branch B) | 0/4 | Not started | - |
| 3. Integration & Error-Handling | WF1 (final) | 0/5 | Not started | - |
