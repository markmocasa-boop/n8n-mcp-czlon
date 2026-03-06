---
phase: 2
plan: 1
workflows: [WF2]
type: n8n-workflow
status: planned
created: 2026-03-03
---

# Phase 2 Plan: WF2 Meta Ads Analyzer

## Objective

Deploy WF2 Meta Ads Analyzer -- a workflow that reads Meta Ads configuration from a Google Sheet, queries the Meta Marketing API (Facebook Graph API) for campaign, ad set, and ad-level performance data over the last 7 days, sends the data to Claude Sonnet 4.5 for a structured German-language analysis, writes the results to Supabase `meta_ads_weekly`, and returns a structured response. The workflow must be triggerable both standalone (via its own Webhook) and from the Master Orchestrator (Phase 5).

---

## Pre-Workflow Tasks

### Task 1: Supabase Schema Update

The placeholder `meta_ads_weekly` table from Phase 1 must be replaced with the full schema. Execute via Supabase SQL Editor:

```sql
-- =============================================================
-- Drop the placeholder and recreate with full schema
-- =============================================================

DROP TABLE IF EXISTS meta_ads_weekly;

CREATE TABLE IF NOT EXISTS meta_ads_weekly (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  ad_account_id         TEXT NOT NULL,

  -- Campaign-level aggregates
  total_campaigns       INTEGER DEFAULT 0,
  active_campaigns      INTEGER DEFAULT 0,
  total_spend           NUMERIC(12,2) DEFAULT 0,
  total_impressions     BIGINT DEFAULT 0,
  total_clicks          INTEGER DEFAULT 0,
  total_conversions     INTEGER DEFAULT 0,
  overall_ctr           NUMERIC(8,4) DEFAULT 0,
  overall_cpc           NUMERIC(8,4) DEFAULT 0,
  overall_cpm           NUMERIC(8,4) DEFAULT 0,
  overall_roas          NUMERIC(8,4) DEFAULT 0,

  -- Top 3 / Bottom 3 ads (JSON arrays)
  top_3_ads             JSONB,
  bottom_3_ads          JSONB,

  -- Platform split
  facebook_spend        NUMERIC(12,2) DEFAULT 0,
  facebook_impressions  BIGINT DEFAULT 0,
  instagram_spend       NUMERIC(12,2) DEFAULT 0,
  instagram_impressions BIGINT DEFAULT 0,

  -- Claude analysis
  analysis_text         TEXT,
  analysis_json         JSONB,

  -- Raw API data
  raw_campaigns         JSONB,
  raw_adsets            JSONB,
  raw_ads               JSONB,

  -- Metadata
  date_range_start      DATE,
  date_range_end        DATE,
  collected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf2_meta_ads_analyzer',

  -- UPSERT constraint
  CONSTRAINT uq_meta_ads_weekly
    UNIQUE (project_name, ad_account_id, calendar_week, year)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_project
  ON meta_ads_weekly (project_name);
CREATE INDEX IF NOT EXISTS idx_meta_ads_kw_year
  ON meta_ads_weekly (calendar_week, year);
```

### Task 2: Google Sheet Tab 4 (Meta Ads Konfig) Setup

Tab 4 was defined in Phase 1. Verify these rows exist:

| Einstellung | Wert |
|---|---|
| ad_account_id | act_XXXXXXXXX |
| campaign_filter | (leer oder Kampagnenname-Filter) |
| date_range_days | 7 |
| enabled | TRUE |

---

## WF2: Meta Ads Analyzer

### Overview

**Trigger**: Webhook (POST) -- accepts calls from the Master Orchestrator or standalone invocation.
**Purpose**: Analyze Meta (Facebook + Instagram) Ads performance for the last 7 days. Collect campaign/ad set/ad data, generate Claude analysis, persist to Supabase.
**Error Handling**: API nodes use `onError: continueRegularOutput` + retry. Claude analysis failure returns a fallback summary. Structured `{ success, data, errors }` response.

### High-Level Flow

```
Webhook Trigger (POST)
  |
  v
IF: Dual-Trigger Pruefung (config in body?)
  |
  +-- TRUE (Master call) --> Konfig zusammenfuehren
  |
  +-- FALSE (standalone) --> Google Sheets: Konfig lesen
                               |
                               v
                            Google Sheets: Meta Ads Konfig lesen
                               |
                               v
                            Konfig zusammenfuehren
  |
  v
IF: Meta Ads aktiv? (enabled === TRUE)
  |
  +-- FALSE --> Code: Skipped Response --> Respond to Webhook
  |
  +-- TRUE
      |
      v
  Code: API-Parameter vorbereiten (date ranges, fields, account ID)
      |
      v
  Facebook Graph API: Kampagnen abrufen
      |
      v
  Facebook Graph API: Anzeigengruppen abrufen
      |
      v
  Facebook Graph API: Anzeigen abrufen
      |
      v
  Code: Ads-Daten konsolidieren (merge campaigns + ad sets + ads, compute KPIs)
      |
      v
  HTTP Request: Claude Analyse (Anthropic Messages API)
      |
      v
  Code: Analyse-Ergebnis verarbeiten
      |
      v
  HTTP Request: Supabase UPSERT meta_ads_weekly
      |
      v
  Code: Response zusammenbauen
      |
      v
  Respond to Webhook
```

### Architecture Decision: Sequential Linear Flow

Unlike WF1 (which needed SplitInBatches for dynamic platform count), WF2 has a fixed sequence:
1. Campaigns query (1 call)
2. Ad Sets query (1 call)
3. Ads query (1 call)
4. Consolidate
5. Claude analysis (1 call)
6. Persist

A simple linear chain is correct here. No SplitInBatches needed.

### Architecture Decision: Claude via HTTP Request (Anthropic Messages API)

