---
phase: 5
plan: 1
workflows: [WF7]
type: n8n-workflow
status: planned
created: 2026-03-03
---

# Phase 5 Plan: WF7 SocialPulse Controller (Master Orchestrator)

## Objective

Deploy WF7 SocialPulse Controller -- the master orchestrator that reads the Konfig-Tab from Google Sheets to determine active modules and platforms, then executes all 6 sub-workflows in the correct order with proper parallelism (Wave 1: WF1+WF2+WF3 parallel, Wave 2: WF4, Wave 3: WF5, Wave 4: WF6). The master logs run status after each sub-workflow, handles errors gracefully (log error but continue where possible), writes a final Run Log entry, and returns a comprehensive summary. Two triggers: Schedule (Monday 9:00 AM CET) and Webhook for manual invocation.

**Requirements covered:** TRIG-01, TRIG-03, OUT-06, ERR-04

---

## Pre-Workflow Tasks

### Task 1: Verify All Sub-Workflows Are Deployed

Before deploying WF7, all 6 sub-workflows must be deployed and active on n8n Cloud. Their webhook URLs must be reachable.

| WF | Webhook Path | Expected Status |
|---|---|---|
| WF1 | `/webhook/socialpulse-performance` | Deployed |
| WF2 | `/webhook/socialpulse-meta-ads` | Deployed |
| WF3 | `/webhook/socialpulse-competitor` | Deployed |
| WF4 | `/webhook/socialpulse-content` | Deployed |
| WF5 | `/webhook/socialpulse-report-generator` | Deployed |
| WF6 | `/webhook/socialpulse-report-sender` | Deployed |

### Task 2: Verify Google Sheet Konfig-Tab

The Konfig-Tab must include `active_modules` row. Verify these rows exist:

| Einstellung | Wert (Beispiel) |
|---|---|
| project_name | MeinProjekt |
| brand_name | MeineMarke |
| brand_description | Kurzbeschreibung der Marke |
| brand_tone | professionell, freundlich |
| brand_colors | #1a73e8, #ffffff |
| active_platforms | instagram, facebook, tiktok, linkedin, youtube, x_twitter |
| active_modules | performance, meta_ads, competitor, content, report |
| report_recipients | team@example.com |
| report_cc | cc@example.com |
| report_language | de |
| apify_rate_limit_ms | 5000 |
| apify_max_concurrent | 2 |

The `active_modules` field controls which sub-workflows are executed:
- `performance` --> WF1
- `meta_ads` --> WF2
- `competitor` --> WF3
- `content` --> WF4 (requires performance + competitor)
- `report` --> WF5 + WF6 (requires all previous)

---

## WF7: SocialPulse Controller

### Overview

**Trigger**: Schedule (Monday 9:00 CET) + Webhook (POST) for manual runs.
**Purpose**: Orchestrate all 6 sub-workflows in the correct execution order, pass config data to each, collect results, handle errors gracefully, and produce a comprehensive run summary.
**Error Handling**: Each sub-workflow call uses `onError: continueRegularOutput` so failures are caught and logged rather than stopping the pipeline. If Wave 1 fails completely, Wave 2-4 are skipped. Partial failures in Wave 1 allow continuation.

### High-Level Flow

```
Schedule Trigger (Mon 9:00)  +  Webhook Trigger (POST /socialpulse-master)
              \                   /
               v                 v
          Merge: Trigger zusammenfuehren
                    |
                    v
          Google Sheets: Konfig-Tab lesen
                    |
                    v
          Code: Konfig verarbeiten + Module bestimmen
                    |
                    v
    +-----------+---+-----------+
    |           |               |
    v           v               v
  HTTP:       HTTP:           HTTP:
  WF1         WF2             WF3
  Perf.       Meta Ads        Competitor
    |           |               |
    +-----+-----+------+-------+
          |             |
          v             v
    Merge: Wave-1-Ergebnisse (3 Inputs)
                    |
                    v
          Code: Wave-1 auswerten + Run-Log
                    |
                    v
          IF: Wave-1 OK? (mindestens 1 Erfolg)
                    |
               +----+----+
               |         |
           TRUE v     FALSE v
               |         |
               v         Code: Wave-1 komplett
          HTTP:             fehlgeschlagen
          WF4                   |
          Content               v
               |         (springt zu Run-Log)
               v
          Code: Wave-2 auswerten
               |
               v
          HTTP:
          WF5
          Report
               |
               v
          Code: Wave-3 auswerten
               |
               v
          HTTP:
          WF6
          Sender
               |
               v
          Code: Wave-4 auswerten
               |
               +------(Merge)------+
                                   |
                                   v
          Code: Finales Run-Log zusammenbauen
                    |
                    v
          HTTP: Supabase Run-Log schreiben
                    |
                    v
          Google Sheets: Run-Log Zeile schreiben
                    |
                    v
          Code: Final Response zusammenbauen
                    |
                    v
          Respond to Webhook (nur bei Webhook-Trigger)
```

### Architecture Decision: HTTP Request to Webhooks (Not Execute Workflow)

All sub-workflows use Webhook triggers (not Execute Workflow Trigger nodes). Therefore, the Master calls them via HTTP Request POST to their webhook URLs. This is consistent with the dual-trigger design -- the Master sends POST requests with `{ config: {...} }` in the body, which sub-workflows detect via their Dual-Trigger IF node.

**Why not Execute Workflow node?**
- Sub-workflows have Webhook triggers, not Execute Workflow Triggers
- HTTP Request allows setting a timeout per call
- The response is the structured `{ success, workflow, data, errors, timestamp }` JSON
- Sub-workflows remain independently callable

### Architecture Decision: Parallel Wave 1 via Merge Node

WF1, WF2, WF3 run in parallel. The workflow splits into 3 branches after config processing, each calling one sub-workflow via HTTP Request. A Merge node (mode: "append", 3 inputs) waits for all three to complete before continuing.

### Architecture Decision: Sequential Waves 2-4

After Wave 1 completes:
- Wave 2 (WF4): Needs WF1 + WF3 performance + competitor data. Called only if at least WF1 or WF3 succeeded.
- Wave 3 (WF5): Generates report. Called only if Wave 1 had at least partial success.
- Wave 4 (WF6): Sends report. Called only if WF5 succeeded.

Each wave has a Code node that evaluates the previous result and prepares input for the next sub-workflow.

### Architecture Decision: Schedule + Webhook Dual Trigger

n8n workflows can have multiple triggers. Both the Schedule Trigger and Webhook Trigger connect to the same Merge node. The Schedule Trigger fires with empty data (config read from Sheet). The Webhook Trigger accepts optional `{ sheet_url }` in the POST body for overriding the Sheet URL.

---

### Nodes

#### Node 1: Schedule Trigger

| Property | Value |
|---|---|
| **ID** | `wf7-schedule` |
| **Name** | `Schedule Trigger` |
| **Type** | `n8n-nodes-base.scheduleTrigger` |
| **typeVersion** | `1.2` |
| **Position** | `[260, 340]` |

**Parameters:**
```json
{
  "rule": {
    "interval": [
      {
        "field": "weeks",
        "triggerAtDay": [1],
        "triggerAtHour": 9,
        "triggerAtMinute": 0
      }
    ]
  }
}
```

**Notes:**
- Fires every Monday at 9:00 AM (server timezone, which is CET on n8n Cloud).
- `triggerAtDay: [1]` = Monday (0=Sunday, 1=Monday).
- Output is `{ json: {} }` -- no data, config is read from Sheet.

---

#### Node 2: Webhook Trigger

| Property | Value |
|---|---|
| **ID** | `wf7-webhook` |
| **Name** | `Webhook Trigger` |
| **Type** | `n8n-nodes-base.webhook` |
| **typeVersion** | `2` |
| **Position** | `[260, 540]` |

