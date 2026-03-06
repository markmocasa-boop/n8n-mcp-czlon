---
phase: 1
plan: 1
workflows: [WF1]
type: n8n-workflow
status: planned
created: 2026-03-03
---

# Phase 1 Plan: Performance Data Foundation

## Objective

Deploy WF1 Performance Collector -- a workflow that collects social media performance metrics from 6 platforms (Instagram, Facebook, TikTok, LinkedIn, YouTube, X/Twitter), normalizes them into a unified schema, and writes the results to both Supabase (historical storage) and Google Sheets (current dashboard). The workflow must be triggerable both standalone (via its own Webhook) and from the Master Orchestrator (Phase 5). Each platform branch must be error-isolated so that a failure on one platform does not block the others.

Additionally, this phase includes the creation of the Supabase database schema and the Google Sheet with all 8 tabs.

---

## Pre-Workflow Tasks

### Task 1: Supabase Schema Setup

Execute via Supabase SQL Editor (Dashboard > SQL Editor):

```sql
-- =============================================================
-- TASK 1A: performance_weekly
-- Stores normalized weekly performance metrics per platform.
-- UPSERT key: project_name + platform + calendar_week + year
-- =============================================================

CREATE TABLE IF NOT EXISTS performance_weekly (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  platform              TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x_twitter')),
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),

  -- Core metrics (all platforms)
  followers             INTEGER DEFAULT 0,
  follower_growth       INTEGER DEFAULT 0,
  posts_published       INTEGER DEFAULT 0,
  impressions           BIGINT DEFAULT 0,
  reach                 BIGINT DEFAULT 0,
  likes                 INTEGER DEFAULT 0,
  comments              INTEGER DEFAULT 0,
  shares                INTEGER DEFAULT 0,
  engagement_rate       NUMERIC(6,4) DEFAULT 0,

  -- Top / Worst Post
  top_post_url          TEXT,
  top_post_engagement   INTEGER DEFAULT 0,
  worst_post_url        TEXT,
  worst_post_engagement INTEGER DEFAULT 0,

  -- Platform-specific (nullable)
  video_views           BIGINT,
  story_views           BIGINT,
  link_clicks           INTEGER,
  watch_time_hours      NUMERIC(10,2),
  avg_view_duration_sec NUMERIC(10,2),

  -- Metadata
  collected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf1_performance_collector',
  raw_data              JSONB,

  -- UPSERT constraint
  CONSTRAINT uq_performance_weekly
    UNIQUE (project_name, platform, calendar_week, year)
);

CREATE INDEX IF NOT EXISTS idx_perf_project_platform
  ON performance_weekly (project_name, platform);
CREATE INDEX IF NOT EXISTS idx_perf_kw_year
  ON performance_weekly (calendar_week, year);

-- =============================================================
-- TASK 1B: workflow_runs
-- Execution log for all workflow runs (used by all WFs).
-- =============================================================

CREATE TABLE IF NOT EXISTS workflow_runs (
  id                BIGSERIAL PRIMARY KEY,
  workflow_name     TEXT NOT NULL,
  workflow_id       TEXT,
  execution_id      TEXT,
  project_name      TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  duration_seconds  NUMERIC(10,2),
  status            TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial_success', 'error')),
  platforms_ok      TEXT[],       -- e.g. {'instagram','facebook'}
  platforms_error   TEXT[],       -- e.g. {'tiktok'}
  error_details     JSONB,
  items_processed   INTEGER DEFAULT 0,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_workflow
  ON workflow_runs (workflow_name);
CREATE INDEX IF NOT EXISTS idx_runs_project
  ON workflow_runs (project_name);

-- =============================================================
-- TASK 1C: Placeholder tables for Phase 2+
-- Created empty now to avoid migration issues later.
-- =============================================================

CREATE TABLE IF NOT EXISTS meta_ads_weekly (
  id BIGSERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  calendar_week INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Full schema added in Phase 2
);

CREATE TABLE IF NOT EXISTS competitor_weekly (
  id BIGSERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  calendar_week INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Full schema added in Phase 2
);

CREATE TABLE IF NOT EXISTS content_generated (
  id BIGSERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  calendar_week INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Full schema added in Phase 3
);
```

### Task 2: Google Sheet Setup

Create a new Google Sheet named **"SocialPulse - [Projektname]"** with these 8 tabs:

#### Tab 1: Konfig

| Spalte | Beschreibung | Beispiel |
|---|---|---|
| A: Einstellung | Konfig-Schluessel | project_name |
| B: Wert | Konfig-Wert | MeinProjekt |

**Zeilen (vorausgefuellt):**

| Einstellung | Wert |
|---|---|
| project_name | (Projektname eintragen) |
| brand_name | (Markenname) |
| brand_description | (Kurzbeschreibung, 1-2 Saetze) |
| brand_tone | professionell, freundlich |
| brand_colors | #1a73e8, #ffffff |
| active_platforms | instagram, facebook, tiktok, linkedin, youtube, x_twitter |
| active_modules | performance, meta_ads, competitor, content, report |
| report_recipients | email1@example.com, email2@example.com |
| report_cc | cc@example.com |
| report_language | de |
| apify_rate_limit_ms | 5000 |
| apify_max_concurrent | 2 |

#### Tab 2: Plattform-Accounts

| Spalte | Beschreibung |
|---|---|
| A: Plattform | instagram / facebook / tiktok / linkedin / youtube / x_twitter |
| B: Account-Name | Display-Name |
| C: Account-ID | Plattform-spezifische ID |
| D: Account-URL | Profil-URL |
| E: Aktiv | TRUE / FALSE |
| F: Apify Actor ID | (nur fuer Apify-basierte Plattformen) |
| G: Notizen | Freitext |

#### Tab 3: Wettbewerber

| Spalte | Beschreibung |
|---|---|
| A: Plattform | instagram / facebook / etc. |
| B: Name | Wettbewerber-Name |
| C: Account-URL | Profil-URL |
| D: Account-ID | (optional) |
| E: Aktiv | TRUE / FALSE |

#### Tab 4: Meta Ads Konfig

| Spalte | Beschreibung |
|---|---|
| A: Einstellung | ad_account_id / campaign_filter / date_range_days |
| B: Wert | Konfigurationswert |

#### Tab 5: Performance Aktuell

| Spalte | Header |
|---|---|
| A | Plattform |
| B | KW |
| C | Jahr |
| D | Followers |
| E | Follower-Wachstum |
| F | Posts |
| G | Impressions |
| H | Reach |
| I | Likes |
| J | Kommentare |
| K | Shares |
| L | Engagement-Rate |
| M | Top-Post URL |
| N | Top-Post Engagement |
| O | Worst-Post URL |
| P | Worst-Post Engagement |
| Q | Video Views |
| R | Story Views |
| S | Link Clicks |
| T | Erfasst am |

#### Tab 6: Content Plan

| Spalte | Header |
|---|---|
| A | Plattform |
| B | KW |
| C | Typ (Post/Story/Reel/Video) |
| D | Text |
| E | Hashtags |
| F | CTA |
| G | Bild-URL |
| H | Video-URL |
| I | Status (Entwurf/Freigegeben) |
| J | Erstellt am |

#### Tab 7: Competitor Insights

| Spalte | Header |
|---|---|
| A | Plattform |
| B | Wettbewerber |
| C | KW |
| D | Followers |
| E | Top-Post URL |
| F | Top-Post Engagement |
| G | Content-Idee |
| H | Sentiment |
| I | Erfasst am |

#### Tab 8: Run Log

| Spalte | Header |
|---|---|
| A | Workflow |
| B | Datum |
| C | Status |
| D | Plattformen OK |
| E | Plattformen Fehler |
| F | Dauer (s) |
| G | Fehler-Details |

---

## WF1: Performance Collector

### Overview

**Trigger**: Webhook (POST) -- accepts calls from the Master Orchestrator or standalone invocation.
**Purpose**: Collect performance metrics from up to 6 social media platforms, normalize them, and write to Supabase + Google Sheets.
**Error Handling**: Each platform runs in its own error-isolated Code node with try/catch. A failing platform produces an error entry instead of crashing the workflow.

### High-Level Flow

