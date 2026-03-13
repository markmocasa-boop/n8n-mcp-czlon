---
phase: 1
plan: 1
workflows: [WF1-BranchA]
type: n8n-workflow
---

# Plan 1-1: LinkedIn Follow-up Automation — Branch A (Neue Leads erkennen)

## Objective

Deploy a fully functional Branch A of WF1 that:
- Fires daily at 05:00 Europe/Berlin via Schedule Trigger
- Starts the Apify LinkedIn Connections Actor
- Polls the actor run status (max 20 attempts, 15s interval) until SUCCEEDED or FAILED
- Fetches dataset items after successful run
- Compares connection URLs against existing Google Sheet rows (normalized)
- Appends only new leads to tab `Leads` with all 13 fields
- Silently skips if 0 new leads found or if actor FAILED

Branch B (DM-Sending) and cross-branch error reporting are planned for Phases 2 and 3.

---

## Phase 1 Requirements Covered

| Req ID | Description | Node(s) |
|--------|-------------|---------|
| TRIG-01 | Schedule Trigger 05:00 Europe/Berlin | Schedule Trigger |
| TRIG-02 | Branch A receives Apify Connections data | HTTP Request: Start Actor |
| API-01 | POST to start Apify Connections Actor with LINKEDIN_COOKIE | HTTP Request: Start Actor |
| API-03 | Polling loop: GET status every 15s, max 20 attempts | Merge Loop Entry + IF Actor Done + Wait 15s + Set: Increment Counter |
| API-05 | Fetch Apify Dataset items via defaultDatasetId | HTTP Request: Get Dataset |
| DATA-01 | Code Node URL comparison (normalized) | Code: Compare URLs |
| OUT-01 | Google Sheets Append all 13 fields | Google Sheets: Append New Leads |
| OUT-02 | IF guard: only append when new leads > 0 | IF: New Leads Found |
| ERR-01 | Actor FAILED → skip Branch A silently | IF Actor Done (false/failed path → No Operation) |

---

## Workflow Architecture

### WF1 — LinkedIn Follow-up Automation (Phase 1: Branch A only)

**Trigger:** Schedule Trigger, 05:00 Europe/Berlin daily (`0 5 * * *`)
**Purpose:** Detect new LinkedIn connections via Apify and write them as leads to Google Sheets

**Node Chain:**

```
[01] Schedule Trigger
        |
        v
[02] HTTP Request: Start Actor          (POST — start Apify run, returns runId + defaultDatasetId)
        |
        v
[03] Wait: Initial 20s                  (warmup before first poll)
        |
        v (input 0 — first entry)
[04] Merge: Loop Entry  <-----------+   (mode: chooseBranch — passes through whichever input fires)
        |                           |
        v                           |
[05] HTTP Request: Check Actor Status   (GET actor run by runId)
        |                           |
        v                           |
[06] IF: Actor Done?                |   (SUCCEEDED→true, FAILED→stop, else→retry path)
      true |       false |           |
           |             v           |
           |      [07] IF: Max Attempts?
           |           yes |   no |
           |               v    |
           |           [08] No Operation (ERR-01: max retries reached / failed)
           |                    |
           |             [09] Set: Increment Attempt Counter
           |                    |
           |             [10] Wait: 15s
           |                    |
           |                    +------> (input 1 of Merge)
           v
[11] HTTP Request: Get Dataset Items    (GET defaultDatasetId items)
        |
        v
[12] Google Sheets: Read Leads          (GET all rows from tab Leads, col A:M)
        |
        v
[13] Code: Compare URLs                 (filter new connections, normalize URLs)
        |
        v
[14] IF: New Leads Found?              (items.length > 0)
      true |       false |
           |             v
           |       [15] No Operation (silent skip — 0 new leads)
           v
[16] Google Sheets: Append New Leads   (append 1 row per new lead, all 13 fields)
```

---

## Node Inventory

| # | Node ID | Display Name | Type | typeVersion | Purpose |
|---|---------|--------------|------|-------------|---------|
| 01 | `schedule-trigger` | Schedule Trigger | `n8n-nodes-base.scheduleTrigger` | 1.2 | Daily at 05:00 Europe/Berlin |
| 02 | `apify-start-actor` | HTTP Request: Start Actor | `n8n-nodes-base.httpRequest` | 4.4 | POST — start Apify run |
| 03 | `wait-initial` | Wait: Initial 20s | `n8n-nodes-base.wait` | 1.1 | Warmup before first poll |
| 04 | `merge-loop-entry` | Merge: Loop Entry | `n8n-nodes-base.merge` | 3.1 | Loop re-entry point |
| 05 | `apify-check-status` | HTTP Request: Check Actor Status | `n8n-nodes-base.httpRequest` | 4.4 | GET run status |
| 06 | `if-actor-done` | IF: Actor Done? | `n8n-nodes-base.if` | 2.2 | Route: succeeded / failed / retry |
| 07 | `if-max-attempts` | IF: Max Attempts? | `n8n-nodes-base.if` | 2.2 | Stop loop after 20 attempts |
| 08 | `no-op-error` | No Operation: Skip Branch A | `n8n-nodes-base.noOp` | 1 | Silent skip on FAILED or max retries |
| 09 | `set-increment-counter` | Set: Increment Attempt Counter | `n8n-nodes-base.set` | 3.4 | Track polling attempt count |
| 10 | `wait-poll` | Wait: 15s Poll Interval | `n8n-nodes-base.wait` | 1.1 | Delay between polls |
| 11 | `apify-get-dataset` | HTTP Request: Get Dataset Items | `n8n-nodes-base.httpRequest` | 4.4 | GET connection records from dataset |
| 12 | `sheets-read-leads` | Google Sheets: Read Leads | `n8n-nodes-base.googleSheets` | 4.7 | Read all existing rows from Leads tab |
| 13 | `code-compare-urls` | Code: Compare URLs | `n8n-nodes-base.code` | 2 | Normalize and diff URLs → return new only |
| 14 | `if-new-leads` | IF: New Leads Found? | `n8n-nodes-base.if` | 2.2 | Guard: only proceed if new leads exist |
| 15 | `no-op-skip` | No Operation: No New Leads | `n8n-nodes-base.noOp` | 1 | Silent skip when 0 new leads |
| 16 | `sheets-append-leads` | Google Sheets: Append New Leads | `n8n-nodes-base.googleSheets` | 4.7 | Append all 13 fields per new lead |