The `nodes-langchain.anthropic` node with `operation: "message"` is a standalone node for direct Claude API calls. However, its `messages` parameter is a `fixedCollection` type which makes dynamic prompt construction awkward in expressions. For a one-shot analysis where the prompt is dynamically built from collected Ads data, a Code node calling `$helpers.httpRequest` to the Anthropic Messages API is more reliable and gives full control over the prompt structure.

**Alternative considered**: Using `nodes-langchain.anthropic` node with `resource: "text"`, `operation: "message"`. This would work but the dynamic prompt with large JSON payloads is better handled via HTTP Request where we have full control over the request body.

**Decision**: Use `n8n-nodes-base.httpRequest` with the Anthropic Messages API (`https://api.anthropic.com/v1/messages`). The API key is passed via header. This is justified because:
1. Dynamic prompt construction with embedded JSON data
2. Full control over `max_tokens`, `temperature`, system message
3. Structured JSON output via system prompt instructions
4. The native `nodes-langchain.anthropic` node's `message` operation uses `fixedCollection` which is hard to populate dynamically

---

### Nodes

#### Node 1: Webhook Trigger

| Property | Value |
|---|---|
| **ID** | `wf2-webhook` |
| **Name** | `Webhook Trigger` |
| **Type** | `n8n-nodes-base.webhook` |
| **typeVersion** | `2` |
| **Position** | `[260, 460]` |

**Parameters:**
```json
{
  "path": "socialpulse-meta-ads",
  "httpMethod": "POST",
  "responseMode": "responseNode",
  "options": {}
}
```

**Notes:**
- `responseMode: "responseNode"` -- response sent by dedicated Respond to Webhook node at the end.
- POST body can optionally contain `{ config: { ... }, meta_ads_config: { ... } }` when called from Master.
- Standalone call body: `{ sheet_url: "..." }` or empty (uses hardcoded Sheet URL).

---

#### Node 2: Dual-Trigger Pruefung

| Property | Value |
|---|---|
| **ID** | `wf2-dual-trigger` |
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
- **TRUE** (config in body) -- Master provided config + meta_ads_config. Skip Sheet reads.
- **FALSE** (no config) -- Standalone. Must read from Google Sheet.

---

#### Node 3: Konfig aus Sheet lesen

| Property | Value |
|---|---|
| **ID** | `wf2-read-konfig` |
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

#### Node 4: Meta Ads Konfig lesen

| Property | Value |
|---|---|
| **ID** | `wf2-read-ads-konfig` |
| **Name** | `Meta Ads Konfig lesen` |
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
    "value": "={{ $json.body.sheet_url ?? 'GOOGLE_SHEET_URL_PLACEHOLDER' }}"
  },
  "sheetName": {
    "mode": "name",
    "value": "Meta Ads Konfig"
  },
  "options": {
    "range": "A:B"
  }
}
```

**Notes:**
- Reads key-value pairs from Tab 4 (Meta Ads Konfig).
- Uses the same Sheet URL as the Konfig tab (passed via webhook or placeholder).
- The `documentId` expression references the webhook body directly since this node is on the FALSE branch (standalone path).

---

#### Node 5: Konfig zusammenfuehren

| Property | Value |
|---|---|
| **ID** | `wf2-merge-config` |
| **Name** | `Konfig zusammenfuehren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[780, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Merge config from either Master (body.config) or Sheet reads.\n// Also merge Meta Ads specific config.\n\nconst webhookData = $('Webhook Trigger').first().json.body || {};\n\nlet config = {};\nlet metaAdsConfig = {};\n\nif (webhookData.config) {\n  // Master provided config\n  config = webhookData.config;\n  metaAdsConfig = webhookData.meta_ads_config || {};\n} else {\n  // Standalone: build config from Sheet rows\n  try {\n    const konfigRows = $('Konfig aus Sheet lesen').all();\n    for (const row of konfigRows) {\n      const key = (row.json['Einstellung'] || row.json['einstellung'] || '').trim();\n      const val = (row.json['Wert'] || row.json['wert'] || '').trim();\n      if (key) config[key] = val;\n    }\n  } catch (e) {\n    // Konfig sheet read may not have run (Master path)\n  }\n\n  try {\n    const adsRows = $('Meta Ads Konfig lesen').all();\n    for (const row of adsRows) {\n      const key = (row.json['Einstellung'] || row.json['einstellung'] || '').trim();\n      const val = (row.json['Wert'] || row.json['wert'] || '').trim();\n      if (key) metaAdsConfig[key] = val;\n    }\n  } catch (e) {\n    // Meta Ads Konfig sheet read may not have run (Master path)\n  }\n}\n\n// Calculate calendar week\nconst now = new Date();\nconst startOfYear = new Date(now.getFullYear(), 0, 1);\nconst days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));\nconst calendarWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);\n\nreturn [{\n  json: {\n    config,\n    metaAdsConfig,\n    projectName: config.project_name || 'unknown',\n    adAccountId: metaAdsConfig.ad_account_id || '',\n    campaignFilter: metaAdsConfig.campaign_filter || '',\n    dateRangeDays: parseInt(metaAdsConfig.date_range_days || '7'),\n    enabled: (metaAdsConfig.enabled || 'FALSE').toUpperCase() === 'TRUE',\n    calendarWeek,\n    year: now.getFullYear(),\n    timestamp: now.toISOString()\n  }\n}];"
}
```

---

#### Node 6: Meta Ads aktiv?

| Property | Value |
|---|---|
| **ID** | `wf2-ads-enabled` |
| **Name** | `Meta Ads aktiv?` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[1040, 460]` |

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
        "id": "ads-enabled",
        "leftValue": "={{ $json.enabled }}",
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
- **TRUE** (enabled === true) -- Proceed with Meta Ads analysis.
- **FALSE** (disabled) -- Return "skipped" response.

---

#### Node 7: Skipped Response