**Parameters:**
```json
{
  "path": "socialpulse-master",
  "httpMethod": "POST",
  "responseMode": "responseNode",
  "options": {}
}
```

**Notes:**
- `responseMode: "responseNode"` -- final response sent by Node 22 (Respond to Webhook).
- POST body (optional): `{ sheet_url: "https://docs.google.com/spreadsheets/d/..." }` to override the default Sheet URL.
- When triggered via Schedule, this node does not fire. When triggered via Webhook, the Schedule node does not fire. n8n handles this correctly via the Merge node downstream.

---

#### Node 3: Trigger zusammenfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-merge-trigger` |
| **Name** | `Trigger zusammenfuehren` |
| **Type** | `n8n-nodes-base.merge` |
| **typeVersion** | `3.1` |
| **Position** | `[520, 440]` |

**Parameters:**
```json
{
  "mode": "chooseBranch",
  "output": "empty"
}
```

**Notes:**
- `chooseBranch` mode: waits for whichever trigger fires and passes through. Since only one trigger fires per execution, the merge passes data from the active trigger.
- `output: "empty"` means it continues with an empty item (we read config from Sheet regardless). The actual trigger data (webhook body) is accessed via `$('Webhook Trigger').first().json` in downstream Code nodes.

---

#### Node 4: Konfig-Tab lesen

| Property | Value |
|---|---|
| **ID** | `wf7-read-konfig` |
| **Name** | `Konfig-Tab lesen` |
| **Type** | `n8n-nodes-base.googleSheets` |
| **typeVersion** | `4.7` |
| **Position** | `[780, 440]` |
| **Credentials** | Google Sheets OAuth2 |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `5000` |

**Parameters:**
```json
{
  "operation": "read",
  "documentId": {
    "mode": "url",
    "value": "GOOGLE_SHEET_URL_PLACEHOLDER"
  },
  "sheetName": {
    "mode": "name",
    "value": "Konfig"
  },
  "options": {
    "range": "A:B"
  }
}
```

**Notes:**
- Reads all rows from the Konfig tab (columns A=Einstellung, B=Wert).
- The Sheet URL placeholder must be replaced with the actual Google Sheet URL before deployment.
- If the Webhook body contains `sheet_url`, a downstream Code node could override this, but for simplicity the Sheet URL is hardcoded here.

---

#### Node 5: Konfig verarbeiten + Module bestimmen

| Property | Value |
|---|---|
| **ID** | `wf7-process-config` |
| **Name** | `Konfig verarbeiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1040, 440]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Parse Konfig-Tab rows into a config object\nconst config = {};\ntry {\n  const konfigRows = $input.all();\n  for (const row of konfigRows) {\n    const key = (row.json['Einstellung'] || row.json['einstellung'] || '').toString().trim();\n    const val = (row.json['Wert'] || row.json['wert'] || '').toString().trim();\n    if (key) config[key] = val;\n  }\n} catch (e) {\n  throw new Error('Konfig-Tab konnte nicht gelesen werden: ' + e.message);\n}\n\n// Validate required fields\nif (!config.project_name) throw new Error('project_name fehlt in Konfig-Tab');\nif (!config.active_modules) throw new Error('active_modules fehlt in Konfig-Tab');\n\n// Parse active modules\nconst activeModules = config.active_modules.split(',').map(m => m.trim().toLowerCase());\nconst activePlatforms = (config.active_platforms || '').split(',').map(p => p.trim().toLowerCase()).filter(p => p);\n\n// Determine which sub-workflows to run\nconst runWF1 = activeModules.includes('performance');\nconst runWF2 = activeModules.includes('meta_ads');\nconst runWF3 = activeModules.includes('competitor');\nconst runWF4 = activeModules.includes('content');\nconst runWF5 = activeModules.includes('report');\nconst runWF6 = activeModules.includes('report'); // WF6 runs whenever WF5 runs\n\n// Calendar week calculation\nconst now = new Date();\nconst year = now.getFullYear();\nconst jan1 = new Date(year, 0, 1);\nconst days = Math.floor((now - jan1) / (24 * 60 * 60 * 1000));\nconst calendarWeek = Math.ceil((days + jan1.getDay() + 1) / 7);\n\n// Base URL for sub-workflow webhooks\nconst baseUrl = 'https://meinoffice.app.n8n.cloud/webhook';\n\n// Build config payload to send to sub-workflows\nconst configPayload = {\n  project_name: config.project_name,\n  brand_name: config.brand_name || config.project_name,\n  brand_description: config.brand_description || '',\n  brand_tone: config.brand_tone || 'professionell',\n  brand_colors: config.brand_colors || '#1a73e8, #ffffff',\n  active_platforms: activePlatforms,\n  report_recipients: config.report_recipients || '',\n  report_cc: config.report_cc || '',\n  report_language: config.report_language || 'de',\n  apify_rate_limit_ms: parseInt(config.apify_rate_limit_ms || '5000', 10),\n  apify_max_concurrent: parseInt(config.apify_max_concurrent || '2', 10)\n};\n\nconst startedAt = new Date().toISOString();\n\nreturn [{\n  json: {\n    config: configPayload,\n    modules: {\n      wf1: runWF1,\n      wf2: runWF2,\n      wf3: runWF3,\n      wf4: runWF4,\n      wf5: runWF5,\n      wf6: runWF6\n    },\n    calendarWeek,\n    year,\n    startedAt,\n    baseUrl,\n    activeModules,\n    activePlatforms\n  }\n}];"
}
```

**Output shape:**
```json
{
  "config": { "project_name": "...", "brand_name": "...", ... },
  "modules": { "wf1": true, "wf2": true, "wf3": true, "wf4": true, "wf5": true, "wf6": true },
  "calendarWeek": 10,
  "year": 2026,
  "startedAt": "2026-03-09T09:00:00.000Z",
  "baseUrl": "https://meinoffice.app.n8n.cloud/webhook",
  "activeModules": ["performance", "meta_ads", "competitor", "content", "report"],
  "activePlatforms": ["instagram", "facebook", "tiktok", "linkedin", "youtube", "x_twitter"]
}
```

---

#### Node 6: WF1 Performance Collector ausfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-call-wf1` |
| **Name** | `WF1 Performance Collector` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1400, 240]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `10000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ $('Konfig verarbeiten').first().json.baseUrl + '/socialpulse-performance' }}",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ config: $('Konfig verarbeiten').first().json.config }) }}",
  "options": {
    "timeout": 300000
  }
}
```

**Notes:**
- POST body: `{ config: {...} }` triggers the Master-call branch in WF1's Dual-Trigger IF node.
- Timeout 300s (5 min) because WF1 scrapes 6 platforms sequentially with rate limiting.
- `onError: continueRegularOutput` -- if WF1 fails entirely, the Master continues and logs the failure.
- Retry 2x/10s for transient network errors.
- Response: `{ success, workflow, data, errors, timestamp }`.

---

#### Node 7: WF2 Meta Ads Analyzer ausfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-call-wf2` |
| **Name** | `WF2 Meta Ads Analyzer` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1400, 440]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `10000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ $('Konfig verarbeiten').first().json.baseUrl + '/socialpulse-meta-ads' }}",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ config: $('Konfig verarbeiten').first().json.config }) }}",
  "options": {
    "timeout": 180000
  }
}
```

**Notes:**
- POST body: `{ config: {...} }` triggers WF2's Master-call branch.
- Timeout 180s (3 min) -- Meta Graph API queries are fast.
- Runs in parallel with WF1 and WF3 (same branch from Konfig verarbeiten).

---

#### Node 8: WF3 Competitor Monitor ausfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-call-wf3` |
| **Name** | `WF3 Competitor Monitor` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1400, 640]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `10000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ $('Konfig verarbeiten').first().json.baseUrl + '/socialpulse-competitor' }}",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ config: $('Konfig verarbeiten').first().json.config }) }}",
  "options": {
    "timeout": 300000
  }
}
```

