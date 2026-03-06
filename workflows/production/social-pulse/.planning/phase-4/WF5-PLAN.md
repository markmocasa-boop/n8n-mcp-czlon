---
phase: 4
plan: 1
workflows: [WF5]
type: n8n-workflow
status: planned
created: 2026-03-03
---

# Phase 4 Plan: WF5 Report Generator

## Objective

Deploy WF5 Report Generator -- a workflow that loads all collected data from Supabase (performance, Meta Ads, competitors, content suggestions), calculates week-over-week comparisons and 4-week averages, generates a comprehensive German-language report narrative via Claude Sonnet 4.5, builds a professional HTML report with branded styling and trend indicators, converts it to PDF via an external HTML-to-PDF service, and returns the complete report data + HTML + PDF binary. The workflow must be triggerable both standalone (via its own Webhook) and from the Master Orchestrator (Phase 5).

---

## Pre-Workflow Tasks

### Task 1: Verify Supabase Tables Exist

All 5 tables must exist from prior phases. Verify via Supabase SQL Editor:

```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('performance_weekly', 'meta_ads_weekly', 'competitor_weekly', 'content_generated', 'workflow_runs');
```

Expected: 5 rows. If any are missing, re-run the CREATE TABLE statements from Phase 1/2/3 PLANs.

### Task 2: HTML-to-PDF Service Setup

WF5 uses an external HTML-to-PDF API. Options evaluated:

| Service | Free Tier | Complexity | Decision |
|---|---|---|---|
| `html2pdf.app` | 300 req/mo | Simple REST API | **Selected** |
| `n8n-nodes-htmlcsstopdf` community node | N/A | Community node, may not be installed | Alternative |
| Puppeteer in Code node | N/A | Not available on n8n Cloud | Rejected |
| PDFShift | 250 req/mo | Simple REST API | Backup |

**Decision**: Use `html2pdf.app` API via HTTP Request. Free tier (300 requests/month) is sufficient for weekly reports. The API accepts HTML string and returns PDF binary.

**Alternative**: If `html2pdf.app` is unavailable, switch to PDFShift (`https://api.pdfshift.io/v3/convert/pdf`).

**Setup**: Register at `https://html2pdf.app` and obtain an API key. Store as an HTTP Header Auth credential in n8n.

---

## WF5: Report Generator

### Overview

**Trigger**: Webhook (POST) -- accepts calls from the Master Orchestrator or standalone invocation.
**Purpose**: Generate a comprehensive weekly performance report comparing current week vs previous week + 4-week averages. Includes Claude AI narrative analysis with 7 report sections, professional HTML template, and PDF conversion.
**Error Handling**: Supabase reads use `onError: continueRegularOutput` + retry. Claude analysis failure falls back to data-only report. Structured `{ success, data, errors }` response.

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
                            Konfig zusammenfuehren
  |
  v
Code: KW + Zeitraum berechnen (current week, previous week, 4-week range)
  |
  v
HTTP Request: Supabase - Performance aktuelle KW laden
  |
  v
HTTP Request: Supabase - Performance Vorwoche laden
  |
  v
HTTP Request: Supabase - Performance 4-Wochen-Historie laden
  |
  v
HTTP Request: Supabase - Meta Ads aktuelle KW laden
  |
  v
HTTP Request: Supabase - Competitor Insights laden
  |
  v
HTTP Request: Supabase - Content-Vorschlaege laden
  |
  v
Code: Alle Daten zusammenfuehren + WoW + 4-Wochen-Durchschnitte berechnen
  |
  v
HTTP Request: Claude Report-Analyse (7 Sektionen, Deutsch)
  |
  v
Code: Claude-Ergebnis verarbeiten
  |
  v
Code: HTML-Report generieren (responsive Template mit Trend-Pfeilen + KPI-Tabellen)
  |
  v
HTTP Request: HTML zu PDF konvertieren
  |
  v
Code: Response zusammenbauen (report data + HTML + PDF info)
  |
  v