```
Webhook Trigger (POST)
  |
  v
Code: Dual-Trigger-Logik (check if config passed or standalone)
  |
  v
[IF standalone] --> Google Sheets: Konfig lesen --> Google Sheets: Accounts lesen
  |                                                          |
  v                                                          v
Code: Konfig zusammenfuehren --------------------------------+
  |
  v
Code: Aktive Plattformen bestimmen + Zeitraum berechnen
  |
  v
Code: Platform Dispatcher (erzeugt 1 Item pro aktive Plattform)
  |
  v
SplitInBatches (1 per batch, fuer Apify Rate Limiting)
  |
  +---> Code: Platform Router (calls correct API per platform)
  |       |
  |       +--> Instagram: Apify Actor (instagram-profile-scraper)
  |       +--> Facebook: Facebook Graph API (native node)
  |       +--> TikTok: Apify Actor (tiktok-profile-scraper)
  |       +--> LinkedIn: Apify Actor (linkedin-profile-scraper)
  |       +--> YouTube: YouTube Native Node (channel statistics)
  |       +--> X/Twitter: Apify Actor (twitter-scraper)
  |
  +---> Loop back to SplitInBatches
  |
  v (done)
Code: Ergebnisse normalisieren
  |
  v
Code: Run-Log vorbereiten
  |
  +--> Supabase: UPSERT performance_weekly
  +--> Google Sheets: Append to "Performance Aktuell"
  +--> Supabase: INSERT workflow_runs (Run-Log)
  |
  v
Code: Response zusammenbauen { success, data, errors }
  |
  v
Respond to Webhook
```

### Architecture Decision: Sequential with SplitInBatches

Instead of parallel branches with a Merge node (which would require exactly 6 inputs), we use a **sequential SplitInBatches** approach. This is the correct choice because:

1. **Apify Rate Limiting** -- max 2 concurrent, 5s pause between calls. Parallel would violate this.
2. **Error Isolation** -- each platform processes in its own batch iteration with try/catch in Code nodes.
3. **Dynamic Platform Count** -- not always 6 platforms active. SplitInBatches handles 1-6 items without hardcoding branch count.
4. **Result Aggregation** -- results accumulate in a workflow-level variable using `$getWorkflowStaticData('global')`.

### Nodes

#### Node 1: Webhook Trigger

| Property | Value |
|---|---|
| **ID** | `webhook-trigger` |
| **Name** | `Webhook Trigger` |
| **Type** | `n8n-nodes-base.webhook` |
| **typeVersion** | `2` |
| **Position** | `[260, 460]` |
| **Credentials** | None (open webhook or headerAuth) |

**Parameters:**
```json
{
  "path": "socialpulse-performance",
  "httpMethod": "POST",
  "responseMode": "responseNode",
  "options": {}
}
```

**Notes:**
- `responseMode: "responseNode"` -- response is sent by a dedicated "Respond to Webhook" node at the end, after all processing is complete.
- POST body can optionally contain `{ config: { ... }, accounts: [...] }` when called from Master.

---

#### Node 2: Dual-Trigger Pruefung