**Notes:**
- POST body: `{ config: {...} }` triggers WF3's Master-call branch.
- Timeout 300s (5 min) -- Apify scraping can be slow.
- Runs in parallel with WF1 and WF2.

---

#### Node 9: Wave-1 Ergebnisse zusammenfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-merge-wave1` |
| **Name** | `Wave-1 Ergebnisse` |
| **Type** | `n8n-nodes-base.merge` |
| **typeVersion** | `3.1` |
| **Position** | `[1700, 440]` |

**Parameters:**
```json
{
  "mode": "append",
  "options": {}
}
```

**Notes:**
- Merge mode "append": combines results from all 3 parallel branches into a single array.
- 3 inputs: WF1 result, WF2 result, WF3 result.
- Each input is one item with the sub-workflow's response JSON.
- The Merge node has 3 inputs because we connect all three HTTP Request nodes to it.

---

#### Node 10: Wave-1 auswerten

| Property | Value |
|---|---|
| **ID** | `wf7-eval-wave1` |
| **Name** | `Wave-1 auswerten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1960, 440]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Evaluate Wave 1 results (WF1, WF2, WF3)\nconst configData = $('Konfig verarbeiten').first().json;\nconst modules = configData.modules;\n\n// Collect results from Wave 1 sub-workflows\nconst wave1Items = $input.all();\nconst wave1Results = [];\nconst wave1Errors = [];\n\n// Map the 3 items to their respective workflows\n// Item order from Merge (append): WF1 (input 0), WF2 (input 1), WF3 (input 2)\nconst wfNames = ['WF1 Performance Collector', 'WF2 Meta Ads Analyzer', 'WF3 Competitor Monitor'];\nconst wfKeys = ['wf1', 'wf2', 'wf3'];\nconst wfModuleActive = [modules.wf1, modules.wf2, modules.wf3];\n\nfor (let i = 0; i < wave1Items.length; i++) {\n  const item = wave1Items[i].json;\n  const wfKey = wfKeys[i] || 'unknown';\n  const wfName = wfNames[i] || 'Unknown';\n  const isActive = wfModuleActive[i] !== false;\n\n  if (!isActive) {\n    wave1Results.push({\n      workflow: wfName,\n      key: wfKey,\n      status: 'skipped',\n      message: 'Modul nicht aktiv in Konfig'\n    });\n    continue;\n  }\n\n  // Check if the HTTP request itself failed (error in response)\n  if (item.error || item.statusCode >= 400) {\n    wave1Errors.push({\n      workflow: wfName,\n      key: wfKey,\n      status: 'error',\n      message: item.error || item.message || ('HTTP ' + (item.statusCode || 'unknown')),\n      details: item\n    });\n    continue;\n  }\n\n  // Check the sub-workflow's structured response\n  if (item.success === false) {\n    wave1Errors.push({\n      workflow: wfName,\n      key: wfKey,\n      status: 'error',\n      message: 'Sub-Workflow meldete Fehler',\n      errors: item.errors\n    });\n    continue;\n  }\n\n  wave1Results.push({\n    workflow: wfName,\n    key: wfKey,\n    status: item.success ? 'success' : 'partial_success',\n    data: item.data || null\n  });\n}\n\nconst wave1Success = wave1Results.filter(r => r.status === 'success' || r.status === 'partial_success').length;\nconst wave1Failed = wave1Errors.length;\nconst wave1Ok = wave1Success > 0;\n\nreturn [{\n  json: {\n    config: configData.config,\n    modules: configData.modules,\n    calendarWeek: configData.calendarWeek,\n    year: configData.year,\n    startedAt: configData.startedAt,\n    baseUrl: configData.baseUrl,\n    wave1: {\n      results: wave1Results,\n      errors: wave1Errors,\n      successCount: wave1Success,\n      errorCount: wave1Failed,\n      ok: wave1Ok\n    },\n    runLog: [\n      ...wave1Results.map(r => ({ wave: 1, workflow: r.workflow, status: r.status })),\n      ...wave1Errors.map(e => ({ wave: 1, workflow: e.workflow, status: 'error', message: e.message }))\n    ]\n  }\n}];"
}
```

**Output shape:**
```json
{
  "config": { ... },
  "modules": { ... },
  "calendarWeek": 10,
  "year": 2026,
  "startedAt": "...",
  "baseUrl": "...",
  "wave1": {
    "results": [ { "workflow": "WF1...", "status": "success", "data": {...} } ],
    "errors": [],
    "successCount": 3,
    "errorCount": 0,
    "ok": true
  },
  "runLog": [ { "wave": 1, "workflow": "WF1...", "status": "success" } ]
}
```

---

#### Node 11: Wave-1 OK?

| Property | Value |
|---|---|
| **ID** | `wf7-if-wave1` |
| **Name** | `Wave-1 OK?` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[2220, 440]` |

**Parameters:**
```json
{
  "conditions": {
    "options": {
      "caseSensitive": true,
      "leftValue": "",
      "typeValidation": "strict"
    },
    "conditions": [
      {
        "id": "wave1-ok",
        "leftValue": "={{ $json.wave1.ok }}",
        "rightValue": true,
        "operator": {
          "type": "boolean",
          "operation": "true",
          "singleValue": true
        }
      }
    ],
    "combinator": "and"
  },
  "options": {}
}
```

**Logic:**
- **TRUE** (at least 1 Wave-1 WF succeeded) --> Continue to Wave 2 (WF4).
- **FALSE** (all Wave-1 WFs failed) --> Skip to final Run-Log (pipeline cannot produce useful content/report).

---

#### Node 12: Wave-1 komplett fehlgeschlagen

| Property | Value |
|---|---|
| **ID** | `wf7-wave1-failed` |
| **Name** | `Wave-1 komplett fehlgeschlagen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2480, 640]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Wave 1 completely failed -- skip Waves 2-4\nconst data = $input.first().json;\n\ndata.runLog.push({\n  wave: 'skip',\n  workflow: 'WF4/WF5/WF6',\n  status: 'skipped',\n  message: 'Uebersprungen weil Wave-1 komplett fehlgeschlagen'\n});\n\ndata.finalStatus = 'error';\ndata.finalMessage = 'Wave-1 komplett fehlgeschlagen. Keine Daten fuer Content/Report.';\n\nreturn [{ json: data }];"
}
```

---

#### Node 13: WF4 Content Creator ausfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-call-wf4` |
| **Name** | `WF4 Content Creator` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[2480, 340]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `10000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ $json.baseUrl + '/socialpulse-content' }}",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ config: $json.config }) }}",
  "options": {
    "timeout": 600000
  }
}
```

**Notes:**
- POST body: `{ config: {...} }` triggers WF4's Master-call branch.
- Timeout 600s (10 min) -- WF4 generates text + images + videos, can be slow.
- `onError: continueRegularOutput` -- content creation failure should not block reporting.
- WF4 reads performance + competitor data from Supabase internally (it was designed for dual-trigger operation).

---

#### Node 14: Wave-2 auswerten