| Property | Value |
|---|---|
| **ID** | `wf2-skipped` |
| **Name** | `Skipped Response` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1300, 620]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "return [{\n  json: {\n    success: true,\n    workflow: 'WF2 Meta Ads Analyzer',\n    status: 'skipped',\n    reason: 'Meta Ads Modul ist deaktiviert (enabled=FALSE in Meta Ads Konfig)',\n    data: null,\n    errors: null,\n    timestamp: new Date().toISOString()\n  }\n}];"
}
```

---

#### Node 8: Skipped Webhook Antwort

| Property | Value |
|---|---|
| **ID** | `wf2-skipped-respond` |
| **Name** | `Skipped Webhook Antwort` |
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **typeVersion** | `1.1` |
| **Position** | `[1560, 620]` |

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

#### Node 9: API-Parameter vorbereiten

| Property | Value |
|---|---|
| **ID** | `wf2-prepare-api` |
| **Name** | `API-Parameter vorbereiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1300, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const input = $input.first().json;\nconst { adAccountId, campaignFilter, dateRangeDays, calendarWeek, year, projectName } = input;\n\nif (!adAccountId) {\n  throw new Error('ad_account_id fehlt in Meta Ads Konfig');\n}\n\n// Calculate date range\nconst endDate = new Date();\nconst startDate = new Date();\nstartDate.setDate(endDate.getDate() - dateRangeDays);\n\nconst formatDate = (d) => d.toISOString().split('T')[0];\n\n// Meta Marketing API fields\nconst campaignFields = [\n  'campaign_name', 'objective', 'status',\n  'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm',\n  'actions', 'action_values', 'reach', 'frequency'\n].join(',');\n\nconst adsetFields = [\n  'adset_name', 'campaign_name', 'status', 'targeting',\n  'spend', 'impressions', 'clicks', 'ctr', 'cpc',\n  'actions', 'reach', 'frequency'\n].join(',');\n\nconst adFields = [\n  'ad_name', 'adset_name', 'campaign_name', 'status',\n  'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm',\n  'actions', 'action_values', 'reach', 'frequency',\n  'publisher_platform'\n].join(',');\n\nreturn [{\n  json: {\n    adAccountId,\n    campaignFilter,\n    calendarWeek,\n    year,\n    projectName,\n    dateRangeStart: formatDate(startDate),\n    dateRangeEnd: formatDate(endDate),\n    timeRange: JSON.stringify({ since: formatDate(startDate), until: formatDate(endDate) }),\n    campaignFields,\n    adsetFields,\n    adFields\n  }\n}];"
}
```

---

#### Node 10: Kampagnen abrufen

| Property | Value |
|---|---|
| **ID** | `wf2-get-campaigns` |
| **Name** | `Kampagnen abrufen` |
| **Type** | `n8n-nodes-base.facebookGraphApi` |
| **typeVersion** | `1` |
| **Position** | `[1560, 460]` |
| **Credentials** | Facebook Graph API (facebookGraphApi) |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "hostUrl": "graph.facebook.com",
  "httpRequestMethod": "GET",
  "graphApiVersion": "v21.0",
  "node": "={{ $json.adAccountId }}",
  "edge": "insights",
  "options": {
    "queryParametersJson": "={{ JSON.stringify({ fields: $json.campaignFields, time_range: $json.timeRange, level: 'campaign', limit: '100' }) }}"
  }
}
```

**Notes:**
- `node` = Ad Account ID (e.g., `act_123456789`).
- `edge` = `insights` -- the Marketing API insights endpoint.
- Query params pass `level: 'campaign'` to get campaign-level breakdown.
- `time_range` is the JSON string `{"since":"2026-02-24","until":"2026-03-03"}`.
- If Meta OAuth is not yet set up, this node will fail gracefully (`onError: continueRegularOutput`).
- `graphApiVersion: "v21.0"` -- latest stable version.

---

#### Node 11: Anzeigengruppen abrufen

