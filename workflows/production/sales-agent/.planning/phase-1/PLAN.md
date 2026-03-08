---
phase: 1
plan: 1
workflows: [WF6, WF0]
type: n8n-workflow
requirements: [TRIG-01, TRIG-02, DATA-01, DATA-09, OUT-03, OUT-04, ERR-01]
---

# Plan 1-1: Fundament — CRM Updater + Master Orchestrator

## Objective

Deploy WF6 (CRM Updater) and WF0 (Master Orchestrator) — the foundational infrastructure for the entire Sales Agent system. WF6 must be deployed first because all other sub-workflows (WF1–WF5) call it. WF0 provides the daily trigger loop that coordinates all sub-workflow calls.

## Build Order

1. WF6 CRM Updater — deploy first, get the n8n workflow ID
2. WF0 Master Orchestrator — reference WF6 ID in Execute Workflow nodes

---

## WF6: CRM Updater

### Overview

- **Name**: Sales Agent — WF6 CRM Updater
- **Trigger**: Execute Workflow (called by WF0 and future sub-WFs via Execute Workflow node)
- **Purpose**: Receives a structured update payload (lead_id + fields to update + optional log entry), finds the correct row in the Leads tab by lead_id, writes updates to that row, and optionally appends a row to Sequenz_Log.
- **Requirements covered**: OUT-03, OUT-04, ERR-01

### Node List

#### Node 1: Execute Workflow Trigger

```
id: "wf6-trigger"
name: "Execute Workflow Trigger"
type: "n8n-nodes-base.executeWorkflowTrigger"
typeVersion: 1.1
position: [100, 300]
parameters: {}
```

This is the entry point when WF6 is called from another n8n workflow via Execute Workflow node. It receives the full payload passed by the caller.

**Output data shape** (what the trigger delivers to downstream nodes):
```json
{
  "lead_id": "LEAD-001",
  "updates": {
    "status": "In Sequenz",
    "score": 75,
    "score_begründung": "Guter Fit: KMU, Entscheider, IT-Branche",
    "sequenz_schritt": 1,
    "nächster_kontakt": "2026-03-15",
    "linkedin_nachricht": "..."
  },
  "log_eintrag": {
    "aktion": "email_1_gesendet",
    "inhalt": "Betreff: ... | Text: ..."
  }
}
```

Note: `log_eintrag` is optional. When absent, the Sequenz_Log append step is skipped.

---

#### Node 2: Google Sheets — Find Lead Row

```
id: "sheets-find-lead"
name: "Sheets: Find Lead Row"
type: "n8n-nodes-base.googleSheets"
typeVersion: 4.7
position: [350, 300]
credentials:
  googleSheetsOAuth2Api:
    id: "gw0DIdDENFkpE7ZW"
    name: "Google Sheets account"
parameters:
  operation: "read"
  documentId:
    __rl: true
    mode: "id"
    value: "SALES_AGENT_SHEET_ID"    # executor fills in real Sheet ID
  sheetName:
    __rl: true
    mode: "name"
    value: "Leads"
  filtersUI:
    values:
      - lookupColumn: "lead_id"
        lookupValue: "={{ $json.lead_id }}"
  options:
    returnAllMatches: false
```

**Purpose**: Searches the Leads tab for the row where column A (lead_id) matches the incoming lead_id. Returns the matched row including its `row_number` metadata field.

**Output data shape**:
```json
{
  "row_number": 5,
  "lead_id": "LEAD-001",
  "vorname": "Max",
  "nachname": "Mustermann",
  "status": "Neu",
  ... (all other columns)
}
```

**Error handling**: `onError: "continueRegularOutput"` — if the lead is not found, the workflow continues and the Code node downstream handles the empty result gracefully.

**retryOnFail**: true, maxTries: 3, waitBetweenTries: 5000

---

#### Node 3: Code Node — Validate & Build Update Payload

```
id: "code-build-update"
name: "Code: Build Update Payload"
type: "n8n-nodes-base.code"
typeVersion: 2
position: [600, 300]
parameters:
  mode: "runOnceForEachItem"
  jsCode: |
    // Get the incoming payload from the trigger
    const trigger = $('Execute Workflow Trigger').first().json;
    const foundRow = $input.item.json;

    // Validate that we found a row
    if (!foundRow.row_number) {
      throw new Error(`Lead not found in Sheets: ${trigger.lead_id}`);
    }

    const updates = trigger.updates || {};
    const logEintrag = trigger.log_eintrag || null;

    // Build the update object — map field names to their column values
    // We pass all updates fields through; the Sheets update node uses column name matching
    const updatePayload = {
      row_number: foundRow.row_number,
      lead_id: trigger.lead_id,
      log_eintrag: logEintrag,
      has_log: logEintrag !== null && logEintrag !== undefined,
      // Spread all update fields so they are available as $json.fieldName
      ...updates
    };

    return { json: updatePayload };
```

**Purpose**: Validates that a row was found, extracts row_number, merges incoming update fields into a flat object for the Sheets update node, and flags whether a log entry needs to be written.

**Output data shape**:
```json
{
  "row_number": 5,
  "lead_id": "LEAD-001",
  "status": "In Sequenz",
  "score": 75,
  "score_begründung": "...",
  "sequenz_schritt": 1,
  "nächster_kontakt": "2026-03-15",
  "has_log": true,
  "log_eintrag": { "aktion": "email_1_gesendet", "inhalt": "..." }
}
```

---

#### Node 4: Google Sheets — Update Lead Row

