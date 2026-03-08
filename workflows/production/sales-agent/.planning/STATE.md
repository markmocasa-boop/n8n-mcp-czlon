# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Jeder qualifizierte Lead (Score ≥ 30) erhält automatisch eine personalisierte 4-E-Mail-Sequenz.
**Current focus:** Phase 1 — Fundament (WF0 Master + WF6 CRM Updater)

## Current Position

Phase: 1 of 5 (Fundament)
Workflow: Phase 1 vollständig deployed
Status: Phase 1 abgeschlossen — bereit für Verify
Last activity: 2026-03-08 — Alle 7 Workflows via REST API deployed

Progress: [████░░░░░░] 35%

## Deployed Workflows

| WF | Name | n8n ID | Status | Deployed |
|---|---|---|---|---|
| WF6 | Sales Agent — WF6 CRM Updater | HxOD2a8He72tvKmR | Active | 2026-03-08 |
| WF1-Stub | Sales Agent — WF1 Stub (Phase 1) | mPtLL7QxoW1lJKu2 | Active | 2026-03-08 |
| WF2-Stub | Sales Agent — WF2 Stub (Phase 1) | GAqEpcFUuLrKGYFH | Active | 2026-03-08 |
| WF3-Stub | Sales Agent — WF3 Stub (Phase 1) | uWkGHyQQ8FBeqErW | Active | 2026-03-08 |
| WF4-Stub | Sales Agent — WF4 Stub (Phase 1) | O2RnTBvoLAOV4agj | Active | 2026-03-08 |
| WF5-Stub | Sales Agent — WF5 Stub (Phase 1) | bQQfeZfngg6AyuwZ | Active | 2026-03-08 |
| WF0 | Sales Agent — WF0 Master Orchestrator | 58ysZ3NLKZfsMfND | Active | 2026-03-08 |

## Local File Paths

| File | Description |
|---|---|
| `production/sales-agent/WF6-CRM-Updater.json` | Deploy FIRST |
| `production/sales-agent/stubs/WF1-Stub.json` | Deploy second |
| `production/sales-agent/stubs/WF2-Stub.json` | Deploy third |
| `production/sales-agent/stubs/WF3-Stub.json` | Deploy fourth |
| `production/sales-agent/stubs/WF4-Stub.json` | Deploy fifth |
| `production/sales-agent/stubs/WF5-Stub.json` | Deploy sixth |
| `production/sales-agent/WF0-Master-Orchestrator.json` | Deploy LAST (fill in real IDs first) |

**Placeholders to replace in WF0 before deploying:**
- `PLACEHOLDER_WF1_ID`, `PLACEHOLDER_WF2_ID`, `PLACEHOLDER_WF3_ID`
- `PLACEHOLDER_WF4_ID` (2 nodes), `PLACEHOLDER_WF5_ID`, `PLACEHOLDER_WF6_ID` (2 nodes)
- `SALES_AGENT_SHEET_ID` in both WF6 and WF0

## Accumulated Context

### Decisions

- Phase 1: WF6 (CRM Updater) wird VOR WF0 (Master) gebaut — WF6-Webhook-URL muss bekannt sein bevor Master ihn aufrufen kann
- Phase 1: Sub-WF-Kommunikation via n8n Execute Workflow Node (nicht externe Webhooks) für WFs auf selber Instanz
- Phase 2: Apify nutzt nativen n8n Apify Node (in INDEX.md gefunden) + Async-Pattern (starten → polling → Ergebnis)
- Phase 2: Tavily bleibt HTTP Request — kein nativer n8n Node vorhanden
- Alle Phasen: Anthropic Chat Model Node (`nodes-langchain.lmChatAnthropic`) statt HTTP Request zu Anthropic API
- Google Sheets: Spaltennamen mit Umlauten (nächster_kontakt etc.) → im Expression-Test validieren

### Validation Issues

Keine noch.

### Blockers/Concerns

- Google OAuth2 Credential braucht erweiterte Scopes: gmail.modify + gmail.compose + calendar + calendar.events — vor Phase 3/5 prüfen ob bestehende Credential ausreicht oder neue nötig
- Apify Async-Pattern: Actor-Polling kann >30s dauern → Webhook-Timeout beachten; ggf. als separaten WF mit Callback lösen

## Session Continuity

Last session: 2026-03-08
Stopped at: Phase 1 JSONs built. MCP deployment pending.
Next step: `/gsd-n8n:verify-phase 1` — dann Google Sheet erstellen + SALES_AGENT_SHEET_ID in WF6 + WF0 eintragen.