| Property | Value |
|---|---|
| **ID** | `dual-trigger-check` |
| **Name** | `Dual-Trigger Pruefung` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[520, 460]` |

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
        "id": "condition-has-config",
        "leftValue": "={{ $json.body.config }}",
        "rightValue": "",
        "operator": {
          "type": "object",
          "operation": "exists",
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
- **TRUE** (config exists in body) -- Master called this workflow, config is in `$json.body.config`. Skip Sheet reads.
- **FALSE** (no config) -- Standalone call. Must read config + accounts from Google Sheet.

---

#### Node 3: Konfig aus Sheet lesen

| Property | Value |
|---|---|
| **ID** | `read-konfig` |
| **Name** | `Konfig aus Sheet lesen` |
| **Type** | `n8n-nodes-base.googleSheets` |
| **typeVersion** | `4.7` |
| **Position** | `[780, 620]` |
| **Credentials** | Google Sheets OAuth2 |

**Parameters:**
```json
{
  "operation": "read",
  "documentId": {
    "mode": "url",
    "value": "={{ $json.body.sheet_url ?? 'GOOGLE_SHEET_URL_PLACEHOLDER' }}"
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
- Reads all rows from the Konfig tab (key-value pairs).
- The Sheet URL will be hardcoded after Google Sheet creation or passed via Webhook body.

---

#### Node 4: Accounts aus Sheet lesen

| Property | Value |
|---|---|
| **ID** | `read-accounts` |
| **Name** | `Accounts aus Sheet lesen` |
| **Type** | `n8n-nodes-base.googleSheets` |
| **typeVersion** | `4.7` |
| **Position** | `[1040, 620]` |
| **Credentials** | Google Sheets OAuth2 |

**Parameters:**
```json
{
  "operation": "read",
  "documentId": {
    "mode": "url",
    "value": "={{ $('Konfig aus Sheet lesen').first().json.sheet_url ?? 'GOOGLE_SHEET_URL_PLACEHOLDER' }}"
  },
  "sheetName": {
    "mode": "name",
    "value": "Plattform-Accounts"
  },
  "options": {
    "range": "A:G"
  }
}
```

---

#### Node 5: Konfig zusammenfuehren (Code)

| Property | Value |
|---|---|
| **ID** | `merge-config` |
| **Name** | `Konfig zusammenfuehren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[780, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// This node receives config from EITHER:\n// A) Master (via $('Dual-Trigger Pruefung') TRUE branch -> body.config)\n// B) Sheet reads (via FALSE branch -> Konfig + Accounts tabs)\n\n// Try to get from webhook body first (Master call)\nconst webhookData = $('Webhook Trigger').first().json.body;\n\nlet config = {};\nlet accounts = [];\n\nif (webhookData && webhookData.config) {\n  // Master provided config\n  config = webhookData.config;\n  accounts = webhookData.accounts || [];\n} else {\n  // Standalone: build config from Sheet rows\n  const konfigRows = $('Konfig aus Sheet lesen').all();\n  for (const row of konfigRows) {\n    const key = row.json['Einstellung'] || row.json['einstellung'];\n    const val = row.json['Wert'] || row.json['wert'];\n    if (key) config[key] = val;\n  }\n  \n  // Parse accounts from Sheet\n  const accountRows = $('Accounts aus Sheet lesen').all();\n  accounts = accountRows\n    .map(r => r.json)\n    .filter(a => String(a['Aktiv'] || a['aktiv']).toUpperCase() === 'TRUE');\n}\n\n// Parse active_platforms from comma-separated string\nconst activePlatforms = (config.active_platforms || '')\n  .split(',')\n  .map(p => p.trim().toLowerCase())\n  .filter(p => p.length > 0);\n\n// Calculate calendar week\nconst now = new Date();\nconst startOfYear = new Date(now.getFullYear(), 0, 1);\nconst days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));\nconst calendarWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);\n\nreturn [{\n  json: {\n    config,\n    accounts,\n    activePlatforms,\n    calendarWeek,\n    year: now.getFullYear(),\n    projectName: config.project_name || 'unknown',\n    timestamp: now.toISOString()\n  }\n}];"
}
```

**Notes:**
- This node has TWO possible input paths (from TRUE and FALSE branches of the IF node). In n8n, when two paths connect to the same node, the node executes once when the first active path delivers data.
- The Code node uses `$('NodeName').all()` to access data from specific upstream nodes regardless of which branch was taken.

---

#### Node 6: Plattform Dispatcher (Code)

| Property | Value |
|---|---|
| **ID** | `platform-dispatcher` |
| **Name** | `Plattform Dispatcher` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1040, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Creates 1 item per active platform for SplitInBatches processing\nconst input = $input.first().json;\nconst { config, accounts, activePlatforms, calendarWeek, year, projectName, timestamp } = input;\n\n// Initialize global static data for result collection\nconst staticData = $getWorkflowStaticData('global');\nstaticData.results = [];\nstaticData.errors = [];\nstaticData.startedAt = new Date().toISOString();\n\nconst platformItems = [];\n\nfor (const platform of activePlatforms) {\n  // Find matching account\n  const account = accounts.find(a => \n    (a['Plattform'] || a['plattform'] || '').toLowerCase() === platform\n  );\n  \n  if (!account) {\n    staticData.errors.push({\n      platform,\n      error: 'Kein Account in Plattform-Accounts Tab gefunden',\n      timestamp: new Date().toISOString()\n    });\n    continue;\n  }\n  \n  platformItems.push({\n    json: {\n      platform,\n      accountName: account['Account-Name'] || account['account_name'] || '',\n      accountId: account['Account-ID'] || account['account_id'] || '',\n      accountUrl: account['Account-URL'] || account['account_url'] || '',\n      apifyActorId: account['Apify Actor ID'] || account['apify_actor_id'] || '',\n      calendarWeek,\n      year,\n      projectName,\n      config,\n      timestamp\n    }\n  });\n}\n\nif (platformItems.length === 0) {\n  return [{ json: { _empty: true, message: 'Keine aktiven Plattformen gefunden' } }];\n}\n\nreturn platformItems;"
}
```

---

#### Node 7: SplitInBatches

| Property | Value |
|---|---|
| **ID** | `split-platforms` |
| **Name** | `Plattform-Batches` |
| **Type** | `n8n-nodes-base.splitInBatches` |
| **typeVersion** | `3` |
| **Position** | `[1300, 460]` |

**Parameters:**
```json
{
  "batchSize": 1,
  "options": {}
}
```

**Notes:**
- Output 0 = "done" (all batches processed) -- connects to normalization.
- Output 1 = "loop" (current batch item) -- connects to Platform Collector.
- Batch size 1 ensures one platform at a time (Apify rate limiting).

---

#### Node 8: Plattform Daten sammeln (Code) -- THE CORE COLLECTOR

| Property | Value |
|---|---|
| **ID** | `platform-collector` |
| **Name** | `Plattform Daten sammeln` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1560, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Main platform collector with try/catch per platform.\n// Uses $helpers.httpRequest for Apify API calls.\n// Stores results in workflow static data for later aggregation.\n\nconst item = $input.first().json;\nconst { platform, accountId, accountUrl, accountName, apifyActorId, calendarWeek, year, projectName, config } = item;\nconst staticData = $getWorkflowStaticData('global');\nconst rateLimitMs = parseInt(config.apify_rate_limit_ms || '5000');\n\ntry {\n  let rawData = {};\n  \n  switch (platform) {\n    case 'instagram': {\n      // Apify: apify/instagram-profile-scraper\n      const actorId = apifyActorId || 'apify~instagram-profile-scraper';\n      rawData = await collectViaApify(actorId, {\n        usernames: [accountName],\n        resultsLimit: 20\n      });\n      break;\n    }\n    \n    case 'facebook': {\n      // Will be handled by native Facebook Graph API node in separate branch\n      // For now, use Apify fallback or mark as needs-native-node\n      rawData = { _useNativeNode: true, platform: 'facebook', accountId };\n      break;\n    }\n    \n    case 'tiktok': {\n      const actorId = apifyActorId || 'clockworks~tiktok-profile-scraper';\n      rawData = await collectViaApify(actorId, {\n        profiles: [accountUrl],\n        resultsPerPage: 20\n      });\n      break;\n    }\n    \n    case 'linkedin': {\n      const actorId = apifyActorId || 'anchor~linkedin-company-scraper';\n      rawData = await collectViaApify(actorId, {\n        urls: [accountUrl]\n      });\n      break;\n    }\n    \n    case 'youtube': {\n      // Will be handled by native YouTube node in separate branch\n      rawData = { _useNativeNode: true, platform: 'youtube', accountId };\n      break;\n    }\n    \n    case 'x_twitter': {\n      const actorId = apifyActorId || 'apidojo~twitter-scraper';\n      rawData = await collectViaApify(actorId, {\n        handles: [accountName],\n        tweetsDesired: 20\n      });\n      break;\n    }\n    \n    default:\n      throw new Error(`Unbekannte Plattform: ${platform}`);\n  }\n  \n  staticData.results.push({\n    platform,\n    accountName,\n    accountId,\n    calendarWeek,\n    year,\n    projectName,\n    rawData,\n    status: 'ok'\n  });\n  \n} catch (error) {\n  staticData.errors.push({\n    platform,\n    accountName,\n    error: error.message || String(error),\n    timestamp: new Date().toISOString()\n  });\n  staticData.results.push({\n    platform,\n    accountName,\n    calendarWeek,\n    year,\n    projectName,\n    rawData: null,\n    status: 'error',\n    errorMessage: error.message\n  });\n}\n\n// Rate limit pause between Apify calls\nawait new Promise(resolve => setTimeout(resolve, rateLimitMs));\n\n// Helper: Run Apify Actor and wait for dataset\nasync function collectViaApify(actorId, input) {\n  const apifyToken = '{{ $credentials.apifyApi.token }}';\n  // Note: In actual implementation, the Apify node will be used.\n  // This Code node serves as the routing dispatcher.\n  // For Apify calls, we use $helpers.httpRequest with the Apify API.\n  \n  // Start actor run\n  const runResponse = await $helpers.httpRequest({\n    method: 'POST',\n    url: `https://api.apify.com/v2/acts/${actorId}/runs`,\n    headers: { 'Authorization': `Bearer ${apifyToken}` },\n    body: {\n      ...input,\n      maxItems: 30\n    },\n    json: true,\n    returnFullResponse: false\n  });\n  \n  const runId = runResponse.data?.id;\n  if (!runId) throw new Error(`Apify Actor ${actorId} konnte nicht gestartet werden`);\n  \n  // Poll for completion (max 120s)\n  let status = 'RUNNING';\n  let attempts = 0;\n  while (status === 'RUNNING' && attempts < 24) {\n    await new Promise(r => setTimeout(r, 5000));\n    const statusResp = await $helpers.httpRequest({\n      method: 'GET',\n      url: `https://api.apify.com/v2/actor-runs/${runId}`,\n      headers: { 'Authorization': `Bearer ${apifyToken}` },\n      json: true\n    });\n    status = statusResp.data?.status;\n    attempts++;\n  }\n  \n  if (status !== 'SUCCEEDED') {\n    throw new Error(`Apify Actor ${actorId} fehlgeschlagen: Status=${status}`);\n  }\n  \n  // Get dataset items\n  const datasetId = runResponse.data?.defaultDatasetId;\n  const dataResp = await $helpers.httpRequest({\n    method: 'GET',\n    url: `https://api.apify.com/v2/datasets/${datasetId}/items`,\n    headers: { 'Authorization': `Bearer ${apifyToken}` },\n    json: true\n  });\n  \n  return dataResp;\n}\n\nreturn [{ json: { platform, status: 'processed' } }];"
}
```

**IMPORTANT IMPLEMENTATION NOTE:**

The above Code node is a **simplified dispatcher**. In the actual implementation, this approach will be refined: rather than calling the Apify REST API directly via `$helpers.httpRequest`, the workflow will use:

- **Apify Community Node** (`@apify/n8n-nodes-apify.apify`) with operation "Run actor and get dataset" for Instagram, TikTok, LinkedIn, X/Twitter.
- **Facebook Graph API Node** (`n8n-nodes-base.facebookGraphApi`) for Facebook.
- **YouTube Node** (`n8n-nodes-base.youTube`) for YouTube.

The SplitInBatches approach handles this by routing to different sub-flows. However, since each SplitInBatches iteration produces 1 item with a `platform` field, we can use **Switch + dedicated branch per platform type** after the SplitInBatches loop output.

**REVISED ARCHITECTURE (more n8n-native):**

Given the complexity of mixing Code-based API calls with native nodes, the recommended architecture uses a **Switch node after SplitInBatches** to route each platform to its dedicated collector node/branch:

```
SplitInBatches (Output 1 = loop)
  |
  v
Switch (on $json.platform)
  |
  +-- "instagram"  --> Apify Node (Instagram) --> Code: Parse Instagram
  +-- "facebook"   --> Facebook Graph API Node --> Code: Parse Facebook
  +-- "tiktok"     --> Apify Node (TikTok) --> Code: Parse TikTok
  +-- "linkedin"   --> Apify Node (LinkedIn) --> Code: Parse LinkedIn
  +-- "youtube"    --> YouTube Node --> Code: Parse YouTube
  +-- "x_twitter"  --> Apify Node (X/Twitter) --> Code: Parse X
  |
  All branches --> Code: Ergebnis sammeln --> Loop zurueck zu SplitInBatches
