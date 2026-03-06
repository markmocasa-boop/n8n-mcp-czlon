---
phase: 2
plan: WF3
workflows: [WF3]
type: n8n-workflow
status: planned
created: 2026-03-03
---

# Phase 2 Plan: WF3 Competitor Monitor

## Objective

Deploy WF3 Competitor Monitor -- a workflow that reads competitor data from the Google Sheet "Wettbewerber" tab, scrapes their profiles and top posts via Apify (one actor per platform), extracts top comments, runs Claude analysis per competitor to generate content ideas, and writes results to both Supabase `competitor_weekly` and Google Sheet "Competitor Insights" tab. The workflow must respect strict Apify rate limits (max 2 concurrent, 5s pause, 30s retry on rate limit). All analysis output is in German.

The workflow follows the same architectural patterns as WF1 (dual-trigger, SplitInBatches, `$getWorkflowStaticData('global')` for result accumulation, error isolation per competitor, structured `{ success, data, errors }` response).

---

## Pre-Workflow Task: Supabase Schema Update

The `competitor_weekly` table was created as a placeholder in Phase 1. It must now be updated with the full schema.

Execute via Supabase SQL Editor:

```sql
-- =============================================================
-- Drop and recreate competitor_weekly with full schema
-- =============================================================

DROP TABLE IF EXISTS competitor_weekly;

CREATE TABLE competitor_weekly (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),

  -- Competitor identity
  competitor_name       TEXT NOT NULL,
  platform              TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x_twitter')),
  account_url           TEXT,

  -- Metrics (scraped)
  followers             INTEGER DEFAULT 0,
  posts_scraped         INTEGER DEFAULT 0,
  avg_likes             NUMERIC(12,2) DEFAULT 0,
  avg_comments          NUMERIC(12,2) DEFAULT 0,
  avg_shares            NUMERIC(12,2) DEFAULT 0,
  engagement_rate       NUMERIC(6,4) DEFAULT 0,

  -- Top posts (JSON array of top 3)
  top_posts             JSONB,

  -- Top comments (JSON array, aggregated from top 3 posts)
  top_comments          JSONB,

  -- Claude analysis (structured JSON)
  analysis              JSONB,

  -- Content ideas (JSON array of 3-5 ideas)
  content_ideas         JSONB,

  -- Metadata
  collected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf3_competitor_monitor',
  raw_data              JSONB,

  -- UPSERT constraint
  CONSTRAINT uq_competitor_weekly
    UNIQUE (project_name, competitor_name, platform, calendar_week, year)
);

CREATE INDEX IF NOT EXISTS idx_competitor_project_platform
  ON competitor_weekly (project_name, platform);
CREATE INDEX IF NOT EXISTS idx_competitor_kw_year
  ON competitor_weekly (calendar_week, year);
CREATE INDEX IF NOT EXISTS idx_competitor_name
  ON competitor_weekly (competitor_name);
```

---

## WF3: Competitor Monitor

### Overview

**Trigger**: Webhook (POST) -- accepts calls from the Master Orchestrator or standalone invocation.
**Purpose**: Scrape competitor profiles and top posts via Apify, read top comments, analyze via Claude, generate content ideas. Write to Supabase + Google Sheet.
**Error Handling**: Each competitor processes in its own SplitInBatches iteration with error isolation. A failing competitor does not block the others. Apify rate limiting is strictly enforced.

### Requirements Coverage

| Requirement | How Covered |
|---|---|
| TRIG-02 | Webhook trigger, reads own config from Google Sheet when standalone |
| TRIG-04 | Dual-trigger IF node: checks `$json.body.config` existence |
| DATA-03 | Reads "Wettbewerber" tab, filters by active platforms |
| API-08 | Apify actors scrape last 20 posts per competitor, top 3 selected by engagement |
| API-09 | Apify comment scraping: top 20 comments per top post |
| AI-03 | Claude analysis per competitor: strategy, engagement patterns, sentiment, 3-5 content ideas |
| OUT-04 | Writes to Supabase `competitor_weekly` (UPSERT) + Google Sheet "Competitor Insights" |
| ERR-02 | Retry on API errors: 15s -> 30s -> 60s, max 3 attempts (via `retryOnFail` on Apify/Claude nodes) |
| ERR-05 | Max 2 concurrent Apify runs (SplitInBatches batchSize=1, sequential), 5s Wait between calls, 30s retry on rate limit |

### High-Level Flow

```
Webhook Trigger (POST)
  |
  v
IF: Dual-Trigger Pruefung (config in body?)
  |
  +-- TRUE  --> Konfig zusammenfuehren
  +-- FALSE --> Sheets: Konfig lesen --> Sheets: Wettbewerber lesen --> Konfig zusammenfuehren
  |
  v
Code: Competitor Dispatcher
  (reads config + competitors, filters by active platforms,
   creates 1 item per competitor-platform pair)
  |
  v
SplitInBatches (batchSize=1, sequential for rate limiting)
  |
  +-- [Output 1: loop] --> Plattform Switch
  |     |
  |     +-- instagram  --> Apify IG Posts --> Code: Parse IG
  |     +-- facebook   --> Apify FB Posts --> Code: Parse FB
  |     +-- tiktok     --> Apify TT Posts --> Code: Parse TT
  |     +-- linkedin   --> Apify LI Posts --> Code: Parse LI
  |     +-- youtube    --> Apify YT Posts --> Code: Parse YT
  |     +-- x_twitter  --> Apify X Posts  --> Code: Parse X
  |     |
  |     All --> Code: Claude Analyse
  |              |
  |              v
  |           Anthropic: Wettbewerber-Analyse
  |              |
  |              v
  |           Code: Ergebnis sammeln
  |              |
  |              v
  |           Wait: Apify Pause (5s)
  |              |
  |              v
  |           Loop back to SplitInBatches
  |
  +-- [Output 0: done] --> Code: Ergebnisse aufbereiten
                              |
                              v
                           HTTP: Supabase UPSERT
                           Sheets: Competitor Insights schreiben
                              |
                              v
                           Code: Response zusammenbauen
                              |
                              v
                           Respond to Webhook
```

### Architecture Decisions

**1. SplitInBatches with batchSize=1 (same as WF1)**
- Apify rate limiting requires sequential processing
- Up to 18 competitor-platform pairs (3 competitors x 6 platforms)
- Each iteration: Apify scrape -> parse -> Claude analysis -> collect result -> 5s wait

**2. Apify "Run actor and get dataset" for all platforms**
- WF1 used native nodes for FB/YT in performance mode. For WF3, we are scraping competitor *posts* (not our own accounts), so Apify actors are required for all 6 platforms. We do not have OAuth access to competitors' accounts.
- Instagram: `apify/instagram-post-scraper` (public post scraping)
- Facebook: `apify/facebook-posts-scraper` (public page posts)
- TikTok: `clockworks/tiktok-scraper` (public profile + posts)
- LinkedIn: `anchor/linkedin-post-scraper` (public company/profile posts)
- YouTube: `bernardo/youtube-scraper` (public channel videos)
- X/Twitter: `apidojo/tweet-scraper` (public tweets)

**3. Claude via `nodes-langchain.anthropic` (native node)**
- `resource: "text"`, `operation: "message"` with Claude Sonnet 4.5
- One Claude call per competitor-platform pair (not per post)
- Prompt assembles top 3 posts + their top comments + context

**4. Result accumulation via `$getWorkflowStaticData('global')`**
- Same proven pattern as WF1
- Collects results across all SplitInBatches iterations
- Final aggregation after all batches complete

**5. Supabase UPSERT via HTTP Request**
- Same pattern as WF1: native Supabase node lacks UPSERT
- Uses `Prefer: resolution=merge-duplicates` header
- UPSERT key: `project_name + competitor_name + platform + calendar_week + year`

---

### Nodes

Total: 28 nodes

---

#### Node 1: Webhook Trigger

| Property | Value |
|---|---|
| **ID** | `wf3-webhook` |
| **Name** | `Webhook Trigger` |
| **Type** | `n8n-nodes-base.webhook` |
| **typeVersion** | `2` |
| **Position** | `[260, 460]` |

**Parameters:**
```json
{
  "path": "socialpulse-competitor",
  "httpMethod": "POST",
  "responseMode": "responseNode",
  "options": {}
}
```

---

#### Node 2: Dual-Trigger Pruefung

| Property | Value |
|---|---|
| **ID** | `wf3-dual-trigger` |
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
        "id": "has-config",
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
- **TRUE**: Master called with `{ config, competitors }` in body. Skip Sheet reads.
- **FALSE**: Standalone call. Must read Konfig + Wettbewerber tabs.

---

#### Node 3: Konfig aus Sheet lesen

| Property | Value |
|---|---|
| **ID** | `wf3-read-konfig` |
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

---

#### Node 4: Wettbewerber aus Sheet lesen