```
id: "sheets-update-lead"
name: "Sheets: Update Lead Row"
type: "n8n-nodes-base.googleSheets"
typeVersion: 4.7
position: [850, 300]
credentials:
  googleSheetsOAuth2Api:
    id: "gw0DIdDENFkpE7ZW"
    name: "Google Sheets account"
parameters:
  operation: "update"
  documentId:
    __rl: true
    mode: "id"
    value: "SALES_AGENT_SHEET_ID"    # executor fills in real Sheet ID
  sheetName:
    __rl: true
    mode: "name"
    value: "Leads"
  columns:
    mappingMode: "defineBelow"
    matchingColumns: ["row_number"]
    value:
      row_number: "={{ $json.row_number }}"
      status: "={{ $json.status }}"
      score: "={{ $json.score }}"
      score_begründung: "={{ $json['score_begründung'] }}"
      sequenz_schritt: "={{ $json.sequenz_schritt }}"
      letzter_kontakt: "={{ $json.letzter_kontakt }}"
      nächster_kontakt: "={{ $json['nächster_kontakt'] }}"
      email_1_gesendet: "={{ $json.email_1_gesendet }}"
      email_2_gesendet: "={{ $json.email_2_gesendet }}"
      email_3_gesendet: "={{ $json.email_3_gesendet }}"
      email_4_gesendet: "={{ $json.email_4_gesendet }}"
      linkedin_nachricht: "={{ $json.linkedin_nachricht }}"
      antwort_erhalten: "={{ $json.antwort_erhalten }}"
      antwort_inhalt: "={{ $json.antwort_inhalt }}"
      termin_vereinbart: "={{ $json.termin_vereinbart }}"
      termin_datum: "={{ $json.termin_datum }}"
      draft_erstellt: "={{ $json.draft_erstellt }}"
  options: {}
```

**Important notes on column mapping**:
- Columns with umlauts (score_begründung, nächster_kontakt) use bracket notation in expressions: `$json['score_begründung']`
- The `row_number` is the matching column — n8n Google Sheets node uses this to identify which row to update
- Fields not present in the payload will be empty strings — the Sheets node only writes columns that have non-empty expressions. Use the schema definition (see Node Configuration Details section) to mark optional columns as `removed: true` for columns that are not being updated in this call.
- **Preferred alternative**: Use `mappingMode: "autoMapInputData"` so the node automatically maps all fields present in `$json` to matching column names. This avoids needing to list every column explicitly.

**retryOnFail**: true, maxTries: 3, waitBetweenTries: 5000

---

#### Node 5: IF — Has Log Entry?

```
id: "if-has-log"
name: "IF: Has Log Entry"
type: "n8n-nodes-base.if"
typeVersion: 2.2
position: [1100, 300]
parameters:
  conditions:
    options:
      caseSensitive: true
      leftValue: ""
      typeValidation: "strict"
      version: 2
    conditions:
      - id: "check-log"
        leftValue: "={{ $json.has_log }}"
        rightValue: true
        operator:
          type: "boolean"
          operation: "true"
  combineOperation: "all"
```

**Purpose**: Routes execution to the log-append branch only when a `log_eintrag` was provided in the payload.

**Output**:
- Output 0 (true): has_log = true → append to Sequenz_Log
- Output 1 (false): has_log = false → skip log, go to respond

---

#### Node 6: Google Sheets — Append Log Entry

```
id: "sheets-append-log"
name: "Sheets: Append Log Entry"
type: "n8n-nodes-base.googleSheets"
typeVersion: 4.7
position: [1350, 200]
credentials:
  googleSheetsOAuth2Api:
    id: "gw0DIdDENFkpE7ZW"
    name: "Google Sheets account"
parameters:
  operation: "append"
  documentId:
    __rl: true
    mode: "id"
    value: "SALES_AGENT_SHEET_ID"    # executor fills in real Sheet ID
  sheetName:
    __rl: true
    mode: "name"
    value: "Sequenz_Log"
  columns:
    mappingMode: "defineBelow"
    value:
      timestamp: "={{ $now.toISO() }}"
      lead_id: "={{ $json.lead_id }}"
      aktion: "={{ $json.log_eintrag.aktion }}"
      inhalt: "={{ $json.log_eintrag.inhalt }}"
      status: "={{ $json.status ?? 'ok' }}"
  options: {}
```

**Tab "Sequenz_Log" columns**: A=timestamp, B=lead_id, C=aktion, D=inhalt, E=status

**retryOnFail**: true, maxTries: 3, waitBetweenTries: 5000

---

#### Node 7: Set — Prepare Success Response

```
id: "set-success-response"
name: "Set: Success Response"
type: "n8n-nodes-base.set"
typeVersion: 3.4
position: [1600, 300]
parameters:
  fields:
    values:
      - name: "success"
        type: "booleanValue"
        booleanValue: true
      - name: "lead_id"
        type: "stringValue"
        stringValue: "={{ $('Execute Workflow Trigger').first().json.lead_id }}"
      - name: "updated_at"
        type: "stringValue"
        stringValue: "={{ $now.toISO() }}"
  options: {}
  include: "selected"
```

**Purpose**: Builds a clean success response that is returned to the calling workflow (WF0 or other sub-WFs).

**Output**:
```json
{
  "success": true,
  "lead_id": "LEAD-001",
  "updated_at": "2026-03-08T08:05:23.000Z"
}
```

---

### WF6 Connections

```
Execute Workflow Trigger → Sheets: Find Lead Row
Sheets: Find Lead Row → Code: Build Update Payload
Code: Build Update Payload → Sheets: Update Lead Row
Sheets: Update Lead Row → IF: Has Log Entry
IF: Has Log Entry [output 0 / true] → Sheets: Append Log Entry
IF: Has Log Entry [output 1 / false] → Set: Success Response
Sheets: Append Log Entry → Set: Success Response
```