| Property | Value |
|---|---|
| **ID** | `wf2-get-adsets` |
| **Name** | `Anzeigengruppen abrufen` |
| **Type** | `n8n-nodes-base.facebookGraphApi` |
| **typeVersion** | `1` |
| **Position** | `[1820, 460]` |
| **Credentials** | Facebook Graph API (facebookGraphApi) |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "hostUrl": "graph.facebook.com",
  "httpRequestMethod": "GET",
  "graphApiVersion": "v21.0",
  "node": "={{ $('API-Parameter vorbereiten').first().json.adAccountId }}",
  "edge": "insights",
  "options": {
    "queryParametersJson": "={{ JSON.stringify({ fields: $('API-Parameter vorbereiten').first().json.adsetFields, time_range: $('API-Parameter vorbereiten').first().json.timeRange, level: 'adset', limit: '200' }) }}"
  }
}
```

---

#### Node 12: Anzeigen abrufen

| Property | Value |
|---|---|
| **ID** | `wf2-get-ads` |
| **Name** | `Anzeigen abrufen` |
| **Type** | `n8n-nodes-base.facebookGraphApi` |
| **typeVersion** | `1` |
| **Position** | `[2080, 460]` |
| **Credentials** | Facebook Graph API (facebookGraphApi) |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `15000` |

**Parameters:**
```json
{
  "hostUrl": "graph.facebook.com",
  "httpRequestMethod": "GET",
  "graphApiVersion": "v21.0",
  "node": "={{ $('API-Parameter vorbereiten').first().json.adAccountId }}",
  "edge": "insights",
  "options": {
    "queryParametersJson": "={{ JSON.stringify({ fields: $('API-Parameter vorbereiten').first().json.adFields, time_range: $('API-Parameter vorbereiten').first().json.timeRange, level: 'ad', limit: '500', breakdowns: 'publisher_platform' }) }}"
  }
}
```

**Notes:**
- `breakdowns: 'publisher_platform'` splits results by Facebook vs. Instagram.
- Limit 500 covers most ad accounts. For very large accounts, pagination would be needed (future enhancement).

---

#### Node 13: Ads-Daten konsolidieren

| Property | Value |
|---|---|
| **ID** | `wf2-consolidate` |
| **Name** | `Ads-Daten konsolidieren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2340, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Consolidate campaign, ad set, and ad data from the 3 Graph API calls.\n// Compute KPIs and identify top/bottom performers.\n\nconst apiParams = $('API-Parameter vorbereiten').first().json;\nconst { adAccountId, calendarWeek, year, projectName, dateRangeStart, dateRangeEnd } = apiParams;\n\n// Safely extract data from each Graph API node\nlet campaigns = [];\nlet adsets = [];\nlet ads = [];\n\ntry {\n  const campaignItems = $('Kampagnen abrufen').all();\n  campaigns = campaignItems\n    .map(i => i.json)\n    .filter(d => d && !d.error && d.campaign_name);\n} catch (e) {\n  campaigns = [];\n}\n\ntry {\n  const adsetItems = $('Anzeigengruppen abrufen').all();\n  adsets = adsetItems\n    .map(i => i.json)\n    .filter(d => d && !d.error && d.adset_name);\n} catch (e) {\n  adsets = [];\n}\n\ntry {\n  const adItems = $('Anzeigen abrufen').all();\n  ads = adItems\n    .map(i => i.json)\n    .filter(d => d && !d.error && d.ad_name);\n} catch (e) {\n  ads = [];\n}\n\n// Helper: safely parse number\nconst num = (v) => parseFloat(v) || 0;\n\n// Aggregate campaign-level KPIs\nconst totalSpend = campaigns.reduce((s, c) => s + num(c.spend), 0);\nconst totalImpressions = campaigns.reduce((s, c) => s + num(c.impressions), 0);\nconst totalClicks = campaigns.reduce((s, c) => s + num(c.clicks), 0);\nconst totalReach = campaigns.reduce((s, c) => s + num(c.reach), 0);\n\n// Extract conversions from actions array\nconst getConversions = (actions) => {\n  if (!Array.isArray(actions)) return 0;\n  const purchase = actions.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');\n  const lead = actions.find(a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead');\n  return num(purchase?.value) + num(lead?.value);\n};\n\nconst getConversionValue = (actionValues) => {\n  if (!Array.isArray(actionValues)) return 0;\n  const purchase = actionValues.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');\n  return num(purchase?.value);\n};\n\nconst totalConversions = campaigns.reduce((s, c) => s + getConversions(c.actions), 0);\nconst totalConversionValue = campaigns.reduce((s, c) => s + getConversionValue(c.action_values), 0);\n\nconst overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;\nconst overallCpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0;\nconst overallCpm = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000) : 0;\nconst overallRoas = totalSpend > 0 ? (totalConversionValue / totalSpend) : 0;\n\n// Rank ads by efficiency (spend-weighted CTR * ROAS or simple spend/conversions)\nconst rankedAds = ads\n  .map(ad => ({\n    name: ad.ad_name,\n    adsetName: ad.adset_name,\n    campaignName: ad.campaign_name,\n    platform: ad.publisher_platform || 'unknown',\n    spend: num(ad.spend),\n    impressions: num(ad.impressions),\n    clicks: num(ad.clicks),\n    ctr: num(ad.ctr),\n    cpc: num(ad.cpc),\n    conversions: getConversions(ad.actions),\n    conversionValue: getConversionValue(ad.action_values),\n    roas: num(ad.spend) > 0 ? (getConversionValue(ad.action_values) / num(ad.spend)) : 0\n  }))\n  .filter(ad => ad.spend > 0)\n  .sort((a, b) => b.roas - a.roas || b.ctr - a.ctr);\n\nconst top3 = rankedAds.slice(0, 3);\nconst bottom3 = rankedAds.slice(-3).reverse();\n\n// Platform split (Facebook vs Instagram)\nconst fbAds = ads.filter(a => (a.publisher_platform || '').toLowerCase() === 'facebook');\nconst igAds = ads.filter(a => (a.publisher_platform || '').toLowerCase() === 'instagram');\n\nconst fbSpend = fbAds.reduce((s, a) => s + num(a.spend), 0);\nconst fbImpressions = fbAds.reduce((s, a) => s + num(a.impressions), 0);\nconst igSpend = igAds.reduce((s, a) => s + num(a.spend), 0);\nconst igImpressions = igAds.reduce((s, a) => s + num(a.impressions), 0);\n\nreturn [{\n  json: {\n    adAccountId,\n    projectName,\n    calendarWeek,\n    year,\n    dateRangeStart,\n    dateRangeEnd,\n    summary: {\n      totalCampaigns: campaigns.length,\n      activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,\n      totalSpend: Math.round(totalSpend * 100) / 100,\n      totalImpressions,\n      totalClicks,\n      totalReach,\n      totalConversions,\n      totalConversionValue: Math.round(totalConversionValue * 100) / 100,\n      overallCtr: Math.round(overallCtr * 10000) / 10000,\n      overallCpc: Math.round(overallCpc * 100) / 100,\n      overallCpm: Math.round(overallCpm * 100) / 100,\n      overallRoas: Math.round(overallRoas * 10000) / 10000\n    },\n    top3Ads: top3,\n    bottom3Ads: bottom3,\n    platformSplit: {\n      facebook: { spend: Math.round(fbSpend * 100) / 100, impressions: fbImpressions },\n      instagram: { spend: Math.round(igSpend * 100) / 100, impressions: igImpressions }\n    },\n    rawCampaigns: campaigns,\n    rawAdsets: adsets,\n    rawAds: ads,\n    adsCount: ads.length,\n    hasData: campaigns.length > 0 || ads.length > 0\n  }\n}];"
}
```

---

#### Node 14: Claude Analyse

| Property | Value |
|---|---|
| **ID** | `wf2-claude-analysis` |
| **Name** | `Claude Analyse` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[2600, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `3` |
| **waitBetweenTries** | `10000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "https://api.anthropic.com/v1/messages",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "x-api-key",
        "value": "ANTHROPIC_API_KEY_PLACEHOLDER"
      },
      {
        "name": "anthropic-version",
        "value": "2023-06-01"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ model: 'claude-sonnet-4-5-20250514', max_tokens: 4096, temperature: 0.3, system: 'Du bist ein erfahrener Meta Ads Performance-Analyst. Antworte IMMER auf Deutsch. Formatiere deine Analyse als valides JSON-Objekt mit den Schlüsseln: zusammenfassung, top_3_analyse, bottom_3_analyse, budget_empfehlungen, targeting_empfehlungen, plattform_vergleich, action_items.', messages: [{ role: 'user', content: 'Analysiere die folgenden Meta Ads Kampagnendaten der letzten 7 Tage.\\n\\nGesamt-Performance:\\n' + JSON.stringify($json.summary, null, 2) + '\\n\\nTop 3 Anzeigen:\\n' + JSON.stringify($json.top3Ads, null, 2) + '\\n\\nBottom 3 Anzeigen:\\n' + JSON.stringify($json.bottom3Ads, null, 2) + '\\n\\nPlattform-Vergleich (Facebook vs Instagram):\\n' + JSON.stringify($json.platformSplit, null, 2) + '\\n\\nErstelle eine detaillierte Analyse auf Deutsch mit:\\n1. Gesamt-Performance-Zusammenfassung (Spend, ROAS, wichtigste KPIs)\\n2. Top 3 performende Anzeigen und warum sie gut laufen\\n3. Bottom 3 Anzeigen und Verbesserungsvorschlaege\\n4. Budget-Empfehlungen (welche Kampagnen skalieren, welche pausieren)\\n5. Targeting-Empfehlungen\\n6. Vergleich Instagram vs Facebook Performance\\n7. Konkrete Action Items fuer die naechste Woche\\n\\nFormatiere als JSON-Objekt.' }] }) }}",
  "options": {
    "timeout": 60000
  }
}
```

**Why HTTP Request instead of native Anthropic node:**
1. The `nodes-langchain.anthropic` node's `message` operation uses a `fixedCollection` for the messages parameter, which is difficult to populate dynamically with large embedded JSON data.
2. Direct API call gives full control over system prompt, temperature, and max_tokens.
3. The prompt needs to embed the full consolidated Ads data JSON, which is best handled in a single expression.
4. The `nodes-langchain.lmChatAnthropic` node is a LangChain sub-node that connects via `ai_languageModel` and requires an Agent or Chain parent -- not suitable for standalone use.

**Credential Note:** The `ANTHROPIC_API_KEY_PLACEHOLDER` must be replaced with a reference to the actual credential. In n8n, this can be done by using the HTTP Header Auth credential type with the API key stored there, or by using `$credentials` if the httpHeaderAuth credential is configured with the key name `x-api-key`.

**Alternative implementation:** Use `httpHeaderAuth` credential directly:
```json
{
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth"
}
```
And configure an HTTP Header Auth credential named "Anthropic API" with header name `x-api-key` and the API key value. Then remove the manual `x-api-key` header parameter.

---

#### Node 15: Analyse-Ergebnis verarbeiten

| Property | Value |
|---|---|
| **ID** | `wf2-process-analysis` |
| **Name** | `Analyse-Ergebnis verarbeiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2860, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Process Claude's analysis response and merge with consolidated data.\nconst adsData = $('Ads-Daten konsolidieren').first().json;\nconst claudeResponse = $input.first().json;\n\nlet analysisText = '';\nlet analysisJson = null;\n\ntry {\n  // Claude API response structure: { content: [{ type: 'text', text: '...' }] }\n  const content = claudeResponse.content;\n  if (Array.isArray(content) && content.length > 0) {\n    analysisText = content[0].text || '';\n  } else if (typeof claudeResponse === 'string') {\n    analysisText = claudeResponse;\n  } else if (claudeResponse.error) {\n    throw new Error(`Claude API Fehler: ${JSON.stringify(claudeResponse.error)}`);\n  }\n\n  // Try to parse as JSON (Claude was instructed to return JSON)\n  try {\n    // Remove markdown code fences if present\n    let cleanText = analysisText.trim();\n    if (cleanText.startsWith('```json')) {\n      cleanText = cleanText.replace(/^```json\\s*/, '').replace(/```\\s*$/, '');\n    } else if (cleanText.startsWith('```')) {\n      cleanText = cleanText.replace(/^```\\s*/, '').replace(/```\\s*$/, '');\n    }\n    analysisJson = JSON.parse(cleanText);\n  } catch (parseErr) {\n    // If JSON parsing fails, store as text only\n    analysisJson = { raw_text: analysisText, parse_error: parseErr.message };\n  }\n} catch (error) {\n  analysisText = `Analyse-Fehler: ${error.message}`;\n  analysisJson = { error: error.message };\n}\n\n// Build the Supabase record\nreturn [{\n  json: {\n    project_name: adsData.projectName,\n    calendar_week: adsData.calendarWeek,\n    year: adsData.year,\n    ad_account_id: adsData.adAccountId,\n    total_campaigns: adsData.summary.totalCampaigns,\n    active_campaigns: adsData.summary.activeCampaigns,\n    total_spend: adsData.summary.totalSpend,\n    total_impressions: adsData.summary.totalImpressions,\n    total_clicks: adsData.summary.totalClicks,\n    total_conversions: adsData.summary.totalConversions,\n    overall_ctr: adsData.summary.overallCtr,\n    overall_cpc: adsData.summary.overallCpc,\n    overall_cpm: adsData.summary.overallCpm,\n    overall_roas: adsData.summary.overallRoas,\n    top_3_ads: JSON.stringify(adsData.top3Ads),\n    bottom_3_ads: JSON.stringify(adsData.bottom3Ads),\n    facebook_spend: adsData.platformSplit.facebook.spend,\n    facebook_impressions: adsData.platformSplit.facebook.impressions,\n    instagram_spend: adsData.platformSplit.instagram.spend,\n    instagram_impressions: adsData.platformSplit.instagram.impressions,\n    analysis_text: analysisText,\n    analysis_json: JSON.stringify(analysisJson),\n    raw_campaigns: JSON.stringify(adsData.rawCampaigns),\n    raw_adsets: JSON.stringify(adsData.rawAdsets),\n    raw_ads: JSON.stringify(adsData.rawAds),\n    date_range_start: adsData.dateRangeStart,\n    date_range_end: adsData.dateRangeEnd,\n    collected_at: new Date().toISOString(),\n    data_source: 'wf2_meta_ads_analyzer'\n  }\n}];"
}
```

---

#### Node 16: Supabase Meta Ads UPSERT

| Property | Value |
|---|---|
| **ID** | `wf2-supabase-upsert` |
| **Name** | `Supabase Meta Ads UPSERT` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[3120, 460]` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/meta_ads_weekly' }}",
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
Same reason as WF1 -- the native `nodes-base.supabase` node does not support UPSERT. Supabase's PostgREST API supports UPSERT via `Prefer: resolution=merge-duplicates` header. The UNIQUE constraint `uq_meta_ads_weekly` on `(project_name, ad_account_id, calendar_week, year)` determines the merge key.

