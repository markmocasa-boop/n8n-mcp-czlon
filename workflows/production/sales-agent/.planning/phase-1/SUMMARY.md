# Summary: Plan 1-1 — Fundament (CRM Updater + Master Orchestrator)

## Status: JSON Built — Deployment Pending

All 7 workflow JSONs were built and saved locally. MCP tools for n8n deployment are not available in sub-agent context — deployment must be completed in the main Claude session or manually.

---

## Workflows Built

| WF | Name | n8n ID | Nodes | Status |
|---|---|---|---|---|
| WF6 | Sales Agent — WF6 CRM Updater | PENDING | 7 | JSON ready, needs deployment |
| WF1 Stub | Sales Agent — WF1 Stub (Phase 1) | PENDING | 2 | JSON ready, needs deployment |
| WF2 Stub | Sales Agent — WF2 Stub (Phase 1) | PENDING | 2 | JSON ready, needs deployment |
| WF3 Stub | Sales Agent — WF3 Stub (Phase 1) | PENDING | 2 | JSON ready, needs deployment |
| WF4 Stub | Sales Agent — WF4 Stub (Phase 1) | PENDING | 2 | JSON ready, needs deployment |
| WF5 Stub | Sales Agent — WF5 Stub (Phase 1) | PENDING | 2 | JSON ready, needs deployment |
| WF0 | Sales Agent — WF0 Master Orchestrator | PENDING | 19 | JSON ready, needs deployment + ID substitution |

---

## Files Created

| File | Description |
|---|---|
| `production/sales-agent/WF6-CRM-Updater.json` | 7-node CRM updater sub-workflow |
| `production/sales-agent/WF0-Master-Orchestrator.json` | 19-node master orchestrator (with placeholder IDs) |
| `production/sales-agent/stubs/WF1-Stub.json` | Pass-through stub for Lead Enrichment |
| `production/sales-agent/stubs/WF2-Stub.json` | Scoring stub (returns score=75, klassifikation=WARM) |
| `production/sales-agent/stubs/WF3-Stub.json` | Pass-through stub for Email Generator |
| `production/sales-agent/stubs/WF4-Stub.json` | Pass-through stub for Email Sender |
| `production/sales-agent/stubs/WF5-Stub.json` | Pass-through stub for LinkedIn Generator |

---

## Node Optimization

| Node | Decision | Reason |
|---|---|---|
| Google Sheets (3x in WF6) | Native node — no replacement needed | Standard n8n node |
| Google Sheets (1x in WF0) | Native node — no replacement needed | Standard n8n node |
| All other nodes | Execute Workflow, IF, Set, Merge, Wait, Schedule, Manual | All native n8n nodes |

No HTTP Request nodes in Phase 1 workflows. All external API calls use native nodes.

---

## Deployment Steps (Required Action)

Deploy in this exact order. After each deployment, copy the n8n workflow ID into the next workflow's JSON before deploying it.

### Step 1: Create the Google Sheet

Create a new Google Sheet at: https://sheets.google.com/

**Sheet name**: Sales Agent CRM (or any name)

**Required tabs** (exact names):
- `Leads` — tab with 28 columns (A–AB):
  - A: lead_id, B: vorname, C: nachname, D: email, E: unternehmen, F: position, G: branche, H: mitarbeiter_anzahl, I: website, J: linkedin_url, K: notizen, L: status, M: score, N: score_begründung, O: sequenz_schritt, P: letzter_kontakt, Q: nächster_kontakt, R: email_1_gesendet, S: email_2_gesendet, T: email_3_gesendet, U: email_4_gesendet, V: linkedin_nachricht, W: antwort_erhalten, X: antwort_inhalt, Y: termin_vereinbart, Z: termin_datum, AA: draft_erstellt, AB: erstellt_am