---

## Detailed Node Specifications

### Node 01 — Schedule Trigger

```json
{
  "id": "schedule-trigger",
  "name": "Schedule Trigger",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "position": [100, 300],
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 5 * * *"
        }
      ]
    }
  }
}
```

**Notes:**
- `typeVersion: 1.2` is the current stable version (reference workflow uses 1.2)
- Cron `0 5 * * *` = 05:00 every day
- Timezone is set in the n8n instance settings to Europe/Berlin (or confirm via workflow settings `timezone` field if needed)
- If the n8n cloud instance is UTC, add timezone awareness: the cron runs at UTC 04:00 in winter / UTC 03:00 in summer (CET/CEST). Since n8n cloud allows setting timezone per workflow, set `"timezone": "Europe/Berlin"` in workflow `settings`.

---

### Node 02 — HTTP Request: Start Actor

**Purpose:** POST to Apify API to start the LinkedIn Connections Actor run. Returns `{ id, defaultDatasetId, status, ... }`.

**Apify API endpoint (start run):**
```
POST https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs
```

**Authentication:** Header Auth — `Authorization: Bearer <token>`

**Important:** On n8n cloud, no native Apify node is available. Use HTTP Request with generic credential `httpHeaderAuth` containing `Authorization: Bearer <APIFY_TOKEN>`.

```json
{
  "id": "apify-start-actor",
  "name": "HTTP Request: Start Actor",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [350, 300],
  "credentials": {
    "httpHeaderAuth": {
      "id": "wWgQDWC9aV3UcUEJ",
      "name": "Apify MN1975"
    }
  },
  "parameters": {
    "method": "POST",
    "url": "https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"cookie\": \"{{ $env.LINKEDIN_COOKIE }}\"\n}",
    "options": {
      "timeout": 30000
    }
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "onError": "continueRegularOutput"
}
```

**Output data shape (Apify run object):**
```json
{
  "data": {
    "id": "abc123RunId",
    "defaultDatasetId": "xyz789DatasetId",
    "status": "READY",
    "actId": "...",
    ...
  }
}
```

**Key fields used downstream:**
- `$json.data.id` — the run ID used for polling
- `$json.data.defaultDatasetId` — the dataset ID used to fetch results

**IMPORTANT — Credential clarification:** The credential ID `wWgQDWC9aV3UcUEJ` in MEMORY.md is typed as `apifyApi`. On n8n cloud there is no native Apify node, so this credential type may not be directly usable with HTTP Request. The executor must either:
1. Create a new `httpHeaderAuth` credential with `Name: Authorization`, `Value: Bearer apify_api_REDACTED_SEE_MEMORY_MD`
2. Or use `sendHeaders: true` with a header parameter `Authorization: Bearer {{ $env.APIFY_API_TOKEN }}`

Plan uses option 2 (header in parameters) as safe fallback:

```json
"parameters": {
  "method": "POST",
  "url": "https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{ $env.APIFY_API_TOKEN }}"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"cookie\": \"{{ $env.LINKEDIN_COOKIE }}\"\n}",
  "options": {
    "timeout": 30000
  }
}
```

---

### Node 03 — Wait: Initial 20s

**Purpose:** Allow the Apify actor run time to start before the first poll.

```json
{
  "id": "wait-initial",
  "name": "Wait: Initial 20s",
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "position": [600, 300],
  "parameters": {
    "resume": "timeInterval",
    "amount": 20,
    "unit": "seconds"
  }
}
```

**Data passthrough:** This node passes all input items unchanged. The Apify start response (`data.id`, `data.defaultDatasetId`) must still be available. The Wait node passes through items — the run data remains in `$json`.

---

### Node 04 — Merge: Loop Entry

**Purpose:** Acts as the loop entry point. Receives input 0 from the Wait: Initial 20s (first entry) and input 1 from Wait: 15s Poll Interval (retry entries). Uses `chooseBranch` mode to pass through whichever input activated it.

```json
{
  "id": "merge-loop-entry",
  "name": "Merge: Loop Entry",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.1,
  "position": [850, 300],
  "parameters": {
    "mode": "chooseBranch",
    "output": "input1"
  }
}
```

**Mode explanation:**
- `chooseBranch` with `output: "input1"` means: output exactly the data from whichever branch has data available first.
- On first entry: input 0 fires (from Wait: Initial 20s) — carries `{ data: { id, defaultDatasetId } }`
- On re-entry: input 1 fires (from Wait: 15s) — carries `{ data: { id, defaultDatasetId }, attemptCount: N }`

**Alternative if `chooseBranch` causes issues:** Use `mode: "append"` — this also works for loop entry because n8n processes whichever input arrives, but may concatenate items on simultaneous inputs. `chooseBranch` is the correct pattern here.

**CRITICAL:** The Merge node in a loop receives from 2 sources. In the n8n connections JSON, both source nodes connect to the Merge using `index: 0` and `index: 1` respectively on the Merge's input side.

---

### Node 05 — HTTP Request: Check Actor Status

**Purpose:** GET the current run status from Apify. Uses the `runId` from the original start response.

```json
{
  "id": "apify-check-status",
  "name": "HTTP Request: Check Actor Status",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [1100, 300],
  "parameters": {
    "method": "GET",
    "url": "=https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs/{{ $json.data.id }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $env.APIFY_API_TOKEN }}"
        }
      ]
    },
    "options": {
      "timeout": 10000
    }
  },
  "retryOnFail": true,
  "maxTries": 2,
  "waitBetweenTries": 3000
}
```