| Property | Value |
|---|---|
| **ID** | `wf3-read-competitors` |
| **Name** | `Wettbewerber aus Sheet lesen` |
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
    "value": "Wettbewerber"
  },
  "options": {
    "range": "A:E"
  }
}
```

**Data Shape (from Sheet "Wettbewerber" tab):**
```
| Plattform | Name | Account-URL | Account-ID | Aktiv |
```

---

#### Node 5: Konfig zusammenfuehren (Code)

| Property | Value |
|---|---|
| **ID** | `wf3-merge-config` |
| **Name** | `Konfig zusammenfuehren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[780, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Merge config from Master or Sheet reads (same pattern as WF1)\nconst webhookData = $('Webhook Trigger').first().json.body;\n\nlet config = {};\nlet competitors = [];\n\nif (webhookData && webhookData.config) {\n  // Master provided config + competitors\n  config = webhookData.config;\n  competitors = webhookData.competitors || [];\n} else {\n  // Standalone: build config from Sheet rows\n  const konfigRows = $('Konfig aus Sheet lesen').all();\n  for (const row of konfigRows) {\n    const key = row.json['Einstellung'] || row.json['einstellung'];\n    const val = row.json['Wert'] || row.json['wert'];\n    if (key) config[key] = val;\n  }\n\n  // Parse competitors from Sheet\n  const compRows = $('Wettbewerber aus Sheet lesen').all();\n  competitors = compRows\n    .map(r => r.json)\n    .filter(c => String(c['Aktiv'] || c['aktiv']).toUpperCase() === 'TRUE');\n}\n\n// Parse active platforms\nconst activePlatforms = (config.active_platforms || '')\n  .split(',')\n  .map(p => p.trim().toLowerCase())\n  .filter(p => p.length > 0);\n\n// Calendar week\nconst now = new Date();\nconst startOfYear = new Date(now.getFullYear(), 0, 1);\nconst days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));\nconst calendarWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);\n\nreturn [{\n  json: {\n    config,\n    competitors,\n    activePlatforms,\n    calendarWeek,\n    year: now.getFullYear(),\n    projectName: config.project_name || 'unknown',\n    brandName: config.brand_name || '',\n    brandDescription: config.brand_description || '',\n    branche: config.branche || config.brand_description || '',\n    timestamp: now.toISOString()\n  }\n}];"
}
```

**Notes:**
- Two input paths (TRUE and FALSE branches of IF) converge here.
- Uses `$('NodeName').all()` for explicit node references regardless of active branch.

---

#### Node 6: Competitor Dispatcher (Code)

| Property | Value |
|---|---|
| **ID** | `wf3-competitor-dispatcher` |
| **Name** | `Competitor Dispatcher` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1040, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Creates 1 item per competitor-platform pair, filtered by active platforms.\n// Max 3 competitors per platform x 6 platforms = 18 items.\nconst input = $input.first().json;\nconst { config, competitors, activePlatforms, calendarWeek, year, projectName, brandName, brandDescription, branche, timestamp } = input;\n\n// Initialize global static data for result accumulation\nconst staticData = $getWorkflowStaticData('global');\nstaticData.results = [];\nstaticData.errors = [];\nstaticData.analyses = [];\nstaticData.startedAt = new Date().toISOString();\n\nconst items = [];\n\nfor (const comp of competitors) {\n  const platform = (comp['Plattform'] || comp['plattform'] || '').toLowerCase();\n  const name = comp['Name'] || comp['name'] || '';\n  const url = comp['Account-URL'] || comp['account_url'] || comp['Account-Url'] || '';\n  const accountId = comp['Account-ID'] || comp['account_id'] || '';\n\n  // Skip if platform not active\n  if (!activePlatforms.includes(platform)) continue;\n\n  // Skip if missing essential data\n  if (!name || !url) {\n    staticData.errors.push({\n      competitor: name || 'unbekannt',\n      platform,\n      error: 'Name oder Account-URL fehlt im Wettbewerber-Tab',\n      timestamp: new Date().toISOString()\n    });\n    continue;\n  }\n\n  items.push({\n    json: {\n      competitorName: name,\n      platform,\n      accountUrl: url,\n      accountId,\n      calendarWeek,\n      year,\n      projectName,\n      brandName,\n      brandDescription,\n      branche,\n      config,\n      timestamp\n    }\n  });\n}\n\nif (items.length === 0) {\n  return [{ json: { _empty: true, message: 'Keine aktiven Wettbewerber gefunden' } }];\n}\n\nreturn items;"
}
```

**Data Shape (output per item):**
```json
{
  "competitorName": "KonkurrenzAG",
  "platform": "instagram",
  "accountUrl": "https://instagram.com/konkurrenzag",
  "accountId": "",
  "calendarWeek": 10,
  "year": 2026,
  "projectName": "MeinProjekt",
  "brandName": "UnsereMarke",
  "brandDescription": "Digitale Loesungen fuer den Mittelstand",
  "branche": "Software / SaaS",
  "config": { ... },
  "timestamp": "2026-03-03T09:00:00.000Z"
}
```

---

#### Node 7: Competitor-Batches (SplitInBatches)

| Property | Value |
|---|---|
| **ID** | `wf3-split-batches` |
| **Name** | `Competitor-Batches` |
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
- Output 0 = "done" (all competitors processed) --> final aggregation
- Output 1 = "loop" (current competitor) --> Platform Switch
- batchSize=1 enforces sequential processing for Apify rate limits

---

#### Node 8: Plattform Switch

| Property | Value |
|---|---|
| **ID** | `wf3-platform-switch` |
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

#### Nodes 9a-9f: Apify Scraper Nodes (one per platform)

All 6 Apify nodes follow the same pattern. They use `operation: "Run actor and get dataset"` which starts the actor, waits for completion, and returns the dataset items.

**Important difference vs WF1:** In WF1, some platforms used native nodes (Facebook Graph API, YouTube). For WF3, we are scraping *competitor* accounts (not our own), so we do NOT have OAuth access. All 6 platforms must use Apify post/content scrapers.

---

##### Node 9a: Apify Instagram Posts

| Property | Value |
|---|---|
| **ID** | `wf3-apify-ig` |
| **Name** | `Apify IG Posts` |
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
    "value": "apify/instagram-post-scraper"
  },
  "body": "={{ JSON.stringify({ directUrls: [$json.accountUrl], resultsLimit: 20, addParentData: true }) }}"
}
```

**Notes:**
- `instagram-post-scraper` returns posts with `likesCount`, `commentsCount`, `caption`, `url`, `timestamp`, `videoViewCount`
- `addParentData: true` includes profile-level metadata (followers etc.)
- `resultsLimit: 20` gets last 20 posts; we select top 3 by engagement in the parse node

---

##### Node 9b: Apify Facebook Posts

| Property | Value |
|---|---|
| **ID** | `wf3-apify-fb` |
| **Name** | `Apify FB Posts` |
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **typeVersion** | `1` |
| **Position** | `[1820, 300]` |
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
    "value": "apify/facebook-posts-scraper"
  },
  "body": "={{ JSON.stringify({ startUrls: [{ url: $json.accountUrl }], resultsLimit: 20 }) }}"
}
```

---

##### Node 9c: Apify TikTok Posts

| Property | Value |
|---|---|
| **ID** | `wf3-apify-tt` |
| **Name** | `Apify TT Posts` |
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
    "value": "clockworks/tiktok-scraper"
  },
  "body": "={{ JSON.stringify({ profiles: [$json.accountUrl], resultsPerPage: 20, shouldDownloadVideos: false }) }}"
}
```

---

##### Node 9d: Apify LinkedIn Posts

| Property | Value |
|---|---|
| **ID** | `wf3-apify-li` |
| **Name** | `Apify LI Posts` |
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
    "value": "anchor/linkedin-post-scraper"
  },
  "body": "={{ JSON.stringify({ urls: [$json.accountUrl], maxResults: 20 }) }}"
}
```

---

##### Node 9e: Apify YouTube Posts

| Property | Value |
|---|---|
| **ID** | `wf3-apify-yt` |
| **Name** | `Apify YT Posts` |
| **Type** | `@apify/n8n-nodes-apify.apify` |
| **typeVersion** | `1` |
| **Position** | `[1820, 780]` |
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
    "value": "bernardo/youtube-scraper"
  },
  "body": "={{ JSON.stringify({ startUrls: [{ url: $json.accountUrl }], maxResults: 20, extendOutputFunction: '' }) }}"
}
```

---

##### Node 9f: Apify X/Twitter Posts

| Property | Value |
|---|---|
| **ID** | `wf3-apify-x` |
| **Name** | `Apify X Posts` |
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
    "value": "apidojo/tweet-scraper"
  },
  "body": "={{ JSON.stringify({ startUrls: [{ url: $json.accountUrl }], maxTweets: 20, includeReplies: false }) }}"
}
```

---

#### Nodes 10a-10f: Parse Nodes (Code) -- per Platform

Each parse node:
1. Receives raw Apify response items
2. Sorts posts by engagement (likes + comments + shares)
3. Selects top 3 posts
4. Extracts comments from top posts (if available in scraper output)
5. Normalizes into a unified competitor data structure
6. Stores in `$getWorkflowStaticData('global')`

**Unified output shape per parse node:**
```json
{
  "competitorName": "...",
  "platform": "...",
  "accountUrl": "...",
  "followers": 12500,
  "postsScraped": 20,
  "avgLikes": 234.5,
  "avgComments": 18.2,
  "avgShares": 5.1,
  "engagementRate": 2.34,
  "topPosts": [
    {
      "url": "...",
      "text": "...",
      "likes": 890,
      "comments": 45,
      "shares": 12,
      "engagement": 947,
      "date": "2026-02-28",
      "type": "image|video|carousel|text"
    }
  ],
  "topComments": [
    { "text": "...", "likes": 5, "postUrl": "..." }
  ],
  "calendarWeek": 10,
  "year": 2026,
  "projectName": "..."
}
```

---

##### Node 10a: Parse Instagram

