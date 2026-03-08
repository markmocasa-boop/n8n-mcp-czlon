# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Jeder qualifizierte Lead (Score ≥ 30) erhält automatisch eine personalisierte 4-E-Mail-Sequenz.
**Current focus:** Phase 3 — E-Mail-Maschinerie (WF3 + WF4)

## Current Position

Phase: 2 of 5 (Enrichment & Scoring) — VERIFIED
Workflow: WF1 Lead Enrichment + WF2 Lead Scoring deployed and verified
Status: Phase 2 complete — bereit für Phase 3
Last activity: 2026-03-08 — Phase 2 verification abgeschlossen (WF2 fix: score thresholds)

Progress: [█████░░░░░] 50%

## Deployed Workflows

| WF | Name | n8n ID | Status | Deployed | Verified |
|---|---|---|---|---|---|
| WF6 | Sales Agent — WF6 CRM Updater | HxOD2a8He72tvKmR | Active | 2026-03-08 | PASS |
| WF1 | Sales Agent — WF1 Lead Enrichment | mPtLL7QxoW1lJKu2 | Inactive | 2026-03-08 | PASS |
| WF2 | Sales Agent — WF2 Lead Scoring | GAqEpcFUuLrKGYFH | Inactive | 2026-03-08 | PASS |
| WF3-Stub | Sales Agent — WF3 Stub (Phase 1) | uWkGHyQQ8FBeqErW | Active | 2026-03-08 | PASS |
| WF4-Stub | Sales Agent — WF4 Stub (Phase 1) | O2RnTBvoLAOV4agj | Active | 2026-03-08 | PASS |
| WF5-Stub | Sales Agent — WF5 Stub (Phase 1) | bQQfeZfngg6AyuwZ | Active | 2026-03-08 | PASS |
| WF0 | Sales Agent — WF0 Master Orchestrator | 58ysZ3NLKZfsMfND | Active | 2026-03-08 | PASS |

## Local File Paths

| File | Description |
|---|---|
| `production/sales-agent/WF6-CRM-Updater.json` | CRM Updater (deployed Phase 1) |
| `production/sales-agent/WF1-Lead-Enrichment.json` | Lead Enrichment (deployed Phase 2) |
| `production/sales-agent/WF2-Lead-Scoring.json` | Lead Scoring (deployed Phase 2, fixed) |
| `production/sales-agent/stubs/WF3-Stub.json` | Still active stub |
| `production/sales-agent/stubs/WF4-Stub.json` | Still active stub |
| `production/sales-agent/stubs/WF5-Stub.json` | Still active stub |
| `production/sales-agent/WF0-Master-Orchestrator.json` | Master Orchestrator |

**Placeholders still needed (REQUIRED before live testing):**
- `SALES_AGENT_SHEET_ID` in WF6 + WF0 — Google Sheet must be created first

**Credentials gesetzt (2026-03-08):**
- Tavily: `a6ZN4T8aDN1bVzeY` (Tavily account) → WF1
- Anthropic: `5LmibcuA2kdHKaqB` (Claude - 20260127) → WF2
- Apify: `wWgQDWC9aV3UcUEJ` (Apify MN1975) → WF1

## Accumulated Context

### Decisions

- Phase 1: WF6 (CRM Updater) wird VOR WF0 (Master) gebaut
- Phase 1: Sub-WF-Kommunikation via n8n Execute Workflow Node (nicht externe Webhooks)
- Phase 2: Apify nutzt "Run actor and get dataset" Operation — kein manuelles Polling nötig
- Phase 2: Tavily nutzt Community Node `@tavily/n8n-nodes-tavily` (nicht HTTP Request — Update zur Phase 1 Entscheidung)
- Alle Phasen: Anthropic Chat Model Node (`nodes-langchain.lmChatAnthropic`) statt HTTP Request
- Google Sheets: Spaltennamen mit Umlauten (nächster_kontakt etc.) → bracket notation verwenden
- WF2: Final Merge Node weggelassen — jeder Branch-Endknoten ist Terminal (Execute Workflow gibt letztes Item zurück)
- WF2 Score Thresholds: KALT (0–29) / WARM (30–79) / HEISS (80–100) — aligns with DATA-03

### Validation Issues (Phase 1 — all resolved/accepted)

- SALES_AGENT_SHEET_ID placeholder in WF6 + WF0 — expected, user action required
- WF0 Merge trigger uses output "input1" (passThrough) — acceptable
- WF6 IF boolean unary operator — auto-sanitized by n8n on save

### Validation Issues (Phase 2 — fixed)

- WF2 system prompt used KALT (0–49) threshold, inconsistent with requirement < 30. Fixed to KALT (0–29) / WARM (30–79) / HEISS (80–100). Code: Parse Score JSON fallback also fixed.

### Blockers/Concerns

- **REQUIRED BEFORE LIVE TESTING**: Google Sheet + SALES_AGENT_SHEET_ID
- Google OAuth2 Credential: gmail.modify + gmail.compose + calendar scopes — vor Phase 3/5 prüfen
- Verify community nodes installed: `@tavily/n8n-nodes-tavily`, `@apify/n8n-nodes-apify`

## Session Continuity

Last session: 2026-03-08
Stopped at: Phase 2 verification complete. WF1 PASS, WF2 PASS (after threshold fix).
Next step: `/gsd-n8n:plan-phase 3` — E-Mail-Maschinerie (WF3 + WF4)
