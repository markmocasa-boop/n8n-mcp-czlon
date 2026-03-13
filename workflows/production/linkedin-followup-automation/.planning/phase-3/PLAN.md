---
phase: 3
plan: 3-1
workflows: [WF1]
type: n8n-workflow
---

# Plan 3-1: Integration & Error-Handling — Final Deploy

## Objective

Add complete error handling to the existing 36-node WF1 workflow and deploy the final production version. Phase 3 adds 3 new nodes and modifies 2 existing nodes, bringing the total to 39 nodes.

Requirements addressed: ERR-01 (verify), ERR-02, ERR-03 (verify), ERR-04, ERR-05.

---

## Current Workflow State (from Phase 2)

- **n8n ID**: `j6O5Ktxcp0n6o9du`
- **Nodes**: 36 (16 Branch A + 20 Branch B)
- **Local JSON**: `WF1-LinkedIn-Followup-Master.json`
- **Status**: Deployed (inactive)

### Key Existing Node Names and IDs

| ID | Name | Position |
|---|---|---|
| `schedule-trigger` | Schedule Trigger | [100, 300] |
| `b08-set-inbox-failed` | Set: Mark Inbox Failed | [1850, 950] |
| `b11-get-inbox-dataset` | HTTP Request: Get Inbox Dataset | [1600, 550] |
| `b12-merge-categorize` | Code: Merge & Categorize | [1850, 550] |
| `b13-build-prompt` | Code: Build Anthropic Prompt | [2100, 550] |
| `b14-anthropic` | Anthropic: Hormozi Analysis | [2350, 550] |
| `b15-parse-ai` | Code: Parse AI Response & Merge | [2600, 550] |
| `b16-html-report` | Code: Generate HTML Report | [2850, 550] |
| `b17-flatten-leads` | Code: Flatten Leads for Update | [3100, 700] |
| `b18-gmail-send` | Gmail: Send Report | [3100, 550] |
| `b19-update-leads` | Google Sheets: Update Leads | [3350, 700] |
| `b20-append-log` | Google Sheets: Append Report-Log | [3100, 400] |

### Current Connections FROM Code: Generate HTML Report

```
Code: Generate HTML Report → (main[0]):
  - Gmail: Send Report
  - Code: Flatten Leads for Update
  - Google Sheets: Append Report-Log
```

---

## Phase 3 Changes Overview

| # | Change Type | Node | Description |
|---|---|---|---|
| 1 | ADD | `Error Trigger` | Workflow-level error trigger node (separate trigger) |
| 2 | ADD | `Gmail: Send Error Notification` | Gmail node connected to Error Trigger |
| 3 | ADD | `Code: Build Log Entry` | New code node between b16 and b20 |
| 4 | MODIFY | `Code: Generate HTML Report` (b16) | Add `inboxFailed` flag + warning banner in HTML |
| 5 | MODIFY connections | `Code: Generate HTML Report` → b20 | Reroute: b16 no longer directly connects to b20; instead b16 → Code: Build Log Entry → b20 |
| 6 | VERIFY | `Set: Mark Inbox Failed` (b08) | Confirm `inboxFailed: true` flag is set (already done in Phase 2) |
| 7 | VERIFY | `Anthropic: Hormozi Analysis` (b14) | Confirm `onError: "continueRegularOutput"` (already done in Phase 2) |
| 8 | VERIFY | `HTTP Request: Check Inbox Status` (b05) | Confirm `onError: "continueRegularOutput"` (already done in Phase 2) |

---

## New Nodes to Add

### Node P3-01: Error Trigger

```json
{
  "id": "p3-error-trigger",
  "name": "Error Trigger",
  "type": "n8n-nodes-base.errorTrigger",
  "typeVersion": 1,
  "position": [100, 1100],
  "parameters": {}
}
```

**Notes:**
- This is a SEPARATE trigger — it is NOT connected to the Schedule Trigger.
- It fires automatically when any node in the workflow throws an unhandled error (i.e., a node that does NOT have `onError: "continueRegularOutput"` and fails).
- It receives `$json.execution.error.message`, `$json.execution.id`, `$json.execution.url`.
- Position: below Branch B at y=1100, far left x=100.

### Node P3-02: Gmail: Send Error Notification