| Property | Value |
|---|---|
| **ID** | `wf3-parse-ig` |
| **Name** | `Parse IG` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 140]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst platformInfo = $('Plattform Switch').first().json;\nconst { competitorName, platform, accountUrl, calendarWeek, year, projectName } = platformInfo;\n\ntry {\n  const items = $input.all();\n  if (!items || items.length === 0 || items[0].json?.error) {\n    throw new Error(items[0]?.json?.error || 'Keine Daten von Apify erhalten');\n  }\n\n  const posts = items.map(i => i.json).filter(p => p.likesCount !== undefined || p.likes !== undefined);\n  if (posts.length === 0) throw new Error('Keine Posts gefunden');\n\n  // Get follower count from parent data or first item\n  const followers = posts[0]?.ownerFollowerCount || posts[0]?.followersCount || 0;\n\n  // Sort by engagement (likes + comments)\n  const sorted = [...posts].sort((a, b) => {\n    const engA = (a.likesCount || a.likes || 0) + (a.commentsCount || a.comments || 0);\n    const engB = (b.likesCount || b.likes || 0) + (b.commentsCount || b.comments || 0);\n    return engB - engA;\n  });\n\n  // Top 3 posts\n  const top3 = sorted.slice(0, 3).map(p => ({\n    url: p.url || p.shortCode ? `https://instagram.com/p/${p.shortCode}` : '',\n    text: (p.caption || '').substring(0, 500),\n    likes: p.likesCount || p.likes || 0,\n    comments: p.commentsCount || p.comments || 0,\n    shares: 0,\n    engagement: (p.likesCount || p.likes || 0) + (p.commentsCount || p.comments || 0),\n    date: p.timestamp || p.takenAtTimestamp || '',\n    type: p.videoViewCount ? 'video' : p.carouselMediaCount ? 'carousel' : 'image'\n  }));\n\n  // Extract comments from top posts (if available)\n  const topComments = [];\n  for (const p of sorted.slice(0, 3)) {\n    const comments = p.latestComments || p.comments_list || [];\n    for (const c of comments.slice(0, 7)) {\n      topComments.push({\n        text: c.text || c.comment || '',\n        likes: c.likesCount || c.likes || 0,\n        postUrl: p.url || ''\n      });\n    }\n  }\n\n  // Calculate averages\n  const totalLikes = posts.reduce((s, p) => s + (p.likesCount || p.likes || 0), 0);\n  const totalComments = posts.reduce((s, p) => s + (p.commentsCount || p.comments || 0), 0);\n  const avgLikes = posts.length > 0 ? totalLikes / posts.length : 0;\n  const avgComments = posts.length > 0 ? totalComments / posts.length : 0;\n  const engagementRate = followers > 0 ? ((avgLikes + avgComments) / followers * 100) : 0;\n\n  const result = {\n    competitorName, platform, accountUrl, followers,\n    postsScraped: posts.length,\n    avgLikes: Math.round(avgLikes * 100) / 100,\n    avgComments: Math.round(avgComments * 100) / 100,\n    avgShares: 0,\n    engagementRate: Math.round(engagementRate * 10000) / 10000,\n    topPosts: top3,\n    topComments: topComments.slice(0, 20),\n    calendarWeek, year, projectName,\n    status: 'ok'\n  };\n\n  return [{ json: result }];\n} catch (error) {\n  const errEntry = {\n    competitorName, platform, calendarWeek, year, projectName,\n    error: error.message, status: 'error'\n  };\n  staticData.errors.push(errEntry);\n  return [{ json: errEntry }];\n}"
}
```

---

##### Node 10b: Parse Facebook

| Property | Value |
|---|---|
| **ID** | `wf3-parse-fb` |
| **Name** | `Parse FB` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 300]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst platformInfo = $('Plattform Switch').first().json;\nconst { competitorName, platform, accountUrl, calendarWeek, year, projectName } = platformInfo;\n\ntry {\n  const items = $input.all();\n  if (!items || items.length === 0 || items[0].json?.error) {\n    throw new Error(items[0]?.json?.error || 'Keine Daten von Apify erhalten');\n  }\n\n  const posts = items.map(i => i.json).filter(p => p.text !== undefined || p.message !== undefined);\n  if (posts.length === 0) throw new Error('Keine Posts gefunden');\n\n  const followers = posts[0]?.pageLikes || posts[0]?.pageFollowers || 0;\n\n  const sorted = [...posts].sort((a, b) => {\n    const engA = (a.likes || 0) + (a.comments || 0) + (a.shares || 0);\n    const engB = (b.likes || 0) + (b.comments || 0) + (b.shares || 0);\n    return engB - engA;\n  });\n\n  const top3 = sorted.slice(0, 3).map(p => ({\n    url: p.url || p.postUrl || '',\n    text: (p.text || p.message || '').substring(0, 500),\n    likes: p.likes || 0,\n    comments: p.comments || 0,\n    shares: p.shares || 0,\n    engagement: (p.likes || 0) + (p.comments || 0) + (p.shares || 0),\n    date: p.time || p.date || '',\n    type: p.type || 'post'\n  }));\n\n  const topComments = [];\n  for (const p of sorted.slice(0, 3)) {\n    const comments = p.topComments || p.commentsList || [];\n    for (const c of comments.slice(0, 7)) {\n      topComments.push({\n        text: c.text || c.comment || c.message || '',\n        likes: c.likes || c.likesCount || 0,\n        postUrl: p.url || p.postUrl || ''\n      });\n    }\n  }\n\n  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);\n  const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);\n  const totalShares = posts.reduce((s, p) => s + (p.shares || 0), 0);\n  const avgLikes = posts.length > 0 ? totalLikes / posts.length : 0;\n  const avgComments = posts.length > 0 ? totalComments / posts.length : 0;\n  const avgShares = posts.length > 0 ? totalShares / posts.length : 0;\n  const engagementRate = followers > 0 ? ((avgLikes + avgComments + avgShares) / followers * 100) : 0;\n\n  const result = {\n    competitorName, platform, accountUrl, followers,\n    postsScraped: posts.length,\n    avgLikes: Math.round(avgLikes * 100) / 100,\n    avgComments: Math.round(avgComments * 100) / 100,\n    avgShares: Math.round(avgShares * 100) / 100,\n    engagementRate: Math.round(engagementRate * 10000) / 10000,\n    topPosts: top3,\n    topComments: topComments.slice(0, 20),\n    calendarWeek, year, projectName,\n    status: 'ok'\n  };\n\n  return [{ json: result }];\n} catch (error) {\n  const errEntry = {\n    competitorName, platform, calendarWeek, year, projectName,\n    error: error.message, status: 'error'\n  };\n  staticData.errors.push(errEntry);\n  return [{ json: errEntry }];\n}"
}
```

---

##### Node 10c: Parse TikTok

