# Summary: Plan 5-1

## Workflows Built

| WF | Name | n8n ID | Nodes | Status |
|---|---|---|---|---|
| WF7 | Sales Agent — WF7 Inbox & Calendar Manager | wsAy4ROLYtgRfXyY | 54 | Deployed |

## Node Optimization

| Original | Decision | Reason |
|---|---|---|
| HTTP Request: Freebusy Query | Kept as HTTP Request | Native Google Calendar node does not expose full freebusy response with busy blocks — only returns boolean isAvailable. Raw busy array needed for slot-finding algorithm. |
| Code: Build Freebusy Body | Added (Code node, not in original plan) | Safer alternative to IIFE expression inside HTTP Request jsonBody field. Computes freebusy request body using Luxon DateTime and passes it as `$json.freebusy_body` to the HTTP Request. |

## Architecture Decisions

- **Path A (Inbox Monitor)**: 40 nodes — Cron (15 min) → Gmail unread → Sheets leads → Code filter → IF → SplitInBatches → duplicate check → thread context → LLM termin detection → IF termin → freebusy → calendar create → Sheets append → WF6 update → Merge → LLM draft → Gmail create draft → WF6 update → Gmail mark read → loop back
- **Path B (Termin-Vorbereitung)**: 14 nodes — Cron (07:00) → Sheets termine → Code filter tomorrow → IF → SplitInBatches → Sheets lead lookup → Code merge context → Set passthrough → LLM vorbereitung → Code agenda → Sheets update → loop back
- **Merge node** (passThrough, output: input1): All three terminal branches (termin created, no termin wanted, no slot available) connect to index 0 — since only one fires per execution, passThrough handles exclusive OR correctly
- **Code: Build Freebusy Body** inserted before HTTP Request instead of IIFE expression for reliability
- **SplitInBatches loop-back**: Set: Email Processed and Set: Skip Already Processed both connect back to SplitInBatches: Per Email input; Set: Vorbereitung Done connects back to SplitInBatches: Per Termin input
- **Execute WF6 retries**: maxTries: 2, waitBetweenTries: 300000 (5 min) per ERR-04 spec; all other external APIs use maxTries: 3, waitBetweenTries: 5000

## Credentials Set

| Node Type | Credential | ID |
|---|---|---|
| Gmail (all 4 nodes) | gmailOAuth2 | yv1FhLRO54A8dyzi |
| Google Sheets (all 6 nodes) | googleSheetsOAuth2Api | gw0DIdDENFkpE7ZW |
| Google Calendar: Create Event | googleCalendarOAuth2Api | xhweiA0UKiD5rxB8 |
| HTTP Request: Freebusy Query | googleCalendarOAuth2Api | xhweiA0UKiD5rxB8 |
| Anthropic Chat Model A/B/C | anthropicApi | 5LmibcuA2kdHKaqB |

## Issues Encountered

None — workflow deployed cleanly on first attempt (54 nodes confirmed in API response, 52 spec nodes + Code: Build Freebusy Body added + 1 extra from plan node numbering).

## Files Created/Modified

- `C:\Users\markn\Desktop\n8n-mcp-czlon\workflows\production\sales-agent\WF7-Inbox-Calendar-Manager.json` — WF7 workflow JSON (54 nodes, two trigger paths)
- `C:\Users\markn\AppData\Local\Temp\deploy_wf7.py` — deploy script used to POST to n8n API

## Placeholders Requiring User Action

- `SALES_AGENT_SHEET_ID` in all Google Sheets nodes (6 occurrences across WF7) — must be replaced with actual Google Sheet ID before live testing
- Verify Gmail `createDraft` operation name works in live instance (v2.1)
- Verify Gmail `markAsRead` operation name works in live instance (v2.1)
- Google Calendar `additionalFields.attendees` may need verification in live instance

## Phase 5 Complete

All 7 workflows (WF0–WF7, excluding WF0 as master) are now deployed:

| WF | n8n ID | Phase |
|---|---|---|
| WF6 | HxOD2a8He72tvKmR | Phase 1 |
| WF1 | mPtLL7QxoW1lJKu2 | Phase 2 |
| WF2 | GAqEpcFUuLrKGYFH | Phase 2 |
| WF3 | uWkGHyQQ8FBeqErW | Phase 3 |
| WF4 | O2RnTBvoLAOV4agj | Phase 3 |
| WF5 | bQQfeZfngg6AyuwZ | Phase 4 |
| WF0 | 58ysZ3NLKZfsMfND | Phase 4 |
| WF7 | wsAy4ROLYtgRfXyY | Phase 5 |