Respond to Webhook
```

### Architecture Decision: Sequential Linear Flow

WF5 has a fixed data-loading sequence followed by processing:
1. Load 6 data sources from Supabase (sequential to avoid overwhelming API)
2. Consolidate + calculate comparisons (1 Code node)
3. Claude analysis (1 API call)
4. HTML generation (1 Code node)
5. PDF conversion (1 API call)
6. Response

A linear chain is correct. No SplitInBatches or parallel branches needed.

### Architecture Decision: Supabase Reads via HTTP Request (GET)

The native `nodes-base.supabase` node supports `getAll` but lacks advanced query parameters (filtering by multiple columns with AND). We use HTTP Request with Supabase PostgREST GET endpoints that support `?column=eq.value&column2=eq.value2` query syntax for precise data retrieval.

### Architecture Decision: Claude via HTTP Request

Same rationale as WF2: dynamic prompt construction with large embedded data (full performance metrics for all platforms across multiple weeks). The Anthropic Messages API via HTTP Request gives full control.

---

### Nodes

#### Node 1: Webhook Trigger

| Property | Value |
|---|---|
| **ID** | `wf5-webhook` |
| **Name** | `Webhook Trigger` |
| **Type** | `n8n-nodes-base.webhook` |
| **typeVersion** | `2` |
| **Position** | `[260, 460]` |

**Parameters:**
```json
{
  "path": "socialpulse-report-generator",
  "httpMethod": "POST",
  "responseMode": "responseNode",
  "options": {}
}
```

**Notes:**
- `responseMode: "responseNode"` -- response sent by dedicated Respond to Webhook node.
- POST body from Master: `{ config: { project_name, brand_name, brand_colors, ... }, calendar_week, year }`.
- Standalone: `{ sheet_url: "..." }` or empty (uses hardcoded Sheet URL).

---

#### Node 2: Dual-Trigger Pruefung

| Property | Value |
|---|---|
| **ID** | `wf5-dual-trigger` |
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

---

#### Node 3: Konfig aus Sheet lesen

| Property | Value |
|---|---|
| **ID** | `wf5-read-konfig` |
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

#### Node 4: Konfig zusammenfuehren

| Property | Value |
|---|---|
| **ID** | `wf5-merge-config` |
| **Name** | `Konfig zusammenfuehren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[780, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Merge config from Master (body.config) or Sheet reads.\nconst webhookData = $('Webhook Trigger').first().json.body || {};\n\nlet config = {};\n\nif (webhookData.config) {\n  config = webhookData.config;\n} else {\n  try {\n    const konfigRows = $('Konfig aus Sheet lesen').all();\n    for (const row of konfigRows) {\n      const key = (row.json['Einstellung'] || row.json['einstellung'] || '').trim();\n      const val = (row.json['Wert'] || row.json['wert'] || '').trim();\n      if (key) config[key] = val;\n    }\n  } catch (e) {\n    // Sheet read may not have run (Master path)\n  }\n}\n\n// Parse active platforms\nconst activePlatforms = (config.active_platforms || '')\n  .split(',')\n  .map(p => p.trim())\n  .filter(p => p.length > 0);\n\n// Parse active modules\nconst activeModules = (config.active_modules || '')\n  .split(',')\n  .map(m => m.trim())\n  .filter(m => m.length > 0);\n\n// Calendar week: use provided or compute\nlet calendarWeek = webhookData.calendar_week;\nlet year = webhookData.year;\nif (!calendarWeek || !year) {\n  const now = new Date();\n  year = now.getFullYear();\n  // ISO week calculation\n  const jan1 = new Date(year, 0, 1);\n  const days = Math.floor((now - jan1) / (24 * 60 * 60 * 1000));\n  calendarWeek = Math.ceil((days + jan1.getDay() + 1) / 7);\n}\n\nreturn [{\n  json: {\n    config,\n    projectName: config.project_name || 'unknown',\n    brandName: config.brand_name || config.project_name || 'SocialPulse',\n    brandColors: (config.brand_colors || '#1a73e8, #ffffff').split(',').map(c => c.trim()),\n    brandTone: config.brand_tone || 'professionell, freundlich',\n    activePlatforms,\n    activeModules,\n    hasMetaAds: activeModules.includes('meta_ads'),\n    hasCompetitor: activeModules.includes('competitor'),\n    hasContent: activeModules.includes('content'),\n    calendarWeek: parseInt(calendarWeek),\n    previousWeek: parseInt(calendarWeek) > 1 ? parseInt(calendarWeek) - 1 : 52,\n    previousWeekYear: parseInt(calendarWeek) > 1 ? parseInt(year) : parseInt(year) - 1,\n    fourWeekStart: parseInt(calendarWeek) > 4 ? parseInt(calendarWeek) - 4 : 52 + parseInt(calendarWeek) - 4,\n    fourWeekStartYear: parseInt(calendarWeek) > 4 ? parseInt(year) : parseInt(year) - 1,\n    year: parseInt(year),\n    reportRecipients: (config.report_recipients || '').split(',').map(e => e.trim()).filter(e => e),\n    reportCc: (config.report_cc || '').split(',').map(e => e.trim()).filter(e => e),\n    timestamp: new Date().toISOString()\n  }\n}];"
}
```

---

#### Node 5: Performance aktuelle KW laden

| Property | Value |
|---|---|
| **ID** | `wf5-load-current` |
| **Name** | `Performance aktuelle KW laden` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1040, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/performance_weekly?project_name=eq.' + encodeURIComponent($json.projectName) + '&calendar_week=eq.' + $json.calendarWeek + '&year=eq.' + $json.year + '&select=*' }}",
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
      }
    ]
  },
  "options": {}
}
```

**Notes:**
- Returns array of performance records for all platforms for the current calendar week.
- PostgREST GET with query filters: `project_name=eq.X&calendar_week=eq.N&year=eq.Y`.

---

#### Node 6: Performance Vorwoche laden

| Property | Value |
|---|---|
| **ID** | `wf5-load-previous` |
| **Name** | `Performance Vorwoche laden` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1300, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/performance_weekly?project_name=eq.' + encodeURIComponent($('Konfig zusammenfuehren').first().json.projectName) + '&calendar_week=eq.' + $('Konfig zusammenfuehren').first().json.previousWeek + '&year=eq.' + $('Konfig zusammenfuehren').first().json.previousWeekYear + '&select=*' }}",
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
      }
    ]
  },
  "options": {}
}
```

---

#### Node 7: Performance 4-Wochen-Historie laden

| Property | Value |
|---|---|
| **ID** | `wf5-load-4weeks` |
| **Name** | `Performance 4-Wochen-Historie laden` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1560, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/performance_weekly?project_name=eq.' + encodeURIComponent($('Konfig zusammenfuehren').first().json.projectName) + '&year=eq.' + $('Konfig zusammenfuehren').first().json.year + '&calendar_week=gte.' + ($('Konfig zusammenfuehren').first().json.calendarWeek - 4) + '&calendar_week=lt.' + $('Konfig zusammenfuehren').first().json.calendarWeek + '&select=*&order=calendar_week.asc,platform.asc' }}",
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
      }
    ]
  },
  "options": {}
}
```

**Notes:**
- Retrieves all records for the 4 weeks before current week.
- Uses `gte` (>=) and `lt` (<) for range query.
- For year boundary cases (e.g., KW 2 wanting KW 50-53 of previous year), the Code node in Node 4 computed `fourWeekStart` and `fourWeekStartYear`. If year boundary is crossed, this single query won't work perfectly. The consolidation Code node (Node 11) handles this by also checking previous year data if needed.

---

#### Node 8: Meta Ads aktuelle KW laden

| Property | Value |
|---|---|
| **ID** | `wf5-load-meta-ads` |
| **Name** | `Meta Ads aktuelle KW laden` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1820, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/meta_ads_weekly?project_name=eq.' + encodeURIComponent($('Konfig zusammenfuehren').first().json.projectName) + '&calendar_week=eq.' + $('Konfig zusammenfuehren').first().json.calendarWeek + '&year=eq.' + $('Konfig zusammenfuehren').first().json.year + '&select=*' }}",
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
      }
    ]
  },
  "options": {}
}
```

---

#### Node 9: Competitor Insights laden

| Property | Value |
|---|---|
| **ID** | `wf5-load-competitors` |
| **Name** | `Competitor Insights laden` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[2080, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/competitor_weekly?project_name=eq.' + encodeURIComponent($('Konfig zusammenfuehren').first().json.projectName) + '&calendar_week=eq.' + $('Konfig zusammenfuehren').first().json.calendarWeek + '&year=eq.' + $('Konfig zusammenfuehren').first().json.year + '&select=*' }}",
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
      }
    ]
  },
  "options": {}
}
```

---

#### Node 10: Content-Vorschlaege laden