| Property | Value |
|---|---|
| **ID** | `wf3-parse-tt` |
| **Name** | `Parse TT` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst platformInfo = $('Plattform Switch').first().json;\nconst { competitorName, platform, accountUrl, calendarWeek, year, projectName } = platformInfo;\n\ntry {\n  const items = $input.all();\n  if (!items || items.length === 0 || items[0].json?.error) {\n    throw new Error(items[0]?.json?.error || 'Keine Daten von Apify erhalten');\n  }\n\n  const allData = items.map(i => i.json);\n  // TikTok scraper: profile has stats.followerCount, posts have playCount/diggCount/commentCount/shareCount\n  const profileItem = allData.find(d => d.stats?.followerCount !== undefined);\n  const posts = allData.filter(d => d.diggCount !== undefined || d.playCount !== undefined);\n  if (posts.length === 0) throw new Error('Keine Posts gefunden');\n\n  const followers = profileItem?.stats?.followerCount || 0;\n\n  const sorted = [...posts].sort((a, b) => {\n    const engA = (a.diggCount || 0) + (a.commentCount || 0) + (a.shareCount || 0);\n    const engB = (b.diggCount || 0) + (b.commentCount || 0) + (b.shareCount || 0);\n    return engB - engA;\n  });\n\n  const top3 = sorted.slice(0, 3).map(p => ({\n    url: p.webVideoUrl || p.url || '',\n    text: (p.text || p.desc || '').substring(0, 500),\n    likes: p.diggCount || 0,\n    comments: p.commentCount || 0,\n    shares: p.shareCount || 0,\n    engagement: (p.diggCount || 0) + (p.commentCount || 0) + (p.shareCount || 0),\n    date: p.createTime ? new Date(p.createTime * 1000).toISOString() : '',\n    type: 'video'\n  }));\n\n  // TikTok comments: may be in p.comments array\n  const topComments = [];\n  for (const p of sorted.slice(0, 3)) {\n    const comments = p.comments || [];\n    for (const c of comments.slice(0, 7)) {\n      topComments.push({\n        text: c.text || c.comment || '',\n        likes: c.diggCount || c.likes || 0,\n        postUrl: p.webVideoUrl || p.url || ''\n      });\n    }\n  }\n\n  const totalLikes = posts.reduce((s, p) => s + (p.diggCount || 0), 0);\n  const totalComments = posts.reduce((s, p) => s + (p.commentCount || 0), 0);\n  const totalShares = posts.reduce((s, p) => s + (p.shareCount || 0), 0);\n  const avgLikes = posts.length > 0 ? totalLikes / posts.length : 0;\n  const avgComments = posts.length > 0 ? totalComments / posts.length : 0;\n  const avgShares = posts.length > 0 ? totalShares / posts.length : 0;\n  const engagementRate = followers > 0 ? ((avgLikes + avgComments + avgShares) / followers * 100) : 0;\n\n  const result = {\n    competitorName, platform, accountUrl, followers,\n    postsScraped: posts.length,\n    avgLikes: Math.round(avgLikes * 100) / 100,\n    avgComments: Math.round(avgComments * 100) / 100,\n    avgShares: Math.round(avgShares * 100) / 100,\n    engagementRate: Math.round(engagementRate * 10000) / 10000,\n    topPosts: top3,\n    topComments: topComments.slice(0, 20),\n    calendarWeek, year, projectName,\n    status: 'ok'\n  };\n\n  return [{ json: result }];\n} catch (error) {\n  const errEntry = {\n    competitorName, platform, calendarWeek, year, projectName,\n    error: error.message, status: 'error'\n  };\n  staticData.errors.push(errEntry);\n  return [{ json: errEntry }];\n}"
}
```

---

##### Node 10d: Parse LinkedIn

| Property | Value |
|---|---|
| **ID** | `wf3-parse-li` |
| **Name** | `Parse LI` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 620]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst platformInfo = $('Plattform Switch').first().json;\nconst { competitorName, platform, accountUrl, calendarWeek, year, projectName } = platformInfo;\n\ntry {\n  const items = $input.all();\n  if (!items || items.length === 0 || items[0].json?.error) {\n    throw new Error(items[0]?.json?.error || 'Keine Daten von Apify erhalten');\n  }\n\n  const posts = items.map(i => i.json).filter(p => p.text !== undefined || p.commentary !== undefined);\n  if (posts.length === 0) throw new Error('Keine Posts gefunden');\n\n  const followers = posts[0]?.authorFollowerCount || posts[0]?.companyFollowerCount || 0;\n\n  const sorted = [...posts].sort((a, b) => {\n    const engA = (a.numLikes || a.likes || 0) + (a.numComments || a.comments || 0) + (a.numShares || a.shares || 0);\n    const engB = (b.numLikes || b.likes || 0) + (b.numComments || b.comments || 0) + (b.numShares || b.shares || 0);\n    return engB - engA;\n  });\n\n  const top3 = sorted.slice(0, 3).map(p => ({\n    url: p.url || p.postUrl || '',\n    text: (p.text || p.commentary || '').substring(0, 500),\n    likes: p.numLikes || p.likes || 0,\n    comments: p.numComments || p.comments || 0,\n    shares: p.numShares || p.shares || 0,\n    engagement: (p.numLikes || p.likes || 0) + (p.numComments || p.comments || 0) + (p.numShares || p.shares || 0),\n    date: p.postedAt || p.date || '',\n    type: p.type || 'post'\n  }));\n\n  const topComments = [];\n  for (const p of sorted.slice(0, 3)) {\n    const comments = p.commentsList || p.topComments || [];\n    for (const c of comments.slice(0, 7)) {\n      topComments.push({\n        text: c.text || c.comment || '',\n        likes: c.likes || c.numLikes || 0,\n        postUrl: p.url || p.postUrl || ''\n      });\n    }\n  }\n\n  const totalLikes = posts.reduce((s, p) => s + (p.numLikes || p.likes || 0), 0);\n  const totalComments = posts.reduce((s, p) => s + (p.numComments || p.comments || 0), 0);\n  const totalShares = posts.reduce((s, p) => s + (p.numShares || p.shares || 0), 0);\n  const avgLikes = posts.length > 0 ? totalLikes / posts.length : 0;\n  const avgComments = posts.length > 0 ? totalComments / posts.length : 0;\n  const avgShares = posts.length > 0 ? totalShares / posts.length : 0;\n  const engagementRate = followers > 0 ? ((avgLikes + avgComments + avgShares) / followers * 100) : 0;\n\n  const result = {\n    competitorName, platform, accountUrl, followers,\n    postsScraped: posts.length,\n    avgLikes: Math.round(avgLikes * 100) / 100,\n    avgComments: Math.round(avgComments * 100) / 100,\n    avgShares: Math.round(avgShares * 100) / 100,\n    engagementRate: Math.round(engagementRate * 10000) / 10000,\n    topPosts: top3,\n    topComments: topComments.slice(0, 20),\n    calendarWeek, year, projectName,\n    status: 'ok'\n  };\n\n  return [{ json: result }];\n} catch (error) {\n  const errEntry = {\n    competitorName, platform, calendarWeek, year, projectName,\n    error: error.message, status: 'error'\n  };\n  staticData.errors.push(errEntry);\n  return [{ json: errEntry }];\n}"
}
```

---

##### Node 10e: Parse YouTube