Connection format for executor:
```json
{
  "Execute Workflow Trigger": {
    "main": [[{ "node": "Sheets: Find Lead Row", "type": "main", "index": 0 }]]
  },
  "Sheets: Find Lead Row": {
    "main": [[{ "node": "Code: Build Update Payload", "type": "main", "index": 0 }]]
  },
  "Code: Build Update Payload": {
    "main": [[{ "node": "Sheets: Update Lead Row", "type": "main", "index": 0 }]]
  },
  "Sheets: Update Lead Row": {
    "main": [[{ "node": "IF: Has Log Entry", "type": "main", "index": 0 }]]
  },
  "IF: Has Log Entry": {
    "main": [
      [{ "node": "Sheets: Append Log Entry", "type": "main", "index": 0 }],
      [{ "node": "Set: Success Response", "type": "main", "index": 0 }]
    ]
  },
  "Sheets: Append Log Entry": {
    "main": [[{ "node": "Set: Success Response", "type": "main", "index": 0 }]]
  }
}
```

---

### WF6 Data Flow Summary

```
[Execute Workflow Trigger]
  INPUT:  { lead_id, updates: {...}, log_eintrag: {...} }
          ↓
[Sheets: Find Lead Row]
  ACTION: Filter Leads tab by lead_id (column A)
  OUTPUT: { row_number, lead_id, status, score, ... }
          ↓
[Code: Build Update Payload]
  ACTION: Validate row found, merge trigger.updates into flat object
  OUTPUT: { row_number, lead_id, has_log, log_eintrag, ...update_fields }
          ↓
[Sheets: Update Lead Row]
  ACTION: Update matched row with all update fields
  OUTPUT: same json (passthrough)
          ↓
[IF: Has Log Entry]
  TRUE  → [Sheets: Append Log Entry] → [Set: Success Response]
  FALSE → [Set: Success Response]
          ↓
[Set: Success Response]
  OUTPUT: { success: true, lead_id, updated_at }
  → returned to calling workflow
```

---

### WF6 Key Expressions Reference

| Node | Field | Expression |
|------|-------|-----------|
| Sheets: Find Lead Row | lookupValue | `={{ $json.lead_id }}` |
| Code: Build Update Payload | jsCode | `$('Execute Workflow Trigger').first().json` |
| Sheets: Update Lead Row | score_begründung | `={{ $json['score_begründung'] }}` |
| Sheets: Update Lead Row | nächster_kontakt | `={{ $json['nächster_kontakt'] }}` |
| Sheets: Append Log Entry | timestamp | `={{ $now.toISO() }}` |
| Sheets: Append Log Entry | aktion | `={{ $json.log_eintrag.aktion }}` |
| Set: Success Response | lead_id | `={{ $('Execute Workflow Trigger').first().json.lead_id }}` |

**Critical**: Fields with umlauts MUST use bracket notation in expressions. `$json.nächster_kontakt` may fail in some n8n expression contexts — always use `$json['nächster_kontakt']`.

---

### WF6 Settings

```json
{
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner"
  }
}
```

---

### WF6 Testing Instructions

**Standalone test** (before WF0 exists):
1. Deploy WF6 to n8n
2. In n8n, manually execute WF6 by using the "Test" feature — but since it uses Execute Workflow Trigger, create a temporary test workflow:
   - Add a Manual Trigger node
   - Add a Set node that outputs the test payload (see below)
   - Add an Execute Workflow node pointing to WF6
3. Test payload:
```json
{
  "lead_id": "LEAD-TEST-001",
  "updates": {
    "status": "In Sequenz",
    "score": 75,
    "score_begründung": "Test-Begründung",
    "sequenz_schritt": 1,
    "nächster_kontakt": "2026-03-15"
  },
  "log_eintrag": {
    "aktion": "test_aktion",
    "inhalt": "Test-Inhalt"
  }
}
```

**Verification checklist**:
- [ ] Row in Leads tab with matching lead_id gets updated
- [ ] score_begründung column (N) is written correctly with umlaut
- [ ] nächster_kontakt column (Q) is written correctly with umlaut
- [ ] New row appears in Sequenz_Log with timestamp, lead_id, aktion, inhalt, status
- [ ] Return value to calling workflow: `{ success: true, lead_id: "LEAD-TEST-001" }`
- [ ] Test with missing log_eintrag — verify no Sequenz_Log row is written
- [ ] Test with non-existent lead_id — verify error is thrown (not silent fail)

---

## WF0: Master Orchestrator

### Overview

- **Name**: Sales Agent — WF0 Master Orchestrator
- **Triggers**: Schedule (daily 08:00) + Manual Trigger
- **Purpose**: Reads all leads from Google Sheets, filters by status, loops over qualifying leads one at a time with rate limiting, and calls sub-workflows (WF1→WF2→WF3/WF4/WF5→WF6) for each lead.
- **Phase 1 note**: In Phase 1, WF1/WF2/WF3/WF4/WF5 do not exist yet. The Execute Workflow nodes for those sub-WFs are designed as pass-through stubs. WF0 can be tested end-to-end in Phase 1 by validating the loop, filter, rate-limiting, and WF6 call logic.
- **Requirements covered**: TRIG-01, TRIG-02, DATA-01, DATA-09, ERR-01

---

### Node List

#### Node 1: Schedule Trigger

```
id: "schedule-trigger"
name: "Schedule Trigger"
type: "n8n-nodes-base.scheduleTrigger"
typeVersion: 1.2
position: [100, 200]
parameters:
  rule:
    interval:
      - field: "cronExpression"
        expression: "0 8 * * *"
```

**Purpose**: Fires daily at 08:00 (server time). Produces one empty item to start the workflow.

---

#### Node 2: Manual Trigger

```
id: "manual-trigger"
name: "When clicking 'Test workflow'"
type: "n8n-nodes-base.manualTrigger"
typeVersion: 1
position: [100, 400]
parameters: {}
```

**Purpose**: Allows manual execution during testing. Produces one empty item.

---

#### Node 3: Merge Triggers

```
id: "merge-triggers"
name: "Merge: Both Triggers"
type: "n8n-nodes-base.merge"
typeVersion: 3.1
position: [350, 300]
parameters:
  mode: "passThrough"
  output: "input1"
  options: {}
```

**Purpose**: Both triggers feed into this merge node. Only one trigger fires at a time — the merge passes the active trigger's output through, ensuring the rest of the workflow runs identically regardless of which trigger activated.