| Property | Value |
|---|---|
| **ID** | `wf5-load-content` |
| **Name** | `Content-Vorschlaege laden` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[2340, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `3000` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/content_generated?project_name=eq.' + encodeURIComponent($('Konfig zusammenfuehren').first().json.projectName) + '&calendar_week=eq.' + $('Konfig zusammenfuehren').first().json.calendarWeek + '&year=eq.' + $('Konfig zusammenfuehren').first().json.year + '&select=*' }}",
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
      }
    ]
  },
  "options": {}
}
```

---

#### Node 11: Daten konsolidieren + Vergleiche berechnen

| Property | Value |
|---|---|
| **ID** | `wf5-consolidate` |
| **Name** | `Daten konsolidieren + Vergleiche berechnen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2600, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// =================================================================\n// Consolidate all loaded data and compute WoW + 4-week averages\n// =================================================================\n\nconst configData = $('Konfig zusammenfuehren').first().json;\nconst { projectName, brandName, calendarWeek, year, activePlatforms, hasMetaAds, hasCompetitor, hasContent } = configData;\n\n// Helper: safely extract array from HTTP response\nconst safeArray = (nodeName) => {\n  try {\n    const items = $(nodeName).all();\n    // Supabase GET returns array directly or wrapped\n    if (items.length === 1 && Array.isArray(items[0].json)) {\n      return items[0].json;\n    }\n    return items.map(i => i.json).filter(d => d && !d.error);\n  } catch (e) {\n    return [];\n  }\n};\n\nconst currentWeekData = safeArray('Performance aktuelle KW laden');\nconst previousWeekData = safeArray('Performance Vorwoche laden');\nconst fourWeekHistory = safeArray('Performance 4-Wochen-Historie laden');\nconst metaAdsData = safeArray('Meta Ads aktuelle KW laden');\nconst competitorData = safeArray('Competitor Insights laden');\nconst contentData = safeArray('Content-Vorschlaege laden');\n\n// Helper: safely get number\nconst num = (v) => parseFloat(v) || 0;\n\n// Helper: compute percentage change\nconst pctChange = (current, previous) => {\n  if (previous === 0) return current > 0 ? 100 : 0;\n  return Math.round(((current - previous) / previous) * 10000) / 100;\n};\n\n// Helper: trend arrow\nconst trendArrow = (change) => {\n  if (change > 0) return { arrow: 'up', color: '#22c55e', symbol: '\\u2191' };\n  if (change < 0) return { arrow: 'down', color: '#ef4444', symbol: '\\u2193' };\n  return { arrow: 'flat', color: '#6b7280', symbol: '\\u2192' };\n};\n\n// ---- Build platform performance comparisons ----\nconst platformReports = [];\nconst metrics = ['followers', 'follower_growth', 'posts_published', 'impressions', 'reach', 'likes', 'comments', 'shares', 'engagement_rate', 'video_views', 'story_views', 'link_clicks'];\n\nfor (const platform of activePlatforms) {\n  const current = currentWeekData.find(d => d.platform === platform) || {};\n  const previous = previousWeekData.find(d => d.platform === platform) || {};\n\n  // 4-week history for this platform\n  const history = fourWeekHistory.filter(d => d.platform === platform);\n\n  // Compute 4-week averages\n  const fourWeekAvg = {};\n  for (const m of metrics) {\n    const values = history.map(h => num(h[m])).filter(v => v > 0);\n    fourWeekAvg[m] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100 : 0;\n  }\n\n  // Build comparison object\n  const comparison = {};\n  for (const m of metrics) {\n    const currentVal = num(current[m]);\n    const previousVal = num(previous[m]);\n    const avgVal = fourWeekAvg[m];\n    const change = pctChange(currentVal, previousVal);\n    comparison[m] = {\n      current: currentVal,\n      previous: previousVal,\n      fourWeekAvg: avgVal,\n      changeWoW: change,\n      changeVsAvg: pctChange(currentVal, avgVal),\n      trend: trendArrow(change)\n    };\n  }\n\n  platformReports.push({\n    platform,\n    hasCurrentData: Object.keys(current).length > 0,\n    hasPreviousData: Object.keys(previous).length > 0,\n    hasHistoryData: history.length > 0,\n    topPostUrl: current.top_post_url || '',\n    topPostEngagement: num(current.top_post_engagement),\n    worstPostUrl: current.worst_post_url || '',\n    worstPostEngagement: num(current.worst_post_engagement),\n    comparison\n  });\n}\n\n// ---- Cross-platform engagement ranking ----\nconst engagementRanking = platformReports\n  .filter(p => p.hasCurrentData)\n  .map(p => ({\n    platform: p.platform,\n    engagementRate: p.comparison.engagement_rate.current,\n    impressions: p.comparison.impressions.current,\n    reach: p.comparison.reach.current,\n    totalEngagements: p.comparison.likes.current + p.comparison.comments.current + p.comparison.shares.current\n  }))\n  .sort((a, b) => b.engagementRate - a.engagementRate);\n\nconst bestPlatform = engagementRanking.length > 0 ? engagementRanking[0] : null;\nconst worstPlatform = engagementRanking.length > 0 ? engagementRanking[engagementRanking.length - 1] : null;\n\n// ---- Cross-platform totals ----\nconst totalFollowers = platformReports.reduce((s, p) => s + p.comparison.followers.current, 0);\nconst totalImpressions = platformReports.reduce((s, p) => s + p.comparison.impressions.current, 0);\nconst totalReach = platformReports.reduce((s, p) => s + p.comparison.reach.current, 0);\nconst totalEngagements = platformReports.reduce((s, p) => s + p.comparison.likes.current + p.comparison.comments.current + p.comparison.shares.current, 0);\nconst avgEngagementRate = platformReports.length > 0\n  ? Math.round(platformReports.reduce((s, p) => s + p.comparison.engagement_rate.current, 0) / platformReports.length * 10000) / 10000\n  : 0;\n\n// ---- Meta Ads summary (if available) ----\nconst metaAdsSummary = metaAdsData.length > 0 ? {\n  available: true,\n  totalSpend: num(metaAdsData[0].total_spend),\n  totalImpressions: num(metaAdsData[0].total_impressions),\n  totalClicks: num(metaAdsData[0].total_clicks),\n  overallRoas: num(metaAdsData[0].overall_roas),\n  overallCtr: num(metaAdsData[0].overall_ctr),\n  overallCpc: num(metaAdsData[0].overall_cpc),\n  top3Ads: metaAdsData[0].top_3_ads ? (typeof metaAdsData[0].top_3_ads === 'string' ? JSON.parse(metaAdsData[0].top_3_ads) : metaAdsData[0].top_3_ads) : [],\n  analysisText: metaAdsData[0].analysis_text || ''\n} : { available: false };\n\n// ---- Competitor summary ----\nconst competitorSummary = competitorData.length > 0 ? {\n  available: true,\n  count: competitorData.length,\n  items: competitorData.slice(0, 10).map(c => ({\n    platform: c.platform,\n    name: c.competitor_name || c.name,\n    followers: num(c.followers),\n    topPostEngagement: num(c.top_post_engagement),\n    contentIdea: c.content_idea || c.content_idee || '',\n    sentiment: c.sentiment || ''\n  }))\n} : { available: false };\n\n// ---- Content suggestions summary ----\nconst contentSummary = contentData.length > 0 ? {\n  available: true,\n  count: contentData.length,\n  items: contentData.slice(0, 10).map(c => ({\n    platform: c.platform,\n    type: c.content_type || c.typ || '',\n    text: (c.text || '').substring(0, 200),\n    status: c.status || 'Entwurf'\n  }))\n} : { available: false };\n\nreturn [{\n  json: {\n    projectName,\n    brandName,\n    calendarWeek,\n    year,\n    previousWeek: configData.previousWeek,\n    previousWeekYear: configData.previousWeekYear,\n    activePlatforms,\n    platformReports,\n    crossPlatform: {\n      engagementRanking,\n      bestPlatform,\n      worstPlatform,\n      totalFollowers,\n      totalImpressions,\n      totalReach,\n      totalEngagements,\n      avgEngagementRate\n    },\n    metaAdsSummary,\n    competitorSummary,\n    contentSummary,\n    dataQuality: {\n      currentWeekPlatforms: currentWeekData.length,\n      previousWeekPlatforms: previousWeekData.length,\n      historyWeeks: [...new Set(fourWeekHistory.map(h => h.calendar_week))].length,\n      hasMetaAds: metaAdsData.length > 0,\n      hasCompetitorData: competitorData.length > 0,\n      hasContentData: contentData.length > 0\n    }\n  }\n}];"
}
```

---

#### Node 12: Claude Report-Analyse

| Property | Value |
|---|---|
| **ID** | `wf5-claude-report` |
| **Name** | `Claude Report-Analyse` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[2860, 460]` |
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
  "jsonBody": "={{ JSON.stringify({ model: 'claude-sonnet-4-5-20250514', max_tokens: 8192, temperature: 0.3, system: 'Du bist ein erfahrener Social Media Performance-Analyst und Report-Autor. Erstelle einen professionellen Wochenreport auf Deutsch. Formatiere deine Antwort als valides JSON-Objekt mit exakt diesen 7 Schluesseln:\\n\\n1. executive_summary (string): 3-5 Saetze Zusammenfassung der wichtigsten Erkenntnisse, Trends und Handlungsempfehlungen.\\n\\n2. platform_performance (array): Fuer jede Plattform ein Objekt mit: platform, headline (1 Satz), highlights (array von 2-3 Bullet Points), concerns (array von 0-2 Probleme), recommendation (1-2 Saetze).\\n\\n3. cross_platform_comparison (object): best_platform, worst_platform, key_insight (2-3 Saetze), engagement_trend (steigend/fallend/stabil), reach_trend (steigend/fallend/stabil).\\n\\n4. meta_ads_performance (object): available (boolean), summary (2-3 Saetze), top_ads_insight (string), budget_recommendation (string). Wenn keine Daten: available=false.\\n\\n5. competitor_analysis (object): available (boolean), key_findings (array von 2-3 Erkenntnissen), content_ideas (array von 2-3 abgeleiteten Ideen). Wenn keine Daten: available=false.\\n\\n6. content_recommendations (array): 3-5 konkrete Content-Vorschlaege mit: platform, type, topic, reasoning (warum dieser Content jetzt gut passt basierend auf den Daten).\\n\\n7. action_items (array): 5-7 priorisierte Aufgaben fuer die kommende Woche mit: priority (hoch/mittel/niedrig), task, reasoning.\\n\\nAntworte NUR mit dem JSON-Objekt, kein Markdown, kein erklaernder Text drumherum.', messages: [{ role: 'user', content: 'Erstelle den Wochenreport fuer ' + $json.brandName + ' (KW ' + $json.calendarWeek + '/' + $json.year + ').\\n\\n=== PLATTFORM-PERFORMANCE (Vergleich: aktuelle KW vs. Vorwoche + 4-Wochen-Durchschnitt) ===\\n' + JSON.stringify($json.platformReports, null, 2) + '\\n\\n=== CROSS-PLATFORM UEBERSICHT ===\\n' + JSON.stringify($json.crossPlatform, null, 2) + '\\n\\n=== META ADS PERFORMANCE ===\\n' + JSON.stringify($json.metaAdsSummary, null, 2) + '\\n\\n=== WETTBEWERBER-ANALYSE ===\\n' + JSON.stringify($json.competitorSummary, null, 2) + '\\n\\n=== CONTENT-VORSCHLAEGE (bereits generiert) ===\\n' + JSON.stringify($json.contentSummary, null, 2) + '\\n\\n=== DATENQUALITAET ===\\n' + JSON.stringify($json.dataQuality, null, 2) }] }) }}",
  "options": {
    "timeout": 120000
  }
}
```

**Notes:**
- `max_tokens: 8192` -- report narrative is comprehensive (7 sections).
- `timeout: 120000` -- 2 minutes for large report generation.
- The system prompt instructs Claude to return pure JSON with 7 keys matching the required report sections.
- All text in German as specified.

**Why HTTP Request instead of native Anthropic node:**
Same rationale as WF2. Dynamic prompt with large embedded JSON data. Full control over system prompt and structured output format.

---

#### Node 13: Claude-Ergebnis verarbeiten

| Property | Value |
|---|---|
| **ID** | `wf5-process-claude` |
| **Name** | `Claude-Ergebnis verarbeiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3120, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Process Claude report analysis response\nconst consolidatedData = $('Daten konsolidieren + Vergleiche berechnen').first().json;\nconst claudeResponse = $input.first().json;\n\nlet reportNarrative = null;\nlet rawText = '';\nlet parseError = null;\n\ntry {\n  // Claude API response: { content: [{ type: 'text', text: '...' }] }\n  const content = claudeResponse.content;\n  if (Array.isArray(content) && content.length > 0) {\n    rawText = content[0].text || '';\n  } else if (typeof claudeResponse === 'string') {\n    rawText = claudeResponse;\n  } else if (claudeResponse.error) {\n    throw new Error('Claude API Fehler: ' + JSON.stringify(claudeResponse.error));\n  }\n\n  // Parse JSON (remove markdown fences if present)\n  let cleanText = rawText.trim();\n  if (cleanText.startsWith('```json')) {\n    cleanText = cleanText.replace(/^```json\\s*/, '').replace(/```\\s*$/, '');\n  } else if (cleanText.startsWith('```')) {\n    cleanText = cleanText.replace(/^```\\s*/, '').replace(/```\\s*$/, '');\n  }\n  reportNarrative = JSON.parse(cleanText);\n} catch (error) {\n  parseError = error.message;\n  // Fallback: create minimal narrative from data\n  reportNarrative = {\n    executive_summary: 'Der automatische Report fuer ' + consolidatedData.brandName + ' KW ' + consolidatedData.calendarWeek + '/' + consolidatedData.year + ' konnte nicht vollstaendig generiert werden. Bitte pruefen Sie die Rohdaten unten.',\n    platform_performance: consolidatedData.activePlatforms.map(p => ({ platform: p, headline: 'Daten verfuegbar', highlights: ['Siehe KPI-Tabellen'], concerns: [], recommendation: 'Manuelle Analyse empfohlen.' })),\n    cross_platform_comparison: { best_platform: consolidatedData.crossPlatform.bestPlatform?.platform || 'n/a', worst_platform: consolidatedData.crossPlatform.worstPlatform?.platform || 'n/a', key_insight: 'Automatische Analyse nicht verfuegbar.', engagement_trend: 'unbekannt', reach_trend: 'unbekannt' },\n    meta_ads_performance: { available: consolidatedData.metaAdsSummary.available, summary: consolidatedData.metaAdsSummary.available ? 'Daten verfuegbar, manuelle Analyse empfohlen.' : 'Keine Meta Ads Daten.', top_ads_insight: '', budget_recommendation: '' },\n    competitor_analysis: { available: consolidatedData.competitorSummary.available, key_findings: [], content_ideas: [] },\n    content_recommendations: [],\n    action_items: [{ priority: 'hoch', task: 'Claude-Analyse pruefen -- automatische Generierung fehlgeschlagen', reasoning: parseError }]\n  };\n}\n\nreturn [{\n  json: {\n    ...consolidatedData,\n    reportNarrative,\n    claudeRawText: rawText,\n    claudeParseError: parseError\n  }\n}];"
}
```

---

#### Node 14: HTML-Report generieren

| Property | Value |
|---|---|
| **ID** | `wf5-html-report` |
| **Name** | `HTML-Report generieren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3380, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// =================================================================\n// Generate professional HTML report\n// =================================================================\n\nconst data = $input.first().json;\nconst { brandName, calendarWeek, year, previousWeek, brandColors, platformReports, crossPlatform, metaAdsSummary, competitorSummary, contentSummary, reportNarrative } = data;\n\nconst primaryColor = (brandColors && brandColors[0]) || '#1a73e8';\nconst secondaryColor = (brandColors && brandColors[1]) || '#ffffff';\n\n// Platform display names\nconst platformNames = {\n  instagram: 'Instagram',\n  facebook: 'Facebook',\n  tiktok: 'TikTok',\n  linkedin: 'LinkedIn',\n  youtube: 'YouTube',\n  x_twitter: 'X / Twitter'\n};\n\n// Platform icons (emoji fallback)\nconst platformIcons = {\n  instagram: '&#x1F4F7;',\n  facebook: '&#x1F4D8;',\n  tiktok: '&#x1F3B5;',\n  linkedin: '&#x1F4BC;',\n  youtube: '&#x25B6;&#xFE0F;',\n  x_twitter: '&#x1F426;'\n};\n\n// Helper: format number with locale\nconst fmt = (n) => {\n  if (n === null || n === undefined) return '-';\n  if (typeof n === 'number') {\n    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';\n    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';\n    return n.toLocaleString('de-DE');\n  }\n  return String(n);\n};\n\n// Helper: format percentage\nconst fmtPct = (n) => {\n  if (n === null || n === undefined) return '-';\n  const val = parseFloat(n);\n  return (val >= 0 ? '+' : '') + val.toFixed(2) + '%';\n};\n\n// Helper: trend HTML\nconst trendHtml = (change) => {\n  if (change > 0) return '<span style=\"color:#22c55e;font-weight:bold;\">&#9650; ' + fmtPct(change) + '</span>';\n  if (change < 0) return '<span style=\"color:#ef4444;font-weight:bold;\">&#9660; ' + fmtPct(change) + '</span>';\n  return '<span style=\"color:#6b7280;\">&#9654; 0%</span>';\n};\n\n// Helper: priority badge\nconst priorityBadge = (p) => {\n  const colors = { hoch: '#ef4444', mittel: '#f59e0b', niedrig: '#22c55e' };\n  return '<span style=\"background:' + (colors[p] || '#6b7280') + ';color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;\">' + (p || 'mittel').toUpperCase() + '</span>';\n};\n\n// ---- Build HTML ----\nlet html = `<!DOCTYPE html>\n<html lang=\"de\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>SocialPulse Report | ${brandName} | KW ${calendarWeek}/${year}</title>\n<style>\n  * { margin: 0; padding: 0; box-sizing: border-box; }\n  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif; background: #f3f4f6; color: #1f2937; line-height: 1.6; }\n  .container { max-width: 800px; margin: 0 auto; background: #fff; }\n  .header { background: ${primaryColor}; color: ${secondaryColor}; padding: 32px 40px; }\n  .header h1 { font-size: 28px; margin-bottom: 4px; }\n  .header .subtitle { font-size: 16px; opacity: 0.9; }\n  .section { padding: 24px 40px; border-bottom: 1px solid #e5e7eb; }\n  .section-title { font-size: 20px; color: ${primaryColor}; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid ${primaryColor}; }\n  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }\n  .kpi-card { background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb; }\n  .kpi-value { font-size: 24px; font-weight: 700; color: #1f2937; }\n  .kpi-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }\n  .kpi-trend { font-size: 13px; margin-top: 4px; }\n  table { width: 100%; border-collapse: collapse; margin: 12px 0; }\n  th { background: #f3f4f6; text-align: left; padding: 10px 12px; font-size: 13px; font-weight: 600; color: #4b5563; border-bottom: 2px solid #e5e7eb; }\n  td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }\n  tr:last-child td { border-bottom: none; }\n  .platform-section { margin-bottom: 20px; background: #f9fafb; border-radius: 8px; padding: 20px; border-left: 4px solid ${primaryColor}; }\n  .platform-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; }\n  .highlight { color: #059669; }\n  .concern { color: #dc2626; }\n  .bullet-list { padding-left: 20px; margin: 8px 0; }\n  .bullet-list li { margin-bottom: 4px; }\n  .action-item { display: flex; gap: 12px; align-items: flex-start; padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; }\n  .action-priority { flex-shrink: 0; }\n  .action-text { flex: 1; }\n  .action-text strong { display: block; margin-bottom: 2px; }\n  .action-text small { color: #6b7280; }\n  .footer { padding: 20px 40px; background: #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af; }\n  @media (max-width: 600px) {\n    .header, .section, .footer { padding-left: 20px; padding-right: 20px; }\n    .kpi-grid { grid-template-columns: repeat(2, 1fr); }\n  }\n</style>\n</head>\n<body>\n<div class=\"container\">\n\n<!-- HEADER -->\n<div class=\"header\">\n  <h1>SocialPulse Report</h1>\n  <div class=\"subtitle\">${brandName} | KW ${calendarWeek}/${year} (Vergleich: KW ${previousWeek})</div>\n</div>\n`;\n\n// ---- SECTION 1: Executive Summary ----\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">1. Executive Summary</h2>\n  <p style=\"font-size:15px;line-height:1.7;\">${reportNarrative.executive_summary || 'Keine Zusammenfassung verfuegbar.'}</p>\n</div>\\n`;\n\n// ---- Cross-Platform KPI Overview ----\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">Gesamt-KPIs (alle Plattformen)</h2>\n  <div class=\"kpi-grid\">\n    <div class=\"kpi-card\">\n      <div class=\"kpi-value\">${fmt(crossPlatform.totalFollowers)}</div>\n      <div class=\"kpi-label\">Followers gesamt</div>\n    </div>\n    <div class=\"kpi-card\">\n      <div class=\"kpi-value\">${fmt(crossPlatform.totalImpressions)}</div>\n      <div class=\"kpi-label\">Impressions</div>\n    </div>\n    <div class=\"kpi-card\">\n      <div class=\"kpi-value\">${fmt(crossPlatform.totalReach)}</div>\n      <div class=\"kpi-label\">Reach</div>\n    </div>\n    <div class=\"kpi-card\">\n      <div class=\"kpi-value\">${fmt(crossPlatform.totalEngagements)}</div>\n      <div class=\"kpi-label\">Engagements</div>\n    </div>\n    <div class=\"kpi-card\">\n      <div class=\"kpi-value\">${(crossPlatform.avgEngagementRate * 100).toFixed(2)}%</div>\n      <div class=\"kpi-label\">Avg. Engagement Rate</div>\n    </div>\n  </div>\n</div>\\n`;\n\n// ---- SECTION 2: Platform Performance ----\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">2. Plattform-Performance</h2>\\n`;\n\nfor (const pr of platformReports) {\n  const pName = platformNames[pr.platform] || pr.platform;\n  const pIcon = platformIcons[pr.platform] || '';\n  const narrative = (reportNarrative.platform_performance || []).find(p => p.platform === pr.platform) || {};\n  const c = pr.comparison;\n\n  html += `<div class=\"platform-section\">\n    <div class=\"platform-name\">${pIcon} ${pName}</div>\n    <p style=\"margin-bottom:12px;\">${narrative.headline || ''}</p>\n    <table>\n      <tr><th>Metrik</th><th>KW ${calendarWeek}</th><th>KW ${previousWeek}</th><th>4-Wo. Avg</th><th>WoW</th></tr>\n      <tr><td>Followers</td><td>${fmt(c.followers?.current)}</td><td>${fmt(c.followers?.previous)}</td><td>${fmt(c.followers?.fourWeekAvg)}</td><td>${trendHtml(c.followers?.changeWoW)}</td></tr>\n      <tr><td>Impressions</td><td>${fmt(c.impressions?.current)}</td><td>${fmt(c.impressions?.previous)}</td><td>${fmt(c.impressions?.fourWeekAvg)}</td><td>${trendHtml(c.impressions?.changeWoW)}</td></tr>\n      <tr><td>Reach</td><td>${fmt(c.reach?.current)}</td><td>${fmt(c.reach?.previous)}</td><td>${fmt(c.reach?.fourWeekAvg)}</td><td>${trendHtml(c.reach?.changeWoW)}</td></tr>\n      <tr><td>Likes</td><td>${fmt(c.likes?.current)}</td><td>${fmt(c.likes?.previous)}</td><td>${fmt(c.likes?.fourWeekAvg)}</td><td>${trendHtml(c.likes?.changeWoW)}</td></tr>\n      <tr><td>Kommentare</td><td>${fmt(c.comments?.current)}</td><td>${fmt(c.comments?.previous)}</td><td>${fmt(c.comments?.fourWeekAvg)}</td><td>${trendHtml(c.comments?.changeWoW)}</td></tr>\n      <tr><td>Shares</td><td>${fmt(c.shares?.current)}</td><td>${fmt(c.shares?.previous)}</td><td>${fmt(c.shares?.fourWeekAvg)}</td><td>${trendHtml(c.shares?.changeWoW)}</td></tr>\n      <tr><td>Engagement Rate</td><td>${(c.engagement_rate?.current * 100).toFixed(2)}%</td><td>${(c.engagement_rate?.previous * 100).toFixed(2)}%</td><td>${(c.engagement_rate?.fourWeekAvg * 100).toFixed(2)}%</td><td>${trendHtml(c.engagement_rate?.changeWoW)}</td></tr>\n    </table>`;\n\n  if (narrative.highlights && narrative.highlights.length > 0) {\n    html += `<p style=\"margin-top:8px;\"><strong class=\"highlight\">Highlights:</strong></p><ul class=\"bullet-list\">`;\n    for (const h of narrative.highlights) { html += '<li>' + h + '</li>'; }\n    html += '</ul>';\n  }\n  if (narrative.concerns && narrative.concerns.length > 0) {\n    html += `<p><strong class=\"concern\">Achtung:</strong></p><ul class=\"bullet-list\">`;\n    for (const c2 of narrative.concerns) { html += '<li>' + c2 + '</li>'; }\n    html += '</ul>';\n  }\n  if (narrative.recommendation) {\n    html += '<p style=\"margin-top:8px;\"><strong>Empfehlung:</strong> ' + narrative.recommendation + '</p>';\n  }\n  html += '</div>\\n';\n}\nhtml += '</div>\\n';\n\n// ---- SECTION 3: Cross-Platform Comparison ----\nconst xp = reportNarrative.cross_platform_comparison || {};\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">3. Cross-Platform-Vergleich</h2>\n  <div class=\"kpi-grid\">\n    <div class=\"kpi-card\" style=\"border-left:4px solid #22c55e;\">\n      <div class=\"kpi-label\">Beste Plattform</div>\n      <div class=\"kpi-value\" style=\"font-size:18px;\">${platformNames[xp.best_platform] || xp.best_platform || '-'}</div>\n    </div>\n    <div class=\"kpi-card\" style=\"border-left:4px solid #ef4444;\">\n      <div class=\"kpi-label\">Schwaechste Plattform</div>\n      <div class=\"kpi-value\" style=\"font-size:18px;\">${platformNames[xp.worst_platform] || xp.worst_platform || '-'}</div>\n    </div>\n    <div class=\"kpi-card\">\n      <div class=\"kpi-label\">Engagement-Trend</div>\n      <div class=\"kpi-value\" style=\"font-size:18px;\">${xp.engagement_trend || '-'}</div>\n    </div>\n    <div class=\"kpi-card\">\n      <div class=\"kpi-label\">Reach-Trend</div>\n      <div class=\"kpi-value\" style=\"font-size:18px;\">${xp.reach_trend || '-'}</div>\n    </div>\n  </div>\n  <p>${xp.key_insight || ''}</p>\n  <table style=\"margin-top:12px;\">\n    <tr><th>Plattform</th><th>Engagement Rate</th><th>Impressions</th><th>Reach</th></tr>`;\nfor (const er of (crossPlatform.engagementRanking || [])) {\n  html += `<tr><td>${platformNames[er.platform] || er.platform}</td><td>${(er.engagementRate * 100).toFixed(2)}%</td><td>${fmt(er.impressions)}</td><td>${fmt(er.reach)}</td></tr>`;\n}\nhtml += `</table>\n</div>\\n`;\n\n// ---- SECTION 4: Meta Ads ----\nconst maNarr = reportNarrative.meta_ads_performance || {};\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">4. Meta Ads Performance</h2>\\n`;\nif (metaAdsSummary.available) {\n  html += `<div class=\"kpi-grid\">\n    <div class=\"kpi-card\"><div class=\"kpi-value\">&euro;${fmt(metaAdsSummary.totalSpend)}</div><div class=\"kpi-label\">Spend</div></div>\n    <div class=\"kpi-card\"><div class=\"kpi-value\">${metaAdsSummary.overallRoas.toFixed(2)}x</div><div class=\"kpi-label\">ROAS</div></div>\n    <div class=\"kpi-card\"><div class=\"kpi-value\">${metaAdsSummary.overallCtr.toFixed(2)}%</div><div class=\"kpi-label\">CTR</div></div>\n    <div class=\"kpi-card\"><div class=\"kpi-value\">&euro;${metaAdsSummary.overallCpc.toFixed(2)}</div><div class=\"kpi-label\">CPC</div></div>\n  </div>\n  <p>${maNarr.summary || ''}</p>`;\n  if (maNarr.top_ads_insight) html += '<p style=\"margin-top:8px;\"><strong>Top Ads:</strong> ' + maNarr.top_ads_insight + '</p>';\n  if (maNarr.budget_recommendation) html += '<p><strong>Budget-Empfehlung:</strong> ' + maNarr.budget_recommendation + '</p>';\n} else {\n  html += '<p style=\"color:#6b7280;\">Keine Meta Ads Daten fuer diese Woche verfuegbar. Modul ist deaktiviert oder keine Kampagnen aktiv.</p>';\n}\nhtml += '</div>\\n';\n\n// ---- SECTION 5: Competitor Analysis ----\nconst compNarr = reportNarrative.competitor_analysis || {};\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">5. Wettbewerber-Analyse</h2>\\n`;\nif (competitorSummary.available) {\n  if (compNarr.key_findings && compNarr.key_findings.length > 0) {\n    html += '<p><strong>Wichtigste Erkenntnisse:</strong></p><ul class=\"bullet-list\">';\n    for (const f of compNarr.key_findings) { html += '<li>' + f + '</li>'; }\n    html += '</ul>';\n  }\n  if (compNarr.content_ideas && compNarr.content_ideas.length > 0) {\n    html += '<p style=\"margin-top:12px;\"><strong>Abgeleitete Content-Ideen:</strong></p><ul class=\"bullet-list\">';\n    for (const idea of compNarr.content_ideas) { html += '<li>' + idea + '</li>'; }\n    html += '</ul>';\n  }\n} else {\n  html += '<p style=\"color:#6b7280;\">Keine Wettbewerber-Daten fuer diese Woche verfuegbar.</p>';\n}\nhtml += '</div>\\n';\n\n// ---- SECTION 6: Content Recommendations ----\nconst contentRecs = reportNarrative.content_recommendations || [];\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">6. Content-Empfehlungen</h2>\\n`;\nif (contentRecs.length > 0) {\n  html += '<table><tr><th>Plattform</th><th>Typ</th><th>Thema</th><th>Begruendung</th></tr>';\n  for (const rec of contentRecs) {\n    html += `<tr><td>${platformNames[rec.platform] || rec.platform || '-'}</td><td>${rec.type || '-'}</td><td>${rec.topic || '-'}</td><td>${rec.reasoning || '-'}</td></tr>`;\n  }\n  html += '</table>';\n} else {\n  html += '<p style=\"color:#6b7280;\">Keine Content-Empfehlungen generiert.</p>';\n}\nhtml += '</div>\\n';\n\n// ---- SECTION 7: Action Items ----\nconst actions = reportNarrative.action_items || [];\nhtml += `<div class=\"section\">\n  <h2 class=\"section-title\">7. Action Items</h2>\\n`;\nif (actions.length > 0) {\n  for (const a of actions) {\n    html += `<div class=\"action-item\">\n      <div class=\"action-priority\">${priorityBadge(a.priority)}</div>\n      <div class=\"action-text\"><strong>${a.task || ''}</strong><small>${a.reasoning || ''}</small></div>\n    </div>`;\n  }\n} else {\n  html += '<p style=\"color:#6b7280;\">Keine Action Items generiert.</p>';\n}\nhtml += '</div>\\n';\n\n// ---- FOOTER ----\nhtml += `<div class=\"footer\">\n  <p>Generiert von SocialPulse | ${new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | Powered by n8n + Claude AI</p>\n</div>\n\n</div>\n</body>\n</html>`;\n\nreturn [{\n  json: {\n    ...data,\n    htmlReport: html,\n    reportSubject: 'SocialPulse Report | ' + brandName + ' | KW ' + calendarWeek + '/' + year\n  }\n}];"
}
```

**Notes:**
- Generates a complete self-contained HTML document with inline CSS (no external dependencies).
- Responsive design (max-width 800px, mobile breakpoints).
- Brand primary color from config applied to header and section titles.
- Trend indicators: green up-triangle, red down-triangle, gray right-triangle.
- KPI cards in grid layout.
- Full comparison tables (current vs previous vs 4-week avg) per platform.
- All 7 report sections from Claude narrative.
- German locale formatting.

---

#### Node 15: HTML zu PDF konvertieren

| Property | Value |
|---|---|
| **ID** | `wf5-html-to-pdf` |
| **Name** | `HTML zu PDF konvertieren` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[3640, 460]` |
| **onError** | `continueRegularOutput` |
| **retryOnFail** | `true` |
| **maxTries** | `2` |
| **waitBetweenTries** | `5000` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "https://html2pdf.app/api/v1/generate",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ html: $json.htmlReport, format: 'A4', margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }) }}",
  "options": {
    "response": {
      "response": {
        "responseFormat": "file"
      }
    },
    "timeout": 60000
  }
}
```

**Notes:**
- `responseFormat: "file"` -- tells n8n to treat the response as binary data (PDF).
- The binary data will be available as `$binary.data` for attachment in WF6.
- If html2pdf.app is unavailable, replace URL with `https://api.pdfshift.io/v3/convert/pdf` and adjust body format.
- Timeout 60s for PDF generation of a multi-page report.