---

#### Node 17: Response zusammenbauen

| Property | Value |
|---|---|
| **ID** | `wf2-build-response` |
| **Name** | `Response zusammenbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3380, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const adsData = $('Ads-Daten konsolidieren').first().json;\nconst analysisResult = $('Analyse-Ergebnis verarbeiten').first().json;\n\nconst errors = [];\n\n// Check if we got actual data\nif (!adsData.hasData) {\n  errors.push({\n    source: 'meta_api',\n    message: 'Keine Kampagnendaten von Meta API erhalten. Moeglicherweise keine aktiven Kampagnen oder API-Zugriffsfehler.'\n  });\n}\n\n// Check if Claude analysis succeeded\nif (analysisResult.analysis_text && analysisResult.analysis_text.startsWith('Analyse-Fehler:')) {\n  errors.push({\n    source: 'claude_analysis',\n    message: analysisResult.analysis_text\n  });\n}\n\nreturn [{\n  json: {\n    success: errors.length === 0,\n    workflow: 'WF2 Meta Ads Analyzer',\n    status: errors.length === 0 ? 'success' : 'partial_success',\n    data: {\n      adAccountId: adsData.adAccountId,\n      dateRange: `${adsData.dateRangeStart} bis ${adsData.dateRangeEnd}`,\n      summary: adsData.summary,\n      top3Ads: adsData.top3Ads.map(a => a.name),\n      bottom3Ads: adsData.bottom3Ads.map(a => a.name),\n      platformSplit: adsData.platformSplit,\n      analysisAvailable: !analysisResult.analysis_text?.startsWith('Analyse-Fehler:'),\n      supabaseWritten: true\n    },\n    errors: errors.length > 0 ? errors : null,\n    timestamp: new Date().toISOString()\n  }\n}];"
}
```