```

Let me now specify all nodes for this revised architecture:

---

#### Node 8 (REVISED): Plattform Switch

| Property | Value |
|---|---|
| **ID** | `platform-switch` |
| **Name** | `Plattform Switch` |
| **Type** | `n8n-nodes-base.switch` |
| **typeVersion** | `3.2` |
| **Position** | `[1560, 460]` |

**Parameters:**
```json
{
  "mode": "rules",
  "rules": {
    "rules": [
      {
        "outputKey": "instagram",
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.platform }}",
              "rightValue": "instagram",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true
      },
      {
        "outputKey": "facebook",
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.platform }}",
              "rightValue": "facebook",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true
      },
      {
        "outputKey": "tiktok",
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.platform }}",
              "rightValue": "tiktok",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true
      },
      {
        "outputKey": "linkedin",
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.platform }}",
              "rightValue": "linkedin",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true
      },
      {
        "outputKey": "youtube",
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.platform }}",
              "rightValue": "youtube",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true
      },
      {
        "outputKey": "x_twitter",
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.platform }}",
              "rightValue": "x_twitter",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true
      }
    ]
  },
  "options": {
    "fallbackOutput": "extra"
  }
}
```

---

#### Node 9a: Apify Instagram

| Property | Value |
|---|---|
| **ID** | `apify-instagram` |
| **Name** | `Apify Instagram` |
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **typeVersion** | `1` |
| **Position** | `[1820, 140]` |
| **Credentials** | Apify API |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "operation": "Run actor and get dataset",
  "actorId": {
    "mode": "id",
    "value": "apify/instagram-profile-scraper"
  },
  "body": "={{ JSON.stringify({ usernames: [$json.accountName], resultsLimit: 20 }) }}"
}
```

---

#### Node 9b: Facebook Graph API

| Property | Value |
|---|---|
| **ID** | `fb-graph-api` |
| **Name** | `Facebook Page Metriken` |
| **Type** | `n8n-nodes-base.facebookGraphApi` |
| **typeVersion** | `1` |
| **Position** | `[1820, 300]` |
| **Credentials** | Facebook Graph API (OAuth2) |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `5000` |

**Parameters:**
```json
{
  "httpRequestMethod": "GET",
  "graphApiVersion": "v23.0",
  "node": "={{ $json.accountId }}",
  "options": {
    "fields": "fan_count,followers_count,name,engagement,talking_about_count"
  }
}
```

**Notes:**
- `accountId` is the Facebook Page ID (e.g., "123456789" or "me" for the authenticated page).
- `fields` parameter requests specific metrics. Additional calls needed for post-level insights (handled in a follow-up Code node).
- A second Facebook Graph API call may be needed for `/{page-id}/posts?fields=message,created_time,likes.summary(true),comments.summary(true),shares` -- this will be handled in the Parse Facebook Code node via `$helpers.httpRequest`.

---

#### Node 9c: Apify TikTok

| Property | Value |
|---|---|
| **ID** | `apify-tiktok` |
| **Name** | `Apify TikTok` |
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **typeVersion** | `1` |
| **Position** | `[1820, 460]` |
| **Credentials** | Apify API |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "operation": "Run actor and get dataset",
  "actorId": {
    "mode": "id",
    "value": "clockworks/tiktok-profile-scraper"
  },
  "body": "={{ JSON.stringify({ profiles: [$json.accountUrl], resultsPerPage: 20 }) }}"
}
```

---

#### Node 9d: Apify LinkedIn

| Property | Value |
|---|---|
| **ID** | `apify-linkedin` |
| **Name** | `Apify LinkedIn` |
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **typeVersion** | `1` |
| **Position** | `[1820, 620]` |
| **Credentials** | Apify API |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "operation": "Run actor and get dataset",
  "actorId": {
    "mode": "id",
    "value": "anchor/linkedin-company-scraper"
  },
  "body": "={{ JSON.stringify({ urls: [$json.accountUrl] }) }}"
}
```

---

#### Node 9e: YouTube Channel Statistiken

| Property | Value |
|---|---|
| **ID** | `youtube-channel` |
| **Name** | `YouTube Channel Statistiken` |
| **Type** | `n8n-nodes-base.youTube` |
| **typeVersion** | `1` |
| **Position** | `[1820, 780]` |
| **Credentials** | YouTube OAuth2 |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `5000` |

**Parameters:**
```json
{
  "resource": "channel",
  "operation": "get",
  "channelId": "={{ $json.accountId }}",
  "part": ["snippet", "statistics", "contentDetails"]
}
```

**Notes:**
- Returns: subscriberCount, viewCount, videoCount, etc.
- For recent video performance, a follow-up search for recent videos + their statistics is needed (handled in Parse YouTube Code node).

---

#### Node 9f: Apify X/Twitter

| Property | Value |
|---|---|
| **ID** | `apify-x-twitter` |
| **Name** | `Apify X/Twitter` |
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **typeVersion** | `1` |
| **Position** | `[1820, 940]` |
| **Credentials** | Apify API |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "operation": "Run actor and get dataset",
  "actorId": {
    "mode": "id",
    "value": "apidojo/twitter-scraper"
  },
  "body": "={{ JSON.stringify({ handles: [$json.accountName], tweetsDesired: 20 }) }}"
}
```

---

#### Nodes 10a-10f: Parse-Nodes (Code) -- per Platform

Each platform has a dedicated Code node that:
1. Receives the raw API/Apify response.
2. Extracts and normalizes metrics into the unified schema.
3. Stores the result in `$getWorkflowStaticData('global').results`.
4. Handles errors gracefully (if the API call returned an error, logs it).

I will show the pattern for Instagram; the others follow the same structure with platform-specific field mappings.

#### Node 10a: Parse Instagram

| Property | Value |
|---|---|
| **ID** | `parse-instagram` |
| **Name** | `Parse Instagram` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 140]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst platformInfo = $('Plattform Switch').first().json;\n\ntry {\n  const items = $input.all();\n  \n  // Check if Apify returned error (continueRegularOutput)\n  if (!items || items.length === 0 || items[0].json?.error) {\n    throw new Error(items[0]?.json?.error || 'Keine Daten von Apify erhalten');\n  }\n  \n  // Instagram profile scraper returns profile + posts\n  const profile = items.find(i => i.json.followersCount !== undefined)?.json || items[0].json;\n  const posts = items.filter(i => i.json.likesCount !== undefined).map(i => i.json);\n  \n  // Sort posts by engagement\n  const sortedPosts = [...posts].sort((a, b) => \n    ((b.likesCount || 0) + (b.commentsCount || 0)) - \n    ((a.likesCount || 0) + (a.commentsCount || 0))\n  );\n  \n  const topPost = sortedPosts[0];\n  const worstPost = sortedPosts[sortedPosts.length - 1];\n  \n  const totalLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);\n  const totalComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);\n  const totalShares = posts.reduce((s, p) => s + (p.sharesCount || 0), 0);\n  const totalViews = posts.reduce((s, p) => s + (p.videoViewCount || p.viewCount || 0), 0);\n  const followers = profile.followersCount || 0;\n  const engagementRate = followers > 0 \n    ? ((totalLikes + totalComments) / (posts.length * followers) * 100) \n    : 0;\n  \n  const result = {\n    platform: 'instagram',\n    calendarWeek: platformInfo.calendarWeek,\n    year: platformInfo.year,\n    projectName: platformInfo.projectName,\n    followers,\n    followerGrowth: 0, // Requires previous week data for delta\n    postsPublished: posts.length,\n    impressions: 0, // Not available via scraper\n    reach: 0, // Not available via scraper\n    likes: totalLikes,\n    comments: totalComments,\n    shares: totalShares,\n    engagementRate: Math.round(engagementRate * 10000) / 10000,\n    topPostUrl: topPost?.url || '',\n    topPostEngagement: topPost ? (topPost.likesCount || 0) + (topPost.commentsCount || 0) : 0,\n    worstPostUrl: worstPost?.url || '',\n    worstPostEngagement: worstPost ? (worstPost.likesCount || 0) + (worstPost.commentsCount || 0) : 0,\n    videoViews: totalViews,\n    storyViews: null,\n    linkClicks: null,\n    status: 'ok'\n  };\n  \n  staticData.results.push(result);\n  return [{ json: { ...result, _parsed: true } }];\n  \n} catch (error) {\n  const errEntry = {\n    platform: 'instagram',\n    calendarWeek: platformInfo.calendarWeek,\n    year: platformInfo.year,\n    projectName: platformInfo.projectName,\n    error: error.message,\n    status: 'error'\n  };\n  staticData.errors.push(errEntry);\n  return [{ json: errEntry }];\n}"
}
```

