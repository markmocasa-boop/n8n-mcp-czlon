# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Jeder qualifizierte Lead (Score ≥ 30) erhält automatisch eine personalisierte 4-E-Mail-Sequenz.
**Current focus:** Phase 2 — Enrichment & Scoring (WF1 + WF2)

## Current Position

Phase: 1 of 5 (Fundament) — VERIFIED
Workflow: Phase 1 vollständig verified
Status: Phase 1 PASS WITH WARNINGS — bereit für Phase 2
Last activity: 2026-03-08 — Phase 1 verification abgeschlossen (0 Errors, 3 accepted warnings)

Progress: [████░░░░░░] 40%

## Deployed Workflows

| WF | Name | n8n ID | Status | Deployed | Verified |
|---|---|---|---|---|---|
| WF6 | Sales Agent — WF6 CRM Updater | HxOD2a8He72tvKmR | Active | 2026-03-08 | PASS |
| WF1-Stub | Sales Agent — WF1 Stub (Phase 1) | mPtLL7QxoW1lJKu2 | Active | 2026-03-08 | PASS |
| WF2-Stub | Sales Agent — WF2 Stub (Phase 1) | GAqEpcFUuLrKGYFH | Active | 2026-03-08 | PASS |
| WF3-Stub | Sales Agent — WF3 Stub (Phase 1) | uWkGHyQQ8FBeqErW | Active | 2026-03-08 | PASS |
| WF4-Stub | Sales Agent — WF4 Stub (Phase 1) | O2RnTBvoLAOV4agj | Active | 2026-03-08 | PASS |
| WF5-Stub | Sales Agent — WF5 Stub (Phase 1) | bQQfeZfngg6AyuwZ | Active | 2026-03-08 | PASS |
| WF0 | Sales Agent — WF0 Master Orchestrator | 58ysZ3NLKZfsMfND | Active | 2026-03-08 | PASS |

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

**Placeholders still needed (not yet a blocker, but required before live testing):**
- `SALES_AGENT_SHEET_ID` in both WF6 (HxOD2a8He72tvKmR) and WF0 (58ysZ3NLKZfsMfND) — user must create Google Sheet first

## Accumulated Context

### Decisions

- Phase 1: WF6 (CRM Updater) wird VOR WF0 (Master) gebaut — WF6-Webhook-URL muss bekannt sein bevor Master ihn aufrufen kann
- Phase 1: Sub-WF-Kommunikation via n8n Execute Workflow Node (nicht externe Webhooks) für WFs auf selber Instanz
- Phase 2: Apify nutzt nativen n8n Apify Node (in INDEX.md gefunden) + Async-Pattern (starten → polling → Ergebnis)
- Phase 2: Tavily bleibt HTTP Request — kein nativer n8n Node vorhanden
- Alle Phasen: Anthropic Chat Model Node (`nodes-langchain.lmChatAnthropic`) statt HTTP Request zu Anthropic API
- Google Sheets: Spaltennamen mit Umlauten (nächster_kontakt etc.) → im Expression-Test validieren

### Validation Issues (Phase 1 — all resolved/accepted)

- SALES_AGENT_SHEET_ID placeholder in WF6 + WF0 — expected, user action required
- WF0 Merge trigger uses output "input1" (passThrough) — acceptable, trigger data unused
- WF6 IF boolean unary operator — auto-sanitized by n8n on save

### Blockers/Concerns

- **REQUIRED BEFORE LIVE TESTING**: Google Sheet must be created, SALES_AGENT_SHEET_ID must be filled in WF6 + WF0
- Google OAuth2 Credential braucht erweiterte Scopes: gmail.modify + gmail.compose + calendar + calendar.events — vor Phase 3/5 prüfen ob bestehende Credential ausreicht oder neue nötig
- Apify Async-Pattern: Actor-Polling kann >30s dauern → Webhook-Timeout beachten; ggf. als separaten WF mit Callback lösen

## Session Continuity

Last session: 2026-03-08
Stopped at: Phase 1 verification complete. PASS WITH WARNINGS.
Next step: `/gsd-n8n:plan-phase 2` — dann WF1 (Lead Enrichment) + WF2 (Lead Scoring) bauen.
Pre-condition: Google Sheet erstellen + SALES_AGENT_SHEET_ID eintragen (kann parallel zu Phase 2 Planung passieren).