---

#### Node 18: Webhook Antwort

| Property | Value |
|---|---|
| **ID** | `wf2-respond` |
| **Name** | `Webhook Antwort` |
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **typeVersion** | `1.1` |
| **Position** | `[3640, 460]` |

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

**Human-readable:**
```
Webhook Trigger --> Dual-Trigger Pruefung

Dual-Trigger Pruefung [TRUE]  --> Konfig zusammenfuehren
Dual-Trigger Pruefung [FALSE] --> Konfig aus Sheet lesen

Konfig aus Sheet lesen --> Meta Ads Konfig lesen
Meta Ads Konfig lesen --> Konfig zusammenfuehren

Konfig zusammenfuehren --> Meta Ads aktiv?

Meta Ads aktiv? [TRUE]  --> API-Parameter vorbereiten
Meta Ads aktiv? [FALSE] --> Skipped Response

Skipped Response --> Skipped Webhook Antwort

API-Parameter vorbereiten --> Kampagnen abrufen
Kampagnen abrufen --> Anzeigengruppen abrufen
Anzeigengruppen abrufen --> Anzeigen abrufen
Anzeigen abrufen --> Ads-Daten konsolidieren
Ads-Daten konsolidieren --> Claude Analyse
Claude Analyse --> Analyse-Ergebnis verarbeiten
Analyse-Ergebnis verarbeiten --> Supabase Meta Ads UPSERT
Supabase Meta Ads UPSERT --> Response zusammenbauen
Response zusammenbauen --> Webhook Antwort
```