#### Node 10b: Parse Facebook

| Property | Value |
|---|---|
| **ID** | `parse-facebook` |
| **Name** | `Parse Facebook` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 300]` |

**Parameters:** Same pattern as Parse Instagram, but maps Facebook Graph API fields:
- `fan_count` / `followers_count` --> followers
- Post insights via additional Graph API call for `/{page-id}/posts`
- `engagement.count` --> total engagement
- Video views from post-level `video_views` metric

*(Full jsCode follows same pattern -- omitted for brevity, identical structure with FB field mappings)*

#### Node 10c: Parse TikTok

| Property | Value |
|---|---|
| **ID** | `parse-tiktok` |
| **Name** | `Parse TikTok` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 460]` |

**Key Field Mappings:**
- `stats.followerCount` --> followers
- `stats.heartCount` --> likes
- `stats.videoCount` --> postsPublished
- Video items: `playCount`, `commentCount`, `shareCount`, `diggCount`

#### Node 10d: Parse LinkedIn

| Property | Value |
|---|---|
| **ID** | `parse-linkedin` |
| **Name** | `Parse LinkedIn` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 620]` |

**Key Field Mappings:**
- `followerCount` --> followers
- Post-level data from scraper: impressions, likes, comments, shares

#### Node 10e: Parse YouTube

| Property | Value |
|---|---|
| **ID** | `parse-youtube` |
| **Name** | `Parse YouTube` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 780]` |

**Key Field Mappings:**
- `statistics.subscriberCount` --> followers
- `statistics.viewCount` --> videoViews (total channel views)
- `statistics.videoCount` --> postsPublished (total videos)
- For recent video stats, a follow-up API call may be needed

#### Node 10f: Parse X/Twitter

| Property | Value |
|---|---|
| **ID** | `parse-x-twitter` |
| **Name** | `Parse X/Twitter` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 940]` |

**Key Field Mappings:**
- `user.followersCount` --> followers
- Tweet items: `likeCount`, `retweetCount`, `replyCount`, `impressionCount`

---

#### Node 11: Ergebnis sammeln (Code)

All 6 Parse nodes connect to this single aggregation node.

| Property | Value |
|---|---|
| **ID** | `collect-result` |
| **Name** | `Ergebnis sammeln` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2340, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Simply pass through -- the parsed result has already been stored\n// in staticData by the Parse nodes. This node serves as a\n// convergence point before looping back to SplitInBatches.\nconst item = $input.first().json;\nreturn [{ json: item }];"
}
```

**Connection:** Output connects back to `Plattform-Batches` (SplitInBatches) input.

---

#### Node 12: Ergebnisse normalisieren (Code)

Connected to SplitInBatches **Output 0** (done).

| Property | Value |
|---|---|
| **ID** | `normalize-results` |
| **Name** | `Ergebnisse normalisieren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1560, 260]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Retrieve all collected results from static data\nconst staticData = $getWorkflowStaticData('global');\nconst results = staticData.results || [];\nconst errors = staticData.errors || [];\n\n// Build normalized items for Supabase + Sheets\nconst normalizedItems = results\n  .filter(r => r.status === 'ok')\n  .map(r => ({\n    json: {\n      project_name: r.projectName,\n      platform: r.platform,\n      calendar_week: r.calendarWeek,\n      year: r.year,\n      followers: r.followers || 0,\n      follower_growth: r.followerGrowth || 0,\n      posts_published: r.postsPublished || 0,\n      impressions: r.impressions || 0,\n      reach: r.reach || 0,\n      likes: r.likes || 0,\n      comments: r.comments || 0,\n      shares: r.shares || 0,\n      engagement_rate: r.engagementRate || 0,\n      top_post_url: r.topPostUrl || '',\n      top_post_engagement: r.topPostEngagement || 0,\n      worst_post_url: r.worstPostUrl || '',\n      worst_post_engagement: r.worstPostEngagement || 0,\n      video_views: r.videoViews || null,\n      story_views: r.storyViews || null,\n      link_clicks: r.linkClicks || null,\n      collected_at: new Date().toISOString(),\n      data_source: 'wf1_performance_collector'\n    }\n  }));\n\n// Store summary for response and run log\nstaticData.normalizedCount = normalizedItems.length;\nstaticData.finishedAt = new Date().toISOString();\n\nif (normalizedItems.length === 0) {\n  return [{ json: { _empty: true, message: 'Keine Daten zum Schreiben', errors } }];\n}\n\nreturn normalizedItems;"
}
```

---

#### Node 13: Supabase UPSERT

| Property | Value |
|---|---|
| **ID** | `supabase-upsert` |
| **Name** | `Supabase Performance Speichern` |
| **Type** | `n8n-nodes-base.supabase` |
| **typeVersion** | `1` |
| **Position** | `[1820, 160]` |
| **Credentials** | Supabase API |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "operation": "create",
  "tableId": "performance_weekly",
  "dataToSend": "autoMapInputData",
  "options": {}
}
```

**Notes:**
- Supabase native node does NOT have a direct "upsert" operation. The `create` operation with the table's UNIQUE constraint (`uq_performance_weekly`) will cause a conflict on duplicate keys.
- **Solution**: Use an HTTP Request node with Supabase REST API's `upsert=true` header, OR handle deduplication in a pre-processing Code node (check if record exists, then create or update).
- **Recommended approach**: Use HTTP Request node with Supabase's PostgREST API and the `Prefer: resolution=merge-duplicates` header. This is one of the rare cases where HTTP Request is justified because the native Supabase node lacks upsert support.

#### Node 13 (REVISED): Supabase UPSERT via HTTP

| Property | Value |
|---|---|
| **ID** | `supabase-upsert` |
| **Name** | `Supabase Performance UPSERT` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1820, 160]` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/performance_weekly' }}",
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
        "name": "Prefer",
        "value": "resolution=merge-duplicates"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify($json) }}",
  "options": {}
}
```

**Why HTTP Request instead of native Supabase node:**
The native `nodes-base.supabase` node only supports `create`, `get`, `getAll`, `update`, `delete`. It has no UPSERT operation. Supabase's PostgREST API supports UPSERT via the `Prefer: resolution=merge-duplicates` header on POST, which is the correct approach for our use case (UPSERT on `project_name + platform + calendar_week + year`).

---

#### Node 14: Google Sheets Performance schreiben

| Property | Value |
|---|---|
| **ID** | `sheets-write-performance` |
| **Name** | `Performance in Sheet schreiben` |
| **Type** | `n8n-nodes-base.googleSheets` |
| **typeVersion** | `4.7` |
| **Position** | `[1820, 320]` |
| **Credentials** | Google Sheets OAuth2 |
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
    "value": "Performance Aktuell"
  },
  "columns": {
    "mappingMode": "autoMapInputData",
    "value": null,
    "matchingColumns": [],
    "schema": [
      { "id": "platform", "displayName": "Plattform", "type": "string" },
      { "id": "calendar_week", "displayName": "KW", "type": "number" },
      { "id": "year", "displayName": "Jahr", "type": "number" },
      { "id": "followers", "displayName": "Followers", "type": "number" },
      { "id": "follower_growth", "displayName": "Follower-Wachstum", "type": "number" },
      { "id": "posts_published", "displayName": "Posts", "type": "number" },
      { "id": "impressions", "displayName": "Impressions", "type": "number" },
      { "id": "reach", "displayName": "Reach", "type": "number" },
      { "id": "likes", "displayName": "Likes", "type": "number" },
      { "id": "comments", "displayName": "Kommentare", "type": "number" },
      { "id": "shares", "displayName": "Shares", "type": "number" },
      { "id": "engagement_rate", "displayName": "Engagement-Rate", "type": "number" },
      { "id": "top_post_url", "displayName": "Top-Post URL", "type": "string" },
      { "id": "top_post_engagement", "displayName": "Top-Post Engagement", "type": "number" },
      { "id": "worst_post_url", "displayName": "Worst-Post URL", "type": "string" },
      { "id": "worst_post_engagement", "displayName": "Worst-Post Engagement", "type": "number" },
      { "id": "video_views", "displayName": "Video Views", "type": "number" },
      { "id": "story_views", "displayName": "Story Views", "type": "number" },
      { "id": "link_clicks", "displayName": "Link Clicks", "type": "number" },
      { "id": "collected_at", "displayName": "Erfasst am", "type": "string" }
    ]
  },
  "options": {}
}
```