| Property | Value |
|---|---|
| **ID** | `wf7-eval-wave2` |
| **Name** | `Wave-2 auswerten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2740, 340]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Evaluate Wave 2 result (WF4 Content Creator)\nconst prevData = $('Wave-1 auswerten').first().json;\nconst wf4Result = $input.first().json;\nconst modules = prevData.modules;\n\nlet wave2Entry;\n\nif (!modules.wf4) {\n  wave2Entry = { wave: 2, workflow: 'WF4 Content Creator', status: 'skipped', message: 'Modul nicht aktiv' };\n} else if (wf4Result.error || wf4Result.statusCode >= 400) {\n  wave2Entry = { wave: 2, workflow: 'WF4 Content Creator', status: 'error', message: wf4Result.error || wf4Result.message || 'HTTP Fehler' };\n} else if (wf4Result.success === false) {\n  wave2Entry = { wave: 2, workflow: 'WF4 Content Creator', status: 'error', message: 'Sub-WF meldete Fehler', errors: wf4Result.errors };\n} else {\n  wave2Entry = { wave: 2, workflow: 'WF4 Content Creator', status: 'success' };\n}\n\nprevData.runLog.push(wave2Entry);\nprevData.wave2 = { result: wave2Entry, ok: wave2Entry.status === 'success' || wave2Entry.status === 'skipped' };\n\nreturn [{ json: prevData }];"
}
```

---

#### Node 15: WF5 Report Generator ausfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-call-wf5` |
| **Name** | `WF5 Report Generator` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[3000, 340]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `10000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ $json.baseUrl + '/socialpulse-report-generator' }}",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ config: $json.config, calendar_week: $json.calendarWeek, year: $json.year }) }}",
  "options": {
    "timeout": 300000
  }
}
```

**Notes:**
- POST body: `{ config: {...}, calendar_week, year }` triggers WF5's Master-call branch.
- Timeout 300s (5 min) -- report generation includes Supabase reads + Claude analysis + PDF generation.
- WF5 returns: `{ success, data: { htmlReport, reportSubject, ... }, errors }`.

---

#### Node 16: Wave-3 auswerten

| Property | Value |
|---|---|
| **ID** | `wf7-eval-wave3` |
| **Name** | `Wave-3 auswerten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3260, 340]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Evaluate Wave 3 result (WF5 Report Generator)\nconst prevData = $('Wave-2 auswerten').first().json;\nconst wf5Result = $input.first().json;\nconst modules = prevData.modules;\n\nlet wave3Entry;\nlet reportData = null;\n\nif (!modules.wf5) {\n  wave3Entry = { wave: 3, workflow: 'WF5 Report Generator', status: 'skipped', message: 'Report-Modul nicht aktiv' };\n} else if (wf5Result.error || wf5Result.statusCode >= 400) {\n  wave3Entry = { wave: 3, workflow: 'WF5 Report Generator', status: 'error', message: wf5Result.error || wf5Result.message || 'HTTP Fehler' };\n} else if (wf5Result.success === false) {\n  wave3Entry = { wave: 3, workflow: 'WF5 Report Generator', status: 'error', message: 'Sub-WF meldete Fehler', errors: wf5Result.errors };\n} else {\n  wave3Entry = { wave: 3, workflow: 'WF5 Report Generator', status: 'success' };\n  reportData = wf5Result.data || null;\n}\n\nprevData.runLog.push(wave3Entry);\nprevData.wave3 = { result: wave3Entry, ok: wave3Entry.status === 'success', reportData };\n\nreturn [{ json: prevData }];"
}
```

---

#### Node 17: IF Report erstellt?

| Property | Value |
|---|---|
| **ID** | `wf7-if-report` |
| **Name** | `Report erstellt?` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[3520, 340]` |

**Parameters:**
```json
{
  "conditions": {
    "options": {
      "caseSensitive": true,
      "leftValue": "",
      "typeValidation": "strict"
    },
    "conditions": [
      {
        "id": "report-ok",
        "leftValue": "={{ $json.wave3.ok }}",
        "rightValue": true,
        "operator": {
          "type": "boolean",
          "operation": "true",
          "singleValue": true
        }
      }
    ],
    "combinator": "and"
  },
  "options": {}
}
```

**Logic:**
- **TRUE** (WF5 succeeded) --> Call WF6 to send the report.
- **FALSE** (WF5 failed or skipped) --> Skip WF6, go to final Run-Log.

---

#### Node 18: WF6 Report Sender ausfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-call-wf6` |
| **Name** | `WF6 Report Sender` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[3780, 240]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `10000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ $json.baseUrl + '/socialpulse-report-sender' }}",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ config: $json.config, reportData: $json.wave3.reportData, calendar_week: $json.calendarWeek, year: $json.year }) }}",
  "options": {
    "timeout": 120000
  }
}
```

**Notes:**
- POST body: `{ config: {...}, reportData: {...}, calendar_week, year }` triggers WF6's Master-call branch.
- Passes the full report data from WF5's response (htmlReport, reportSubject, etc.).
- Timeout 120s (2 min) -- email sending is fast.
- Note: PDF binary data cannot be passed via HTTP POST body. WF6 handles this by generating/fetching the PDF independently or sending without PDF if binary is unavailable. This is a known limitation of the webhook-based architecture.

---

#### Node 19: Wave-4 auswerten

| Property | Value |
|---|---|
| **ID** | `wf7-eval-wave4` |
| **Name** | `Wave-4 auswerten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[4040, 240]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Evaluate Wave 4 result (WF6 Report Sender)\nconst prevData = $('Wave-3 auswerten').first().json;\nconst wf6Result = $input.first().json;\n\nlet wave4Entry;\n\nif (wf6Result.error || wf6Result.statusCode >= 400) {\n  wave4Entry = { wave: 4, workflow: 'WF6 Report Sender', status: 'error', message: wf6Result.error || wf6Result.message || 'HTTP Fehler' };\n} else if (wf6Result.success === false) {\n  wave4Entry = { wave: 4, workflow: 'WF6 Report Sender', status: 'error', message: 'Sub-WF meldete Fehler', errors: wf6Result.errors };\n} else {\n  wave4Entry = { wave: 4, workflow: 'WF6 Report Sender', status: 'success' };\n}\n\nprevData.runLog.push(wave4Entry);\nprevData.wave4 = { result: wave4Entry, ok: wave4Entry.status === 'success' };\n\nreturn [{ json: prevData }];"
}
```

---

#### Node 20: Report uebersprungen

| Property | Value |
|---|---|
| **ID** | `wf7-report-skipped` |
| **Name** | `Report uebersprungen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3780, 440]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Report was not generated -- skip WF6\nconst data = $input.first().json;\n\ndata.runLog.push({\n  wave: 4,\n  workflow: 'WF6 Report Sender',\n  status: 'skipped',\n  message: 'Uebersprungen weil Report nicht erstellt wurde'\n});\n\ndata.wave4 = { result: { status: 'skipped' }, ok: false };\n\nreturn [{ json: data }];"
}
```

---

#### Node 21: Final Run-Log zusammenfuehren

| Property | Value |
|---|---|
| **ID** | `wf7-merge-final` |
| **Name** | `Final zusammenfuehren` |
| **Type** | `n8n-nodes-base.merge` |
| **typeVersion** | `3.1` |
| **Position** | `[4300, 440]` |

**Parameters:**
```json
{
  "mode": "chooseBranch",
  "output": "empty"
}
```

**Notes:**
- This Merge node collects the final state from 3 possible paths:
  1. Normal path (Wave-4 auswerten) -- after successful WF6 call
  2. Report skipped path (Report uebersprungen) -- WF5 failed, WF6 skipped
  3. Wave-1 failed path (Wave-1 komplett fehlgeschlagen) -- all of Wave 1 failed
- `chooseBranch` with `output: "empty"` -- we read the actual data from the last Code node on whichever branch executed, using `$('NodeName').first().json` in the next Code node.

---

#### Node 22: Finales Run-Log zusammenbauen