**Expression for URL:**
`=https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs/{{ $json.data.id }}`

Note: `$json.data.id` references the run ID from the original Apify start response, which flows through the Wait and Merge nodes unchanged.

**Output data shape:**
```json
{
  "data": {
    "id": "abc123RunId",
    "status": "SUCCEEDED",   // or "RUNNING", "READY", "FAILED", "TIMED-OUT", "ABORTED"
    "defaultDatasetId": "xyz789DatasetId",
    ...
  },
  "attemptCount": 1   // added by Set: Increment Attempt Counter on re-entry
}
```

---

### Node 06 — IF: Actor Done?

**Purpose:** Route based on run status.
- `true` output (index 0): status is `SUCCEEDED` → proceed to fetch dataset
- `false` output (index 1): status is anything else (`RUNNING`, `READY`, etc.) → go to retry path
- Special case FAILED: handled by a second condition — if status is `FAILED`, `TIMED-OUT`, or `ABORTED` → route to No Operation (ERR-01)

**Implementation strategy:** Use two IF nodes in sequence is cleaner, but to keep the node count minimal, we use a single IF with two conditions combined:

Actually, the cleanest approach for n8n is:
1. IF node checks `status == "SUCCEEDED"` → true path continues, false path goes to the max-attempts check
2. Within the false path: IF: Max Attempts checks both `attemptCount >= 20` AND status being a terminal failure

So node 06 is a pure SUCCEEDED check:

```json
{
  "id": "if-actor-done",
  "name": "IF: Actor Done?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1350, 300],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "status-succeeded",
          "leftValue": "={{ $json.data.status }}",
          "rightValue": "SUCCEEDED",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  }
}
```

**Output routing:**
- Output index 0 (true): `data.status == "SUCCEEDED"` → Node 11 (Get Dataset)
- Output index 1 (false): anything else → Node 07 (IF: Max Attempts?)

---

### Node 07 — IF: Max Attempts?

**Purpose:** Stop the loop after 20 attempts OR if the actor status is a terminal failure (`FAILED`, `TIMED-OUT`, `ABORTED`).

```json
{
  "id": "if-max-attempts",
  "name": "IF: Max Attempts?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1600, 450],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "max-attempts-reached",
          "leftValue": "={{ $json.attemptCount ?? 0 }}",
          "rightValue": 20,
          "operator": {
            "type": "number",
            "operation": "gte"
          }
        },
        {
          "id": "status-terminal-failure",
          "leftValue": "={{ ['FAILED','TIMED-OUT','ABORTED'].includes($json.data.status) }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "equals"
          }
        }
      ],
      "combinator": "or"
    },
    "options": {}
  }
}
```

**Output routing:**
- Output index 0 (true): max attempts OR terminal failure → Node 08 (No Operation: Skip Branch A)
- Output index 1 (false): still retrying → Node 09 (Set: Increment Attempt Counter)

---

### Node 08 — No Operation: Skip Branch A

**Purpose:** Silently absorbs the execution path for ERR-01 (actor FAILED or max retries). No action taken.

```json
{
  "id": "no-op-error",
  "name": "No Operation: Skip Branch A",
  "type": "n8n-nodes-base.noOp",
  "typeVersion": 1,
  "position": [1850, 550],
  "parameters": {}
}
```

---

### Node 09 — Set: Increment Attempt Counter

**Purpose:** Add/increment `attemptCount` on the item data so the loop counter works.

**CRITICAL:** This is the mechanism that prevents infinite loops. The counter starts at 0 (absent from initial data) and increments by 1 on each retry.

```json
{
  "id": "set-increment-counter",
  "name": "Set: Increment Attempt Counter",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1850, 350],
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        {
          "id": "attempt-counter",
          "name": "attemptCount",
          "value": "={{ ($json.attemptCount ?? 0) + 1 }}",
          "type": "number"
        },
        {
          "id": "run-id-passthrough",
          "name": "data",
          "value": "={{ $json.data }}",
          "type": "object"
        }
      ]
    },
    "options": {
      "includeBinary": false
    }
  }
}
```

**Why passthrough `data`:** The Set node in `mode: "manual"` by default replaces all fields with only what is explicitly set. We must preserve `data.id` and `data.defaultDatasetId` for the next poll iteration. The `data` assignment preserves the full Apify run object.

**Alternative approach:** Use `mode: "manual"` with `includeOtherFields: true` (available in typeVersion 3.4 via `options.includeOtherFields`). This is simpler:

```json
"parameters": {
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      {
        "id": "attempt-counter",
        "name": "attemptCount",
        "value": "={{ ($json.attemptCount ?? 0) + 1 }}",
        "type": "number"
      }
    ]
  },
  "options": {
    "includeBinary": false
  }
}
```

With Set 3.4 the default behavior keeps existing fields when `mode: "manual"` — but this depends on the exact n8n version. The **safe** approach is to explicitly pass through `data` as shown in the primary spec above.

---

### Node 10 — Wait: 15s Poll Interval

**Purpose:** Pause 15 seconds between each status poll. After waiting, feeds back into the Merge loop entry node (input 1).

```json
{
  "id": "wait-poll",
  "name": "Wait: 15s Poll Interval",
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "position": [2100, 350],
  "parameters": {
    "resume": "timeInterval",
    "amount": 15,
    "unit": "seconds"
  }
}
```

**Loop connection:** `Wait: 15s Poll Interval` → `Merge: Loop Entry` (input index 1)

---

### Node 11 — HTTP Request: Get Dataset Items

**Purpose:** After SUCCEEDED status, fetch all connection records from the Apify dataset.

**Endpoint:** `GET https://api.apify.com/v2/datasets/{datasetId}/items?format=json&clean=true`