---

#### Node 15: Run-Log vorbereiten (Code)

| Property | Value |
|---|---|
| **ID** | `prepare-runlog` |
| **Name** | `Run-Log vorbereiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 240]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst results = staticData.results || [];\nconst errors = staticData.errors || [];\n\nconst platformsOk = results.filter(r => r.status === 'ok').map(r => r.platform);\nconst platformsError = errors.map(e => e.platform);\n\nconst startedAt = staticData.startedAt || new Date().toISOString();\nconst finishedAt = new Date().toISOString();\nconst startMs = new Date(startedAt).getTime();\nconst endMs = new Date(finishedAt).getTime();\nconst durationSeconds = Math.round((endMs - startMs) / 1000 * 100) / 100;\n\nconst status = errors.length === 0 \n  ? 'success' \n  : platformsOk.length > 0 \n    ? 'partial_success' \n    : 'error';\n\nreturn [{\n  json: {\n    workflow_name: 'WF1 Performance Collector',\n    workflow_id: $workflow.id || '',\n    execution_id: $execution.id || '',\n    project_name: results[0]?.projectName || 'unknown',\n    started_at: startedAt,\n    finished_at: finishedAt,\n    duration_seconds: durationSeconds,\n    status,\n    platforms_ok: platformsOk,\n    platforms_error: platformsError,\n    error_details: errors.length > 0 ? JSON.stringify(errors) : null,\n    items_processed: staticData.normalizedCount || 0\n  }\n}];"
}
```

---

#### Node 16: Supabase Run-Log schreiben

| Property | Value |
|---|---|
| **ID** | `supabase-runlog` |
| **Name** | `Supabase Run-Log` |
| **Type** | `n8n-nodes-base.supabase` |
| **typeVersion** | `1` |
| **Position** | `[2340, 240]` |
| **Credentials** | Supabase API |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "operation": "create",
  "tableId": "workflow_runs",
  "dataToSend": "autoMapInputData"
}
```

---

#### Node 17: Response zusammenbauen (Code)

| Property | Value |
|---|---|
| **ID** | `build-response` |
| **Name** | `Response zusammenbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2600, 240]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst results = staticData.results || [];\nconst errors = staticData.errors || [];\n\nconst platformsOk = results.filter(r => r.status === 'ok').map(r => r.platform);\nconst platformsError = errors.map(e => e.platform);\n\n// Clean up static data\ndelete staticData.results;\ndelete staticData.errors;\ndelete staticData.startedAt;\ndelete staticData.finishedAt;\ndelete staticData.normalizedCount;\n\nreturn [{\n  json: {\n    success: errors.length === 0,\n    workflow: 'WF1 Performance Collector',\n    data: {\n      platformsCollected: platformsOk,\n      platformsFailed: platformsError,\n      totalPlatforms: platformsOk.length + platformsError.length,\n      successCount: platformsOk.length,\n      errorCount: platformsError.length\n    },\n    errors: errors.length > 0 ? errors : null,\n    timestamp: new Date().toISOString()\n  }\n}];"
}
```

---

#### Node 18: Respond to Webhook

| Property | Value |
|---|---|
| **ID** | `respond-webhook` |
| **Name** | `Webhook Antwort` |
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **typeVersion** | `1.1` |
| **Position** | `[2860, 240]` |

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

---

#### Node 19: Wait (Apify Rate Limit)

| Property | Value |
|---|---|
| **ID** | `wait-rate-limit` |
| **Name** | `Apify Pause` |
| **Type** | `n8n-nodes-base.wait` |
| **typeVersion** | `1.1` |
| **Position** | `[2340, 620]` |

**Parameters:**
```json
{
  "amount": 5,
  "unit": "seconds"
}
```

**Notes:** Inserted between the "Ergebnis sammeln" node and the loop-back to SplitInBatches to enforce the 5s pause between Apify calls. However, this node is only needed if using the Apify community node directly. If the Code node already includes an `await` delay, this is redundant. Decision: **Include the Wait node** for explicit visibility in the workflow canvas, and remove the `setTimeout` from Code nodes.

---

### Connections

```
Webhook Trigger --> Dual-Trigger Pruefung

Dual-Trigger Pruefung [TRUE]  --> Konfig zusammenfuehren
Dual-Trigger Pruefung [FALSE] --> Konfig aus Sheet lesen

Konfig aus Sheet lesen --> Accounts aus Sheet lesen
Accounts aus Sheet lesen --> Konfig zusammenfuehren

Konfig zusammenfuehren --> Plattform Dispatcher
Plattform Dispatcher --> Plattform-Batches (SplitInBatches)

Plattform-Batches [Output 1 = loop] --> Plattform Switch

Plattform Switch [Output 0: instagram]  --> Apify Instagram
Plattform Switch [Output 1: facebook]   --> Facebook Page Metriken
Plattform Switch [Output 2: tiktok]     --> Apify TikTok
Plattform Switch [Output 3: linkedin]   --> Apify LinkedIn
Plattform Switch [Output 4: youtube]    --> YouTube Channel Statistiken
Plattform Switch [Output 5: x_twitter]  --> Apify X/Twitter

Apify Instagram              --> Parse Instagram
Facebook Page Metriken        --> Parse Facebook
Apify TikTok                  --> Parse TikTok
Apify LinkedIn                --> Parse LinkedIn
YouTube Channel Statistiken   --> Parse YouTube
Apify X/Twitter               --> Parse X/Twitter

Parse Instagram   --> Ergebnis sammeln
Parse Facebook    --> Ergebnis sammeln
Parse TikTok      --> Ergebnis sammeln
Parse LinkedIn    --> Ergebnis sammeln
Parse YouTube     --> Ergebnis sammeln
Parse X/Twitter   --> Ergebnis sammeln

Ergebnis sammeln --> Apify Pause (Wait)
Apify Pause --> Plattform-Batches (loop back)

Plattform-Batches [Output 0 = done] --> Ergebnisse normalisieren

Ergebnisse normalisieren --> Supabase Performance UPSERT
Ergebnisse normalisieren --> Performance in Sheet schreiben
Ergebnisse normalisieren --> Run-Log vorbereiten

Run-Log vorbereiten --> Supabase Run-Log

Supabase Performance UPSERT  --> Response zusammenbauen
Performance in Sheet schreiben --> Response zusammenbauen
Supabase Run-Log              --> Response zusammenbauen