**Connection note**: Schedule Trigger connects to input 0, Manual Trigger connects to input 1.

---

#### Node 4: Google Sheets — Get All Leads

```
id: "sheets-get-leads"
name: "Sheets: Get All Leads"
type: "n8n-nodes-base.googleSheets"
typeVersion: 4.7
position: [600, 300]
credentials:
  googleSheetsOAuth2Api:
    id: "gw0DIdDENFkpE7ZW"
    name: "Google Sheets account"
parameters:
  operation: "read"
  documentId:
    __rl: true
    mode: "id"
    value: "SALES_AGENT_SHEET_ID"    # executor fills in real Sheet ID
  sheetName:
    __rl: true
    mode: "name"
    value: "Leads"
  filtersUI: {}
  options:
    returnAllMatches: true
```

**Purpose**: Reads all rows from the Leads tab. Returns one item per row, each containing all 28 columns (A–AB) as named fields.

**Output data shape** (one item per lead):
```json
{
  "row_number": 2,
  "lead_id": "LEAD-001",
  "vorname": "Max",
  "nachname": "Mustermann",
  "email": "max@example.com",
  "unternehmen": "Beispiel GmbH",
  "position": "Geschäftsführer",
  "branche": "IT",
  "mitarbeiter_anzahl": "50",
  "website": "https://beispiel.de",
  "linkedin_url": "https://linkedin.com/in/max",
  "notizen": "",
  "status": "Neu",
  "score": "",
  "score_begründung": "",
  "sequenz_schritt": "0",
  "letzter_kontakt": "",
  "nächster_kontakt": "",
  "email_1_gesendet": "FALSE",
  "email_2_gesendet": "FALSE",
  "email_3_gesendet": "FALSE",
  "email_4_gesendet": "FALSE",
  "linkedin_nachricht": "",
  "antwort_erhalten": "FALSE",
  "antwort_inhalt": "",
  "termin_vereinbart": "FALSE",
  "termin_datum": "",
  "draft_erstellt": "FALSE",
  "erstellt_am": "2026-03-01"
}
```

**retryOnFail**: true, maxTries: 3, waitBetweenTries: 5000

---

#### Node 5: IF — Filter by Status

```
id: "filter-status"
name: "IF: Filter by Status"
type: "n8n-nodes-base.if"
typeVersion: 2.2
position: [850, 300]
parameters:
  conditions:
    options:
      caseSensitive: true
      leftValue: ""
      typeValidation: "loose"
      version: 2
    conditions:
      - id: "check-neu"
        leftValue: "={{ $json.status }}"
        rightValue: "Neu"
        operator:
          type: "string"
          operation: "equals"
      - id: "check-in-sequenz"
        leftValue: "={{ $json.status }}"
        rightValue: "In Sequenz"
        operator:
          type: "string"
          operation: "equals"
  combineOperation: "any"
```

**Purpose**: Passes through only leads with status = "Neu" OR "In Sequenz". Discards all other statuses (Abgeschlossen, Verloren, Kalt, Fehler-*).

**Output 0 (true)**: Qualifying leads — pass to SplitInBatches
**Output 1 (false)**: Non-qualifying leads — no further action needed (connection not required, or connect to a NoOp node)

---

#### Node 6: SplitInBatches — Loop Over Leads

```
id: "split-leads"
name: "SplitInBatches: Loop Leads"
type: "n8n-nodes-base.splitInBatches"
typeVersion: 3
position: [1100, 300]
parameters:
  batchSize: 1
  options: {}
```

**Purpose**: Processes exactly one lead at a time. This enables the Wait node to insert a 3-second pause between each lead.

**Connection note** (CRITICAL — from n8n-rules-summary.md):
- Output **Index 0** = "done" (all leads processed) → end of workflow
- Output **Index 1** = "loop" (next lead iteration) → Wait node → sub-workflow calls → back to SplitInBatches

---

#### Node 7: Wait — Rate Limit Pause

```
id: "wait-rate-limit"
name: "Wait: Rate Limit"
type: "n8n-nodes-base.wait"
typeVersion: 1.1
position: [1350, 300]
parameters:
  amount: 3
  unit: "seconds"
  resume: "timeInterval"
```

**Purpose**: Pauses 3 seconds between processing each lead. Prevents Gmail API rate limiting when sub-workflows send emails. Located immediately after the SplitInBatches loop output.

---

#### Node 8: Execute Workflow — WF1 Lead Enrichment (Stub)

```
id: "exec-wf1-enrichment"
name: "Execute: WF1 Lead Enrichment"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [1600, 300]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "PLACEHOLDER_WF1_ID"    # Phase 2: replace with actual WF1 n8n ID
  options:
    waitForSubWorkflow: true
```

**Input data**: Full lead data item from SplitInBatches (all 28 columns).

**Phase 1 behavior**: WF1 does not exist yet. The executor has two options:
1. Leave the workflowId as a placeholder — WF0 will error on this node but the rest of the structure is valid.
2. Create a minimal stub WF1 (Execute Workflow Trigger → Set node that returns `$input.first().json` unchanged) and use its ID here.

**Recommended for Phase 1**: Option 2 (stub workflow). The stub WF1 must:
- Start with Execute Workflow Trigger
- Return the same data it receives (passthrough)
- Be named "Sales Agent — WF1 Stub (Phase 1)"

**Output**: WF1 returns enriched lead data. In Phase 1 (stub), returns the same lead data unchanged.

---

#### Node 9: Execute Workflow — WF2 Lead Scoring (Stub)

```
id: "exec-wf2-scoring"
name: "Execute: WF2 Lead Scoring"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [1850, 300]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "PLACEHOLDER_WF2_ID"    # Phase 2: replace with actual WF2 n8n ID
  options:
    waitForSubWorkflow: true
```

**Input data**: Enriched lead data from WF1.