| Property | Value |
|---|---|
| **ID** | `wf7-build-runlog` |
| **Name** | `Finales Run-Log zusammenbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[4560, 440]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Build final run log from whichever path completed\nlet data;\n\n// Try to get data from the different possible paths\ntry { data = $('Wave-4 auswerten').first().json; } catch(e) {}\nif (!data) { try { data = $('Report uebersprungen').first().json; } catch(e) {} }\nif (!data) { try { data = $('Wave-1 komplett fehlgeschlagen').first().json; } catch(e) {} }\n\nif (!data) {\n  return [{ json: { error: 'Keine Daten von Sub-Workflows erhalten', runLog: [], finalStatus: 'error' } }];\n}\n\nconst finishedAt = new Date().toISOString();\nconst startMs = new Date(data.startedAt).getTime();\nconst endMs = new Date(finishedAt).getTime();\nconst durationSeconds = Math.round((endMs - startMs) / 1000 * 100) / 100;\n\n// Count successes and errors\nconst runLog = data.runLog || [];\nconst successWFs = runLog.filter(r => r.status === 'success').map(r => r.workflow);\nconst errorWFs = runLog.filter(r => r.status === 'error').map(r => r.workflow);\nconst skippedWFs = runLog.filter(r => r.status === 'skipped').map(r => r.workflow);\n\nlet finalStatus;\nif (data.finalStatus) {\n  finalStatus = data.finalStatus;\n} else if (errorWFs.length === 0) {\n  finalStatus = 'success';\n} else if (successWFs.length > 0) {\n  finalStatus = 'partial_success';\n} else {\n  finalStatus = 'error';\n}\n\nreturn [{\n  json: {\n    workflow_name: 'WF7 SocialPulse Controller',\n    workflow_id: $workflow.id || '',\n    execution_id: $execution.id || '',\n    project_name: data.config?.project_name || 'unknown',\n    started_at: data.startedAt,\n    finished_at: finishedAt,\n    duration_seconds: durationSeconds,\n    status: finalStatus,\n    platforms_ok: successWFs,\n    platforms_error: errorWFs,\n    error_details: errorWFs.length > 0 ? JSON.stringify(runLog.filter(r => r.status === 'error')) : null,\n    items_processed: successWFs.length + skippedWFs.length + errorWFs.length,\n    notes: 'Waves: W1=' + (data.wave1?.successCount || 0) + '/' + ((data.wave1?.successCount || 0) + (data.wave1?.errorCount || 0)) + ' OK, W2=' + (data.wave2?.result?.status || 'n/a') + ', W3=' + (data.wave3?.result?.status || 'n/a') + ', W4=' + (data.wave4?.result?.status || 'n/a'),\n    // Pass full data for downstream nodes\n    _config: data.config,\n    _runLog: runLog,\n    _calendarWeek: data.calendarWeek,\n    _year: data.year,\n    _finalMessage: data.finalMessage || '',\n    _wave1: data.wave1,\n    _wave2: data.wave2,\n    _wave3: data.wave3,\n    _wave4: data.wave4\n  }\n}];"
}
```

---

#### Node 23: Supabase Run-Log schreiben

| Property | Value |
|---|---|
| **ID** | `wf7-supabase-runlog` |
| **Name** | `Supabase Run-Log schreiben` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[4820, 440]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/workflow_runs' }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "apikey",
        "value": "SUPABASE_API_KEY_PLACEHOLDER"
      },
      {
        "name": "Authorization",
        "value": "Bearer SUPABASE_API_KEY_PLACEHOLDER"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ workflow_name: $json.workflow_name, workflow_id: $json.workflow_id, execution_id: $json.execution_id, project_name: $json.project_name, started_at: $json.started_at, finished_at: $json.finished_at, duration_seconds: $json.duration_seconds, status: $json.status, platforms_ok: $json.platforms_ok, platforms_error: $json.platforms_error, error_details: $json.error_details ? JSON.parse($json.error_details) : null, items_processed: $json.items_processed, notes: $json.notes }) }}",
  "options": {}
}
```

**Notes:**
- Uses Supabase PostgREST INSERT (POST) to write the run log entry.
- Same credential pattern as WF1-WF6.
- `onError: continueRegularOutput` -- run log failure must not block the response.
- Placeholders `SUPABASE_URL_PLACEHOLDER` and `SUPABASE_API_KEY_PLACEHOLDER` must be replaced before deployment.

---

#### Node 24: Google Sheets Run-Log schreiben

| Property | Value |
|---|---|
| **ID** | `wf7-sheet-runlog` |
| **Name** | `Sheets Run-Log schreiben` |
| **Type** | `n8n-nodes-base.googleSheets` |
| **typeVersion** | `4.7` |
| **Position** | `[5080, 440]` |
| **Credentials** | Google Sheets OAuth2 |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `5000` |

**Parameters:**
```json
{
  "operation": "append",
  "documentId": {
    "mode": "url",
    "value": "GOOGLE_SHEET_URL_PLACEHOLDER"
  },
  "sheetName": {
    "mode": "name",
    "value": "Run Log"
  },
  "columns": {
    "mappingMode": "defineBelow",
    "value": {
      "Datum": "={{ $('Finales Run-Log zusammenbauen').first().json.finished_at }}",
      "Workflow": "={{ $('Finales Run-Log zusammenbauen').first().json.workflow_name }}",
      "Status": "={{ $('Finales Run-Log zusammenbauen').first().json.status }}",
      "Dauer (s)": "={{ $('Finales Run-Log zusammenbauen').first().json.duration_seconds }}",
      "Erfolg": "={{ $('Finales Run-Log zusammenbauen').first().json.platforms_ok.join(', ') }}",
      "Fehler": "={{ ($('Finales Run-Log zusammenbauen').first().json.platforms_error || []).join(', ') }}",
      "Details": "={{ $('Finales Run-Log zusammenbauen').first().json.notes }}"
    }
  },
  "options": {}
}
```

**Notes:**
- Appends a new row to the "Run Log" tab in the Google Sheet.
- Tab 8 from the Sheet structure defined in Phase 1.
- Columns: Datum, Workflow, Status, Dauer (s), Erfolg, Fehler, Details.
- `onError: continueRegularOutput` -- Sheet write failure must not block response.

---

#### Node 25: Final Response zusammenbauen

| Property | Value |
|---|---|
| **ID** | `wf7-build-response` |
| **Name** | `Final Response zusammenbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[5340, 440]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Build comprehensive final response\nconst runLogData = $('Finales Run-Log zusammenbauen').first().json;\n\nconst response = {\n  success: runLogData.status === 'success',\n  workflow: 'WF7 SocialPulse Controller',\n  status: runLogData.status,\n  summary: {\n    projectName: runLogData.project_name,\n    calendarWeek: runLogData._calendarWeek,\n    year: runLogData._year,\n    durationSeconds: runLogData.duration_seconds,\n    startedAt: runLogData.started_at,\n    finishedAt: runLogData.finished_at\n  },\n  waves: {\n    wave1: {\n      workflows: ['WF1', 'WF2', 'WF3'],\n      successCount: runLogData._wave1?.successCount || 0,\n      errorCount: runLogData._wave1?.errorCount || 0,\n      ok: runLogData._wave1?.ok || false\n    },\n    wave2: {\n      workflow: 'WF4',\n      status: runLogData._wave2?.result?.status || 'not_run'\n    },\n    wave3: {\n      workflow: 'WF5',\n      status: runLogData._wave3?.result?.status || 'not_run'\n    },\n    wave4: {\n      workflow: 'WF6',\n      status: runLogData._wave4?.result?.status || 'not_run'\n    }\n  },\n  runLog: runLogData._runLog || [],\n  errors: (runLogData._runLog || []).filter(r => r.status === 'error').length > 0\n    ? (runLogData._runLog || []).filter(r => r.status === 'error')\n    : null,\n  message: runLogData._finalMessage || (runLogData.status === 'success'\n    ? 'Alle Workflows erfolgreich abgeschlossen.'\n    : runLogData.status === 'partial_success'\n      ? 'Teilweise erfolgreich. Einige Workflows hatten Fehler.'\n      : 'Pipeline fehlgeschlagen. Details im runLog.'),\n  timestamp: new Date().toISOString()\n};\n\nreturn [{ json: response }];"
}
```

**Output shape:**
```json
{
  "success": true,
  "workflow": "WF7 SocialPulse Controller",
  "status": "success",
  "summary": {
    "projectName": "MeinProjekt",
    "calendarWeek": 10,
    "year": 2026,
    "durationSeconds": 245.5,
    "startedAt": "2026-03-09T09:00:00.000Z",
    "finishedAt": "2026-03-09T09:04:05.500Z"
  },
  "waves": {
    "wave1": { "workflows": ["WF1", "WF2", "WF3"], "successCount": 3, "errorCount": 0, "ok": true },
    "wave2": { "workflow": "WF4", "status": "success" },
    "wave3": { "workflow": "WF5", "status": "success" },
    "wave4": { "workflow": "WF6", "status": "success" }
  },
  "runLog": [
    { "wave": 1, "workflow": "WF1 Performance Collector", "status": "success" },
    { "wave": 1, "workflow": "WF2 Meta Ads Analyzer", "status": "success" },
    { "wave": 1, "workflow": "WF3 Competitor Monitor", "status": "success" },
    { "wave": 2, "workflow": "WF4 Content Creator", "status": "success" },
    { "wave": 3, "workflow": "WF5 Report Generator", "status": "success" },
    { "wave": 4, "workflow": "WF6 Report Sender", "status": "success" }
  ],
  "errors": null,
  "message": "Alle Workflows erfolgreich abgeschlossen.",
  "timestamp": "2026-03-09T09:04:06.000Z"
}
```

---

#### Node 26: Webhook Antwort

| Property | Value |
|---|---|
| **ID** | `wf7-respond` |
| **Name** | `Webhook Antwort` |
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **typeVersion** | `1.1` |
| **Position** | `[5600, 440]` |

**Parameters:**
```json
{
  "respondWith": "json",
  "responseBody": "={{ $json }}",
  "options": {
    "responseCode": 200
  }
}
```

**Notes:**
- Only relevant when triggered via Webhook (Node 2). When triggered via Schedule (Node 1), there is no HTTP response to send, so this node is a no-op (it runs but has no effect since there is no waiting HTTP connection).
- Returns the comprehensive summary from Node 25.

---

### Connections

**Human-readable:**
```
Schedule Trigger --> Trigger zusammenfuehren (Input 0)
Webhook Trigger --> Trigger zusammenfuehren (Input 1)