**Alternative (PDFShift):**
```json
{
  "url": "https://api.pdfshift.io/v3/convert/pdf",
  "jsonBody": "={{ JSON.stringify({ source: $json.htmlReport, landscape: false, format: 'A4' }) }}"
}
```

---

#### Node 16: Response zusammenbauen

| Property | Value |
|---|---|
| **ID** | `wf5-build-response` |
| **Name** | `Response zusammenbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3900, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "const reportData = $('HTML-Report generieren').first().json;\nconst pdfResponse = $input.first().json;\n\nconst errors = [];\n\n// Check Claude parse error\nif (reportData.claudeParseError) {\n  errors.push({\n    source: 'claude_analysis',\n    message: 'Claude-Analyse konnte nicht als JSON geparst werden: ' + reportData.claudeParseError\n  });\n}\n\n// Check PDF generation\nlet pdfGenerated = false;\ntry {\n  const binaryData = $input.first().binary;\n  if (binaryData && binaryData.data) {\n    pdfGenerated = true;\n  }\n} catch (e) {\n  // No binary data\n}\nif (!pdfGenerated) {\n  // Check if PDF API returned error\n  if (pdfResponse && pdfResponse.error) {\n    errors.push({\n      source: 'pdf_generation',\n      message: 'PDF-Generierung fehlgeschlagen: ' + JSON.stringify(pdfResponse.error)\n    });\n  } else if (!pdfResponse || typeof pdfResponse === 'object' && Object.keys(pdfResponse).length === 0) {\n    errors.push({\n      source: 'pdf_generation',\n      message: 'PDF-Generierung: Keine Daten zurueckgegeben'\n    });\n  }\n}\n\nreturn [{\n  json: {\n    success: errors.length === 0,\n    workflow: 'WF5 Report Generator',\n    status: errors.length === 0 ? 'success' : 'partial_success',\n    data: {\n      reportSubject: reportData.reportSubject,\n      calendarWeek: reportData.calendarWeek,\n      year: reportData.year,\n      brandName: reportData.brandName,\n      platformsReported: reportData.activePlatforms,\n      sectionsGenerated: 7,\n      htmlLength: (reportData.htmlReport || '').length,\n      pdfGenerated,\n      reportRecipients: reportData.reportRecipients,\n      reportCc: reportData.reportCc,\n      crossPlatform: reportData.crossPlatform,\n      dataQuality: reportData.dataQuality,\n      // Pass full report data to WF6\n      htmlReport: reportData.htmlReport,\n      reportNarrative: reportData.reportNarrative\n    },\n    errors: errors.length > 0 ? errors : null,\n    timestamp: new Date().toISOString()\n  }\n}];"
}
```

