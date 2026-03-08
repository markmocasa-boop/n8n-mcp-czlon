# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Jeder qualifizierte Lead (Score ≥ 30) erhält automatisch eine personalisierte 4-E-Mail-Sequenz.
**Current focus:** Phase 4 — LinkedIn Content (WF5) — VERIFIED

## Current Position

Phase: 4 of 5 (LinkedIn Content) — VERIFIED
Workflow: WF5 LinkedIn Content Generator — deployed and verified PASS
Status: Phase 4 complete — WF5 (9 nodes) + WF0 (20 nodes) deployed and verified
Last activity: 2026-03-08 — Phase 4 verified

Progress: [████████░░] 80%

## Deployed Workflows

| WF | Name | n8n ID | Status | Deployed | Verified |
|---|---|---|---|---|---|
| WF6 | Sales Agent — WF6 CRM Updater | HxOD2a8He72tvKmR | Active | 2026-03-08 | PASS |
| WF1 | Sales Agent — WF1 Lead Enrichment | mPtLL7QxoW1lJKu2 | Inactive | 2026-03-08 | PASS |
| WF2 | Sales Agent — WF2 Lead Scoring | GAqEpcFUuLrKGYFH | Inactive | 2026-03-08 | PASS |
| WF3 | Sales Agent — WF3 E-Mail Sequenz Generator | uWkGHyQQ8FBeqErW | Inactive | 2026-03-08 | PASS |
| WF4 | Sales Agent — WF4 E-Mail Sender | O2RnTBvoLAOV4agj | Inactive | 2026-03-08 | PASS (fixed) |
| WF5 | Sales Agent — WF5 LinkedIn Content Generator | bQQfeZfngg6AyuwZ | Inactive | 2026-03-08 | PASS |
| WF0 | Sales Agent — WF0 Master Orchestrator | 58ysZ3NLKZfsMfND | Inactive | 2026-03-08 | PASS (updated Phase 4) |

## Local File Paths

| File | Description |
|---|---|
| `production/sales-agent/WF6-CRM-Updater.json` | CRM Updater (deployed Phase 1) |
| `production/sales-agent/WF1-Lead-Enrichment.json` | Lead Enrichment (deployed Phase 2) |
| `production/sales-agent/WF2-Lead-Scoring.json` | Lead Scoring (deployed Phase 2, fixed) |
| `production/sales-agent/WF3-Email-Sequenz-Generator.json` | Email Sequenz Generator (Phase 3) |
| `production/sales-agent/WF4-Email-Sender.json` | Email Sender (Phase 3, fixed) |
| `production/sales-agent/WF5-LinkedIn-Content-Generator.json` | LinkedIn Content Generator (Phase 4, verified) |
| `production/sales-agent/WF0-Master-Orchestrator.json` | Master Orchestrator (updated Phase 4, verified) |

**Placeholders still needed (REQUIRED before live testing):**
- `SALES_AGENT_SHEET_ID` in WF6 + WF0 — Google Sheet must be created first

**Credentials gesetzt (2026-03-08):**
- Tavily: `a6ZN4T8aDN1bVzeY` (Tavily account) → WF1
- Anthropic: `5LmibcuA2kdHKaqB` (Claude - 20260127) → WF2, WF3, WF5
- Apify: `wWgQDWC9aV3UcUEJ` (Apify MN1975) → WF1
- Gmail: `yv1FhLRO54A8dyzi` (Mark@mo-casa.com) → WF4

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
- WF3: 4 sequential Basic LLM Chain + Anthropic node pairs, Code: Build Output reads all 4 via $('NodeName').first().json
- WF4: nächster_kontakt (with ä) must be preserved through all code paths — naechster_kontakt is wrong
- Phase 4: WF4 Set:Success Output only returns 4 fields → added Set:Lead Context for WF5 node in WF0 to re-pass full lead context (from WF2 output + WF1 angereichert) before calling WF5

### Validation Issues (Phase 1 — all resolved/accepted)

- SALES_AGENT_SHEET_ID placeholder in WF6 + WF0 — expected, user action required
- WF0 Merge trigger uses output "input1" (passThrough) — acceptable
- WF6 IF boolean unary operator — auto-sanitized by n8n on save

### Validation Issues (Phase 2 — fixed)

- WF2 system prompt used KALT (0–49) threshold, inconsistent with requirement < 30. Fixed to KALT (0–29) / WARM (30–79) / HEISS (80–100). Code: Parse Score JSON fallback also fixed.

### Validation Issues (Phase 3 — fixed)

- WF4 Code: Build WF6 Update Payload used `naechster_kontakt` (ascii) instead of `nächster_kontakt` (with ä umlaut). WF6 uses autoMapInputData so wrong field name would silently fail to update next-contact date in CRM. Fixed and redeployed.

### Validation Issues (Phase 4 — accepted/cosmetic)

- WF5 local JSON had credential name "Anthropic account" while live shows "Claude - 20260127". Cosmetic only (credential ID 5LmibcuA2kdHKaqB is correct). Local JSON updated to match live.

### Blockers/Concerns

- **REQUIRED BEFORE LIVE TESTING**: Google Sheet + SALES_AGENT_SHEET_ID
- Google OAuth2 Credential: gmail.modify + gmail.compose + calendar scopes — vor Phase 5 prüfen
- Verify community nodes installed: `@tavily/n8n-nodes-tavily`, `@apify/n8n-nodes-apify`

## Session Continuity

Last session: 2026-03-08
Stopped at: Phase 4 verified PASS. WF5 + WF0 bridge node both verified against live n8n API.
Next step: Phase 5 — Inbox & Calendar Manager (WF7).