**Phase 1 stub behavior**: WF2 stub must return lead data with a `score` field added:
```json
{ ...lead_data, "score": 75, "klassifikation": "Standard" }
```
This allows the IF score check (Node 10) to function during Phase 1 testing.

**Output**: Lead data enriched with score (0–100), klassifikation (Kalt/Standard/Premium).

---

#### Node 10: IF — Score Check (>= 30?)

```
id: "if-score-check"
name: "IF: Score >= 30?"
type: "n8n-nodes-base.if"
typeVersion: 2.2
position: [2100, 300]
parameters:
  conditions:
    options:
      caseSensitive: true
      leftValue: ""
      typeValidation: "loose"
      version: 2
    conditions:
      - id: "check-score"
        leftValue: "={{ $json.score }}"
        rightValue: 30
        operator:
          type: "number"
          operation: "gte"
  combineOperation: "all"
```

**Output 0 (true)**: score >= 30 → lead qualifies for email sequence → go to IF Status New check
**Output 1 (false)**: score < 30 → lead is cold → call WF6 to set status = "Kalt"

---

#### Node 11: IF — Status = "Neu"? (for qualified leads)

```
id: "if-status-new"
name: "IF: Status = Neu?"
type: "n8n-nodes-base.if"
typeVersion: 2.2
position: [2350, 200]
parameters:
  conditions:
    options:
      caseSensitive: true
      leftValue: ""
      typeValidation: "strict"
      version: 2
    conditions:
      - id: "check-status-neu"
        leftValue: "={{ $json.status }}"
        rightValue: "Neu"
        operator:
          type: "string"
          operation: "equals"
  combineOperation: "all"
```

**Output 0 (true)**: status = "Neu" → new lead → call WF3 (email generator), WF4 (email sender), WF5 (LinkedIn)
**Output 1 (false)**: status = "In Sequenz" → existing sequence → call WF4 only (next email)

---

#### Node 12: Execute Workflow — WF3 Email Sequence Generator (Stub)

```
id: "exec-wf3-emails"
name: "Execute: WF3 Email Generator"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [2600, 100]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "PLACEHOLDER_WF3_ID"    # Phase 3: replace with actual WF3 n8n ID
  options:
    waitForSubWorkflow: true
```

Only called for "Neu" leads with score >= 30. In Phase 1, stub passes data through.

---

#### Node 13: Execute Workflow — WF4 Email Sender (for Neu leads, after WF3)

```
id: "exec-wf4-neu"
name: "Execute: WF4 Email Sender (Neu)"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [2850, 100]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "PLACEHOLDER_WF4_ID"    # Phase 3: replace with actual WF4 n8n ID
  options:
    waitForSubWorkflow: true
```

---

#### Node 14: Execute Workflow — WF5 LinkedIn Content Generator (Stub)

```
id: "exec-wf5-linkedin"
name: "Execute: WF5 LinkedIn Generator"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [3100, 100]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "PLACEHOLDER_WF5_ID"    # Phase 4: replace with actual WF5 n8n ID
  options:
    waitForSubWorkflow: true
```

Only called for "Neu" leads. In Phase 4, this will be filled in.

---

#### Node 15: Execute Workflow — WF4 Email Sender (for In Sequenz leads)

```
id: "exec-wf4-sequenz"
name: "Execute: WF4 Email Sender (In Sequenz)"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [2600, 350]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "PLACEHOLDER_WF4_ID"    # Phase 3: replace with actual WF4 n8n ID
  options:
    waitForSubWorkflow: true
```

Only called for "In Sequenz" leads (IF Status = Neu → output 1 false).

---

#### Node 16: Execute Workflow — WF6 CRM Updater (Mark as Kalt)

```
id: "exec-wf6-kalt"
name: "Execute: WF6 CRM — Set Kalt"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [2350, 450]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "WF6_ACTUAL_ID"    # executor fills in after deploying WF6
  options:
    waitForSubWorkflow: true
  inputData:
    values:
      - name: "lead_id"
        value: "={{ $json.lead_id }}"
      - name: "updates"
        value: "={{ { \"status\": \"Kalt\", \"score\": $json.score, \"score_begründung\": $json['score_begründung'] } }}"
```

**Purpose**: Called when score < 30. Updates the lead's status to "Kalt" in Google Sheets via WF6.

**Alternative approach** (simpler): Use a Set node before this Execute Workflow to build the payload cleanly:

```
id: "set-kalt-payload"
name: "Set: Kalt Payload"
type: "n8n-nodes-base.set"
typeVersion: 3.4
position: [2350, 450]
parameters:
  fields:
    values:
      - name: "lead_id"
        type: "stringValue"
        stringValue: "={{ $json.lead_id }}"
      - name: "updates"
        type: "objectValue"
        objectValue: "={{ { \"status\": \"Kalt\", \"score\": $json.score } }}"
  options: {}
  include: "selected"
```

Then the Execute Workflow node for WF6 (Kalt) follows at position [2600, 450].

---

#### Node 17: Execute Workflow — WF6 CRM Final Update (after sequence processing)

```
id: "exec-wf6-final"
name: "Execute: WF6 CRM — Final Update"
type: "n8n-nodes-base.executeWorkflow"
typeVersion: 1.2
position: [3350, 250]
parameters:
  source: "database"
  workflowId:
    __rl: true
    mode: "id"
    value: "WF6_ACTUAL_ID"    # executor fills in after deploying WF6
  options:
    waitForSubWorkflow: true
```

**Purpose**: Called after WF3/WF4/WF5 complete for "Neu" leads, or after WF4 completes for "In Sequenz" leads. Updates CRM with the final state. In Phase 1 (stubs), this writes the score and updates the status from "Neu" to "In Sequenz".

**Note**: In Phase 1, the payload for this node should update `status` to "In Sequenz" and write the score. A Set node should precede this to build the payload.

---

#### Node 18: Merge — Rejoin After Sequence Branches