Trigger zusammenfuehren --> Konfig-Tab lesen
Konfig-Tab lesen --> Konfig verarbeiten

Konfig verarbeiten --> WF1 Performance Collector
Konfig verarbeiten --> WF2 Meta Ads Analyzer
Konfig verarbeiten --> WF3 Competitor Monitor

WF1 Performance Collector --> Wave-1 Ergebnisse (Input 0)
WF2 Meta Ads Analyzer --> Wave-1 Ergebnisse (Input 1)
WF3 Competitor Monitor --> Wave-1 Ergebnisse (Input 2)

Wave-1 Ergebnisse --> Wave-1 auswerten
Wave-1 auswerten --> Wave-1 OK?

Wave-1 OK? [TRUE]  --> WF4 Content Creator
Wave-1 OK? [FALSE] --> Wave-1 komplett fehlgeschlagen

WF4 Content Creator --> Wave-2 auswerten
Wave-2 auswerten --> WF5 Report Generator
WF5 Report Generator --> Wave-3 auswerten
Wave-3 auswerten --> Report erstellt?

Report erstellt? [TRUE]  --> WF6 Report Sender
Report erstellt? [FALSE] --> Report uebersprungen

WF6 Report Sender --> Wave-4 auswerten
Wave-4 auswerten --> Final zusammenfuehren (Input 0)

Report uebersprungen --> Final zusammenfuehren (Input 1)
Wave-1 komplett fehlgeschlagen --> Final zusammenfuehren (Input 2)