```json
{
  "id": "apify-get-dataset",
  "name": "HTTP Request: Get Dataset Items",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [1600, 150],
  "parameters": {
    "method": "GET",
    "url": "=https://api.apify.com/v2/datasets/{{ $json.data.defaultDatasetId }}/items",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $env.APIFY_API_TOKEN }}"
        }
      ]
    },
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        {
          "name": "format",
          "value": "json"
        },
        {
          "name": "clean",
          "value": "true"
        }
      ]
    },
    "options": {
      "timeout": 60000
    }
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

**Output data shape:** The Apify dataset items endpoint returns a JSON array. n8n's HTTP Request node with `json` response will return each array item as a separate output item. However, the response may be wrapped — confirm the exact response structure when testing.

**Expected item shape (per connection record):**
```json
{
  "name": "Max Mustermann",
  "linkedInUrl": "https://www.linkedin.com/in/max-mustermann",
  "company": "Musterfirma GmbH",
  "position": "Head of Sales",
  "connectedOn": "2024-01-15",
  ...
}
```

**Note on field names:** The exact field names returned by `curious_coder~linkedin-profile-scraper` must be verified during execution. Common variants: `profileUrl`, `linkedInUrl`, `url`, `profileId`. The Code: Compare URLs node (Node 13) handles normalization and must be updated if field names differ.

---

### Node 12 — Google Sheets: Read Leads

**Purpose:** Read all existing rows from the `Leads` tab to get the current list of LinkedIn URLs for deduplication.

```json
{
  "id": "sheets-read-leads",
  "name": "Google Sheets: Read Leads",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [1850, 150],
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "parameters": {
    "operation": "read",
    "documentId": {
      "__rl": true,
      "value": "={{ $env.GOOGLE_SHEET_ID }}",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Leads",
      "mode": "name"
    },
    "filtersUI": {},
    "options": {
      "range": "A:M"
    }
  }
}
```

**Output:** One item per row in the `Leads` tab. Each item has fields: `Name`, `LinkedIn_URL`, `Unternehmen`, `Position`, `Erstkontakt_Datum`, `Letzter_Reply_Datum`, `Anzahl_Nachrichten`, `Status`, `Stern`, `Letzte_Kategorie`, `Letzter_Report`, `Zuletzt_gesehen`, `Quelle`.

**For the Code node (Node 13):** The column `B` maps to `LinkedIn_URL` (the Google Sheets node maps columns to header names automatically when the first row is a header row). The Code node references `$('Google Sheets: Read Leads').all()` to get existing rows.

---

### Node 13 — Code: Compare URLs

**Purpose:** Compare the Apify connection URLs (from Node 11) with existing Sheet URLs (from Node 12). Return only entries where the normalized URL is NOT already in the sheet.

**Normalization rules (DATA-01):**
1. Lowercase the URL
2. Remove trailing slash
3. Remove `https://` and `http://` prefix for comparison
4. Remove `www.` prefix