```
id: "merge-after-sequence"
name: "Merge: After Sequence"
type: "n8n-nodes-base.merge"
typeVersion: 3.1
position: [3100, 250]
parameters:
  mode: "passThrough"
  output: "input1"
  options: {}
```

**Purpose**: Merges the "Neu" branch (WF5 → here) and "In Sequenz" branch (WF4 Sequenz → here) back into a single flow before calling WF6 Final Update.

**Inputs**:
- Input 0: from "Execute: WF5 LinkedIn Generator" (Neu path)
- Input 1: from "Execute: WF4 Email Sender (In Sequenz)"

---

#### Node 19: Loop Back to SplitInBatches

The SplitInBatches loop is closed by connecting the final WF6 response back to the SplitInBatches node (Input 0 of SplitInBatches).

**Pattern** (from n8n-rules-summary.md, SplitInBatches section):
- SplitInBatches Output 1 (loop) → Wait → processing chain → back to SplitInBatches Input
- The loop-back connection target is: `{ "node": "SplitInBatches: Loop Leads", "type": "main", "index": 0 }`

---

### WF0 Connections

```
Schedule Trigger [output 0] → Merge: Both Triggers [input 0]
Manual Trigger [output 0] → Merge: Both Triggers [input 1]
Merge: Both Triggers → Sheets: Get All Leads
Sheets: Get All Leads → IF: Filter by Status
IF: Filter by Status [output 0 / true] → SplitInBatches: Loop Leads
SplitInBatches: Loop Leads [output 1 / loop] → Wait: Rate Limit
Wait: Rate Limit → Execute: WF1 Lead Enrichment
Execute: WF1 Lead Enrichment → Execute: WF2 Lead Scoring
Execute: WF2 Lead Scoring → IF: Score >= 30?
IF: Score >= 30? [output 0 / true] → IF: Status = Neu?
IF: Score >= 30? [output 1 / false] → Set: Kalt Payload
Set: Kalt Payload → Execute: WF6 CRM — Set Kalt
Execute: WF6 CRM — Set Kalt → SplitInBatches: Loop Leads [input 0]

IF: Status = Neu? [output 0 / true] → Execute: WF3 Email Generator
Execute: WF3 Email Generator → Execute: WF4 Email Sender (Neu)
Execute: WF4 Email Sender (Neu) → Execute: WF5 LinkedIn Generator
Execute: WF5 LinkedIn Generator → Merge: After Sequence [input 0]

IF: Status = Neu? [output 1 / false] → Execute: WF4 Email Sender (In Sequenz)
Execute: WF4 Email Sender (In Sequenz) → Merge: After Sequence [input 1]

Merge: After Sequence → Execute: WF6 CRM — Final Update
Execute: WF6 CRM — Final Update → SplitInBatches: Loop Leads [input 0]

SplitInBatches: Loop Leads [output 0 / done] → (end — no connection needed)
```

**Critical loop-back connections** (both the Kalt path and the normal path loop back to SplitInBatches):

```json
"Execute: WF6 CRM — Set Kalt": {
  "main": [[{ "node": "SplitInBatches: Loop Leads", "type": "main", "index": 0 }]]
},
"Execute: WF6 CRM — Final Update": {
  "main": [[{ "node": "SplitInBatches: Loop Leads", "type": "main", "index": 0 }]]
}
```

Full connections object for executor:
```json
{
  "Schedule Trigger": {
    "main": [[{ "node": "Merge: Both Triggers", "type": "main", "index": 0 }]]
  },
  "When clicking 'Test workflow'": {
    "main": [[{ "node": "Merge: Both Triggers", "type": "main", "index": 1 }]]
  },
  "Merge: Both Triggers": {
    "main": [[{ "node": "Sheets: Get All Leads", "type": "main", "index": 0 }]]
  },
  "Sheets: Get All Leads": {
    "main": [[{ "node": "IF: Filter by Status", "type": "main", "index": 0 }]]
  },
  "IF: Filter by Status": {
    "main": [
      [{ "node": "SplitInBatches: Loop Leads", "type": "main", "index": 0 }],
      []
    ]
  },
  "SplitInBatches: Loop Leads": {
    "main": [
      [],
      [{ "node": "Wait: Rate Limit", "type": "main", "index": 0 }]
    ]
  },
  "Wait: Rate Limit": {
    "main": [[{ "node": "Execute: WF1 Lead Enrichment", "type": "main", "index": 0 }]]
  },
  "Execute: WF1 Lead Enrichment": {
    "main": [[{ "node": "Execute: WF2 Lead Scoring", "type": "main", "index": 0 }]]
  },
  "Execute: WF2 Lead Scoring": {
    "main": [[{ "node": "IF: Score >= 30?", "type": "main", "index": 0 }]]
  },
  "IF: Score >= 30?": {
    "main": [
      [{ "node": "IF: Status = Neu?", "type": "main", "index": 0 }],
      [{ "node": "Set: Kalt Payload", "type": "main", "index": 0 }]
    ]
  },
  "IF: Status = Neu?": {
    "main": [
      [{ "node": "Execute: WF3 Email Generator", "type": "main", "index": 0 }],
      [{ "node": "Execute: WF4 Email Sender (In Sequenz)", "type": "main", "index": 0 }]
    ]
  },
  "Execute: WF3 Email Generator": {
    "main": [[{ "node": "Execute: WF4 Email Sender (Neu)", "type": "main", "index": 0 }]]
  },
  "Execute: WF4 Email Sender (Neu)": {
    "main": [[{ "node": "Execute: WF5 LinkedIn Generator", "type": "main", "index": 0 }]]
  },
  "Execute: WF5 LinkedIn Generator": {
    "main": [[{ "node": "Merge: After Sequence", "type": "main", "index": 0 }]]
  },
  "Execute: WF4 Email Sender (In Sequenz)": {
    "main": [[{ "node": "Merge: After Sequence", "type": "main", "index": 1 }]]
  },
  "Merge: After Sequence": {
    "main": [[{ "node": "Execute: WF6 CRM — Final Update", "type": "main", "index": 0 }]]
  },
  "Set: Kalt Payload": {
    "main": [[{ "node": "Execute: WF6 CRM — Set Kalt", "type": "main", "index": 0 }]]
  },
  "Execute: WF6 CRM — Set Kalt": {
    "main": [[{ "node": "SplitInBatches: Loop Leads", "type": "main", "index": 0 }]]
  },
  "Execute: WF6 CRM — Final Update": {
    "main": [[{ "node": "SplitInBatches: Loop Leads", "type": "main", "index": 0 }]]
  }
}
```