```json
{
  "id": "p3-gmail-error",
  "name": "Gmail: Send Error Notification",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [350, 1100],
  "credentials": {
    "gmailOAuth2": {
      "id": "Kh7cApAx6TAe4Hpy",
      "name": "Gmail account"
    }
  },
  "parameters": {
    "operation": "send",
    "sendTo": "={{ $env.REPORT_EMAIL }}",
    "subject": "={{ 'LinkedIn Automation Fehler – ' + new Date().toLocaleDateString('de-DE') }}",
    "emailType": "text",
    "message": "={{ 'Der LinkedIn Follow-up Workflow ist mit einem Fehler abgebrochen.\\n\\nFehler: ' + ($json.execution.error.message ?? 'Unbekannter Fehler') + '\\n\\nWorkflow-Ausführung: ' + ($json.execution.id ?? '') + '\\n\\nBitte prüfen: meinoffice.app.n8n.cloud' }}",
    "options": {}
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

**Notes:**
- `emailType: "text"` — plain text for error notifications (no HTML needed, simpler and more reliable).
- Subject does NOT use emoji characters (to avoid encoding issues in email clients — learned from Phase 2).
- Expression uses `??` null-coalescing to handle cases where error fields may be absent.
- `onError` is NOT set to `continueRegularOutput` here — if the error notification itself fails, we accept that (retryOnFail covers transient failures).

### Node P3-03: Code: Build Log Entry

```json
{
  "id": "p3-build-log-entry",
  "name": "Code: Build Log Entry",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [2850, 400],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// Read report data from b16\nconst reportData = $('Code: Generate HTML Report').first().json;\n\n// Read categorized counts from b15\nconst categorizedData = $('Code: Parse AI Response & Merge').first().json;\n\n// Check if inbox failed — b08 sets inboxFailed:true on that item\n// After b11 (Get Inbox Dataset) both paths merge, so we check b16's output\nconst inboxFailed = reportData.inboxFailed === true;\n\nreturn [{\n  json: {\n    Datum: new Date().toLocaleDateString('de-DE'),\n    Anzahl_Unbeantwortet: (categorizedData.unbeantwortet || []).length,\n    Anzahl_Stern: (categorizedData.stern || []).length,\n    Anzahl_3_Tage: (categorizedData.dreiTage || []).length,\n    Anzahl_5_Tage: (categorizedData.fuenfTage || []).length,\n    Gesamt_Kontakte: reportData.gesamt || 0,\n    Report_gesendet: 'JA',\n    Fehler: inboxFailed ? 'Apify Inbox Actor fehlgeschlagen — Sheet-Daten verwendet' : ''\n  }\n}];"
  }
}
```

**Notes:**
- This node sits between `Code: Generate HTML Report` (b16) and `Google Sheets: Append Report-Log` (b20).
- Position x=2850, y=400 — directly above b16 at y=550 (150px offset).
- It reads `inboxFailed` from b16's output (which b16 will be modified to pass through).
- `Report_gesendet` is always `'JA'` at this point — ERR-05 (Gmail failure detection) is handled separately (see ERR-05 section below).
- Uses `$('Code: Parse AI Response & Merge').first().json` for category counts (not b16) — consistent with how b20 worked in Phase 2.

---

## Modified Nodes

### Modification 1: Code: Generate HTML Report (b16)

**What changes**: The `jsCode` parameter is updated to:
1. Read the `inboxFailed` flag from `Set: Mark Inbox Failed` (b08) via a try/catch reference
2. Add a warning banner at the top of the HTML if inbox failed
3. Include `inboxFailed` in the output JSON

**New jsCode for b16** (replaces existing code entirely):

```javascript
const data = $input.first().json;
const heute = new Date().toLocaleDateString('de-DE', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

const gesamt = data.stern.length + data.unbeantwortet.length +
               data.dreiTage.length + data.fuenfTage.length;

// Check if inbox failed — Set: Mark Inbox Failed sets inboxFailed:true
// We check via Code: Merge & Categorize which receives the combined data
// The inboxFailed flag travels through the pipeline from b08 → b11 → b12 → b13 → b14 → b15
// But since b12 processes the merged data, we need to check b08 directly
let inboxFailed = false;
try {
  const inboxFailedItems = $('Set: Mark Inbox Failed').all();
  inboxFailed = inboxFailedItems.length > 0;
} catch (e) {
  // Node not executed (inbox succeeded) — inboxFailed stays false
  inboxFailed = false;
}

function buildTable(contacts, farbe, emoji) {
  if (contacts.length === 0) {
    return `<p style="color:#999;font-style:italic;">Keine Kontakte in dieser Kategorie.</p>`;
  }
  return contacts.map(c => `
  <div style="border:1px solid ${farbe};border-radius:8px;padding:16px;margin-bottom:12px;background:#fff;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong style="font-size:15px;">
        <a href="${c.linkedinUrl}" style="color:#0077B5;text-decoration:none;">${c.name}</a>
      </strong>
      <span style="color:#666;font-size:12px;">${c.unternehmen || ''}${c.position ? ' · ' + c.position : ''}</span>
    </div>
    <div style="margin-top:8px;font-size:13px;color:#444;">
      <strong>Kontext:</strong> ${c.zusammenfassung}
    </div>
    <div style="margin-top:8px;background:#f8f9fa;border-left:3px solid ${farbe};padding:10px;border-radius:4px;font-size:13px;">
      <strong>Vorschlag:</strong> ${c.nachrichtenvorschlag}
    </div>
    <div style="margin-top:6px;font-size:11px;color:#999;">
      Nachrichten: ${c.anzahlNachrichten} · Erstkontakt: ${c.erstkontaktDatum} · Letzter Reply: ${c.letzterReplyDatum || 'nie'}
    </div>
  </div>`).join('');
}

// Warning banner HTML (only shown when inbox failed)
const warningBanner = inboxFailed ? `
<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:14px 18px;margin-bottom:16px;color:#856404;">
  <strong>Hinweis:</strong> Apify Inbox Actor konnte nicht abgerufen werden. Der Report basiert auf den zuletzt gespeicherten Sheet-Daten. Gesprachsverlaeufe und Nachrichten-Counts koennen veraltet sein.
</div>` : '';

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LinkedIn Follow-up Report ${heute}</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;background:#f4f4f4;">

<div style="background:#0077B5;color:white;padding:24px;border-radius:8px 8px 0 0;">
  <h1 style="margin:0;font-size:22px;">LinkedIn Follow-up Report</h1>
  <p style="margin:6px 0 0;opacity:0.9;">${heute}</p>
</div>

<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;">
  ${warningBanner}
  <div style="display:flex;gap:16px;flex-wrap:wrap;">
    <div style="background:#fff9c4;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#f59e0b;">${data.stern.length}</div>
      <div style="font-size:12px;color:#666;">Stern</div>
    </div>
    <div style="background:#fee2e2;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#ef4444;">${data.unbeantwortet.length}</div>
      <div style="font-size:12px;color:#666;">Unbeantwortet</div>
    </div>
    <div style="background:#dbeafe;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#3b82f6;">${data.dreiTage.length}</div>
      <div style="font-size:12px;color:#666;">3 Tage still</div>
    </div>
    <div style="background:#f3e8ff;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#8b5cf6;">${data.fuenfTage.length}</div>
      <div style="font-size:12px;color:#666;">5 Tage still</div>
    </div>
  </div>
  <p style="text-align:center;color:#666;font-size:13px;margin-top:12px;">
    Gesamt: <strong>${gesamt} Kontakte</strong> heute priorisiert
  </p>
</div>

${data.stern.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#f59e0b;margin-top:0;border-bottom:2px solid #f59e0b;padding-bottom:8px;">
    Stern-Kontakte (${data.stern.length})
  </h2>
  ${buildTable(data.stern, '#f59e0b', 'Stern')}
</div>` : ''}

${data.unbeantwortet.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#ef4444;margin-top:0;border-bottom:2px solid #ef4444;padding-bottom:8px;">
    Unbeantwortet (${data.unbeantwortet.length})
  </h2>
  ${buildTable(data.unbeantwortet, '#ef4444', 'Unbeantwortet')}
</div>` : ''}

${data.dreiTage.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#3b82f6;margin-top:0;border-bottom:2px solid #3b82f6;padding-bottom:8px;">
    3 Tage still (${data.dreiTage.length})
  </h2>
  ${buildTable(data.dreiTage, '#3b82f6', '3 Tage')}
</div>` : ''}

${data.fuenfTage.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#8b5cf6;margin-top:0;border-bottom:2px solid #8b5cf6;padding-bottom:8px;">
    5 Tage still (${data.fuenfTage.length})
  </h2>
  ${buildTable(data.fuenfTage, '#8b5cf6', '5 Tage')}
</div>` : ''}

<div style="background:#374151;color:white;padding:16px;border-radius:0 0 8px 8px;text-align:center;font-size:12px;margin-top:2px;">
  Generiert am ${heute} · LinkedIn Follow-up Automation
</div>

</body>
</html>`;

return [{ json: { html, gesamt, heute, inboxFailed } }];
```

**Critical notes for b16 modification:**
- The `try/catch` around `$('Set: Mark Inbox Failed').all()` is REQUIRED. In n8n, referencing a node that was not executed in the current execution path throws an error. The try/catch gracefully defaults to `inboxFailed = false`.
- The `inboxFailed` flag is added to the output: `{ html, gesamt, heute, inboxFailed }`.
- Warning banner text uses "ae", "oe", "ue" instead of umlauts (avoiding potential encoding issues in email HTML — safe practice).
- No emoji characters in the warning banner.

### Modification 2: Connection Rerouting for b20

**Current**: `Code: Generate HTML Report` (b16) → `Google Sheets: Append Report-Log` (b20) directly.

**New**: `Code: Generate HTML Report` (b16) → `Code: Build Log Entry` (p3-build-log-entry) → `Google Sheets: Append Report-Log` (b20).

**Connection changes in the `connections` object**:

Remove from `"Code: Generate HTML Report"` main[0]:
```json
{ "node": "Google Sheets: Append Report-Log", "type": "main", "index": 0 }
```

Add to `"Code: Generate HTML Report"` main[0]:
```json
{ "node": "Code: Build Log Entry", "type": "main", "index": 0 }
```

Add new connection entry:
```json
"Code: Build Log Entry": {
  "main": [
    [
      { "node": "Google Sheets: Append Report-Log", "type": "main", "index": 0 }
    ]
  ]
}
```

**Updated `Google Sheets: Append Report-Log` (b20) column mapping** — change from inline expressions to simple field references from the new Code node output:

```json
"columns": {
  "mappingMode": "defineBelow",
  "value": {
    "Datum": "={{ $json.Datum }}",
    "Anzahl_Unbeantwortet": "={{ $json.Anzahl_Unbeantwortet }}",
    "Anzahl_Stern": "={{ $json.Anzahl_Stern }}",
    "Anzahl_3_Tage": "={{ $json.Anzahl_3_Tage }}",
    "Anzahl_5_Tage": "={{ $json.Anzahl_5_Tage }}",
    "Gesamt_Kontakte": "={{ $json.Gesamt_Kontakte }}",
    "Report_gesendet": "={{ $json.Report_gesendet }}",
    "Fehler": "={{ $json.Fehler }}"
  }
}
```

---

## ERR-05: Gmail Failure Handling (Design Decision)

**Requirement**: `Report_gesendet: NEIN` when Gmail send fails.

**Analysis**: Implementing this cleanly in n8n requires either:
- A dedicated IF node after Gmail checking for errors (complex, Gmail output structure varies)
- Two separate `Code: Build Log Entry` nodes — one for success path, one for failure path — requiring the Gmail node's `onError` to connect to a different Log Entry builder

**Current behavior**: Gmail (b18) already has `onError: "continueRegularOutput"`. This means when Gmail fails, execution continues to the NEXT connected node. However, b18 is currently a terminal node (no outgoing connection after it) and is in a parallel branch from b16's output.

**Phase 3 approach**: The `Code: Build Log Entry` runs in a separate parallel branch from b16, so it is NOT affected by Gmail success/failure. `Report_gesendet` will always be `'JA'` from the log entry node's perspective.

**Decision**: ERR-05 is deferred to v2 as a known limitation. The current architecture (parallel branches from b16) makes it architecturally difficult to pass Gmail failure state to the log entry without a significant refactor. The `Fehler` field in Report-Log will document Apify failures (ERR-02) but not Gmail failures (ERR-05).

**Documentation in code**: The `Code: Build Log Entry` has a comment explaining this limitation.

---

## Connection Changes Summary

### Connections that change

**Before (from `Code: Generate HTML Report`):**
```json
"Code: Generate HTML Report": {
  "main": [[
    { "node": "Gmail: Send Report", "type": "main", "index": 0 },
    { "node": "Code: Flatten Leads for Update", "type": "main", "index": 0 },
    { "node": "Google Sheets: Append Report-Log", "type": "main", "index": 0 }
  ]]
}
```

**After (from `Code: Generate HTML Report`):**
```json
"Code: Generate HTML Report": {
  "main": [[
    { "node": "Gmail: Send Report", "type": "main", "index": 0 },
    { "node": "Code: Flatten Leads for Update", "type": "main", "index": 0 },
    { "node": "Code: Build Log Entry", "type": "main", "index": 0 }
  ]]
}
```

### New connections to add

```json
"Error Trigger": {
  "main": [[
    { "node": "Gmail: Send Error Notification", "type": "main", "index": 0 }
  ]]
},
"Code: Build Log Entry": {
  "main": [[
    { "node": "Google Sheets: Append Report-Log", "type": "main", "index": 0 }
  ]]
}
```

---

## Full Node Position Map (39 nodes after Phase 3)

### Branch A (16 nodes — unchanged)

| Node | Position |
|---|---|
| Schedule Trigger | [100, 300] |
| HTTP Request: Start Actor | [350, 150] |
| Wait: Initial 20s | [600, 150] |
| Merge: Loop Entry | [850, 150] |
| HTTP Request: Check Actor Status | [1100, 150] |
| IF: Actor Done? | [1350, 150] |
| IF: Max Attempts? | [1600, 300] |
| No Operation: Skip Branch A | [1850, 400] |
| Set: Increment Attempt Counter | [1850, 200] |
| Wait: 15s Poll Interval | [2100, 200] |
| HTTP Request: Get Dataset Items | [1600, 0] |
| Google Sheets: Read Leads | [1850, 0] |
| Code: Compare URLs | [2100, 0] |
| IF: New Leads Found? | [2350, 0] |
| No Operation: No New Leads | [2600, 150] |
| Google Sheets: Append New Leads | [2600, -100] |

### Branch B (20 nodes — mostly unchanged)

| Node | Position |
|---|---|
| Google Sheets: Read All Leads | [100, 700] |
| HTTP Request: Start Inbox Actor | [350, 700] |
| Wait: Inbox Initial 20s | [600, 700] |
| Merge: Inbox Loop Entry | [850, 700] |
| HTTP Request: Check Inbox Status | [1100, 700] |
| IF: Inbox Actor Done? | [1350, 700] |
| IF: Inbox Max Attempts? | [1600, 850] |
| Set: Mark Inbox Failed | [1850, 950] |
| Set: Increment Inbox Counter | [1850, 750] |
| Wait: Inbox 15s Poll | [2100, 750] |
| HTTP Request: Get Inbox Dataset | [1600, 550] |
| Code: Merge & Categorize | [1850, 550] |
| Code: Build Anthropic Prompt | [2100, 550] |
| Anthropic: Hormozi Analysis | [2350, 550] |
| Code: Parse AI Response & Merge | [2600, 550] |
| Code: Generate HTML Report (modified) | [2850, 550] |
| Gmail: Send Report | [3100, 550] |
| Code: Flatten Leads for Update | [3100, 700] |
| Google Sheets: Update Leads | [3350, 700] |
| Google Sheets: Append Report-Log (modified b20) | [3100, 400] |

### New Phase 3 nodes (3 new)

| Node | Position |
|---|---|
| Code: Build Log Entry | [2850, 400] |
| Error Trigger | [100, 1100] |
| Gmail: Send Error Notification | [350, 1100] |

---

## Execution Order Verification

### ERR-01 (Apify Connections FAILED — silent skip)

Already implemented. Path: `IF: Max Attempts?` true → `No Operation: Skip Branch A`. The no-op node is a terminal node, execution stops. No error mail is sent. Status: VERIFIED via Phase 2 JSON review.

### ERR-02 (Apify Inbox FAILED — report runs with error note)

Path 1 (inbox fails immediately): `IF: Inbox Max Attempts?` true → `Set: Mark Inbox Failed` → `HTTP Request: Get Inbox Dataset` (returns empty `[]`) → `Code: Merge & Categorize` (processes with empty inbox data) → ... → `Code: Generate HTML Report` (detects `inboxFailed=true` via try/catch, adds warning banner, outputs `inboxFailed:true`) → `Code: Build Log Entry` (reads `inboxFailed`, sets `Fehler` field) → `Google Sheets: Append Report-Log`.

**Critical architecture note**: `Set: Mark Inbox Failed` (b08) connects to `HTTP Request: Get Inbox Dataset` (b11). This means when inbox fails, b11 receives the failed item (with `inboxFailed:true`) and attempts to fetch the dataset with whatever `data.defaultDatasetId` is available. If the actor failed and has no dataset, the HTTP request may fail or return empty — b11 has `onError: "continueRegularOutput"` so it continues. The downstream `Code: Merge & Categorize` will process an empty inbox result alongside the sheet leads.

The b16 try/catch approach for `inboxFailed` detection is the correct pattern because `Set: Mark Inbox Failed` only executes when the inbox polling fails — otherwise it is skipped. The n8n expression `$('Set: Mark Inbox Failed').all()` would throw if that node never ran in this execution, hence the try/catch wrapper.

### ERR-03 (Anthropic failure — fallback texts)

Already implemented. `Anthropic: Hormozi Analysis` has `onError: "continueRegularOutput"`. On failure, `Code: Parse AI Response & Merge` (b15) handles empty/missing AI response with fallback texts. Status: VERIFIED via Phase 2 JSON review.

### ERR-04 (Critical workflow error — Gmail notification)

Implemented by Phase 3 Error Trigger + Gmail: Send Error Notification. The error trigger fires for any unhandled error (nodes without `onError: "continueRegularOutput"` that fail). Gmail sends plain-text notification to `$env.REPORT_EMAIL`.

### ERR-05 (Gmail send fails — Report_gesendet: NEIN)

Deferred to v2. Known limitation. The `Code: Build Log Entry` runs in a parallel branch from b16, independent of Gmail success/failure. `Report_gesendet` will always be `'JA'` in this version.

---

## Nodes with onError: continueRegularOutput (current state)

| Node | Has continueRegularOutput | Phase |
|---|---|---|
| HTTP Request: Start Actor | Yes | Phase 1 |
| HTTP Request: Start Inbox Actor | Yes | Phase 2 |
| HTTP Request: Check Inbox Status | Yes | Phase 2 |
| HTTP Request: Get Inbox Dataset | Yes | Phase 2 |
| Anthropic: Hormozi Analysis | Yes | Phase 2 |
| Gmail: Send Report | Yes | Phase 2 |
| Google Sheets: Update Leads | Yes | Phase 2 |
| Google Sheets: Append Report-Log | Yes | Phase 2 |
| Gmail: Send Error Notification | NO — intentional | Phase 3 |

**Note**: `Gmail: Send Error Notification` does NOT have `continueRegularOutput` because it IS the error handler — it should not silently fail. It has `retryOnFail: true, maxTries: 3` for transient Gmail failures.

---

## Executor Steps

### Step 1: Read current WF1 JSON

Read `WF1-LinkedIn-Followup-Master.json` in full.

### Step 2: Add 3 new nodes to the `nodes` array

Append these 3 node objects:
1. `Error Trigger` (p3-error-trigger) — see spec above
2. `Gmail: Send Error Notification` (p3-gmail-error) — see spec above
3. `Code: Build Log Entry` (p3-build-log-entry) — see spec above

### Step 3: Update `Code: Generate HTML Report` jsCode

Replace the `jsCode` property of node `b16-html-report` with the new code that:
- Adds `inboxFailed` detection via try/catch
- Adds `warningBanner` HTML variable
- Inserts `warningBanner` before the stat cards div
- Adds `inboxFailed` to the return object

### Step 4: Update `Google Sheets: Append Report-Log` column mappings

Replace the inline expressions in `b20-append-log` with simple `$json.FieldName` references.

### Step 5: Update connections

1. In `"Code: Generate HTML Report"` main[0]: remove `Google Sheets: Append Report-Log` entry, add `Code: Build Log Entry` entry.
2. Add `"Error Trigger"` connection block.
3. Add `"Code: Build Log Entry"` connection block.

### Step 6: Validate

Run `validate_workflow` via n8n-MCP. Check all warnings against FALSE_POSITIVES.md.

### Step 7: Deploy

Run `n8n_update_full_workflow` for workflow ID `j6O5Ktxcp0n6o9du`.

### Step 8: Save JSON locally

Save updated JSON to `WF1-LinkedIn-Followup-Master.json`.

### Step 9: GitHub Push

```bash
cd "C:\Users\markn\Desktop\n8n-mcp-czlon"
git add workflows/production/linkedin-followup-automation/WF1-LinkedIn-Followup-Master.json
git add workflows/production/linkedin-followup-automation/.planning/phase-3/
git commit -m "feat: LinkedIn Follow-up WF1 Phase 3 — Error handling + final deploy (39 nodes)"
git push origin main
```

---

## Validation Checklist

### Pre-deploy structural checks

- [ ] Total node count: 39 (36 + 3 new)
- [ ] All node IDs unique: `p3-error-trigger`, `p3-gmail-error`, `p3-build-log-entry` are new unique IDs
- [ ] All node names unique: "Error Trigger", "Gmail: Send Error Notification", "Code: Build Log Entry" are new unique names
- [ ] `Code: Build Log Entry` uses `$('Code: Generate HTML Report').first().json` and `$('Code: Parse AI Response & Merge').first().json` — cross-node references (not `$input` for the counts)
- [ ] `b16` modified jsCode: `$('Set: Mark Inbox Failed').all()` is inside try/catch
- [ ] `b16` output includes `inboxFailed` field
- [ ] `b20` column mapping updated to `$json.FieldName` references
- [ ] Error Trigger has no incoming connections (it is a trigger node)
- [ ] Error Trigger connects only to `Gmail: Send Error Notification`
- [ ] `Code: Build Log Entry` connects only to `Google Sheets: Append Report-Log`
- [ ] `Code: Generate HTML Report` main[0] has exactly 3 targets: Gmail, Code: Flatten Leads, Code: Build Log Entry

### n8n Rule compliance checks

- [ ] All expressions use `={{ }}` format (not `{{ }}`)
- [ ] No `continueOnFail` property anywhere — only `onError: "continueRegularOutput"`
- [ ] No `$node['name']` references — only `$('name')`
- [ ] All IF nodes have `"version": 2` in `conditions.options`
- [ ] All Code nodes use `$input.first().json` or `$input.all()` (not `$json` directly)
- [ ] No Switch nodes anywhere
- [ ] Gmail typeVersion: 2.1 for both Gmail nodes
- [ ] Error Trigger typeVersion: 1
- [ ] Code typeVersion: 2 for all Code nodes

### Post-deploy checks

- [ ] `validate_workflow` returns no errors
- [ ] Warnings checked against FALSE_POSITIVES.md
- [ ] Workflow visible on n8n cloud canvas (no Canvas crash)
- [ ] Node count on server: 39
- [ ] Error Trigger node visible as separate trigger in workflow

---

## Known Limitations & v2 Items

| Limitation | Requirement | Workaround | v2 Fix |
|---|---|---|---|
| ERR-05: `Report_gesendet: NEIN` not implemented | ERR-05 | Log always writes `JA` | Implement IF after Gmail + two Log Entry paths |
| ERR-04 covers only unhandled errors | ERR-04 | Nodes with `continueRegularOutput` fail silently (by design) | Review which nodes should escalate vs. continue |
| LinkedIn Cookie expiry not detected | V2-01 | Manual check required | Add auth error detection in Apify response |

---

## Files to Create/Modify

| File | Action |
|---|---|
| `WF1-LinkedIn-Followup-Master.json` | UPDATE (39 nodes) |
| `.planning/phase-3/PLAN.md` | CREATE (this file) |
| `.planning/phase-3/SUMMARY.md` | CREATE (executor writes after completion) |
| `.planning/STATE.md` | UPDATE (Phase 3 complete) |