Final zusammenfuehren --> Finales Run-Log zusammenbauen
Finales Run-Log zusammenbauen --> Supabase Run-Log schreiben
Supabase Run-Log schreiben --> Sheets Run-Log schreiben
Sheets Run-Log schreiben --> Final Response zusammenbauen
Final Response zusammenbauen --> Webhook Antwort
```

**Connection JSON (n8n format):**
```json
{
  "Schedule Trigger": {
    "main": [[{ "node": "Trigger zusammenfuehren", "type": "main", "index": 0 }]]
  },
  "Webhook Trigger": {
    "main": [[{ "node": "Trigger zusammenfuehren", "type": "main", "index": 1 }]]
  },
  "Trigger zusammenfuehren": {
    "main": [[{ "node": "Konfig-Tab lesen", "type": "main", "index": 0 }]]
  },
  "Konfig-Tab lesen": {
    "main": [[{ "node": "Konfig verarbeiten", "type": "main", "index": 0 }]]
  },
  "Konfig verarbeiten": {
    "main": [[
      { "node": "WF1 Performance Collector", "type": "main", "index": 0 },
      { "node": "WF2 Meta Ads Analyzer", "type": "main", "index": 0 },
      { "node": "WF3 Competitor Monitor", "type": "main", "index": 0 }
    ]]
  },
  "WF1 Performance Collector": {
    "main": [[{ "node": "Wave-1 Ergebnisse", "type": "main", "index": 0 }]]
  },
  "WF2 Meta Ads Analyzer": {
    "main": [[{ "node": "Wave-1 Ergebnisse", "type": "main", "index": 1 }]]
  },
  "WF3 Competitor Monitor": {
    "main": [[{ "node": "Wave-1 Ergebnisse", "type": "main", "index": 2 }]]
  },
  "Wave-1 Ergebnisse": {
    "main": [[{ "node": "Wave-1 auswerten", "type": "main", "index": 0 }]]
  },
  "Wave-1 auswerten": {
    "main": [[{ "node": "Wave-1 OK?", "type": "main", "index": 0 }]]
  },
  "Wave-1 OK?": {
    "main": [
      [{ "node": "WF4 Content Creator", "type": "main", "index": 0 }],
      [{ "node": "Wave-1 komplett fehlgeschlagen", "type": "main", "index": 0 }]
    ]
  },
  "WF4 Content Creator": {
    "main": [[{ "node": "Wave-2 auswerten", "type": "main", "index": 0 }]]
  },
  "Wave-2 auswerten": {
    "main": [[{ "node": "WF5 Report Generator", "type": "main", "index": 0 }]]
  },
  "WF5 Report Generator": {
    "main": [[{ "node": "Wave-3 auswerten", "type": "main", "index": 0 }]]
  },
  "Wave-3 auswerten": {
    "main": [[{ "node": "Report erstellt?", "type": "main", "index": 0 }]]
  },
  "Report erstellt?": {
    "main": [
      [{ "node": "WF6 Report Sender", "type": "main", "index": 0 }],
      [{ "node": "Report uebersprungen", "type": "main", "index": 0 }]
    ]
  },
  "WF6 Report Sender": {
    "main": [[{ "node": "Wave-4 auswerten", "type": "main", "index": 0 }]]
  },
  "Wave-4 auswerten": {
    "main": [[{ "node": "Final zusammenfuehren", "type": "main", "index": 0 }]]
  },
  "Report uebersprungen": {
    "main": [[{ "node": "Final zusammenfuehren", "type": "main", "index": 1 }]]
  },
  "Wave-1 komplett fehlgeschlagen": {
    "main": [[{ "node": "Final zusammenfuehren", "type": "main", "index": 2 }]]
  },
  "Final zusammenfuehren": {
    "main": [[{ "node": "Finales Run-Log zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Finales Run-Log zusammenbauen": {
    "main": [[{ "node": "Supabase Run-Log schreiben", "type": "main", "index": 0 }]]
  },
  "Supabase Run-Log schreiben": {
    "main": [[{ "node": "Sheets Run-Log schreiben", "type": "main", "index": 0 }]]
  },
  "Sheets Run-Log schreiben": {
    "main": [[{ "node": "Final Response zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Final Response zusammenbauen": {
    "main": [[{ "node": "Webhook Antwort", "type": "main", "index": 0 }]]
  }
}
```

---

### Workflow Settings

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

## Node Configuration Summary

| # | Node Name | Type | typeVersion | Credentials | Error Handling |
|---|---|---|---|---|---|
| 1 | Schedule Trigger | `n8n-nodes-base.scheduleTrigger` | 1.2 | None | - |
| 2 | Webhook Trigger | `n8n-nodes-base.webhook` | 2 | None | - |
| 3 | Trigger zusammenfuehren | `n8n-nodes-base.merge` | 3.1 | None | - |
| 4 | Konfig-Tab lesen | `n8n-nodes-base.googleSheets` | 4.7 | Google Sheets OAuth2 | retry 3x/5s |
| 5 | Konfig verarbeiten | `n8n-nodes-base.code` | 2 | None | - |
| 6 | WF1 Performance Collector | `n8n-nodes-base.httpRequest` | 4.4 | None | onError: continueRegularOutput, retry 2x/10s |
| 7 | WF2 Meta Ads Analyzer | `n8n-nodes-base.httpRequest` | 4.4 | None | onError: continueRegularOutput, retry 2x/10s |
| 8 | WF3 Competitor Monitor | `n8n-nodes-base.httpRequest` | 4.4 | None | onError: continueRegularOutput, retry 2x/10s |
| 9 | Wave-1 Ergebnisse | `n8n-nodes-base.merge` | 3.1 | None | - |
| 10 | Wave-1 auswerten | `n8n-nodes-base.code` | 2 | None | - |
| 11 | Wave-1 OK? | `n8n-nodes-base.if` | 2.2 | None | - |
| 12 | Wave-1 komplett fehlgeschlagen | `n8n-nodes-base.code` | 2 | None | - |
| 13 | WF4 Content Creator | `n8n-nodes-base.httpRequest` | 4.4 | None | onError: continueRegularOutput, retry 2x/10s |
| 14 | Wave-2 auswerten | `n8n-nodes-base.code` | 2 | None | - |
| 15 | WF5 Report Generator | `n8n-nodes-base.httpRequest` | 4.4 | None | onError: continueRegularOutput, retry 2x/10s |
| 16 | Wave-3 auswerten | `n8n-nodes-base.code` | 2 | None | - |
| 17 | Report erstellt? | `n8n-nodes-base.if` | 2.2 | None | - |
| 18 | WF6 Report Sender | `n8n-nodes-base.httpRequest` | 4.4 | None | onError: continueRegularOutput, retry 2x/10s |
| 19 | Wave-4 auswerten | `n8n-nodes-base.code` | 2 | None | - |
| 20 | Report uebersprungen | `n8n-nodes-base.code` | 2 | None | - |
| 21 | Final zusammenfuehren | `n8n-nodes-base.merge` | 3.1 | None | - |
| 22 | Finales Run-Log zusammenbauen | `n8n-nodes-base.code` | 2 | None | - |
| 23 | Supabase Run-Log schreiben | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Supabase) | onError: continueRegularOutput, retry 2x/3s |
| 24 | Sheets Run-Log schreiben | `n8n-nodes-base.googleSheets` | 4.7 | Google Sheets OAuth2 | onError: continueRegularOutput, retry 3x/5s |
| 25 | Final Response zusammenbauen | `n8n-nodes-base.code` | 2 | None | - |
| 26 | Webhook Antwort | `n8n-nodes-base.respondToWebhook` | 1.1 | None | - |

**Total: 26 nodes**

---

## HTTP Request Justifications

| Node | Why HTTP Request | Native Alternative |
|---|---|---|
| WF1-WF3 calls (Nodes 6-8) | Sub-workflows use Webhook triggers, not Execute Workflow Triggers. HTTP POST is the only way to invoke them. | `nodes-base.executeWorkflow` would require sub-WFs to have Execute Workflow Trigger nodes instead of Webhooks |
| WF4-WF6 calls (Nodes 13, 15, 18) | Same reason as above: webhook-triggered sub-workflows. | Same as above |
| Supabase Run-Log (Node 23) | Consistency with WF1-WF6 pattern. Native Supabase node could handle INSERT but HTTP Request keeps the same credential setup. | `nodes-base.supabase` with `operation: create` |

**Note:** The Google Sheets nodes (4 and 24) use the **native node** (`nodes-base.googleSheets`). No HTTP Request needed for Sheet operations.

---

## Data Flow

### Input (Trigger)

**Schedule Trigger (Monday 9:00):**
- No input data. Config is read from Google Sheet.

**Webhook Trigger (POST body, optional):**
```json
{
  "sheet_url": "https://docs.google.com/spreadsheets/d/..."
}
```

### Internal Data Flow

```
[Trigger] --> empty
  |
  v
[Konfig-Tab lesen] --> Array of {Einstellung, Wert} rows
  |
  v
[Konfig verarbeiten] --> { config, modules, calendarWeek, year, startedAt, baseUrl }
  |
  +--> [WF1 call] --> { success, workflow, data, errors, timestamp }
  +--> [WF2 call] --> { success, workflow, data, errors, timestamp }
  +--> [WF3 call] --> { success, workflow, data, errors, timestamp }
  |
  v
[Wave-1 Merge] --> 3 items (append)
  |
  v
[Wave-1 auswerten] --> { config, modules, ..., wave1: { results, errors, ok }, runLog }
  |
  v
[IF Wave-1 OK] --> TRUE: continue | FALSE: skip to final
  |
  v (TRUE path)
[WF4 call] --> { success, workflow, data, errors, timestamp }
  |
  v
[Wave-2 auswerten] --> { ..., wave2: { result, ok }, runLog updated }
  |
  v
[WF5 call] --> { success, data: { htmlReport, reportSubject, ... }, errors }
  |
  v
[Wave-3 auswerten] --> { ..., wave3: { result, ok, reportData }, runLog updated }
  |
  v
[IF Report OK] --> TRUE: WF6 | FALSE: skip WF6
  |
  v (TRUE path)
[WF6 call] --> { success, data: { recipients, subject, ... }, errors }
  |
  v
[Wave-4 auswerten] --> { ..., wave4: { result, ok }, runLog updated }
  |
  v
[Final Merge] <-- (collects from 3 possible paths)
  |
  v
[Final Run-Log] --> { workflow_name, status, duration_seconds, ... }
  |
  v
[Supabase INSERT] --> writes to workflow_runs table
  |
  v
[Sheet append] --> writes to "Run Log" tab
  |
  v
[Final Response] --> { success, status, summary, waves, runLog, errors, message }
  |
  v
[Webhook Antwort] --> HTTP 200 JSON response
```

### Output (Webhook Response)

See Node 25 output shape above.

---

## Conditional Module Execution

The `active_modules` config field controls which sub-workflows run. The Code node "Konfig verarbeiten" (Node 5) parses this field and sets `modules.wf1` through `modules.wf6` booleans.

**However**, the current architecture always calls WF1/WF2/WF3 in Wave 1 via HTTP Request. If a module is inactive, the HTTP Request still fires but the sub-workflow's Dual-Trigger logic handles it -- the sub-workflow reads its own config and may skip processing if its module is disabled.

**Future enhancement**: Add IF nodes before each Wave 1 call to skip inactive modules entirely. For v1, the overhead of calling an inactive module's webhook (which returns quickly with a "skipped" response) is acceptable.

For Waves 2-4, the `Wave-N auswerten` Code nodes check `modules.wfN` and mark the step as "skipped" if the module is inactive, preventing unnecessary HTTP calls to WF4/WF5/WF6.

**Important**: WF4 (content) depends on WF1+WF3 data. WF5 (report) needs data from WF1-WF4. WF6 (sender) needs WF5's output. The wave architecture enforces these dependencies naturally.

---

## Error Handling Strategy

### Per-Node Error Handling

| Category | Pattern | Nodes |
|---|---|---|
| Sub-WF calls | `onError: continueRegularOutput` + retry 2x/10s | 6, 7, 8, 13, 15, 18 |
| Supabase write | `onError: continueRegularOutput` + retry 2x/3s | 23 |
| Google Sheets write | `onError: continueRegularOutput` + retry 3x/5s | 24 |
| Google Sheets read | retry 3x/5s (no continueRegularOutput -- config is required) | 4 |
| Code nodes | No error handling (throw = stop) | 5, 10, 12, 14, 16, 19, 20, 22, 25 |

### Error Propagation Logic

1. **Config read fails** (Node 4/5): Workflow stops entirely. Cannot proceed without config.
2. **Wave 1 sub-WF fails**: `onError: continueRegularOutput` catches the error. The merge node receives an error item. The Wave-1 auswerten Code node detects the error and logs it.
3. **All Wave 1 fails**: IF node routes to "Wave-1 komplett fehlgeschlagen" which skips Waves 2-4 and jumps to final Run-Log.
4. **WF4 fails** (Wave 2): Logged as error. Pipeline continues to WF5 (report can still be generated with WF1/WF3 data from Supabase).
5. **WF5 fails** (Wave 3): IF node routes to "Report uebersprungen" which skips WF6 and jumps to final Run-Log.
6. **WF6 fails** (Wave 4): Logged as error. Pipeline still writes Run-Log and returns response.
7. **Run-Log write fails** (Supabase/Sheet): `onError: continueRegularOutput` -- failure is silently ignored; response is still sent.

---

## Placeholders to Replace Before Deployment

| Placeholder | Used In | Replacement |
|---|---|---|
| `GOOGLE_SHEET_URL_PLACEHOLDER` | Node 4 (Konfig-Tab lesen), Node 24 (Sheets Run-Log) | Actual Google Sheet URL |
| `SUPABASE_URL_PLACEHOLDER` | Node 23 (Supabase Run-Log) | Actual Supabase project URL |
| `SUPABASE_API_KEY_PLACEHOLDER` | Node 23 (Supabase Run-Log, 2x in headers) | Actual Supabase anon/service key |

---

## Requirements Coverage

| Requirement | Status | Implementation |
|---|---|---|
| **TRIG-01** | Covered | Node 1: Schedule Trigger (Monday 9:00) + Node 2: Webhook for manual trigger |
| **TRIG-03** | Covered | Nodes 4-5: Read Konfig-Tab from Google Sheet, parse active_modules to determine which sub-WFs to run |
| **OUT-06** | Covered | Nodes 22-24: Run-Log written to both Supabase `workflow_runs` and Google Sheet "Run Log" tab after each run |
| **ERR-04** | Covered | Nodes 6-8, 13, 15, 18: All sub-WF calls use `onError: continueRegularOutput`; Nodes 10, 14, 16, 19: Wave evaluation Code nodes log errors with details; Node 22: Final run log aggregates all errors |

---

## Validation Criteria

- [ ] All 26 nodes have correct typeVersions
- [ ] All expressions use `={{ }}` syntax
- [ ] Code nodes use `$input.first().json`, `$input.all()`, and `$('NodeName').first().json` correctly
- [ ] No `$node['Name']` or `$json` (direct) in Code nodes
- [ ] All sub-WF HTTP Request nodes have `onError: continueRegularOutput`
- [ ] All sub-WF HTTP Request nodes have appropriate timeouts (120s-600s)
- [ ] Merge node "Wave-1 Ergebnisse" receives 3 inputs (one per parallel branch)
- [ ] Merge node "Final zusammenfuehren" receives 3 inputs (one per possible path)
- [ ] IF nodes use correct boolean comparison
- [ ] Connection JSON references nodes by name (not id)
- [ ] Parallel branching: Konfig verarbeiten fans out to 3 HTTP Request nodes
- [ ] Schedule Trigger configured for Monday 9:00
- [ ] Webhook path is `socialpulse-master`
- [ ] Run-Log writes to both Supabase AND Google Sheet
- [ ] Workflow settings include `executionOrder: "v1"`
- [ ] All placeholders documented (GOOGLE_SHEET_URL, SUPABASE_URL, SUPABASE_API_KEY)
- [ ] No HTTP Request nodes where native nodes exist (justified: sub-WF calls are webhooks, Supabase is for consistency)
- [ ] Credentials set for Google Sheets nodes

---

## Position Map (Visual Layout)

```
Y=240:                                          [WF1]─────────────────────────────────────────────────────[WF6]──[W4-eval]
Y=340:                                          [WF2]──────────────────────[WF4]──[W2-eval]──[WF5]──[W3-eval]──[IF-rpt]
Y=440:  [Sched]──[Merge]──[Sheet]──[Konfig]────────────────[W1-Merge]──[W1-eval]──[IF-W1]                       [rpt-skip]──[F-Merge]──[F-RunLog]──[Supa]──[SheetLog]──[Response]──[Respond]
Y=540:  [Webhook]
Y=640:                                          [WF3]─────────────────────[W1-fail]
```

**Positions summary:**

| Node | Position [x, y] |
|---|---|
| Schedule Trigger | [260, 340] |
| Webhook Trigger | [260, 540] |
| Trigger zusammenfuehren | [520, 440] |
| Konfig-Tab lesen | [780, 440] |
| Konfig verarbeiten | [1040, 440] |
| WF1 Performance Collector | [1400, 240] |
| WF2 Meta Ads Analyzer | [1400, 440] |
| WF3 Competitor Monitor | [1400, 640] |
| Wave-1 Ergebnisse | [1700, 440] |
| Wave-1 auswerten | [1960, 440] |
| Wave-1 OK? | [2220, 440] |
| Wave-1 komplett fehlgeschlagen | [2480, 640] |
| WF4 Content Creator | [2480, 340] |
| Wave-2 auswerten | [2740, 340] |
| WF5 Report Generator | [3000, 340] |
| Wave-3 auswerten | [3260, 340] |
| Report erstellt? | [3520, 340] |
| WF6 Report Sender | [3780, 240] |
| Wave-4 auswerten | [4040, 240] |
| Report uebersprungen | [3780, 440] |
| Final zusammenfuehren | [4300, 440] |
| Finales Run-Log zusammenbauen | [4560, 440] |
| Supabase Run-Log schreiben | [4820, 440] |
| Sheets Run-Log schreiben | [5080, 440] |
| Final Response zusammenbauen | [5340, 440] |
| Webhook Antwort | [5600, 440] |

---

## Known Limitations

1. **PDF binary passthrough**: The Master cannot pass WF5's PDF binary data to WF6 via HTTP POST body. WF6 must either regenerate the PDF or send without attachment. A future improvement could use Execute Workflow nodes with Execute Workflow Trigger instead of webhooks to enable binary data passthrough.

2. **Module skip optimization**: Currently, inactive modules still receive webhook calls (Wave 1). The sub-workflows handle the skip internally. A future improvement could add IF nodes before each Wave 1 call.

3. **Webhook timeout**: n8n Cloud has a default webhook response timeout. Since the Master orchestrates multiple sub-workflows that can each take several minutes, the total execution time could exceed the webhook timeout (typically 3-5 minutes). For Schedule Trigger invocations this is not an issue (no HTTP response needed). For Webhook invocations, if the total pipeline exceeds the timeout, the caller gets a timeout error even though the pipeline continues running. A possible mitigation: return an immediate "accepted" response and use a callback URL for the final result.

---
*Plan created: 2026-03-03*