---

#### Node 17: Webhook Antwort

| Property | Value |
|---|---|
| **ID** | `wf5-respond` |
| **Name** | `Webhook Antwort` |
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **typeVersion** | `1.1` |
| **Position** | `[4160, 460]` |

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

Konfig aus Sheet lesen --> Konfig zusammenfuehren

Konfig zusammenfuehren --> Performance aktuelle KW laden

Performance aktuelle KW laden --> Performance Vorwoche laden
Performance Vorwoche laden --> Performance 4-Wochen-Historie laden
Performance 4-Wochen-Historie laden --> Meta Ads aktuelle KW laden
Meta Ads aktuelle KW laden --> Competitor Insights laden
Competitor Insights laden --> Content-Vorschlaege laden

Content-Vorschlaege laden --> Daten konsolidieren + Vergleiche berechnen

Daten konsolidieren + Vergleiche berechnen --> Claude Report-Analyse
Claude Report-Analyse --> Claude-Ergebnis verarbeiten
Claude-Ergebnis verarbeiten --> HTML-Report generieren
HTML-Report generieren --> HTML zu PDF konvertieren
HTML zu PDF konvertieren --> Response zusammenbauen
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
    "main": [[{ "node": "Konfig zusammenfuehren", "type": "main", "index": 0 }]]
  },
  "Konfig zusammenfuehren": {
    "main": [[{ "node": "Performance aktuelle KW laden", "type": "main", "index": 0 }]]
  },
  "Performance aktuelle KW laden": {
    "main": [[{ "node": "Performance Vorwoche laden", "type": "main", "index": 0 }]]
  },
  "Performance Vorwoche laden": {
    "main": [[{ "node": "Performance 4-Wochen-Historie laden", "type": "main", "index": 0 }]]
  },
  "Performance 4-Wochen-Historie laden": {
    "main": [[{ "node": "Meta Ads aktuelle KW laden", "type": "main", "index": 0 }]]
  },
  "Meta Ads aktuelle KW laden": {
    "main": [[{ "node": "Competitor Insights laden", "type": "main", "index": 0 }]]
  },
  "Competitor Insights laden": {
    "main": [[{ "node": "Content-Vorschlaege laden", "type": "main", "index": 0 }]]
  },
  "Content-Vorschlaege laden": {
    "main": [[{ "node": "Daten konsolidieren + Vergleiche berechnen", "type": "main", "index": 0 }]]
  },
  "Daten konsolidieren + Vergleiche berechnen": {
    "main": [[{ "node": "Claude Report-Analyse", "type": "main", "index": 0 }]]
  },
  "Claude Report-Analyse": {
    "main": [[{ "node": "Claude-Ergebnis verarbeiten", "type": "main", "index": 0 }]]
  },
  "Claude-Ergebnis verarbeiten": {
    "main": [[{ "node": "HTML-Report generieren", "type": "main", "index": 0 }]]
  },
  "HTML-Report generieren": {
    "main": [[{ "node": "HTML zu PDF konvertieren", "type": "main", "index": 0 }]]
  },
  "HTML zu PDF konvertieren": {
    "main": [[{ "node": "Response zusammenbauen", "type": "main", "index": 0 }]]
  },
  "Response zusammenbauen": {
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
| 1 | Webhook Trigger | `n8n-nodes-base.webhook` | 2 | None | - |
| 2 | Dual-Trigger Pruefung | `n8n-nodes-base.if` | 2.2 | None | - |
| 3 | Konfig aus Sheet lesen | `n8n-nodes-base.googleSheets` | 4.7 | Google Sheets OAuth2 | - |
| 4 | Konfig zusammenfuehren | `n8n-nodes-base.code` | 2 | None | - |
| 5 | Performance aktuelle KW laden | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Supabase) | onError: continueRegularOutput, retry 2x/3s |
| 6 | Performance Vorwoche laden | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Supabase) | onError: continueRegularOutput, retry 2x/3s |
| 7 | Performance 4-Wochen-Historie laden | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Supabase) | onError: continueRegularOutput, retry 2x/3s |
| 8 | Meta Ads aktuelle KW laden | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Supabase) | onError: continueRegularOutput, retry 2x/3s |
| 9 | Competitor Insights laden | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Supabase) | onError: continueRegularOutput, retry 2x/3s |
| 10 | Content-Vorschlaege laden | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Supabase) | onError: continueRegularOutput, retry 2x/3s |
| 11 | Daten konsolidieren + Vergleiche berechnen | `n8n-nodes-base.code` | 2 | None | - |
| 12 | Claude Report-Analyse | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (Anthropic) | onError: continueRegularOutput, retry 3x/10s |
| 13 | Claude-Ergebnis verarbeiten | `n8n-nodes-base.code` | 2 | None | - |
| 14 | HTML-Report generieren | `n8n-nodes-base.code` | 2 | None | - |
| 15 | HTML zu PDF konvertieren | `n8n-nodes-base.httpRequest` | 4.4 | HTTP Header Auth (html2pdf.app) | onError: continueRegularOutput, retry 2x/5s |
| 16 | Response zusammenbauen | `n8n-nodes-base.code` | 2 | None | - |
| 17 | Webhook Antwort | `n8n-nodes-base.respondToWebhook` | 1.1 | None | - |