---

### WF0 Data Flow Summary

```
[Schedule Trigger / Manual Trigger]
  → [Merge: Both Triggers]
  → [Sheets: Get All Leads]      reads all rows from Tab "Leads"
  → [IF: Filter by Status]       keeps "Neu" + "In Sequenz" only
  → [SplitInBatches: Loop Leads] one lead at a time
      ↓ (output 1 = loop)
  → [Wait: Rate Limit]           3 second pause
  → [Execute: WF1 Lead Enrichment]  → enriched lead data
  → [Execute: WF2 Lead Scoring]     → lead + score (0-100)
  → [IF: Score >= 30?]
        TRUE → [IF: Status = Neu?]
                  TRUE → WF3 → WF4 (Neu) → WF5 → Merge
                  FALSE → WF4 (Sequenz) → Merge
               → [Execute: WF6 CRM — Final Update]
               → back to SplitInBatches
        FALSE → [Set: Kalt Payload]
              → [Execute: WF6 CRM — Set Kalt]
              → back to SplitInBatches
      ↓ (output 0 = done, all leads processed)
  [end]
```

---

### WF0 Key Expressions Reference

| Node | Field | Expression |
|------|-------|-----------|
| IF: Filter by Status | leftValue (Neu) | `={{ $json.status }}` |
| IF: Filter by Status | leftValue (In Sequenz) | `={{ $json.status }}` |
| IF: Score >= 30? | leftValue | `={{ $json.score }}` |
| IF: Status = Neu? | leftValue | `={{ $json.status }}` |
| Set: Kalt Payload | lead_id | `={{ $json.lead_id }}` |
| Set: Kalt Payload | updates.score | `={{ $json.score }}` |
| Execute: WF6 nodes | workflowId | literal WF6 n8n ID (not expression) |

---

### WF0 Settings

```json
{
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner",
    "timeoutWorkflow": false
  }
}
```

---

### WF0 Testing Instructions

**Phase 1 test setup** (before WF1/WF2/WF3/WF4/WF5 exist):

1. Add at least 2 test rows to the Leads tab:
   - Row 1: status = "Neu", lead_id = "LEAD-TEST-001"
   - Row 2: status = "Kalt" (should be filtered out)
   - Row 3: status = "In Sequenz", lead_id = "LEAD-TEST-002"

2. Deploy WF6 first, note its n8n workflow ID.

3. Create stub workflows for WF1 and WF2:
   - WF1 Stub: Execute Workflow Trigger → Set (returns input unchanged)
   - WF2 Stub: Execute Workflow Trigger → Set (adds `score: 75` to output)
   - Note both n8n IDs.

4. Deploy WF0 with:
   - WF6 actual ID in all WF6 Execute Workflow nodes
   - WF1 stub ID in exec-wf1-enrichment
   - WF2 stub ID in exec-wf2-scoring
   - Leave WF3/WF4/WF5 as placeholders (or create minimal stubs)
   - Real Google Sheet ID in sheets-get-leads

5. Click "Test workflow" (Manual Trigger).

**Verification checklist**:
- [ ] Both triggers activate the workflow (test both)
- [ ] Sheets: Get All Leads returns all rows from Leads tab
- [ ] IF Filter: only rows with status "Neu" or "In Sequenz" pass through
- [ ] SplitInBatches processes exactly 1 lead per iteration
- [ ] Wait node pauses 3 seconds (visible in execution timeline)
- [ ] WF1 stub is called, data passes through
- [ ] WF2 stub is called, returns data with score = 75
- [ ] IF Score >= 30: lead with score 75 goes to TRUE branch
- [ ] IF Status = Neu: LEAD-TEST-001 goes to Neu branch, LEAD-TEST-002 to In Sequenz branch
- [ ] WF6 is called and updates the sheet correctly (check Google Sheet)
- [ ] Loop processes LEAD-TEST-001, then LEAD-TEST-002 (two iterations visible)
- [ ] Loop ends after all qualifying leads are processed (SplitInBatches output 0 = done)

---

## Node Configuration Details

### Google Sheets documentId Placeholder

Both WF6 and WF0 use `"SALES_AGENT_SHEET_ID"` as a placeholder for the actual Google Sheets document ID. The executor must replace this with the real ID.

To find the Sheet ID: open the Google Sheet, copy the ID from the URL:
`https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit`

### Execute Workflow Node — How Sub-WF Data Passing Works

When calling a sub-workflow via Execute Workflow node with `waitForSubWorkflow: true`:
- The calling node passes its current item's JSON data as the input to the sub-workflow
- The sub-workflow receives this via its Execute Workflow Trigger node
- The sub-workflow's final node output is returned to the calling node
- The calling workflow continues with the returned data

This is why all sub-WFs must start with `n8n-nodes-base.executeWorkflowTrigger` (not a Webhook trigger).

### WF6 workflowId in WF0

After deploying WF6, the executor will receive an n8n workflow ID (format: alphanumeric string like `O54X9J442WJFax2k`). This ID must be entered in:
- exec-wf6-kalt: `workflowId.value`
- exec-wf6-final: `workflowId.value`

### Set: Kalt Payload — Full Parameters