| Property | Value |
|---|---|
| **ID** | `wf3-parse-yt` |
| **Name** | `Parse YT` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 780]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst platformInfo = $('Plattform Switch').first().json;\nconst { competitorName, platform, accountUrl, calendarWeek, year, projectName } = platformInfo;\n\ntry {\n  const items = $input.all();\n  if (!items || items.length === 0 || items[0].json?.error) {\n    throw new Error(items[0]?.json?.error || 'Keine Daten von Apify erhalten');\n  }\n\n  const allData = items.map(i => i.json);\n  // YouTube scraper: videos have viewCount, likes, commentCount\n  const channelItem = allData.find(d => d.subscriberCountText || d.subscriberCount);\n  const videos = allData.filter(d => d.viewCount !== undefined || d.views !== undefined);\n  if (videos.length === 0) throw new Error('Keine Videos gefunden');\n\n  const followers = channelItem?.subscriberCount || parseInt(String(channelItem?.subscriberCountText || '0').replace(/[^0-9]/g, '')) || 0;\n\n  const sorted = [...videos].sort((a, b) => {\n    const engA = (a.likes || 0) + (a.commentCount || a.comments || 0);\n    const engB = (b.likes || 0) + (b.commentCount || b.comments || 0);\n    return engB - engA;\n  });\n\n  const top3 = sorted.slice(0, 3).map(v => ({\n    url: v.url || v.videoUrl || (v.id ? `https://youtube.com/watch?v=${v.id}` : ''),\n    text: (v.title || v.text || '').substring(0, 500),\n    likes: v.likes || 0,\n    comments: v.commentCount || v.comments || 0,\n    shares: 0,\n    engagement: (v.likes || 0) + (v.commentCount || v.comments || 0),\n    date: v.date || v.uploadDate || v.publishedAt || '',\n    type: 'video'\n  }));\n\n  // YouTube comments\n  const topComments = [];\n  for (const v of sorted.slice(0, 3)) {\n    const comments = v.commentsData || v.topComments || [];\n    for (const c of comments.slice(0, 7)) {\n      topComments.push({\n        text: c.text || c.comment || '',\n        likes: c.likes || c.voteCount || 0,\n        postUrl: v.url || v.videoUrl || ''\n      });\n    }\n  }\n\n  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);\n  const totalComments = videos.reduce((s, v) => s + (v.commentCount || v.comments || 0), 0);\n  const avgLikes = videos.length > 0 ? totalLikes / videos.length : 0;\n  const avgComments = videos.length > 0 ? totalComments / videos.length : 0;\n  const engagementRate = followers > 0 ? ((avgLikes + avgComments) / followers * 100) : 0;\n\n  const result = {\n    competitorName, platform, accountUrl, followers,\n    postsScraped: videos.length,\n    avgLikes: Math.round(avgLikes * 100) / 100,\n    avgComments: Math.round(avgComments * 100) / 100,\n    avgShares: 0,\n    engagementRate: Math.round(engagementRate * 10000) / 10000,\n    topPosts: top3,\n    topComments: topComments.slice(0, 20),\n    calendarWeek, year, projectName,\n    status: 'ok'\n  };\n\n  return [{ json: result }];\n} catch (error) {\n  const errEntry = {\n    competitorName, platform, calendarWeek, year, projectName,\n    error: error.message, status: 'error'\n  };\n  staticData.errors.push(errEntry);\n  return [{ json: errEntry }];\n}"
}
```

---

##### Node 10f: Parse X/Twitter

| Property | Value |
|---|---|
| **ID** | `wf3-parse-x` |
| **Name** | `Parse X` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 940]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst platformInfo = $('Plattform Switch').first().json;\nconst { competitorName, platform, accountUrl, calendarWeek, year, projectName } = platformInfo;\n\ntry {\n  const items = $input.all();\n  if (!items || items.length === 0 || items[0].json?.error) {\n    throw new Error(items[0]?.json?.error || 'Keine Daten von Apify erhalten');\n  }\n\n  const allData = items.map(i => i.json);\n  // X/Twitter scraper: user has user.followersCount, tweets have likeCount/retweetCount/replyCount\n  const userItem = allData.find(d => d.user?.followersCount !== undefined);\n  const tweets = allData.filter(d => d.likeCount !== undefined || d.retweetCount !== undefined);\n  if (tweets.length === 0) throw new Error('Keine Tweets gefunden');\n\n  const followers = userItem?.user?.followersCount || tweets[0]?.user?.followersCount || 0;\n\n  const sorted = [...tweets].sort((a, b) => {\n    const engA = (a.likeCount || 0) + (a.retweetCount || 0) + (a.replyCount || 0);\n    const engB = (b.likeCount || 0) + (b.retweetCount || 0) + (b.replyCount || 0);\n    return engB - engA;\n  });\n\n  const top3 = sorted.slice(0, 3).map(t => ({\n    url: t.url || (t.id ? `https://x.com/i/status/${t.id}` : ''),\n    text: (t.text || t.fullText || '').substring(0, 500),\n    likes: t.likeCount || 0,\n    comments: t.replyCount || 0,\n    shares: t.retweetCount || 0,\n    engagement: (t.likeCount || 0) + (t.retweetCount || 0) + (t.replyCount || 0),\n    date: t.createdAt || t.date || '',\n    type: t.isRetweet ? 'retweet' : t.isQuote ? 'quote' : 'tweet'\n  }));\n\n  // X comments (replies)\n  const topComments = [];\n  for (const t of sorted.slice(0, 3)) {\n    const replies = t.replies || t.topReplies || [];\n    for (const r of replies.slice(0, 7)) {\n      topComments.push({\n        text: r.text || r.fullText || '',\n        likes: r.likeCount || 0,\n        postUrl: t.url || ''\n      });\n    }\n  }\n\n  const totalLikes = tweets.reduce((s, t) => s + (t.likeCount || 0), 0);\n  const totalComments = tweets.reduce((s, t) => s + (t.replyCount || 0), 0);\n  const totalShares = tweets.reduce((s, t) => s + (t.retweetCount || 0), 0);\n  const avgLikes = tweets.length > 0 ? totalLikes / tweets.length : 0;\n  const avgComments = tweets.length > 0 ? totalComments / tweets.length : 0;\n  const avgShares = tweets.length > 0 ? totalShares / tweets.length : 0;\n  const engagementRate = followers > 0 ? ((avgLikes + avgComments + avgShares) / followers * 100) : 0;\n\n  const result = {\n    competitorName, platform, accountUrl, followers,\n    postsScraped: tweets.length,\n    avgLikes: Math.round(avgLikes * 100) / 100,\n    avgComments: Math.round(avgComments * 100) / 100,\n    avgShares: Math.round(avgShares * 100) / 100,\n    engagementRate: Math.round(engagementRate * 10000) / 10000,\n    topPosts: top3,\n    topComments: topComments.slice(0, 20),\n    calendarWeek, year, projectName,\n    status: 'ok'\n  };\n\n  return [{ json: result }];\n} catch (error) {\n  const errEntry = {\n    competitorName, platform, calendarWeek, year, projectName,\n    error: error.message, status: 'error'\n  };\n  staticData.errors.push(errEntry);\n  return [{ json: errEntry }];\n}"
}
```

---

#### Node 11: Claude Prompt vorbereiten (Code)

All 6 Parse nodes converge here. This node prepares the Claude prompt from the parsed competitor data.

| Property | Value |
|---|---|
| **ID** | `wf3-claude-prep` |
| **Name** | `Claude Prompt vorbereiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2340, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const item = $input.first().json;\n\n// If this competitor had an error in parsing, skip Claude analysis\nif (item.status === 'error') {\n  return [{ json: { ...item, analysis: null, contentIdeas: null, _skipClaude: true } }];\n}\n\n// Get brand info from the Switch node's pass-through data\nconst platformInfo = $('Plattform Switch').first().json;\nconst { brandName, brandDescription, branche } = platformInfo;\n\n// Build the Claude prompt (German, as specified)\nconst topPostsJson = JSON.stringify(item.topPosts, null, 2);\nconst commentsJson = JSON.stringify(item.topComments, null, 2);\n\nconst systemPrompt = `Du bist ein erfahrener Social Media Stratege fuer den DACH-Markt. Du analysierst Wettbewerber-Daten und leitest daraus konkrete, umsetzbare Content-Ideen ab. Antworte immer auf Deutsch. Formatiere deine Antwort als valides JSON.`;\n\nconst userPrompt = `Analysiere die Top-Posts und Kommentare dieses Wettbewerbers.\n\nWettbewerber: ${item.competitorName}\nPlattform: ${item.platform}\nBranche: ${branche}\nUnsere Marke: ${brandName} - ${brandDescription}\n\nWettbewerber-Metriken:\n- Followers: ${item.followers}\n- Posts analysiert: ${item.postsScraped}\n- Durchschn. Likes: ${item.avgLikes}\n- Durchschn. Kommentare: ${item.avgComments}\n- Engagement-Rate: ${item.engagementRate}%\n\nTop-Posts:\n${topPostsJson}\n\nKommentare:\n${commentsJson}\n\nErstelle auf Deutsch ein JSON-Objekt mit diesen Feldern:\n{\n  \"staerken\": \"Was macht der Wettbewerber gut? (2-3 Saetze)\",\n  \"engagement_treiber\": \"Welche Themen/Formate erzeugen das meiste Engagement? (2-3 Saetze)\",\n  \"community_sentiment\": \"Was sagen die Kommentar-Nutzer? Stimmung und Hauptthemen. (2-3 Saetze)\",\n  \"content_ideen\": [\n    {\n      \"titel\": \"Kurzer Titel der Idee\",\n      \"beschreibung\": \"Was genau erstellen, welches Format, welcher Hook\",\n      \"plattform\": \"${item.platform}\",\n      \"format\": \"post|reel|video|carousel|story\",\n      \"inspiration\": \"Welcher Wettbewerber-Post hat diese Idee inspiriert\"\n    }\n  ],\n  \"nicht_kopieren\": \"Was sollten wir NICHT kopieren und warum? (1-2 Saetze)\"\n}\n\nGib 3-5 Content-Ideen zurueck. Antworte NUR mit dem JSON-Objekt, ohne Markdown-Codeblock.`;\n\nreturn [{\n  json: {\n    ...item,\n    systemPrompt,\n    userPrompt,\n    _skipClaude: false\n  }\n}];"
}
```

---

#### Node 12: IF: Claude ueberspringen?

| Property | Value |
|---|---|
| **ID** | `wf3-skip-claude-check` |
| **Name** | `Claude ueberspringen?` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[2600, 460]` |

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
        "id": "skip-claude",
        "leftValue": "={{ $json._skipClaude }}",
        "rightValue": true,
        "operator": {
          "type": "boolean",
          "operation": "equals"
        }
      }
    ],
    "combinator": "and"
  },
  "options": {}
}
```

**Logic:**
- **TRUE** (_skipClaude = true): Competitor had a scraping error, skip Claude. Go directly to Ergebnis sammeln.
- **FALSE** (_skipClaude = false): Proceed to Claude analysis.

---

#### Node 13: Anthropic Wettbewerber-Analyse

| Property | Value |
|---|---|
| **ID** | `wf3-claude-analysis` |
| **Name** | `Claude Wettbewerber-Analyse` |
| **Type** | `nodes-langchain.anthropic` |
| **typeVersion** | `1` |
| **Position** | `[2860, 560]` |
| **Credentials** | Anthropic API |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "resource": "text",
  "operation": "message",
  "modelId": {
    "mode": "id",
    "value": "claude-sonnet-4-5-20250514"
  },
  "messages": {
    "values": [
      {
        "role": "user",
        "content": "={{ $json.userPrompt }}"
      }
    ]
  },
  "options": {
    "systemMessage": "={{ $json.systemPrompt }}",
    "maxTokens": 2000,
    "temperature": 0.3
  }
}
```

**IMPORTANT NOTE on `messages` format:**
Per MEMORY.md, the Anthropic node `messages` parameter is a `fixedCollection`. The docs show `{"values": [...]}` wrapper. However, MEMORY.md warns that the extra `{"values": [...]}` wrapper crashes the n8n frontend for `prompt` fixedCollections. The `messages` field here is a different fixedCollection than `prompt`. During execution phase, verify the correct format by testing. If it causes issues, fall back to HTTP Request for the Anthropic API.

**Fallback option (if native node has issues):** Use HTTP Request node:
```json
{
  "method": "POST",
  "url": "https://api.anthropic.com/v1/messages",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      { "name": "x-api-key", "value": "ANTHROPIC_API_KEY" },
      { "name": "anthropic-version", "value": "2023-06-01" },
      { "name": "Content-Type", "value": "application/json" }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ model: 'claude-sonnet-4-5-20250514', max_tokens: 2000, temperature: 0.3, system: $json.systemPrompt, messages: [{ role: 'user', content: $json.userPrompt }] }) }}"
}
```

---

#### Node 14: Claude Ergebnis parsen (Code)

| Property | Value |
|---|---|
| **ID** | `wf3-parse-claude` |
| **Name** | `Claude Ergebnis parsen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3120, 560]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const item = $input.first().json;\nconst promptData = $('Claude Prompt vorbereiten').first().json;\n\ntry {\n  // The Anthropic node returns the response in various formats.\n  // For resource:text, operation:message, the response content is typically in:\n  // $json.content[0].text (API format) or $json.message or $json.text\n  let responseText = '';\n  if (item.content && Array.isArray(item.content)) {\n    responseText = item.content.map(c => c.text || '').join('');\n  } else if (item.message) {\n    responseText = typeof item.message === 'string' ? item.message : JSON.stringify(item.message);\n  } else if (item.text) {\n    responseText = item.text;\n  } else {\n    // Fallback: stringify the whole response\n    responseText = JSON.stringify(item);\n  }\n\n  // Try to parse as JSON\n  // Remove potential markdown code blocks\n  responseText = responseText.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();\n\n  let analysis;\n  try {\n    analysis = JSON.parse(responseText);\n  } catch (parseErr) {\n    // If JSON parsing fails, wrap the text as analysis\n    analysis = {\n      staerken: responseText.substring(0, 500),\n      engagement_treiber: '',\n      community_sentiment: '',\n      content_ideen: [],\n      nicht_kopieren: ''\n    };\n  }\n\n  // Extract content ideas\n  const contentIdeas = analysis.content_ideen || analysis.contentIdeas || [];\n\n  return [{\n    json: {\n      competitorName: promptData.competitorName,\n      platform: promptData.platform,\n      accountUrl: promptData.accountUrl,\n      followers: promptData.followers,\n      postsScraped: promptData.postsScraped,\n      avgLikes: promptData.avgLikes,\n      avgComments: promptData.avgComments,\n      avgShares: promptData.avgShares,\n      engagementRate: promptData.engagementRate,\n      topPosts: promptData.topPosts,\n      topComments: promptData.topComments,\n      analysis,\n      contentIdeas,\n      calendarWeek: promptData.calendarWeek,\n      year: promptData.year,\n      projectName: promptData.projectName,\n      status: 'ok'\n    }\n  }];\n} catch (error) {\n  return [{\n    json: {\n      competitorName: promptData.competitorName,\n      platform: promptData.platform,\n      calendarWeek: promptData.calendarWeek,\n      year: promptData.year,\n      projectName: promptData.projectName,\n      analysis: null,\n      contentIdeas: [],\n      error: 'Claude Analyse fehlgeschlagen: ' + error.message,\n      status: 'partial'\n    }\n  }];\n}"
}
```