**Total: 17 nodes**

---

## HTTP Request Justifications

| Node | Why HTTP Request | Native Alternative |
|---|---|---|
| Supabase reads (5-10) | Native `nodes-base.supabase` has `getAll` but lacks multi-column filter queries with `gte`/`lt` range operators needed for 4-week history | `nodes-base.supabase` (insufficient query support) |
| Claude Report-Analyse | Dynamic prompt with large embedded JSON (6 data sections). Native `nodes-langchain.anthropic` uses fixedCollection for messages, hard to populate dynamically | `nodes-langchain.anthropic` (fixedCollection limitation) |
| HTML-to-PDF | No native n8n node for HTML-to-PDF conversion. External API required | None available |

---

## Data Flow

### Input (Webhook POST body)

**From Master:**
```json
{
  "config": {
    "project_name": "MeinProjekt",
    "brand_name": "MeineMarke",
    "brand_colors": "#1a73e8, #ffffff",
    "active_platforms": "instagram, facebook, tiktok, linkedin, youtube, x_twitter",
    "active_modules": "performance, meta_ads, competitor, content, report",
    "report_recipients": "team@example.com",
    "report_cc": ""
  },
  "calendar_week": 10,
  "year": 2026
}
```

**Standalone:**
```json
{
  "sheet_url": "https://docs.google.com/spreadsheets/d/..."
}
```