- `Sequenz_Log` — tab with 5 columns: timestamp, lead_id, aktion, inhalt, status
- `Termine` — tab with 15 columns (A–O): for Phase 5

Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit`

### Step 2: Replace SALES_AGENT_SHEET_ID

In both `WF6-CRM-Updater.json` and `WF0-Master-Orchestrator.json`, find and replace all occurrences of `SALES_AGENT_SHEET_ID` with the real Sheet ID.

### Step 3: Deploy WF6 → note its ID

Use n8n_create_workflow with the content of `WF6-CRM-Updater.json`.

### Step 4: Deploy WF1 Stub → note ID

Use n8n_create_workflow with `stubs/WF1-Stub.json`.

### Step 5: Deploy WF2 Stub → note ID

Use n8n_create_workflow with `stubs/WF2-Stub.json`.

### Step 6: Deploy WF3 Stub → note ID

Use n8n_create_workflow with `stubs/WF3-Stub.json`.

### Step 7: Deploy WF4 Stub → note ID

Use n8n_create_workflow with `stubs/WF4-Stub.json`.

### Step 8: Deploy WF5 Stub → note ID

Use n8n_create_workflow with `stubs/WF5-Stub.json`.

### Step 9: Update WF0 with real IDs

In `WF0-Master-Orchestrator.json`, replace these placeholders:
- `PLACEHOLDER_WF1_ID` → actual WF1 Stub n8n ID
- `PLACEHOLDER_WF2_ID` → actual WF2 Stub n8n ID
- `PLACEHOLDER_WF3_ID` → actual WF3 Stub n8n ID
- `PLACEHOLDER_WF4_ID` → actual WF4 Stub n8n ID (used in 2 nodes)
- `PLACEHOLDER_WF5_ID` → actual WF5 Stub n8n ID
- `PLACEHOLDER_WF6_ID` → actual WF6 n8n ID (used in 2 nodes: Set Kalt + Final Update)

### Step 10: Deploy WF0

Use n8n_create_workflow with the updated `WF0-Master-Orchestrator.json`.

---

## Issues Encountered

### MCP Tools Not Available in Sub-Agent Context

The n8n MCP tools (`n8n_create_workflow`, `validate_workflow`) are only available in the main Claude session where the MCP server is connected. In the sub-agent executor context, these tools cannot be called. All JSON files were built and saved locally as specified.

**Resolution**: Deploy from the main Claude session using the n8n MCP tools, or import manually via the n8n UI (Settings > Import Workflow).

### Google Sheet Not Yet Created

The PLAN.md uses `SALES_AGENT_SHEET_ID` as a placeholder. No Google Sheet exists yet — user must create it before the workflows will function.

---

## WF0 Architecture Notes

### Loop Structure (Critical)
The master orchestrator uses SplitInBatches for the lead loop:
- Output 1 (loop) → Wait → WF1 → WF2 → Score branch → WF6 → back to SplitInBatches (Input 0)
- Both loop-back paths (Kalt + Final) connect to `SplitInBatches: Loop Leads` at `index: 0`
- Output 0 (done) = end of workflow, not connected

### Score Gate
- Score >= 30: lead qualifies → IF Status = Neu? branch
- Score < 30: Set Kalt Payload → WF6 Set Kalt → loop back

### Status Branches
- Status = "Neu": WF3 (email gen) → WF4 (send) → WF5 (LinkedIn) → Merge → WF6 Final Update
- Status = "In Sequenz": WF4 (send next) → Merge → WF6 Final Update

---

## Next Steps

1. User creates Google Sheet with the 3 tabs described above
2. Deployment via main Claude session (run `/gsd-n8n:execute-phase` or deploy manually)
3. Update STATE.md with all deployed workflow IDs
4. Add 2-3 test leads to the Leads tab (status=Neu + status=In Sequenz)
5. Activate WF6 and stubs, then test WF0 via Manual Trigger
6. Verify loop processes each lead, WF6 updates the sheet
7. Phase 2: Replace WF1 stub with real Lead Enrichment workflow