---

#### Node 15: Ergebnis sammeln (Code)

Both the "skip Claude" path (TRUE from IF) and the "Claude parsed" path converge here.

| Property | Value |
|---|---|
| **ID** | `wf3-collect-result` |
| **Name** | `Ergebnis sammeln` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3380, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst item = $input.first().json;\n\n// Store result in static data\nif (item.status === 'ok' || item.status === 'partial') {\n  staticData.results.push(item);\n  if (item.analysis) {\n    staticData.analyses.push({\n      competitor: item.competitorName,\n      platform: item.platform,\n      analysis: item.analysis,\n      contentIdeas: item.contentIdeas || []\n    });\n  }\n} else {\n  staticData.errors.push({\n    competitor: item.competitorName || 'unbekannt',\n    platform: item.platform || 'unbekannt',\n    error: item.error || 'Unbekannter Fehler',\n    timestamp: new Date().toISOString()\n  });\n}\n\nreturn [{ json: { _collected: true, competitor: item.competitorName, platform: item.platform, status: item.status } }];"
}
```

---

#### Node 16: Apify Pause (Wait)

| Property | Value |
|---|---|
| **ID** | `wf3-wait-rate-limit` |
| **Name** | `Apify Pause` |
| **Type** | `n8n-nodes-base.wait` |
| **typeVersion** | `1.1` |
| **Position** | `[3380, 620]` |

**Parameters:**
```json
{
  "amount": 5,
  "unit": "seconds"
}
```

**Notes:**
- 5-second pause between SplitInBatches iterations to respect Apify rate limits.
- Output connects back to `Competitor-Batches` (SplitInBatches) input for the next iteration.

---

#### Node 17: Ergebnisse aufbereiten (Code)

Connected to SplitInBatches **Output 0** (done -- all competitors processed).

| Property | Value |
|---|---|
| **ID** | `wf3-prepare-output` |
| **Name** | `Ergebnisse aufbereiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1560, 260]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Retrieve all collected results from static data\nconst staticData = $getWorkflowStaticData('global');\nconst results = staticData.results || [];\nconst errors = staticData.errors || [];\n\n// Build items for Supabase UPSERT\nconst supabaseItems = results\n  .filter(r => r.status === 'ok' || r.status === 'partial')\n  .map(r => ({\n    json: {\n      project_name: r.projectName,\n      calendar_week: r.calendarWeek,\n      year: r.year,\n      competitor_name: r.competitorName,\n      platform: r.platform,\n      account_url: r.accountUrl || '',\n      followers: r.followers || 0,\n      posts_scraped: r.postsScraped || 0,\n      avg_likes: r.avgLikes || 0,\n      avg_comments: r.avgComments || 0,\n      avg_shares: r.avgShares || 0,\n      engagement_rate: r.engagementRate || 0,\n      top_posts: JSON.stringify(r.topPosts || []),\n      top_comments: JSON.stringify(r.topComments || []),\n      analysis: JSON.stringify(r.analysis || null),\n      content_ideas: JSON.stringify(r.contentIdeas || []),\n      collected_at: new Date().toISOString(),\n      data_source: 'wf3_competitor_monitor'\n    }\n  }));\n\nstaticData.outputCount = supabaseItems.length;\nstaticData.finishedAt = new Date().toISOString();\n\nif (supabaseItems.length === 0) {\n  return [{ json: { _empty: true, message: 'Keine Daten zum Schreiben', errors } }];\n}\n\nreturn supabaseItems;"
}
```

---

#### Node 18: Supabase Competitor UPSERT

| Property | Value |
|---|---|
| **ID** | `wf3-supabase-upsert` |
| **Name** | `Supabase Competitor UPSERT` |
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
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/competitor_weekly' }}",
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

**Why HTTP Request:** Same as WF1 -- native Supabase node lacks UPSERT. PostgREST `Prefer: resolution=merge-duplicates` header handles it.

---

#### Node 19: Competitor Insights in Sheet schreiben

| Property | Value |
|---|---|
| **ID** | `wf3-sheets-write` |
| **Name** | `Competitor Insights schreiben` |
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
    "value": "Competitor Insights"
  },
  "columns": {
    "mappingMode": "defineBelow",
    "value": {
      "mappings": [
        { "columnName": "Plattform", "fieldValue": "={{ $json.platform }}" },
        { "columnName": "Wettbewerber", "fieldValue": "={{ $json.competitor_name }}" },
        { "columnName": "KW", "fieldValue": "={{ $json.calendar_week }}" },
        { "columnName": "Followers", "fieldValue": "={{ $json.followers }}" },
        { "columnName": "Top-Post URL", "fieldValue": "={{ JSON.parse($json.top_posts || '[]')[0]?.url ?? '' }}" },
        { "columnName": "Top-Post Engagement", "fieldValue": "={{ JSON.parse($json.top_posts || '[]')[0]?.engagement ?? 0 }}" },
        { "columnName": "Content-Idee", "fieldValue": "={{ (JSON.parse($json.content_ideas || '[]')[0]?.titel ?? '') + ': ' + (JSON.parse($json.content_ideas || '[]')[0]?.beschreibung ?? '') }}" },
        { "columnName": "Sentiment", "fieldValue": "={{ JSON.parse($json.analysis || '{}')?.community_sentiment ?? '' }}" },
        { "columnName": "Erfasst am", "fieldValue": "={{ $json.collected_at }}" }
      ]
    },
    "matchingColumns": [],
    "schema": []
  },
  "options": {}
}
```

---

#### Node 20: Run-Log vorbereiten (Code)

| Property | Value |
|---|---|
| **ID** | `wf3-prepare-runlog` |
| **Name** | `Run-Log vorbereiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2080, 240]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst results = staticData.results || [];\nconst errors = staticData.errors || [];\n\nconst competitorsOk = results.filter(r => r.status === 'ok').map(r => `${r.competitorName} (${r.platform})`);\nconst competitorsError = errors.map(e => `${e.competitor || 'unbekannt'} (${e.platform || '?'})`);\n\nconst startedAt = staticData.startedAt || new Date().toISOString();\nconst finishedAt = new Date().toISOString();\nconst startMs = new Date(startedAt).getTime();\nconst endMs = new Date(finishedAt).getTime();\nconst durationSeconds = Math.round((endMs - startMs) / 1000 * 100) / 100;\n\nconst status = errors.length === 0\n  ? 'success'\n  : competitorsOk.length > 0\n    ? 'partial_success'\n    : 'error';\n\nreturn [{\n  json: {\n    workflow_name: 'WF3 Competitor Monitor',\n    workflow_id: $workflow.id || '',\n    execution_id: $execution.id || '',\n    project_name: results[0]?.projectName || 'unknown',\n    started_at: startedAt,\n    finished_at: finishedAt,\n    duration_seconds: durationSeconds,\n    status,\n    platforms_ok: competitorsOk,\n    platforms_error: competitorsError,\n    error_details: errors.length > 0 ? JSON.stringify(errors) : null,\n    items_processed: staticData.outputCount || 0,\n    notes: `${competitorsOk.length} Wettbewerber analysiert, ${errors.length} Fehler`\n  }\n}];"
}
```

---

#### Node 21: Supabase Run-Log

| Property | Value |
|---|---|
| **ID** | `wf3-supabase-runlog` |
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

#### Node 22: Response zusammenbauen (Code)

| Property | Value |
|---|---|
| **ID** | `wf3-build-response` |
| **Name** | `Response zusammenbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2600, 160]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const staticData = $getWorkflowStaticData('global');\nconst results = staticData.results || [];\nconst errors = staticData.errors || [];\nconst analyses = staticData.analyses || [];\n\nconst competitorsOk = results.filter(r => r.status === 'ok').map(r => r.competitorName + ' (' + r.platform + ')');\nconst competitorsError = errors.map(e => (e.competitor || 'unbekannt') + ' (' + (e.platform || '?') + ')');\n\n// Collect all content ideas across all competitors\nconst allContentIdeas = analyses.flatMap(a => \n  (a.contentIdeas || []).map(idea => ({\n    ...idea,\n    competitor: a.competitor,\n    platform: a.platform\n  }))\n);\n\n// Clean up static data\ndelete staticData.results;\ndelete staticData.errors;\ndelete staticData.analyses;\ndelete staticData.startedAt;\ndelete staticData.finishedAt;\ndelete staticData.outputCount;\n\nreturn [{\n  json: {\n    success: errors.length === 0,\n    workflow: 'WF3 Competitor Monitor',\n    data: {\n      competitorsAnalyzed: competitorsOk,\n      competitorsFailed: competitorsError,\n      totalCompetitors: competitorsOk.length + competitorsError.length,\n      successCount: competitorsOk.length,\n      errorCount: competitorsError.length,\n      contentIdeasGenerated: allContentIdeas.length,\n      contentIdeas: allContentIdeas\n    },\n    errors: errors.length > 0 ? errors : null,\n    timestamp: new Date().toISOString()\n  }\n}];"
}
```