### Output (Webhook Response)

```json
{
  "success": true,
  "workflow": "WF5 Report Generator",
  "status": "success",
  "data": {
    "reportSubject": "SocialPulse Report | MeineMarke | KW 10/2026",
    "calendarWeek": 10,
    "year": 2026,
    "brandName": "MeineMarke",
    "platformsReported": ["instagram", "facebook", "tiktok", "linkedin", "youtube", "x_twitter"],
    "sectionsGenerated": 7,
    "htmlLength": 45000,
    "pdfGenerated": true,
    "reportRecipients": ["team@example.com"],
    "reportCc": [],
    "htmlReport": "<!DOCTYPE html>...",
    "reportNarrative": { "executive_summary": "...", "..." : "..." },
    "crossPlatform": { "..." : "..." },
    "dataQuality": { "..." : "..." }
  },
  "errors": null,
  "timestamp": "2026-03-03T09:15:00.000Z"
}
```

**Note:** The response includes `htmlReport` (full HTML string) and binary PDF data. The Master passes both to WF6 for email sending.

---

## Requirements Coverage

| Requirement | Status | Implementation |
|---|---|---|
| DATA-06 | Covered | Node 11: WoW comparison computed for all metrics per platform |
| DATA-07 | Covered | Node 11: 4-week averages computed from historical Supabase data |
| DATA-08 | Covered | Node 11: Cross-platform aggregation (engagement ranking, totals, best/worst) |
| AI-04 | Covered | Node 12: Claude generates 7-section report narrative in German |
| OUT-07 | Covered | Node 14: Professional HTML report with brand colors, trend arrows, KPI tables, responsive design |
| OUT-08 | Covered | Node 15: PDF generated via html2pdf.app API |
| TRIG-02 | Covered | Node 1: Standalone webhook trigger at `/socialpulse-report-generator` |
| TRIG-04 | Covered | Nodes 2-4: Dual-trigger logic (Master config vs Sheet read) |
| ERR-02 | Covered | All HTTP Request nodes: retryOnFail with appropriate delays |
| ERR-03 | Covered | Node 16: Structured `{ success, data, errors }` response |

---

## Validation Criteria

- [ ] All 17 nodes have correct typeVersions
- [ ] All expressions use `={{ }}` syntax
- [ ] Code nodes use `$input.first().json` and `$('NodeName').first().json`
- [ ] All Supabase HTTP Request nodes have retry + onError
- [ ] Claude HTTP Request has retry 3x/10s + onError + 120s timeout
- [ ] HTML-to-PDF HTTP Request has retry 2x/5s + onError + 60s timeout
- [ ] No native node alternatives missed (all HTTP Request usage justified)
- [ ] Connection JSON references nodes by name
- [ ] Workflow settings include `executionOrder: "v1"`
- [ ] Claude system prompt requests structured JSON with 7 exact keys
- [ ] HTML report is self-contained (inline CSS, no external resources)
- [ ] Response includes full report data for WF6 consumption
- [ ] All placeholders documented (SUPABASE_URL, SUPABASE_API_KEY, ANTHROPIC_API_KEY, GOOGLE_SHEET_URL)

---
*Plan created: 2026-03-03*