**Connection JSON (n8n format):**
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
    "main": [[{ "node": "Meta Ads Konfig lesen", "type": "main", "index": 0 }]]
  },
  "Meta Ads Konfig lesen": {
    "main": [[{ "node": "Konfig zusammenfuehren", "type": "main", "index": 0 }]]
  },
  "Konfig zusammenfuehren": {
    "main": [[{ "node": "Meta Ads aktiv?", "type": "main", "index": 0 }]]
  },
  "Meta Ads aktiv?": {
    "main": [
      [{ "node": "API-Parameter vorbereiten", "type": "main", "index": 0 }],
      [{ "node": "Skipped Response", "type": "main", "index": 0 }]
    ]
  },
  "Skipped Response": {
    "main": [[{ "node": "Skipped Webhook Antwort", "type": "main", "index": 0 }]]
  },
  "API-Parameter vorbereiten": {
    "main": [[{ "node": "Kampagnen abrufen", "type": "main", "index": 0 }]]
  },
  "Kampagnen abrufen": {
    "main": [[{ "node": "Anzeigengruppen abrufen", "type": "main", "index": 0 }]]
  },
  "Anzeigengruppen abrufen": {
    "main": [[{ "node": "Anzeigen abrufen", "type": "main", "index": 0 }]]
  },
  "Anzeigen abrufen": {
    "main": [[{ "node": "Ads-Daten konsolidieren", "type": "main", "index": 0 }]]
  },
  "Ads-Daten konsolidieren": {
    "main": [[{ "node": "Claude Analyse", "type": "main", "index": 0 }]]
  },
  "Claude Analyse": {
    "main": [[{ "node": "Analyse-Ergebnis verarbeiten", "type": "main", "index": 0 }]]
  },
  "Analyse-Ergebnis verarbeiten": {
    "main": [[{ "node": "Supabase Meta Ads UPSERT", "type": "main", "index": 0 }]]
  },
  "Supabase Meta Ads UPSERT": {
    "main": [[{ "node": "Response zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Response zusammenbauen": {
    "main": [[{ "node": "Webhook Antwort", "type": "main", "index": 0 }]]
  }
}
```

---

### Error Handling Strategy

| Component | Strategy | Implementation |
|---|---|---|
| **Facebook Graph API Nodes** (3x) | `onError: continueRegularOutput` + `retryOnFail: true` | 3 retries, 15s wait (exponential backoff for rate limits) |
| **Consolidation Code Node** | try/catch per data source | Safely handles missing/empty data from any Graph API call |
| **Claude API Call** | `onError: continueRegularOutput` + `retryOnFail: true` | 3 retries, 10s wait. Fallback: error message in analysis_text |
| **Supabase UPSERT** | `retryOnFail: true` (2x, 3s) | DB-level retry |
| **Config Resolution** | try/catch in Code node | Handles both Master and standalone paths |
| **Module Disabled** | IF node bypass | Returns "skipped" status immediately |
| **Whole Workflow** | Structured response `{ success, status, data, errors }` | Response Code node |

### Data Flow Summary

```
Step 1: Webhook receives POST request
  Input: { config?, meta_ads_config?, sheet_url? }

Step 2: Config Resolution
  IF config provided -> use directly (Master path)
  ELSE -> Read Konfig tab + Meta Ads Konfig tab from Google Sheet
  Output: { config, metaAdsConfig, adAccountId, enabled, calendarWeek, year }

Step 3: Enabled Check
  IF enabled === false -> return "skipped" response, workflow ends
  IF enabled === true  -> continue

Step 4: API Parameter Preparation
  Input: config + meta ads config
  Output: { adAccountId, dateRangeStart, dateRangeEnd, timeRange, campaignFields, adsetFields, adFields }

Step 5: Meta Marketing API Calls (sequential)
  5a: GET /{adAccountId}/insights?level=campaign -> campaign-level data
  5b: GET /{adAccountId}/insights?level=adset -> ad set-level data
  5c: GET /{adAccountId}/insights?level=ad&breakdowns=publisher_platform -> ad-level data with FB/IG split

Step 6: Data Consolidation
  Input: raw campaigns + adsets + ads
  Compute: totalSpend, ROAS, CTR, CPC, CPM, top3, bottom3, platform split
  Output: { summary, top3Ads, bottom3Ads, platformSplit, rawCampaigns, rawAdsets, rawAds }

Step 7: Claude Analysis
  Input: summary + top3 + bottom3 + platform split (as JSON in prompt)
  System prompt: German-language Meta Ads analyst
  Output: Structured JSON analysis (zusammenfassung, empfehlungen, action_items, ...)

Step 8: Result Processing
  Merge Claude analysis with consolidated data
  Map to Supabase table schema (meta_ads_weekly)

Step 9: Supabase UPSERT
  UPSERT into meta_ads_weekly (merge on project_name + ad_account_id + calendar_week + year)

Step 10: Response
  Output: { success, workflow, status, data: { summary, top3, bottom3, platformSplit, analysisAvailable }, errors }
```

### Expressions Reference

| Node | Field | Expression |
|---|---|---|
| Dual-Trigger Pruefung | leftValue | `={{ $json.body.config }}` |
| Konfig aus Sheet lesen | documentId | `={{ $json.body.sheet_url ?? 'GOOGLE_SHEET_URL_PLACEHOLDER' }}` |
| Meta Ads Konfig lesen | documentId | `={{ $json.body.sheet_url ?? 'GOOGLE_SHEET_URL_PLACEHOLDER' }}` |
| Meta Ads aktiv? | leftValue | `={{ $json.enabled }}` |
| Kampagnen abrufen | node | `={{ $json.adAccountId }}` |
| Kampagnen abrufen | queryParametersJson | `={{ JSON.stringify({ fields: $json.campaignFields, time_range: $json.timeRange, level: 'campaign', limit: '100' }) }}` |
| Anzeigengruppen abrufen | node | `={{ $('API-Parameter vorbereiten').first().json.adAccountId }}` |
| Anzeigen abrufen | node | `={{ $('API-Parameter vorbereiten').first().json.adAccountId }}` |
| Claude Analyse | jsonBody | `={{ JSON.stringify({ model: '...', messages: [...] }) }}` |
| Supabase UPSERT | jsonBody | `={{ JSON.stringify($json) }}` |
| Webhook Antwort | responseBody | `={{ $json }}` |

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

## Node Summary

| # | Node Name | Type | typeVersion | Position | Credentials |
|---|---|---|---|---|---|
| 1 | Webhook Trigger | `n8n-nodes-base.webhook` | 2 | [260, 460] | - |
| 2 | Dual-Trigger Pruefung | `n8n-nodes-base.if` | 2.2 | [520, 460] | - |
| 3 | Konfig aus Sheet lesen | `n8n-nodes-base.googleSheets` | 4.7 | [780, 620] | Google Sheets OAuth2 |
| 4 | Meta Ads Konfig lesen | `n8n-nodes-base.googleSheets` | 4.7 | [1040, 620] | Google Sheets OAuth2 |
| 5 | Konfig zusammenfuehren | `n8n-nodes-base.code` | 2 | [780, 460] | - |
| 6 | Meta Ads aktiv? | `n8n-nodes-base.if` | 2.2 | [1040, 460] | - |
| 7 | Skipped Response | `n8n-nodes-base.code` | 2 | [1300, 620] | - |
| 8 | Skipped Webhook Antwort | `n8n-nodes-base.respondToWebhook` | 1.1 | [1560, 620] | - |
| 9 | API-Parameter vorbereiten | `n8n-nodes-base.code` | 2 | [1300, 460] | - |
| 10 | Kampagnen abrufen | `n8n-nodes-base.facebookGraphApi` | 1 | [1560, 460] | Facebook Graph API |
| 11 | Anzeigengruppen abrufen | `n8n-nodes-base.facebookGraphApi` | 1 | [1820, 460] | Facebook Graph API |
| 12 | Anzeigen abrufen | `n8n-nodes-base.facebookGraphApi` | 1 | [2080, 460] | Facebook Graph API |
| 13 | Ads-Daten konsolidieren | `n8n-nodes-base.code` | 2 | [2340, 460] | - |
| 14 | Claude Analyse | `n8n-nodes-base.httpRequest` | 4.4 | [2600, 460] | HTTP Header Auth (Anthropic) |
| 15 | Analyse-Ergebnis verarbeiten | `n8n-nodes-base.code` | 2 | [2860, 460] | - |
| 16 | Supabase Meta Ads UPSERT | `n8n-nodes-base.httpRequest` | 4.4 | [3120, 460] | HTTP Header Auth (Supabase) |
| 17 | Response zusammenbauen | `n8n-nodes-base.code` | 2 | [3380, 460] | - |
| 18 | Webhook Antwort | `n8n-nodes-base.respondToWebhook` | 1.1 | [3640, 460] | - |

**Total: 18 nodes**

---

## HTTP Request Justification

This workflow uses 2 HTTP Request nodes:

| Node | Reason |
|---|---|
| Claude Analyse | Dynamic prompt construction with embedded JSON data. The native `nodes-langchain.anthropic` node's `message` operation uses `fixedCollection` which cannot be dynamically populated with large JSON payloads. The `nodes-langchain.lmChatAnthropic` is a LangChain sub-node requiring an Agent/Chain parent. |
| Supabase UPSERT | Native `nodes-base.supabase` node lacks UPSERT operation. Supabase PostgREST API supports UPSERT via `Prefer: resolution=merge-duplicates` header (same pattern as WF1). |

---

## Requirements Coverage

| Requirement | Description | Coverage |
|---|---|---|
| **TRIG-02** | Jeder Sub-WF eigenstaendig per Webhook auslösbar | Webhook Trigger with `socialpulse-meta-ads` path |
| **TRIG-04** | Dual-Trigger-Logik | IF node checks `$json.body.config` existence |
| **DATA-04** | Meta Ads Konfig-Tab lesen | Google Sheets read Tab 4 (standalone) or config from Master |
| **API-07** | Meta Ads via Graph API | 3x Facebook Graph API nodes (campaigns, ad sets, ads) |
| **AI-02** | Meta Ads Performance-Analyse via Claude | HTTP Request to Anthropic Messages API with structured German prompt |
| **OUT-03** | Meta Ads-Daten in Supabase schreiben | HTTP Request UPSERT to `meta_ads_weekly` |
| **ERR-02** | Exponential Backoff Retry | `retryOnFail: true`, 15s wait on Graph API, 10s on Claude, 3s on Supabase |

---

## Validation Criteria

- [ ] All 18 nodes have valid type, typeVersion, position, and parameters
- [ ] All expressions use `={{ }}` syntax
- [ ] No `$node['Name'].json` patterns (use `$('Name').first().json`)
- [ ] Code nodes use `$input.first().json` (not `$json` directly)
- [ ] Code nodes return `[{ json: { ... } }]` format
- [ ] Connections reference nodes by `name` (not `id`)
- [ ] SplitInBatches not needed (linear flow, fixed number of API calls)
- [ ] HTTP Request nodes justified (Claude dynamic prompt + Supabase UPSERT)
- [ ] `onError: "continueRegularOutput"` on all external API nodes
- [ ] `retryOnFail: true` with appropriate `maxTries` and `waitBetweenTries`
- [ ] Node positions: no overlaps, 260px horizontal spacing, no [0,0]
- [ ] Workflow settings include `executionOrder: "v1"`
- [ ] Dual-trigger pattern matches WF1 (consistent across sub-workflows)
- [ ] Structured response format `{ success, workflow, status, data, errors }` matches WF1

---

## Open Items / Credentials Status

| Item | Status | Action Required |
|---|---|---|
| Facebook Graph API OAuth | Not yet configured | Must set up Meta Business Manager app + OAuth before testing Graph API nodes |
| Anthropic API Key | Available | Replace `ANTHROPIC_API_KEY_PLACEHOLDER` or configure HTTP Header Auth credential |
| Supabase URL + API Key | Available | Replace `SUPABASE_URL_PLACEHOLDER` and `SUPABASE_API_KEY_PLACEHOLDER` |
| Google Sheet URL | Available | Replace `GOOGLE_SHEET_URL_PLACEHOLDER` (same sheet as WF1) |
| `meta_ads_weekly` table | Placeholder exists | Execute full CREATE TABLE SQL from this plan |

---

*Plan created: 2026-03-03*