```json
{
  "id": "set-kalt-payload",
  "name": "Set: Kalt Payload",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [2350, 450],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "lead_id",
          "type": "stringValue",
          "stringValue": "={{ $json.lead_id }}"
        },
        {
          "name": "updates",
          "type": "objectValue",
          "objectValue": "={{ { \"status\": \"Kalt\", \"score\": $json.score, \"score_begr\\u00FCndung\": $json['score_begr\\u00FCndung'] } }}"
        },
        {
          "name": "log_eintrag",
          "type": "objectValue",
          "objectValue": "={{ { \"aktion\": \"score_zu_niedrig\", \"inhalt\": \"Score: \" + $json.score + \" (unter 30)\" } }}"
        }
      ]
    },
    "include": "selected",
    "options": {}
  }
}
```

**Important**: The `objectValue` for updates with umlaut key `score_begründung` — use `$json['score_begründung']` inside the expression. If the expression engine has trouble with the umlaut in a template literal, use the unicode escape `\u00FC` for ü or pass the value through a Code node instead.

### Google Sheets Update — Column Schema for WF6

The Google Sheets update node in WF6 uses `mappingMode: "autoMapInputData"` as the recommended approach. This means n8n will automatically map fields from `$json` to matching column names in the sheet. The Code: Build Update Payload node must output field names that exactly match the column headers in the Leads tab (case-sensitive).

Column name exact strings (as they appear in row 1 of the Leads tab):
```
A: lead_id
B: vorname
C: nachname
D: email
E: unternehmen
F: position
G: branche
H: mitarbeiter_anzahl
I: website
J: linkedin_url
K: notizen
L: status
M: score
N: score_begründung
O: sequenz_schritt
P: letzter_kontakt
Q: nächster_kontakt
R: email_1_gesendet
S: email_2_gesendet
T: email_3_gesendet
U: email_4_gesendet
V: linkedin_nachricht
W: antwort_erhalten
X: antwort_inhalt
Y: termin_vereinbart
Z: termin_datum
AA: draft_erstellt
AB: erstellt_am
```

Fields with umlauts in column headers: `score_begründung` (N) and `nächster_kontakt` (Q).

When using `autoMapInputData`, n8n matches `$json` field names to sheet column headers. If the Code node outputs `{ "score_begründung": "...", "nächster_kontakt": "..." }`, n8n will match them to columns N and Q respectively — provided the sheet headers are exactly correct.

### WF6 Google Sheets Read — Filter Configuration

The `filtersUI` parameter for the read operation (finding a lead by lead_id):

```json
"filtersUI": {
  "values": [
    {
      "lookupColumn": "lead_id",
      "lookupValue": "={{ $json.lead_id }}"
    }
  ]
}
```

This tells the Google Sheets node to search column `lead_id` (column A header) for a value matching the incoming lead_id. The node returns all matching rows including the `row_number` metadata field that indicates which row number in the sheet the match was found on.

### Wait Node — typeVersion

The Wait node typeVersion 1.1 supports the `resume: "timeInterval"` mode with `amount` and `unit` parameters. Verify this is the current version before deployment.

---

## Validation Criteria

- [ ] All workflows validate via n8n-MCP `validate_workflow` with no errors
- [ ] No HTTP Request nodes (all operations use native Google Sheets node)
- [ ] All expressions use `={{ }}` syntax (not `{{ }}`)
- [ ] Fields with umlauts use bracket notation: `$json['nächster_kontakt']`
- [ ] Credentials `gw0DIdDENFkpE7ZW` set on all Google Sheets nodes
- [ ] WF6 deployed before WF0 (WF6 ID needed for WF0)
- [ ] SplitInBatches Output 0 = done (no connection), Output 1 = loop → Wait node
- [ ] Both loop-back connections go to SplitInBatches (Kalt path + normal path)
- [ ] Execute Workflow nodes use `waitForSubWorkflow: true`
- [ ] Google Sheets nodes: `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`
- [ ] Workflow settings: `executionOrder: "v1"` on both workflows
- [ ] WF6 `callerPolicy: "workflowsFromSameOwner"` (allows WF0 to call it)
- [ ] IF nodes use `typeVersion: 2.2` with `version: 2` in conditions.options
- [ ] Merge nodes use `typeVersion: 3.1`
- [ ] Set nodes use `typeVersion: 3.4`
- [ ] No node at position [0, 0]
- [ ] No overlapping nodes (250px horizontal spacing)

---

## Phase 1 Stub Workflows (for WF0 testing)

### WF1 Stub

Minimal workflow that passes data through unchanged:

```
Nodes:
  1. Execute Workflow Trigger (typeVersion 1.1, position [100, 300])
  2. Set: Pass Through (typeVersion 3.4, position [350, 300])
     - include: "all"  ← passes all fields through unchanged
     - fields.values: [] ← no new fields added

Connection: Execute Workflow Trigger → Set: Pass Through
Name: "Sales Agent — WF1 Stub (Phase 1)"
```

### WF2 Stub

Minimal workflow that adds a score field:

```
Nodes:
  1. Execute Workflow Trigger (typeVersion 1.1, position [100, 300])
  2. Set: Add Score (typeVersion 3.4, position [350, 300])
     - include: "all"
     - fields.values:
         - name: "score", type: "numberValue", numberValue: 75
         - name: "klassifikation", type: "stringValue", stringValue: "Standard"
         - name: "score_begründung", type: "stringValue", stringValue: "Phase 1 Stub — Score 75"

Connection: Execute Workflow Trigger → Set: Add Score
Name: "Sales Agent — WF2 Stub (Phase 1)"
```

### WF3/WF4/WF5 Stubs

All three are identical to WF1 Stub (pass through unchanged). Names:
- "Sales Agent — WF3 Stub (Phase 1)"
- "Sales Agent — WF4 Stub (Phase 1)"
- "Sales Agent — WF5 Stub (Phase 1)"

---

*Plan created: 2026-03-08*
*Phase: 1 of 5*
*Next step: Execute phase (build JSON, deploy WF6, then WF0)*