---

#### Node 23: Webhook Antwort

| Property | Value |
|---|---|
| **ID** | `wf3-respond-webhook` |
| **Name** | `Webhook Antwort` |
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **typeVersion** | `1.1` |
| **Position** | `[2860, 160]` |

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

### Connections

```
Webhook Trigger --> Dual-Trigger Pruefung

Dual-Trigger Pruefung [TRUE]  --> Konfig zusammenfuehren
Dual-Trigger Pruefung [FALSE] --> Konfig aus Sheet lesen

Konfig aus Sheet lesen --> Wettbewerber aus Sheet lesen
Wettbewerber aus Sheet lesen --> Konfig zusammenfuehren

Konfig zusammenfuehren --> Competitor Dispatcher
Competitor Dispatcher --> Competitor-Batches (SplitInBatches)

Competitor-Batches [Output 1 = loop] --> Plattform Switch

Plattform Switch [Output 0: instagram]  --> Apify IG Posts
Plattform Switch [Output 1: facebook]   --> Apify FB Posts
Plattform Switch [Output 2: tiktok]     --> Apify TT Posts
Plattform Switch [Output 3: linkedin]   --> Apify LI Posts
Plattform Switch [Output 4: youtube]    --> Apify YT Posts
Plattform Switch [Output 5: x_twitter]  --> Apify X Posts

Apify IG Posts  --> Parse IG
Apify FB Posts  --> Parse FB
Apify TT Posts  --> Parse TT
Apify LI Posts  --> Parse LI
Apify YT Posts  --> Parse YT
Apify X Posts   --> Parse X

Parse IG  --> Claude Prompt vorbereiten
Parse FB  --> Claude Prompt vorbereiten
Parse TT  --> Claude Prompt vorbereiten
Parse LI  --> Claude Prompt vorbereiten
Parse YT  --> Claude Prompt vorbereiten
Parse X   --> Claude Prompt vorbereiten

Claude Prompt vorbereiten --> Claude ueberspringen? (IF)

Claude ueberspringen? [TRUE = skip]  --> Ergebnis sammeln
Claude ueberspringen? [FALSE = run]  --> Claude Wettbewerber-Analyse

Claude Wettbewerber-Analyse --> Claude Ergebnis parsen
Claude Ergebnis parsen --> Ergebnis sammeln

Ergebnis sammeln --> Apify Pause (Wait)
Apify Pause --> Competitor-Batches (loop back)

Competitor-Batches [Output 0 = done] --> Ergebnisse aufbereiten

Ergebnisse aufbereiten --> Supabase Competitor UPSERT
Ergebnisse aufbereiten --> Competitor Insights schreiben
Ergebnisse aufbereiten --> Run-Log vorbereiten

Run-Log vorbereiten --> Supabase Run-Log

Supabase Competitor UPSERT   --> Response zusammenbauen
Competitor Insights schreiben --> Response zusammenbauen
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
    "main": [[{ "node": "Wettbewerber aus Sheet lesen", "type": "main", "index": 0 }]]
  },
  "Wettbewerber aus Sheet lesen": {
    "main": [[{ "node": "Konfig zusammenfuehren", "type": "main", "index": 0 }]]
  },
  "Konfig zusammenfuehren": {
    "main": [[{ "node": "Competitor Dispatcher", "type": "main", "index": 0 }]]
  },
  "Competitor Dispatcher": {
    "main": [[{ "node": "Competitor-Batches", "type": "main", "index": 0 }]]
  },
  "Competitor-Batches": {
    "main": [
      [{ "node": "Ergebnisse aufbereiten", "type": "main", "index": 0 }],
      [{ "node": "Plattform Switch", "type": "main", "index": 0 }]
    ]
  },
  "Plattform Switch": {
    "main": [
      [{ "node": "Apify IG Posts", "type": "main", "index": 0 }],
      [{ "node": "Apify FB Posts", "type": "main", "index": 0 }],
      [{ "node": "Apify TT Posts", "type": "main", "index": 0 }],
      [{ "node": "Apify LI Posts", "type": "main", "index": 0 }],
      [{ "node": "Apify YT Posts", "type": "main", "index": 0 }],
      [{ "node": "Apify X Posts", "type": "main", "index": 0 }]
    ]
  },
  "Apify IG Posts": {
    "main": [[{ "node": "Parse IG", "type": "main", "index": 0 }]]
  },
  "Apify FB Posts": {
    "main": [[{ "node": "Parse FB", "type": "main", "index": 0 }]]
  },
  "Apify TT Posts": {
    "main": [[{ "node": "Parse TT", "type": "main", "index": 0 }]]
  },
  "Apify LI Posts": {
    "main": [[{ "node": "Parse LI", "type": "main", "index": 0 }]]
  },
  "Apify YT Posts": {
    "main": [[{ "node": "Parse YT", "type": "main", "index": 0 }]]
  },
  "Apify X Posts": {
    "main": [[{ "node": "Parse X", "type": "main", "index": 0 }]]
  },
  "Parse IG": {
    "main": [[{ "node": "Claude Prompt vorbereiten", "type": "main", "index": 0 }]]
  },
  "Parse FB": {
    "main": [[{ "node": "Claude Prompt vorbereiten", "type": "main", "index": 0 }]]
  },
  "Parse TT": {
    "main": [[{ "node": "Claude Prompt vorbereiten", "type": "main", "index": 0 }]]
  },
  "Parse LI": {
    "main": [[{ "node": "Claude Prompt vorbereiten", "type": "main", "index": 0 }]]
  },
  "Parse YT": {
    "main": [[{ "node": "Claude Prompt vorbereiten", "type": "main", "index": 0 }]]
  },
  "Parse X": {
    "main": [[{ "node": "Claude Prompt vorbereiten", "type": "main", "index": 0 }]]
  },
  "Claude Prompt vorbereiten": {
    "main": [[{ "node": "Claude ueberspringen?", "type": "main", "index": 0 }]]
  },
  "Claude ueberspringen?": {
    "main": [
      [{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }],
      [{ "node": "Claude Wettbewerber-Analyse", "type": "main", "index": 0 }]
    ]
  },
  "Claude Wettbewerber-Analyse": {
    "main": [[{ "node": "Claude Ergebnis parsen", "type": "main", "index": 0 }]]
  },
  "Claude Ergebnis parsen": {
    "main": [[{ "node": "Ergebnis sammeln", "type": "main", "index": 0 }]]
  },
  "Ergebnis sammeln": {
    "main": [[{ "node": "Apify Pause", "type": "main", "index": 0 }]]
  },
  "Apify Pause": {
    "main": [[{ "node": "Competitor-Batches", "type": "main", "index": 0 }]]
  },
  "Ergebnisse aufbereiten": {
    "main": [[
      { "node": "Supabase Competitor UPSERT", "type": "main", "index": 0 },
      { "node": "Competitor Insights schreiben", "type": "main", "index": 0 },
      { "node": "Run-Log vorbereiten", "type": "main", "index": 0 }
    ]]
  },
  "Run-Log vorbereiten": {
    "main": [[{ "node": "Supabase Run-Log", "type": "main", "index": 0 }]]
  },
  "Supabase Competitor UPSERT": {
    "main": [[{ "node": "Response zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Competitor Insights schreiben": {
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

**IMPORTANT NOTE on "Ergebnisse aufbereiten" connections:**
The node connects to 3 downstream nodes. In n8n connection JSON, a single output sends the SAME data to multiple nodes. The correct format is an array of connection objects in a single output array:
```json
"Ergebnisse aufbereiten": {
  "main": [[
    { "node": "Supabase Competitor UPSERT", "type": "main", "index": 0 },
    { "node": "Competitor Insights schreiben", "type": "main", "index": 0 },
    { "node": "Run-Log vorbereiten", "type": "main", "index": 0 }
  ]]
}
```

---

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

| # | ID | Name | Type | typeVersion | Position | Credentials | onError | retryOnFail |
|---|---|---|---|---|---|---|---|---|
| 1 | wf3-webhook | Webhook Trigger | n8n-nodes-base.webhook | 2 | [260, 460] | - | - | - |
| 2 | wf3-dual-trigger | Dual-Trigger Pruefung | n8n-nodes-base.if | 2.2 | [520, 460] | - | - | - |
| 3 | wf3-read-konfig | Konfig aus Sheet lesen | n8n-nodes-base.googleSheets | 4.7 | [780, 620] | Google Sheets OAuth2 | - | - |
| 4 | wf3-read-competitors | Wettbewerber aus Sheet lesen | n8n-nodes-base.googleSheets | 4.7 | [1040, 620] | Google Sheets OAuth2 | - | - |
| 5 | wf3-merge-config | Konfig zusammenfuehren | n8n-nodes-base.code | 2 | [780, 460] | - | - | - |
| 6 | wf3-competitor-dispatcher | Competitor Dispatcher | n8n-nodes-base.code | 2 | [1040, 460] | - | - | - |
| 7 | wf3-split-batches | Competitor-Batches | n8n-nodes-base.splitInBatches | 3 | [1300, 460] | - | - | - |
| 8 | wf3-platform-switch | Plattform Switch | n8n-nodes-base.switch | 3.2 | [1560, 460] | - | - | - |
| 9a | wf3-apify-ig | Apify IG Posts | @apify/n8n-nodes-apify.apify | 1 | [1820, 140] | Apify API | continueRegularOutput | 3x / 15s |
| 9b | wf3-apify-fb | Apify FB Posts | @apify/n8n-nodes-apify.apify | 1 | [1820, 300] | Apify API | continueRegularOutput | 3x / 15s |
| 9c | wf3-apify-tt | Apify TT Posts | @apify/n8n-nodes-apify.apify | 1 | [1820, 460] | Apify API | continueRegularOutput | 3x / 15s |
| 9d | wf3-apify-li | Apify LI Posts | @apify/n8n-nodes-apify.apify | 1 | [1820, 620] | Apify API | continueRegularOutput | 3x / 15s |
| 9e | wf3-apify-yt | Apify YT Posts | @apify/n8n-nodes-apify.apify | 1 | [1820, 780] | Apify API | continueRegularOutput | 3x / 15s |
| 9f | wf3-apify-x | Apify X Posts | @apify/n8n-nodes-apify.apify | 1 | [1820, 940] | Apify API | continueRegularOutput | 3x / 15s |
| 10a | wf3-parse-ig | Parse IG | n8n-nodes-base.code | 2 | [2080, 140] | - | - | - |
| 10b | wf3-parse-fb | Parse FB | n8n-nodes-base.code | 2 | [2080, 300] | - | - | - |
| 10c | wf3-parse-tt | Parse TT | n8n-nodes-base.code | 2 | [2080, 460] | - | - | - |
| 10d | wf3-parse-li | Parse LI | n8n-nodes-base.code | 2 | [2080, 620] | - | - | - |
| 10e | wf3-parse-yt | Parse YT | n8n-nodes-base.code | 2 | [2080, 780] | - | - | - |
| 10f | wf3-parse-x | Parse X | n8n-nodes-base.code | 2 | [2080, 940] | - | - | - |
| 11 | wf3-claude-prep | Claude Prompt vorbereiten | n8n-nodes-base.code | 2 | [2340, 460] | - | - | - |
| 12 | wf3-skip-claude-check | Claude ueberspringen? | n8n-nodes-base.if | 2.2 | [2600, 460] | - | - | - |
| 13 | wf3-claude-analysis | Claude Wettbewerber-Analyse | nodes-langchain.anthropic | 1 | [2860, 560] | Anthropic API | continueRegularOutput | 3x / 15s |
| 14 | wf3-parse-claude | Claude Ergebnis parsen | n8n-nodes-base.code | 2 | [3120, 560] | - | - | - |
| 15 | wf3-collect-result | Ergebnis sammeln | n8n-nodes-base.code | 2 | [3380, 460] | - | - | - |
| 16 | wf3-wait-rate-limit | Apify Pause | n8n-nodes-base.wait | 1.1 | [3380, 620] | - | - | - |
| 17 | wf3-prepare-output | Ergebnisse aufbereiten | n8n-nodes-base.code | 2 | [1560, 260] | - | - | - |
| 18 | wf3-supabase-upsert | Supabase Competitor UPSERT | n8n-nodes-base.httpRequest | 4.4 | [1820, 160] | Header Auth | - | 2x / 3s |
| 19 | wf3-sheets-write | Competitor Insights schreiben | n8n-nodes-base.googleSheets | 4.7 | [1820, 320] | Google Sheets OAuth2 | - | 3x / 5s |
| 20 | wf3-prepare-runlog | Run-Log vorbereiten | n8n-nodes-base.code | 2 | [2080, 240] | - | - | - |
| 21 | wf3-supabase-runlog | Supabase Run-Log | n8n-nodes-base.supabase | 1 | [2340, 240] | Supabase API | - | 2x / 3s |
| 22 | wf3-build-response | Response zusammenbauen | n8n-nodes-base.code | 2 | [2600, 160] | - | - | - |
| 23 | wf3-respond-webhook | Webhook Antwort | n8n-nodes-base.respondToWebhook | 1.1 | [2860, 160] | - | - | - |

**Total: 28 nodes** (23 unique functional roles, 6 parallel Apify + 6 parallel Parse branches)

---

## Error Handling Strategy

### Per-Competitor Error Isolation

Each competitor-platform pair processes in its own SplitInBatches iteration. Errors are caught at two levels:

1. **Apify Node Level**: `onError: "continueRegularOutput"` + `retryOnFail: true` (3 retries, 15s between). If all retries fail, the node outputs an error item instead of crashing.

2. **Parse Code Node Level**: `try/catch` wraps all parsing logic. If Apify returned an error (or unexpected data format), the parse node logs the error to `staticData.errors` and returns an error status item.

3. **Claude Skip Logic**: If a competitor's scraping failed, `_skipClaude: true` bypasses the Claude analysis call (no point analyzing empty data).

4. **Claude Node Level**: `onError: "continueRegularOutput"` + `retryOnFail: true`. If Claude fails, the "Claude Ergebnis parsen" node handles the error gracefully and returns a `status: 'partial'` result.

### Rate Limiting

| Mechanism | Implementation |
|---|---|
| Max 2 concurrent Apify runs | SplitInBatches with batchSize=1 (only 1 at a time, even stricter) |
| 5s pause between Apify calls | Wait node (5 seconds) between Ergebnis sammeln and loop-back |
| 30s retry on rate limit error | retryOnFail with waitBetweenTries=15000 (15s between attempts, 3 attempts = up to 45s) |

### Response Format

The webhook always returns a structured response:
```json
{
  "success": true,
  "workflow": "WF3 Competitor Monitor",
  "data": {
    "competitorsAnalyzed": ["KonkurrenzAG (instagram)", "KonkurrenzAG (facebook)"],
    "competitorsFailed": [],
    "totalCompetitors": 2,
    "successCount": 2,
    "errorCount": 0,
    "contentIdeasGenerated": 8,
    "contentIdeas": [
      {
        "titel": "Hinter-den-Kulissen Reel",
        "beschreibung": "...",
        "plattform": "instagram",
        "format": "reel",
        "inspiration": "Top-Post des Wettbewerbers...",
        "competitor": "KonkurrenzAG",
        "platform": "instagram"
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-03-03T09:05:00.000Z"
}
```

---

## Credentials Required

| Credential | Node(s) | Status |
|---|---|---|
| Google Sheets OAuth2 | Konfig aus Sheet lesen, Wettbewerber aus Sheet lesen, Competitor Insights schreiben | Available |
| Apify API Token | 6x Apify nodes | Available |
| Anthropic API Key | Claude Wettbewerber-Analyse | Available |
| Supabase API (via HTTP headers) | Supabase Competitor UPSERT | Available (URL + Key as placeholders) |
| Supabase API (native) | Supabase Run-Log | Available |

---

## Placeholders to Replace Before Deployment

| Placeholder | Node(s) | Replace With |
|---|---|---|
| `GOOGLE_SHEET_URL_PLACEHOLDER` | Nodes 3, 4, 19 | Actual Google Sheet URL |
| `SUPABASE_URL_PLACEHOLDER` | Node 18 | Actual Supabase project URL |
| `SUPABASE_API_KEY_PLACEHOLDER` | Node 18 (2 occurrences) | Actual Supabase API key |

---

## Validation Criteria

- [ ] All 28 nodes defined with correct typeVersions
- [ ] No HTTP Request nodes where native nodes exist (only Supabase UPSERT justified)
- [ ] All expressions use `={{ }}` syntax
- [ ] Code nodes use `$input.first().json` (not `$json` directly)
- [ ] Code nodes return `[{ json: { ... } }]` format
- [ ] SplitInBatches Output 0 = done, Output 1 = loop
- [ ] Connections reference nodes by `name` (not `id`)
- [ ] `onError: "continueRegularOutput"` on all Apify + Claude nodes (not `continueOnFail`)
- [ ] `retryOnFail` configured on all external API nodes
- [ ] Credentials specified for all nodes requiring authentication
- [ ] Node positions have no overlaps and follow 260px horizontal / 160px vertical spacing
- [ ] Workflow settings include `executionOrder: "v1"`
- [ ] Claude prompt is in German
- [ ] All content ideas output in German
- [ ] Rate limiting: batchSize=1 + 5s Wait node enforced
- [ ] `$getWorkflowStaticData('global')` cleaned up in Response node

---

## Execution Time Estimate

For a typical run with 3 competitors x 3 active platforms = 9 iterations:

| Step | Time per iteration | Total |
|---|---|---|
| Apify scrape (Run actor + get dataset) | 30-90s | 4.5-13.5 min |
| Parse code | <1s | ~9s |
| Claude analysis | 5-15s | 45s-2.25 min |
| Wait (rate limit) | 5s | 45s |
| **Total per iteration** | **40-110s** | |
| **Total workflow** | | **6-17 min** |

This is within n8n Cloud execution limits. For very large runs (18 competitors), the workflow could take up to 30+ minutes, which may approach timeout limits. Consider adding a note to the Konfig tab about keeping active competitor count reasonable.

---

*Plan created: 2026-03-03*
*Architecture follows WF1 patterns (dual-trigger, SplitInBatches, staticData accumulation, error isolation)*