Response zusammenbauen --> Webhook Antwort
```

**Connection JSON format (n8n):**
```json
{
  "Webhook Trigger": {
    "main": [[{ "node": "Dual-Trigger Pruefung", "type": "main", "index": 0 }]]
  },
  "Dual-Trigger Pruefung": {
    "main": [
      [{ "node": "Konfig zusammenfuehren", "type": "main", "index": 0 }],
      [{ "node": "Konfig aus Sheet lesen", "type": "main", "index": 0 }]
    ]
  },
  "Konfig aus Sheet lesen": {
    "main": [[{ "node": "Accounts aus Sheet lesen", "type": "main", "index": 0 }]]
  },
  "Accounts aus Sheet lesen": {
    "main": [[{ "node": "Konfig zusammenfuehren", "type": "main", "index": 0 }]]
  },
  "Konfig zusammenfuehren": {
    "main": [[{ "node": "Plattform Dispatcher", "type": "main", "index": 0 }]]
  },
  "Plattform Dispatcher": {
    "main": [[{ "node": "Plattform-Batches", "type": "main", "index": 0 }]]
  },
  "Plattform-Batches": {
    "main": [
      [{ "node": "Ergebnisse normalisieren", "type": "main", "index": 0 }],
      [{ "node": "Plattform Switch", "type": "main", "index": 0 }]
    ]
  },
  "Plattform Switch": {
    "main": [
      [{ "node": "Apify Instagram", "type": "main", "index": 0 }],
      [{ "node": "Facebook Page Metriken", "type": "main", "index": 0 }],
      [{ "node": "Apify TikTok", "type": "main", "index": 0 }],
      [{ "node": "Apify LinkedIn", "type": "main", "index": 0 }],
      [{ "node": "YouTube Channel Statistiken", "type": "main", "index": 0 }],
      [{ "node": "Apify X/Twitter", "type": "main", "index": 0 }]
    ]
  },
  "Apify Instagram": {
    "main": [[{ "node": "Parse Instagram", "type": "main", "index": 0 }]]
  },
  "Facebook Page Metriken": {
    "main": [[{ "node": "Parse Facebook", "type": "main", "index": 0 }]]
  },
  "Apify TikTok": {
    "main": [[{ "node": "Parse TikTok", "type": "main", "index": 0 }]]
  },
  "Apify LinkedIn": {
    "main": [[{ "node": "Parse LinkedIn", "type": "main", "index": 0 }]]
  },
  "YouTube Channel Statistiken": {
    "main": [[{ "node": "Parse YouTube", "type": "main", "index": 0 }]]
  },
  "Apify X/Twitter": {
    "main": [[{ "node": "Parse X/Twitter", "type": "main", "index": 0 }]]
  },
  "Parse Instagram": {
    "main": [[{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }]]
  },
  "Parse Facebook": {
    "main": [[{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }]]
  },
  "Parse TikTok": {
    "main": [[{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }]]
  },
  "Parse LinkedIn": {
    "main": [[{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }]]
  },
  "Parse YouTube": {
    "main": [[{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }]]
  },
  "Parse X/Twitter": {
    "main": [[{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }]]
  },
  "Ergebnis sammeln": {
    "main": [[{ "node": "Apify Pause", "type": "main", "index": 0 }]]
  },
  "Apify Pause": {
    "main": [[{ "node": "Plattform-Batches", "type": "main", "index": 0 }]]
  },
  "Ergebnisse normalisieren": {
    "main": [[
      { "node": "Supabase Performance UPSERT", "type": "main", "index": 0 },
      { "node": "Performance in Sheet schreiben", "type": "main", "index": 0 },
      { "node": "Run-Log vorbereiten", "type": "main", "index": 0 }
    ]]
  },
  "Run-Log vorbereiten": {
    "main": [[{ "node": "Supabase Run-Log", "type": "main", "index": 0 }]]
  },
  "Supabase Performance UPSERT": {
    "main": [[{ "node": "Response zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Performance in Sheet schreiben": {
    "main": [[{ "node": "Response zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Supabase Run-Log": {
    "main": [[{ "node": "Response zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Response zusammenbauen": {
    "main": [[{ "node": "Webhook Antwort", "type": "main", "index": 0 }]]
  }
}
```

**IMPORTANT NOTE on parallel output connections:**
The connection from "Ergebnisse normalisieren" to three downstream nodes (Supabase UPSERT, Sheet Write, Run-Log) should be three separate entries in the same output array. In n8n, a single output can connect to multiple nodes, and they execute in parallel. The "Response zusammenbauen" node has 3 inputs and will wait for all 3 to arrive before executing (it acts as an implicit merge point).

**REVISED NOTE:** Actually, in n8n, a node with multiple inputs from different branches will execute once per arriving input, NOT wait for all. To properly wait for all 3 to finish before building the response, we need a **Merge node** (mode: "Combine", combineBy: "waitForAll") or we need to chain them sequentially.

**Recommended fix:** Chain sequentially:
```
Ergebnisse normalisieren
  --> Supabase Performance UPSERT
  --> Performance in Sheet schreiben
  --> Run-Log vorbereiten
  --> Supabase Run-Log
  --> Response zusammenbauen
  --> Webhook Antwort
```

This is simpler and avoids the Merge node complexity. The total execution time increase is minimal since each write operation is fast.

---

### Error Handling Strategy

| Component | Strategy | Implementation |
|---|---|---|
| **Platform API Nodes** (Apify, FB, YT) | `onError: continueRegularOutput` + `retryOnFail: true` | Node settings |
| **Parse Code Nodes** | try/catch within JavaScript | Errors logged to `staticData.errors` |
| **Supabase/Sheets Write** | `retryOnFail: true` (2x for DB, 3x for API) | Node settings |
| **Whole Workflow** | Structured response `{ success, data, errors }` | Response Code node |
| **Apify Rate Limiting** | Wait node (5s) between iterations + max 2 concurrent | SplitInBatches (batchSize: 1) |
| **Exponential Backoff** | 15s --> 30s --> 60s for Apify nodes | `waitBetweenTries` escalation on retry |

### Data Flow Summary

```
Step 1: Webhook receives POST request
  Input: { config?, accounts?, sheet_url? }

Step 2: Config Resolution
  IF config provided -> use directly
  ELSE -> Read Konfig tab + Accounts tab from Google Sheet
  Output: { config, accounts, activePlatforms, calendarWeek, year }

Step 3: Platform Dispatch
  Input: config + accounts
  Output: N items (1 per active platform), each with:
    { platform, accountId, accountUrl, accountName, apifyActorId, calendarWeek, year }

Step 4: Sequential Collection (SplitInBatches)
  Per platform:
    Input: { platform, accountId, ... }
    -> API call (Apify or native node)
    -> Parse response to normalized schema
    -> Store in workflow static data
  Between iterations: 5s pause

Step 5: Normalization
  Input: All collected results from static data
  Output: N items in unified schema:
    { project_name, platform, calendar_week, year, followers, ..., collected_at }

Step 6: Persistence (Sequential)
  6a: Supabase UPSERT (HTTP Request with merge-duplicates)
  6b: Google Sheets Append (Performance Aktuell tab)
  6c: Supabase INSERT (workflow_runs log)

Step 7: Response
  Output: { success, data: { platformsCollected, platformsFailed, ... }, errors }
```

### Expressions Reference

| Node | Field | Expression |
|---|---|---|
| Dual-Trigger Pruefung | leftValue | `={{ $json.body.config }}` |
| Konfig aus Sheet lesen | documentId | `={{ $json.body.sheet_url ?? 'PLACEHOLDER' }}` |
| Plattform Switch | leftValue | `={{ $json.platform }}` |
| Apify Instagram | body | `={{ JSON.stringify({ usernames: [$json.accountName] }) }}` |
| Facebook Page Metriken | node | `={{ $json.accountId }}` |
| YouTube Channel | channelId | `={{ $json.accountId }}` |
| Supabase UPSERT | jsonBody | `={{ JSON.stringify($json) }}` |
| Webhook Antwort | responseBody | `={{ $json }}` |

### Workflow Settings

```json
{
  "executionOrder": "v1",
  "saveDataErrorExecution": "all",
  "saveDataSuccessExecution": "all",
  "saveManualExecutions": true,
  "callerPolicy": "workflowsFromSameOwner"
}
```

---

## Node Summary Table

| # | ID | Name | Type | typeVersion | Position |
|---|---|---|---|---|---|
| 1 | webhook-trigger | Webhook Trigger | n8n-nodes-base.webhook | 2 | [260, 460] |
| 2 | dual-trigger-check | Dual-Trigger Pruefung | n8n-nodes-base.if | 2.2 | [520, 460] |
| 3 | read-konfig | Konfig aus Sheet lesen | n8n-nodes-base.googleSheets | 4.7 | [780, 620] |
| 4 | read-accounts | Accounts aus Sheet lesen | n8n-nodes-base.googleSheets | 4.7 | [1040, 620] |
| 5 | merge-config | Konfig zusammenfuehren | n8n-nodes-base.code | 2 | [780, 460] |
| 6 | platform-dispatcher | Plattform Dispatcher | n8n-nodes-base.code | 2 | [1040, 460] |
| 7 | split-platforms | Plattform-Batches | n8n-nodes-base.splitInBatches | 3 | [1300, 460] |
| 8 | platform-switch | Plattform Switch | n8n-nodes-base.switch | 3.2 | [1560, 460] |
| 9a | apify-instagram | Apify Instagram | @apify/n8n-nodes-apify.apify | 1 | [1820, 140] |
| 9b | fb-graph-api | Facebook Page Metriken | n8n-nodes-base.facebookGraphApi | 1 | [1820, 300] |
| 9c | apify-tiktok | Apify TikTok | @apify/n8n-nodes-apify.apify | 1 | [1820, 460] |
| 9d | apify-linkedin | Apify LinkedIn | @apify/n8n-nodes-apify.apify | 1 | [1820, 620] |
| 9e | youtube-channel | YouTube Channel Statistiken | n8n-nodes-base.youTube | 1 | [1820, 780] |
| 9f | apify-x-twitter | Apify X/Twitter | @apify/n8n-nodes-apify.apify | 1 | [1820, 940] |
| 10a | parse-instagram | Parse Instagram | n8n-nodes-base.code | 2 | [2080, 140] |
| 10b | parse-facebook | Parse Facebook | n8n-nodes-base.code | 2 | [2080, 300] |
| 10c | parse-tiktok | Parse TikTok | n8n-nodes-base.code | 2 | [2080, 460] |
| 10d | parse-linkedin | Parse LinkedIn | n8n-nodes-base.code | 2 | [2080, 620] |
| 10e | parse-youtube | Parse YouTube | n8n-nodes-base.code | 2 | [2080, 780] |
| 10f | parse-x-twitter | Parse X/Twitter | n8n-nodes-base.code | 2 | [2080, 940] |
| 11 | collect-result | Ergebnis sammeln | n8n-nodes-base.code | 2 | [2340, 460] |
| 12 | normalize-results | Ergebnisse normalisieren | n8n-nodes-base.code | 2 | [1560, 260] |
| 13 | supabase-upsert | Supabase Performance UPSERT | n8n-nodes-base.httpRequest | 4.4 | [1820, 160] |
| 14 | sheets-write-performance | Performance in Sheet schreiben | n8n-nodes-base.googleSheets | 4.7 | [2080, 160] |
| 15 | prepare-runlog | Run-Log vorbereiten | n8n-nodes-base.code | 2 | [2340, 160] |
| 16 | supabase-runlog | Supabase Run-Log | n8n-nodes-base.supabase | 1 | [2600, 160] |
| 17 | build-response | Response zusammenbauen | n8n-nodes-base.code | 2 | [2860, 160] |
| 18 | respond-webhook | Webhook Antwort | n8n-nodes-base.respondToWebhook | 1.1 | [3120, 160] |
| 19 | wait-rate-limit | Apify Pause | n8n-nodes-base.wait | 1.1 | [2600, 460] |

**Total: 25 nodes**

---

## Credentials Required

| Credential | n8n Credential Type | Used By | Status |
|---|---|---|---|
| Google Sheets OAuth2 | `googleSheetsOAuth2Api` | Konfig lesen, Accounts lesen, Performance schreiben | Vorhanden |
| Supabase API | `supabaseApi` | Supabase Run-Log | Vorhanden |
| Supabase (HTTP) | Header Auth (apikey) | Supabase Performance UPSERT (HTTP Request) | Vorhanden (Key nutzen) |
| Apify API | `apifyApi` | Apify Instagram/TikTok/LinkedIn/X nodes | Vorhanden |
| Facebook Graph API | `facebookGraphApi` | Facebook Page Metriken | Noch einrichten |
| YouTube OAuth2 | `youTubeOAuth2Api` | YouTube Channel Statistiken | Noch einrichten |

---

## Requirements Coverage

| Requirement | How Covered | Node(s) |
|---|---|---|
| TRIG-02 | Webhook trigger, standalone per WF auslösbar | webhook-trigger |
| TRIG-04 | IF-Node prüft ob config im Body vorhanden | dual-trigger-check |
| DATA-01 | Konfig-Tab wird gelesen (standalone) oder config aus Body verwendet | read-konfig, merge-config |
| DATA-02 | Plattform-Accounts-Tab wird gelesen, aktive gefiltert | read-accounts, platform-dispatcher |
| DATA-05 | Normalisierung aller 6 Plattformen in einheitliches Schema | parse-instagram bis parse-x-twitter, normalize-results |
| API-01 | Instagram via Apify Actor instagram-profile-scraper | apify-instagram, parse-instagram |
| API-02 | Facebook via nativer facebookGraphApi Node | fb-graph-api, parse-facebook |
| API-03 | TikTok via Apify Actor tiktok-profile-scraper | apify-tiktok, parse-tiktok |
| API-04 | LinkedIn via Apify Actor linkedin-company-scraper | apify-linkedin, parse-linkedin |
| API-05 | YouTube via nativer youTube Node (channel statistics) | youtube-channel, parse-youtube |
| API-06 | X/Twitter via Apify Actor twitter-scraper | apify-x-twitter, parse-x-twitter |
| OUT-01 | UPSERT in Supabase performance_weekly via PostgREST API | supabase-upsert |
| OUT-02 | Append in Google Sheet Tab "Performance Aktuell" | sheets-write-performance |
| ERR-01 | Jede Plattform in eigenem SplitInBatches-Iteration + try/catch | platform-switch, parse-* nodes, onError: continueRegularOutput |
| ERR-02 | retryOnFail mit Exponential Backoff (15s/30s/60s) auf API Nodes | Apify nodes (maxTries: 3, waitBetweenTries: 15000) |
| ERR-03 | Strukturierte Response { success, data, errors } | build-response, respond-webhook |

---

## Validation Criteria

- [ ] All 25 nodes have correct typeVersion
- [ ] All expressions use `={{ }}` syntax (not `{{ }}` or `${}`)
- [ ] No HTTP Request nodes where native nodes exist (exception: Supabase UPSERT, documented)
- [ ] Credentials specified for all nodes requiring authentication
- [ ] SplitInBatches: Output 0 = done, Output 1 = loop (correct wiring)
- [ ] Switch node has 6 outputs matching 6 platforms
- [ ] All Code nodes return `[{ json: { ... } }]` format
- [ ] Code nodes use `$input.first().json` not `$json` directly
- [ ] `onError: "continueRegularOutput"` on all external API nodes
- [ ] `retryOnFail: true` on all external API and database nodes
- [ ] Workflow settings include `executionOrder: "v1"`
- [ ] Node positions have no overlaps, follow grid layout
- [ ] Connection map is complete and correct
- [ ] `$getWorkflowStaticData('global')` cleaned up in Response node

---

## Implementation Notes for Executor

1. **Google Sheet URL**: Must be replaced with actual URL after Sheet creation (Task 2). Search for `GOOGLE_SHEET_URL_PLACEHOLDER` in the plan.

2. **Supabase URL/Key**: Must be replaced with actual values. Search for `SUPABASE_URL_PLACEHOLDER` and `SUPABASE_API_KEY_PLACEHOLDER`. Alternatively, use environment variables: `$env.SUPABASE_URL` and `$env.SUPABASE_KEY`.

3. **Apify Actor IDs**: The default Actor IDs used (`apify/instagram-profile-scraper`, `clockworks/tiktok-profile-scraper`, etc.) may need verification. The actual Actor IDs should be confirmed in the Apify Console and set in the "Plattform-Accounts" Sheet tab.

4. **Facebook + YouTube Credentials**: Must be set up in n8n before deployment. These OAuth flows require app creation on the respective developer portals.

5. **Sequential vs Parallel Output**: The persistence layer (Supabase UPSERT, Sheet Write, Run-Log) should be wired sequentially to avoid the Merge-node complexity of waiting for 3 parallel outputs.

6. **Parse Code Nodes**: Each Parse node's `jsCode` must be fully implemented with the correct field mappings for each platform's API response. The Instagram parse node is fully specified as a template; the others follow the same pattern with platform-specific field names.

7. **Webhook typeVersion**: The webhook node docs show typeVersion 1, but current n8n (v2.35.5) supports typeVersion 2 with additional features. Use typeVersion 2.

8. **Apify Node body parameter**: The `body` parameter for the Apify community node may need to be passed as a JSON object, not a string. Test during implementation whether `JSON.stringify()` is needed or if the node accepts an object directly.

---

*Plan created: 2026-03-03*
*Phase: 1 of 5*
*Workflow count: 1 (WF1 Performance Collector)*
*Estimated node count: 25*