**Input context:**
- `$input.all()` = items from Node 11 (Apify dataset items — current node's direct input)
- `$('Google Sheets: Read Leads').all()` = all existing sheet rows

**IMPORTANT:** The Code node receives the output of Node 11 (HTTP Request: Get Dataset Items) as its direct input. Node 12 (Google Sheets: Read Leads) runs in parallel and is accessed via cross-node reference. However, n8n executes nodes sequentially in the main chain — Node 12 must complete before Node 13 can access it.

**Architecture note:** To ensure Node 12 is executed before Node 13, Node 12 must be in the main execution chain BEFORE Node 13. The proposed architecture has Node 11 → Node 12 → Node 13 (sequential). This is the safe approach.

**Revised node chain (updated from original design):**
```
[11] HTTP Request: Get Dataset Items
        |
        v
[12] Google Sheets: Read Leads      (reads existing leads — passes through all items from Node 11 + sheet data accessible via $('...'))
        |
        v
[13] Code: Compare URLs             ($input = dataset items piped through; $('Google Sheets: Read Leads') = sheet rows)
```

Wait — this does not work as intended. Node 12 (Google Sheets read) would output the SHEET ROWS as items, not the dataset items. The Code node would receive the sheet rows as `$input`, not the dataset items.

**Correct architecture:** Use a Merge node to combine both streams, OR access Node 11's data via `$('HTTP Request: Get Dataset Items').all()` inside the Code node.

**Best approach:** Run Node 11 and Node 12 sequentially but have Node 12 connect to Node 13, and inside the Code node access Node 11's output via cross-node reference.

```
[11] HTTP Request: Get Dataset Items ----\
                                          \--> (cross-node ref in Code)
[12] Google Sheets: Read Leads ---------> [13] Code: Compare URLs
```

In n8n, the connection chain is: Node 11 → (no direct connection to 13) and Node 12 → Node 13. Node 13 accesses Node 11's data via `$('HTTP Request: Get Dataset Items').all()`.

**But this requires Node 11 to be executed BEFORE Node 13.** In n8n's execution model, if Node 12 is only connected AFTER Node 11, Node 12 inherits the execution context — but Node 11 IS in the same execution path. When Node 13 runs, Node 11 has already completed, so `$('HTTP Request: Get Dataset Items').all()` is valid.

**Final chain:**
```
Node 11 → Node 12 → Node 13
```
- Node 11 output: dataset items (Apify connections)
- Node 12 receives Node 11's output but as a trigger — it reads the sheet independently (its output is the sheet rows)
- Node 13 receives Node 12's output (`$input` = sheet rows) and accesses Node 11 via `$('HTTP Request: Get Dataset Items').all()`

**Code Node implementation:**

```javascript
// Mode: Run Once For All Items
// $input.all() = Google Sheets rows (existing leads)
// $('HTTP Request: Get Dataset Items').all() = Apify dataset items (new connections from LinkedIn)

const existingRows = $input.all();
const apifyItems = $('HTTP Request: Get Dataset Items').all();

// Build normalized URL set from existing sheet
function normalizeUrl(url) {
  if (!url) return '';
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '')
    .trim();
}

const existingUrls = new Set(
  existingRows
    .map(item => normalizeUrl(item.json.LinkedIn_URL))
    .filter(url => url !== '')
);

// Filter Apify items to only those not in the sheet
const today = $now.toFormat('yyyy-MM-dd');
const newLeads = [];

for (const item of apifyItems) {
  // Try common field name variants from Apify actor
  const rawUrl = item.json.linkedInUrl
    || item.json.profileUrl
    || item.json.url
    || item.json.linkedin_url
    || '';

  const normalizedUrl = normalizeUrl(rawUrl);

  if (!normalizedUrl || existingUrls.has(normalizedUrl)) {
    continue; // Skip empty URLs and already-known leads
  }

  // Map Apify fields to Google Sheet columns (A-M)
  newLeads.push({
    json: {
      Name: item.json.name || item.json.fullName || item.json.firstName + ' ' + (item.json.lastName || '') || '',
      LinkedIn_URL: rawUrl,
      Unternehmen: item.json.company || item.json.companyName || item.json.currentCompany || '',
      Position: item.json.position || item.json.title || item.json.headline || '',
      Erstkontakt_Datum: today,
      Letzter_Reply_Datum: '',
      Anzahl_Nachrichten: 0,
      Status: 'Offen',
      Stern: '',
      Letzte_Kategorie: '',
      Letzter_Report: '',
      Zuletzt_gesehen: '',
      Quelle: 'auto-import'
    }
  });
}

// Return new leads (may be empty array — handled by IF: New Leads Found)
return newLeads;
```

**Node JSON:**

```json
{
  "id": "code-compare-urls",
  "name": "Code: Compare URLs",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [2350, 150],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// Mode: Run Once For All Items\n// $input.all() = Google Sheets rows (existing leads)\n// $('HTTP Request: Get Dataset Items').all() = Apify dataset items\n\nconst existingRows = $input.all();\nconst apifyItems = $('HTTP Request: Get Dataset Items').all();\n\nfunction normalizeUrl(url) {\n  if (!url) return '';\n  return url\n    .toLowerCase()\n    .replace(/^https?:\\/\\/(www\\.)?/, '')\n    .replace(/\\/$/, '')\n    .trim();\n}\n\nconst existingUrls = new Set(\n  existingRows\n    .map(item => normalizeUrl(item.json.LinkedIn_URL))\n    .filter(url => url !== '')\n);\n\nconst today = $now.toFormat('yyyy-MM-dd');\nconst newLeads = [];\n\nfor (const item of apifyItems) {\n  const rawUrl = item.json.linkedInUrl \n    || item.json.profileUrl \n    || item.json.url \n    || item.json.linkedin_url \n    || '';\n  \n  const normalizedUrl = normalizeUrl(rawUrl);\n  \n  if (!normalizedUrl || existingUrls.has(normalizedUrl)) {\n    continue;\n  }\n  \n  newLeads.push({\n    json: {\n      Name: item.json.name || item.json.fullName || ((item.json.firstName || '') + ' ' + (item.json.lastName || '')).trim() || '',\n      LinkedIn_URL: rawUrl,\n      Unternehmen: item.json.company || item.json.companyName || item.json.currentCompany || '',\n      Position: item.json.position || item.json.title || item.json.headline || '',\n      Erstkontakt_Datum: today,\n      Letzter_Reply_Datum: '',\n      Anzahl_Nachrichten: 0,\n      Status: 'Offen',\n      Stern: '',\n      Letzte_Kategorie: '',\n      Letzter_Report: '',\n      Zuletzt_gesehen: '',\n      Quelle: 'auto-import'\n    }\n  });\n}\n\nreturn newLeads;"
  }
}
```

---

### Node 14 — IF: New Leads Found?

**Purpose:** Guard — only proceed to append if there is at least one new lead. If the Code node returned 0 items, n8n will pass an empty array and this IF must handle it.

**Problem with empty arrays:** If the Code node returns `[]` (empty array), n8n may not execute downstream nodes at all (0 items = no execution). In that case, the IF is redundant but harmless. However, if there IS at least 1 item, we check `$input.all().length > 0`.

**Practical approach:** Keep the IF as a safety guard for the case where 0 items flow through.

```json
{
  "id": "if-new-leads",
  "name": "IF: New Leads Found?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [2600, 150],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "has-new-leads",
          "leftValue": "={{ $input.all().length }}",
          "rightValue": 0,
          "operator": {
            "type": "number",
            "operation": "gt"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  }
}
```

**Output routing:**
- Output index 0 (true): length > 0 → Node 16 (Google Sheets: Append New Leads)
- Output index 1 (false): length == 0 → Node 15 (No Operation: No New Leads)

---

### Node 15 — No Operation: No New Leads

**Purpose:** Silently absorbs the execution path when 0 new leads are found. No action.

```json
{
  "id": "no-op-skip",
  "name": "No Operation: No New Leads",
  "type": "n8n-nodes-base.noOp",
  "typeVersion": 1,
  "position": [2850, 300],
  "parameters": {}
}
```

---

### Node 16 — Google Sheets: Append New Leads

**Purpose:** Append each new lead as a row in the `Leads` tab. Runs once per item (n8n's Google Sheets append operation processes items individually).

```json
{
  "id": "sheets-append-leads",
  "name": "Google Sheets: Append New Leads",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [2850, 100],
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "parameters": {
    "operation": "append",
    "documentId": {
      "__rl": true,
      "value": "={{ $env.GOOGLE_SHEET_ID }}",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Leads",
      "mode": "name"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "Name": "={{ $json.Name }}",
        "LinkedIn_URL": "={{ $json.LinkedIn_URL }}",
        "Unternehmen": "={{ $json.Unternehmen }}",
        "Position": "={{ $json.Position }}",
        "Erstkontakt_Datum": "={{ $json.Erstkontakt_Datum }}",
        "Letzter_Reply_Datum": "={{ $json.Letzter_Reply_Datum }}",
        "Anzahl_Nachrichten": "={{ $json.Anzahl_Nachrichten }}",
        "Status": "={{ $json.Status }}",
        "Stern": "={{ $json.Stern }}",
        "Letzte_Kategorie": "={{ $json.Letzte_Kategorie }}",
        "Letzter_Report": "={{ $json.Letzter_Report }}",
        "Zuletzt_gesehen": "={{ $json.Zuletzt_gesehen }}",
        "Quelle": "={{ $json.Quelle }}"
      }
    },
    "options": {
      "cellFormat": "USER_ENTERED",
      "valueInputMode": "USER_ENTERED"
    }
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

---

## Connections Map

This is the exact `connections` object for the n8n workflow JSON.

```json
"connections": {
  "Schedule Trigger": {
    "main": [
      [
        { "node": "HTTP Request: Start Actor", "type": "main", "index": 0 }
      ]
    ]
  },
  "HTTP Request: Start Actor": {
    "main": [
      [
        { "node": "Wait: Initial 20s", "type": "main", "index": 0 }
      ]
    ]
  },
  "Wait: Initial 20s": {
    "main": [
      [
        { "node": "Merge: Loop Entry", "type": "main", "index": 0 }
      ]
    ]
  },
  "Merge: Loop Entry": {
    "main": [
      [
        { "node": "HTTP Request: Check Actor Status", "type": "main", "index": 0 }
      ]
    ]
  },
  "HTTP Request: Check Actor Status": {
    "main": [
      [
        { "node": "IF: Actor Done?", "type": "main", "index": 0 }
      ]
    ]
  },
  "IF: Actor Done?": {
    "main": [
      [
        { "node": "HTTP Request: Get Dataset Items", "type": "main", "index": 0 }
      ],
      [
        { "node": "IF: Max Attempts?", "type": "main", "index": 0 }
      ]
    ]
  },
  "IF: Max Attempts?": {
    "main": [
      [
        { "node": "No Operation: Skip Branch A", "type": "main", "index": 0 }
      ],
      [
        { "node": "Set: Increment Attempt Counter", "type": "main", "index": 0 }
      ]
    ]
  },
  "Set: Increment Attempt Counter": {
    "main": [
      [
        { "node": "Wait: 15s Poll Interval", "type": "main", "index": 0 }
      ]
    ]
  },
  "Wait: 15s Poll Interval": {
    "main": [
      [
        { "node": "Merge: Loop Entry", "type": "main", "index": 1 }
      ]
    ]
  },
  "HTTP Request: Get Dataset Items": {
    "main": [
      [
        { "node": "Google Sheets: Read Leads", "type": "main", "index": 0 }
      ]
    ]
  },
  "Google Sheets: Read Leads": {
    "main": [
      [
        { "node": "Code: Compare URLs", "type": "main", "index": 0 }
      ]
    ]
  },
  "Code: Compare URLs": {
    "main": [
      [
        { "node": "IF: New Leads Found?", "type": "main", "index": 0 }
      ]
    ]
  },
  "IF: New Leads Found?": {
    "main": [
      [
        { "node": "Google Sheets: Append New Leads", "type": "main", "index": 0 }
      ],
      [
        { "node": "No Operation: No New Leads", "type": "main", "index": 0 }
      ]
    ]
  }
}
```

**Loop back connection (Merge input 1):**
The connection from `Wait: 15s Poll Interval` to `Merge: Loop Entry` uses `index: 1` on the Merge node's input. This is the re-entry path for the polling loop.

---

## Data Flow Summary

| Step | Node | Data In | Data Out |
|------|------|---------|----------|
| 01 | Schedule Trigger | — | `{ timestamp: "...", ... }` |
| 02 | HTTP Request: Start Actor | trigger item | `{ data: { id: "runId", defaultDatasetId: "dsId", status: "READY" } }` |
| 03 | Wait: Initial 20s | run object | run object (passthrough) |
| 04 | Merge: Loop Entry | run object (first) or `{ data, attemptCount }` (retry) | either input item |
| 05 | HTTP Request: Check Actor Status | `{ data: { id } }` | `{ data: { id, status, defaultDatasetId, ... } }` |
| 06 | IF: Actor Done? | status object | true→continue / false→retry path |
| 07 | IF: Max Attempts? | `{ data, attemptCount }` | true→stop / false→increment |
| 09 | Set: Increment Attempt Counter | `{ data, attemptCount: N }` | `{ data, attemptCount: N+1 }` |
| 10 | Wait: 15s Poll Interval | `{ data, attemptCount }` | same (passthrough) |
| 11 | HTTP Request: Get Dataset Items | `{ data: { defaultDatasetId } }` | array of connection items |
| 12 | Google Sheets: Read Leads | dataset items (via trigger) | array of existing sheet rows |
| 13 | Code: Compare URLs | sheet rows (`$input`) + dataset items (`$('...')`) | filtered new lead items (shape: 13 fields) |
| 14 | IF: New Leads Found? | new lead items | true→append / false→no-op |
| 16 | Google Sheets: Append | 1 item per new lead | appended row confirmation |

---

## Node Positions (Canvas Layout)

```
[Schedule Trigger]          x:100  y:300
[HTTP Request: Start Actor] x:350  y:300
[Wait: Initial 20s]         x:600  y:300
[Merge: Loop Entry]         x:850  y:300
[HTTP Request: Check Status]x:1100 y:300
[IF: Actor Done?]           x:1350 y:300
[IF: Max Attempts?]         x:1600 y:450
[No Op: Skip Branch A]      x:1850 y:550
[Set: Increment Counter]    x:1850 y:350
[Wait: 15s Poll Interval]   x:2100 y:350
[HTTP Request: Get Dataset] x:1600 y:150
[Google Sheets: Read Leads] x:1850 y:150
[Code: Compare URLs]        x:2100 y:150
[IF: New Leads Found?]      x:2350 y:150
[Google Sheets: Append]     x:2600 y:100
[No Op: No New Leads]       x:2600 y:300
```

---

## Workflow Settings

```json
"settings": {
  "executionOrder": "v1",
  "saveDataErrorExecution": "all",
  "saveDataSuccessExecution": "all",
  "saveManualExecutions": true,
  "callerPolicy": "workflowsFromSameOwner",
  "timezone": "Europe/Berlin"
}
```

**IMPORTANT:** Setting `timezone: "Europe/Berlin"` in workflow settings ensures the Schedule Trigger's cron `0 5 * * *` fires at 05:00 Central European Time regardless of the n8n server's system timezone.

---

## Critical Implementation Notes

### 1. Switch Node NOT Used Here
Phase 1 has no Switch node. No risk of the canvas-crash bug. IF nodes are used throughout (typeVersion 2.2, standard conditions format).

### 2. IF Node `version: 2` in conditions.options
All IF nodes must include `"version": 2` inside `conditions.options` to use the current conditions format:
```json
"conditions": {
  "options": {
    "version": 2,
    ...
  }
}
```

### 3. Merge Node — Loop Pattern
The Merge node with `mode: "chooseBranch"` and `output: "input1"` is the correct n8n loop pattern. It accepts whichever input fires and passes it through. Key connection detail:
- Input 0 (index 0): initial entry from Wait: Initial 20s
- Input 1 (index 1): loop re-entry from Wait: 15s Poll Interval

In the connections JSON, both connections reference the Merge node but the re-entry uses index 1:
```json
"Wait: 15s Poll Interval": {
  "main": [[ { "node": "Merge: Loop Entry", "type": "main", "index": 1 } ]]
}
```

### 4. Counter Mechanism — Preventing Infinite Loops
The attempt counter uses the `$json.attemptCount ?? 0` pattern:
- First iteration: `attemptCount` field does not exist → `?? 0` defaults to 0 → Set node writes `attemptCount: 1`
- Subsequent: `$json.attemptCount` exists → increments normally
- Stop condition: `attemptCount >= 20` in IF: Max Attempts?

Max total wait time: 20s (initial) + 20 × 15s (polls) = 320 seconds ≈ 5.3 minutes

### 5. Apify Data Field Names — Verify at Runtime
The `curious_coder~linkedin-profile-scraper` actor's output field names must be verified during the first test run. The Code node uses multiple fallback field names (`linkedInUrl || profileUrl || url || linkedin_url`). If none match, add the actual field name to the Code node.

To inspect the actual output: after a successful run, check `HTTP Request: Get Dataset Items` node output in the n8n execution log.

### 6. HTTP Request Authentication for Apify
On n8n cloud 2.36.1, the plan uses `sendHeaders: true` with an inline header `Authorization: Bearer {{ $env.APIFY_API_TOKEN }}`. The `$env.APIFY_API_TOKEN` environment variable must be set in the n8n instance settings with value `apify_api_REDACTED_SEE_MEMORY_MD`.

Alternative: Create a new `httpHeaderAuth` credential:
- Name: `Apify Header Auth`
- Header Name: `Authorization`
- Header Value: `Bearer apify_api_REDACTED_SEE_MEMORY_MD`
Then use `authentication: "genericCredentialType"` + `genericAuthType: "httpHeaderAuth"` in all 3 Apify HTTP Request nodes.

### 7. Google Sheets typeVersion 4.7
The reference workflow uses `typeVersion: 4.5`. Use `4.7` (current) for both Google Sheets nodes. The `columns.mappingMode: "defineBelow"` with explicit field mappings is the standard approach.

### 8. Code Node — Cross-Node Reference Timing
Inside Code node (Node 13), `$('HTTP Request: Get Dataset Items').all()` is valid because:
1. Node 11 runs and produces output
2. Node 12 runs (receives Node 11's items but outputs sheet rows)
3. Node 13 runs — Node 11's output is still available in execution context via `$('...')`

This is a standard n8n pattern. The cross-node reference does NOT require the referenced node to be directly connected to the Code node.

### 9. Empty Array Handling
If the Apify dataset returns 0 items (no LinkedIn connections scraped), the Code node returns `[]`. In n8n, when a node outputs 0 items, downstream nodes in that path do not execute. The IF: New Leads Found? node therefore acts as a double-safety but may never trigger in the empty case — the no-op is still included for clarity.

### 10. Google Sheets `Leads` Tab — First Row Must Be Headers
The Google Sheets append node with `mappingMode: "defineBelow"` requires the sheet's first row to contain column headers matching the field names: `Name`, `LinkedIn_URL`, `Unternehmen`, `Position`, `Erstkontakt_Datum`, `Letzter_Reply_Datum`, `Anzahl_Nachrichten`, `Status`, `Stern`, `Letzte_Kategorie`, `Letzter_Report`, `Zuletzt_gesehen`, `Quelle`.

---

## Complete Code: Code: Compare URLs

```javascript
// Run Once For All Items
// $input.all() = Google Sheets rows (existing Leads tab rows)
// $('HTTP Request: Get Dataset Items').all() = Apify actor dataset items

const existingRows = $input.all();
const apifyItems = $('HTTP Request: Get Dataset Items').all();

function normalizeUrl(url) {
  if (!url) return '';
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '')
    .trim();
}

// Build a Set of normalized existing LinkedIn URLs
const existingUrls = new Set(
  existingRows
    .map(item => normalizeUrl(item.json.LinkedIn_URL))
    .filter(url => url !== '')
);

const today = $now.toFormat('yyyy-MM-dd');
const newLeads = [];

for (const item of apifyItems) {
  // Try multiple field name variants from different Apify actor versions
  const rawUrl = item.json.linkedInUrl
    || item.json.profileUrl
    || item.json.url
    || item.json.linkedin_url
    || item.json.LinkedInUrl
    || '';

  const normalizedUrl = normalizeUrl(rawUrl);

  // Skip if URL is empty or already in the sheet
  if (!normalizedUrl || existingUrls.has(normalizedUrl)) {
    continue;
  }

  // Build the full name from available fields
  const firstName = item.json.firstName || '';
  const lastName = item.json.lastName || '';
  const fullName = item.json.name
    || item.json.fullName
    || (firstName + ' ' + lastName).trim()
    || '';

  newLeads.push({
    json: {
      Name: fullName,
      LinkedIn_URL: rawUrl,
      Unternehmen: item.json.company
        || item.json.companyName
        || item.json.currentCompany
        || '',
      Position: item.json.position
        || item.json.title
        || item.json.headline
        || '',
      Erstkontakt_Datum: today,
      Letzter_Reply_Datum: '',
      Anzahl_Nachrichten: 0,
      Status: 'Offen',
      Stern: '',
      Letzte_Kategorie: '',
      Letzter_Report: '',
      Zuletzt_gesehen: '',
      Quelle: 'auto-import'
    }
  });
}

return newLeads;
```

---

## Environment Variables Required

| Variable | Value | Used In |
|----------|-------|---------|
| `APIFY_API_TOKEN` | `apify_api_REDACTED_SEE_MEMORY_MD` | All 3 HTTP Request nodes (Apify) |
| `LINKEDIN_COOKIE` | LinkedIn session cookie string | HTTP Request: Start Actor |
| `GOOGLE_SHEET_ID` | Google Sheet ID containing `Leads` tab | Both Google Sheets nodes |

These must be set in the n8n instance environment variables (Settings → Environment Variables on n8n cloud).

---

## Credentials Required

| Node | Credential Type | Credential ID | Notes |
|------|----------------|---------------|-------|
| Google Sheets: Read Leads | `googleSheetsOAuth2Api` | `gw0DIdDENFkpE7ZW` | Already configured |
| Google Sheets: Append New Leads | `googleSheetsOAuth2Api` | `gw0DIdDENFkpE7ZW` | Same credential |
| All Apify HTTP Requests | none (header auth via env var) | — | `$env.APIFY_API_TOKEN` |

---

## Validation Checklist

### Pre-Build
- [ ] Tab `Leads` exists in the Google Sheet with headers in row 1 (A-M)
- [ ] `APIFY_API_TOKEN`, `LINKEDIN_COOKIE`, `GOOGLE_SHEET_ID` env vars set in n8n instance
- [ ] Apify actor slug `curious_coder~linkedin-profile-scraper` confirmed in Apify dashboard

### Post-Build (validate_workflow)
- [ ] All 16 nodes present in workflow JSON
- [ ] No typeVersion errors (Schedule Trigger: 1.2, HTTP Request: 4.4, Wait: 1.1, Merge: 3.1, IF: 2.2, Set: 3.4, Code: 2, Google Sheets: 4.7, NoOp: 1)
- [ ] Connections map exactly matches the spec above (especially Merge input index 1 for loop re-entry)
- [ ] IF nodes have `"version": 2` in `conditions.options`
- [ ] No `continueOnFail: true` anywhere — use `onError: "continueRegularOutput"` where needed
- [ ] No `$node['Name'].json` patterns — use `$('Name').first().json` or `$('Name').all()`
- [ ] Code node uses `$input.all()` (not `$json` directly)
- [ ] All expressions use `={{ }}` syntax (not `{{ }}` or `${}`)
- [ ] `settings.timezone: "Europe/Berlin"` present in workflow settings
- [ ] `settings.executionOrder: "v1"` present
- [ ] Google Sheets credential ID `gw0DIdDENFkpE7ZW` set in both Sheet nodes
- [ ] retryOnFail set on: HTTP Request: Start Actor (3×), HTTP Request: Get Dataset (3×), Google Sheets: Append (3×)

### Functional Test
- [ ] Manual trigger execution completes without error
- [ ] HTTP Request: Start Actor returns `data.id` and `data.defaultDatasetId`
- [ ] Polling loop iterates (check execution log for multiple HTTP Check nodes)
- [ ] After SUCCEEDED: dataset items are fetched
- [ ] Code: Compare URLs returns correct count of new leads (0 on re-run with same data)
- [ ] IF: New Leads Found? routes correctly (true → append, false → no-op)
- [ ] New rows appear in `Leads` tab with `Quelle: "auto-import"` and `Status: "Offen"`
- [ ] Second run with same connections: 0 new leads, no rows appended (deduplication works)
- [ ] If Apify actor returns FAILED status: workflow reaches No Operation: Skip Branch A without error

---

## Known Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Apify actor field names differ from expected | Code node has multi-fallback field resolution; verify on first run |
| LinkedIn cookie expires | `$env.LINKEDIN_COOKIE` — update env var when expired |
| Apify actor slug wrong | Verify in Apify dashboard; actor may be `curious_coder/linkedin-profile-scraper` (with `/`) — check API docs |
| Merge loop does not re-enter | Ensure Wait: 15s → Merge with `index: 1`; test with manual trigger |
| Google Sheet has no header row | Create `Leads` tab with headers A1-M1 before first run |
| 0 items from empty sheet on first run | Code node returns all Apify items as new leads — correct behavior |

---

## Apify API Endpoint Reference

| Operation | Method | URL |
|-----------|--------|-----|
| Start run | POST | `https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs` |
| Check run status | GET | `https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs/{runId}` |
| Get dataset items | GET | `https://api.apify.com/v2/datasets/{datasetId}/items?format=json&clean=true` |

**Alternative run status URL (uses run ID directly, no actor slug needed):**
```
GET https://api.apify.com/v2/actor-runs/{runId}
```
This is slightly more efficient and avoids encoding the actor slug. Use either approach — both return the same run object.

**Recommended alternative for Check Actor Status node:**
```
=https://api.apify.com/v2/actor-runs/{{ $json.data.id }}
```
