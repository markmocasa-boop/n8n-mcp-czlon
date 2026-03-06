---
phase: 3
plan: WF4
workflows: [WF4]
type: n8n-workflow
status: planned
created: 2026-03-03
---

# Phase 3 Plan: WF4 Content Creator

## Objective

Deploy WF4 Content Creator -- a workflow that generates platform-specific social media content (text via Claude Sonnet 4.5, images via Imagen 4, video concepts via Veo 3) based on current performance data and competitor insights. For each active platform, it generates optimized text content with platform-specific rules (character limits, hashtags, CTAs, tone), plus visual assets at the correct resolution. Results are stored in Supabase `content_generated` and Google Sheet "Content Plan" tab. All output is in German.

The workflow follows the same architectural patterns as WF1/WF3 (dual-trigger, SplitInBatches per platform, `$getWorkflowStaticData('global')` for result accumulation, error isolation per platform, structured `{ success, data, errors }` response).

---

## Pre-Workflow Task: Supabase Schema Update

The `content_generated` table was created as a placeholder in Phase 1. It must now be updated with the full schema.

Execute via Supabase SQL Editor:

```sql
-- =============================================================
-- Drop and recreate content_generated with full schema
-- =============================================================

DROP TABLE IF EXISTS content_generated;

CREATE TABLE content_generated (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),

  -- Platform and content identity
  platform              TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x_twitter')),
  content_type          TEXT NOT NULL CHECK (content_type IN ('feed_post', 'reel', 'story', 'short', 'tweet', 'article')),

  -- Text content
  caption               TEXT,
  hashtags              TEXT[],
  cta_text              TEXT,

  -- Platform-specific fields
  char_count            INTEGER DEFAULT 0,
  hashtag_count         INTEGER DEFAULT 0,

  -- Media references
  image_prompt          TEXT,
  image_url             TEXT,
  image_base64          TEXT,
  image_resolution      TEXT,
  video_prompt          TEXT,
  video_url             TEXT,
  video_concept         TEXT,
  video_duration_target TEXT,
  video_format          TEXT,

  -- Generation context
  performance_context   JSONB,
  competitor_context    JSONB,
  generation_prompt     TEXT,

  -- Claude analysis metadata
  tone_description      TEXT,
  target_audience       TEXT,
  content_theme         TEXT,

  -- Status
  status                TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'published')),
  quality_score         NUMERIC(3,1),

  -- Metadata
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf4_content_creator',
  raw_claude_response   JSONB,
  raw_imagen_response   JSONB,
  raw_veo_response      JSONB,

  -- UPSERT constraint
  CONSTRAINT uq_content_generated
    UNIQUE (project_name, platform, content_type, calendar_week, year)
);

CREATE INDEX IF NOT EXISTS idx_content_project_platform
  ON content_generated (project_name, platform);
CREATE INDEX IF NOT EXISTS idx_content_kw_year
  ON content_generated (calendar_week, year);
CREATE INDEX IF NOT EXISTS idx_content_status
  ON content_generated (status);
```

---

## WF4: Content Creator

### Overview

**Trigger**: Webhook (POST) -- accepts calls from the Master Orchestrator or standalone invocation.
**Purpose**: Generate platform-specific content (text + images + video concepts) for all active platforms. Text via Claude Sonnet 4.5, images via Imagen 4 (Gemini API), video concepts via Veo 3 (Gemini API). Content is data-driven: uses performance data from Supabase and competitor insights to inform content strategy.
**Error Handling**: Each platform processes in its own SplitInBatches iteration with error isolation. A failing platform does not block the others. Media generation failures produce text-only fallback content. Structured `{ success, data, errors }` response.

### Requirements Coverage

| Requirement | How Covered |
|---|---|
| TRIG-02 | Webhook trigger, reads own config from Google Sheet when standalone |
| TRIG-04 | Dual-trigger IF node: checks `$json.body.config` existence |
| API-10 | Imagen 4 via HTTP Request to Gemini API -- IG 1080x1350, FB 1080x1350, LI 1200x627, X 1600x900 |
| API-11 | Veo 3 via HTTP Request to Gemini API -- 9:16 for TikTok (15-30s) and YouTube Shorts (15-60s) |
| AI-01 | Claude Sonnet 4.5 via HTTP Request (Anthropic Messages API) -- per-platform content with platform-specific rules |
| OUT-05 | Writes to Supabase `content_generated` (UPSERT) + Google Sheet "Content Plan" tab |

### High-Level Flow

```
Webhook Trigger (POST)
  |
  v
IF: Dual-Trigger Pruefung (config in body?)
  |
  +-- TRUE  --> Konfig zusammenfuehren
  +-- FALSE --> Sheets: Konfig lesen --> Konfig zusammenfuehren
  |
  v
Code: Performance + Competitor Daten laden
  (reads from Supabase via HTTP Request, or uses data passed by Master)
  |
  v
HTTP: Supabase Performance lesen
  |
  v
HTTP: Supabase Competitor lesen
  |
  v
Code: Platform Dispatcher
  (creates 1 item per active platform with platform-specific rules)
  |
  v
SplitInBatches (batchSize=1, sequential for API rate management)
  |
  +-- [Output 1: loop] --> Code: Claude Prompt aufbauen
  |     |
  |     v
  |   HTTP: Claude Content generieren (Anthropic Messages API)
  |     |
  |     v
  |   Code: Claude Response parsen
  |     |
  |     v
  |   IF: Braucht Bild?
  |     |
  |     +-- TRUE  --> HTTP: Imagen 4 Bild generieren
  |     |               |
  |     |               v
  |     |            Code: Bild-Response parsen
  |     |               |
  |     +-- FALSE ------+
  |     |               |
  |     v               v
  |   IF: Braucht Video?
  |     |
  |     +-- TRUE  --> HTTP: Veo 3 Video generieren
  |     |               |
  |     |               v
  |     |            Wait: Veo 3 Processing (60s)
  |     |               |
  |     |               v
  |     |            HTTP: Veo 3 Ergebnis abrufen
  |     |               |
  |     |               v
  |     |            Code: Video-Response parsen
  |     |               |
  |     +-- FALSE ------+
  |     |               |
  |     v               v
  |   Code: Ergebnis sammeln (staticData)
  |     |
  |     v
  |   Wait: API Pause (3s)
  |     |
  |     v
  |   Loop back to SplitInBatches
  |
  +-- [Output 0: done] --> Code: Ergebnisse aufbereiten
                              |
                              v
                           HTTP: Supabase UPSERT (content_generated)
                              |
                              v
                           Sheets: Content Plan schreiben
                              |
                              v
                           Code: Response zusammenbauen
                              |
                              v
                           Respond to Webhook
```

### Architecture Decisions

**1. SplitInBatches with batchSize=1 (same as WF1/WF3)**
- 6 possible platforms, each needs 1-3 API calls (Claude + optionally Imagen + optionally Veo)
- Sequential processing avoids API rate limit issues
- Each iteration: prompt build -> Claude -> optionally Imagen -> optionally Veo -> collect -> 3s wait

**2. Claude via HTTP Request (Anthropic Messages API)**
- Same pattern as WF2: dynamic prompt with embedded performance/competitor data
- Uses `https://api.anthropic.com/v1/messages` with `x-api-key` header
- Full control over system message, max_tokens, temperature
- Platform-specific prompts are dynamically constructed per iteration

**3. Imagen 4 via HTTP Request (Google Gemini REST API)**
- No native n8n node for Imagen 4 image generation (the `nodes-langchain.googleGemini` node handles text, not image generation)
- API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/imagen-4:generateImages`
- Authentication via API key in query parameter (`?key=GEMINI_API_KEY`)
- Request body includes `prompt`, `config.numberOfImages`, `config.outputOptions.mimeType`
- Response contains base64-encoded image data
- Platform-specific resolutions set via prompt engineering (Imagen 4 generates images based on prompt; aspect ratios guided by prompt)

**4. Veo 3 via HTTP Request (Google Gemini REST API)**
- No native n8n node for Veo 3 video generation
- Veo 3 is asynchronous: submit job -> poll for result
- API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideos`
- Authentication via API key in query parameter (`?key=GEMINI_API_KEY`)
- Uses Wait node (60s) between submit and poll
- Returns video URL or base64 data
- Video concepts include: aspect ratio (9:16), duration target, style direction

**5. Media type routing via IF nodes (not Switch)**
- Simple boolean checks: "needs image?" and "needs video?" based on platform
- Platforms needing images: instagram, facebook, linkedin, x_twitter
- Platforms needing video: tiktok, youtube
- Merge nodes reunite the branches before result collection

**6. Supabase reads for context data**
- Performance data: reads latest `performance_weekly` for the current project + current KW
- Competitor data: reads latest `competitor_weekly` for the current project + current KW
- Both via HTTP Request to Supabase REST API (same pattern as UPSERT)
- If Master provides the data in the webhook body, Supabase reads are skipped

**7. Result accumulation via `$getWorkflowStaticData('global')`**
- Same proven pattern as WF1/WF3
- Collects generated content across all SplitInBatches iterations
- Final aggregation after all batches complete

---

### Platform-Specific Content Rules

These rules are embedded in the Claude prompt dynamically based on which platform is being processed.

| Platform | Content Type | Image Resolution | Text Rules | Hashtags | Special |
|---|---|---|---|---|---|
| Instagram | Feed Post + Reel Concept | 1080x1350 | Max 125 chars caption | 3-5 | CTA in first line, Reel concept description |
| Facebook | Post | 1080x1350 | 40-80 chars text | Max 1-2 | Conversational tone, question or story |
| TikTok | Video Concept (9:16) | -- (video only) | Keyword-rich caption | 3-5 trending | 15-30s video concept, hook in first 3s |
| LinkedIn | Text Post + Image | 1200x627 | Under 140 chars before "more" | 2-3 | Professional tone, thought leadership |
| YouTube | Short Concept (9:16) | -- (video only) | Max 70 chars title | -- | 15-60s concept, keyword-rich description |
| X/Twitter | Tweet + Image | 1600x900 | 70-100 chars | 1-2 | Punchy, opinionated, conversation starter |

---

### Nodes

Total: 28 nodes

---

#### Node 1: Webhook Trigger

| Property | Value |
|---|---|
| **ID** | `wf4-webhook` |
| **Name** | `Webhook Trigger` |
| **Type** | `n8n-nodes-base.webhook` |
| **typeVersion** | `2` |
| **Position** | `[260, 460]` |

**Parameters:**
```json
{
  "path": "socialpulse-content",
  "httpMethod": "POST",
  "responseMode": "responseNode",
  "options": {}
}
```

**Notes:**
- `responseMode: "responseNode"` -- response sent by dedicated Respond to Webhook node at the end.
- POST body from Master: `{ config: { ... }, performance_data: [...], competitor_data: [...] }`
- Standalone call body: `{ sheet_url: "..." }` or empty (uses hardcoded Sheet URL).

---

#### Node 2: Dual-Trigger Pruefung

| Property | Value |
|---|---|
| **ID** | `wf4-dual-trigger` |
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
- **TRUE**: Master called with `{ config, performance_data, competitor_data }` in body. Skip Sheet reads + Supabase reads.
- **FALSE**: Standalone call. Must read Konfig tab + fetch data from Supabase.

---

#### Node 3: Konfig aus Sheet lesen

| Property | Value |
|---|---|
| **ID** | `wf4-read-konfig` |
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

**Connects from:** Dual-Trigger Pruefung (FALSE output)

---

#### Node 4: Konfig zusammenfuehren

| Property | Value |
|---|---|
| **ID** | `wf4-merge-config` |
| **Name** | `Konfig zusammenfuehren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1040, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Merge config from Master or Sheet reads (same pattern as WF1/WF3)\nconst webhookData = $('Webhook Trigger').first().json.body;\n\nlet config = {};\nlet performanceData = null;\nlet competitorData = null;\n\nif (webhookData && webhookData.config) {\n  // Master provided config + data\n  config = webhookData.config;\n  performanceData = webhookData.performance_data || null;\n  competitorData = webhookData.competitor_data || null;\n} else {\n  // Standalone: build config from Sheet rows\n  const konfigRows = $('Konfig aus Sheet lesen').all();\n  for (const row of konfigRows) {\n    const key = row.json['Einstellung'] || row.json['einstellung'];\n    const val = row.json['Wert'] || row.json['wert'];\n    if (key) config[key] = val;\n  }\n}\n\n// Parse active platforms\nconst activePlatforms = (config.active_platforms || '')\n  .split(',')\n  .map(p => p.trim().toLowerCase())\n  .filter(p => p.length > 0);\n\n// Calendar week\nconst now = new Date();\nconst startOfYear = new Date(now.getFullYear(), 0, 1);\nconst days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));\nconst calendarWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);\n\n// Initialize staticData for result accumulation\nconst staticData = $getWorkflowStaticData('global');\nstaticData.results = [];\nstaticData.errors = [];\n\nreturn [{\n  json: {\n    config,\n    activePlatforms,\n    calendarWeek,\n    year: now.getFullYear(),\n    projectName: config.project_name || 'unknown',\n    brandName: config.brand_name || '',\n    brandDescription: config.brand_description || '',\n    branche: config.branche || '',\n    targetAudience: config.target_audience || '',\n    brandTone: config.brand_tone || 'professionell, nahbar',\n    performanceData,\n    competitorData,\n    needsSupabaseRead: !performanceData,\n    timestamp: now.toISOString()\n  }\n}];"
}
```

**Connects from:** Dual-Trigger Pruefung (TRUE output) and Konfig aus Sheet lesen.

---

#### Node 5: Braucht Supabase-Daten?

| Property | Value |
|---|---|
| **ID** | `wf4-needs-supabase` |
| **Name** | `Braucht Supabase-Daten?` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[1300, 460]` |

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
        "id": "needs-supabase",
        "leftValue": "={{ $json.needsSupabaseRead }}",
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
- **TRUE**: Standalone call -- must read performance + competitor data from Supabase.
- **FALSE**: Master already provided data -- skip Supabase reads.

---

#### Node 6: Supabase Performance lesen

| Property | Value |
|---|---|
| **ID** | `wf4-read-performance` |
| **Name** | `Supabase Performance lesen` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1560, 620]` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/performance_weekly' }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "project_name",
        "value": "=eq.{{ $json.projectName }}"
      },
      {
        "name": "calendar_week",
        "value": "=eq.{{ $json.calendarWeek }}"
      },
      {
        "name": "year",
        "value": "=eq.{{ $json.year }}"
      },
      {
        "name": "select",
        "value": "*"
      }
    ]
  },
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
  "options": {
    "response": {
      "response": {
        "responseFormat": "json"
      }
    }
  }
}
```

**onError:** `continueRegularOutput`
**retryOnFail:** true, maxTries: 3, waitBetweenTries: 5000

---

#### Node 7: Supabase Competitor lesen

| Property | Value |
|---|---|
| **ID** | `wf4-read-competitor` |
| **Name** | `Supabase Competitor lesen` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[1820, 620]` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/competitor_weekly' }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "project_name",
        "value": "=eq.{{ $json.projectName }}"
      },
      {
        "name": "calendar_week",
        "value": "=eq.{{ $json.calendarWeek }}"
      },
      {
        "name": "year",
        "value": "=eq.{{ $json.year }}"
      },
      {
        "name": "select",
        "value": "*"
      }
    ]
  },
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
  "options": {
    "response": {
      "response": {
        "responseFormat": "json"
      }
    }
  }
}
```

**onError:** `continueRegularOutput`
**retryOnFail:** true, maxTries: 3, waitBetweenTries: 5000

---

#### Node 8: Daten zusammenfuehren

| Property | Value |
|---|---|
| **ID** | `wf4-merge-data` |
| **Name** | `Daten zusammenfuehren` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1560, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Merge context data from Supabase reads or from Master-provided data\nconst configData = $('Konfig zusammenfuehren').first().json;\n\nlet performanceData = configData.performanceData;\nlet competitorData = configData.competitorData;\n\n// If standalone, read from Supabase responses\nif (!performanceData) {\n  try {\n    const perfResponse = $('Supabase Performance lesen').first().json;\n    performanceData = Array.isArray(perfResponse) ? perfResponse : (perfResponse.data || []);\n  } catch (e) {\n    performanceData = [];\n  }\n}\n\nif (!competitorData) {\n  try {\n    const compResponse = $('Supabase Competitor lesen').first().json;\n    competitorData = Array.isArray(compResponse) ? compResponse : (compResponse.data || []);\n  } catch (e) {\n    competitorData = [];\n  }\n}\n\nreturn [{\n  json: {\n    ...configData,\n    performanceData,\n    competitorData\n  }\n}];"
}
```

**Connects from:** Both IF branches (TRUE skips Supabase, FALSE goes through Supabase reads). This node receives data from either path.

**Note:** When the Master path (no Supabase reads) is taken, the references to `$('Supabase Performance lesen')` and `$('Supabase Competitor lesen')` will not exist. The `try/catch` blocks handle this gracefully. The `configData.performanceData` will already be populated from the Master-provided data.

---

#### Node 9: Platform Dispatcher

| Property | Value |
|---|---|
| **ID** | `wf4-platform-dispatch` |
| **Name** | `Platform Dispatcher` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[1820, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Create 1 item per active platform with platform-specific rules\nconst data = $input.first().json;\n\nconst PLATFORM_RULES = {\n  instagram: {\n    contentType: 'feed_post',\n    needsImage: true,\n    needsVideo: false,\n    imageResolution: '1080x1350',\n    maxCaptionChars: 125,\n    hashtagCount: '3-5',\n    tone: 'visuell, aspirativ, storytelling',\n    rules: 'Max 125 Zeichen Caption. CTA in der ersten Zeile. 3-5 relevante Hashtags. Zusaetzlich: Reel-Konzept beschreiben (kurzes Video, vertikales Format). Emojis gezielt einsetzen.'\n  },\n  facebook: {\n    contentType: 'feed_post',\n    needsImage: true,\n    needsVideo: false,\n    imageResolution: '1080x1350',\n    maxCaptionChars: 80,\n    hashtagCount: '1-2',\n    tone: 'konversationell, persoenlich, Fragen stellen',\n    rules: '40-80 Zeichen Text. Max 1-2 Hashtags. Konversationeller Ton — Frage oder Geschichte erzaehlen. Teilen und Kommentare anregen.'\n  },\n  tiktok: {\n    contentType: 'short',\n    needsImage: false,\n    needsVideo: true,\n    videoFormat: '9:16',\n    videoDuration: '15-30s',\n    maxCaptionChars: 300,\n    hashtagCount: '3-5 trending',\n    tone: 'locker, unterhaltsam, trend-orientiert',\n    rules: 'Video-Konzept im 9:16 Format, 15-30 Sekunden. Hook in den ersten 3 Sekunden. Keyword-reiche Caption. 3-5 trendende Hashtags. Beschreibe das Video-Skript Szene fuer Szene.'\n  },\n  linkedin: {\n    contentType: 'article',\n    needsImage: true,\n    needsVideo: false,\n    imageResolution: '1200x627',\n    maxCaptionChars: 3000,\n    maxPreviewChars: 140,\n    hashtagCount: '2-3',\n    tone: 'professionell, thought-leadership, Mehrwert',\n    rules: 'Unter 140 Zeichen vor dem Mehr-Button (Teaser). Professioneller Ton, Thought Leadership. 2-3 Hashtags. Laengerer Text erlaubt (bis 3000 Zeichen), aber Teaser muss fesseln.'\n  },\n  youtube: {\n    contentType: 'short',\n    needsImage: false,\n    needsVideo: true,\n    videoFormat: '9:16',\n    videoDuration: '15-60s',\n    maxTitleChars: 70,\n    hashtagCount: '0',\n    tone: 'informativ, energetisch, Mehrwert',\n    rules: 'Short-Konzept im 9:16 Format, 15-60 Sekunden. Max 70 Zeichen Titel. Keyword-reiche Beschreibung. Beschreibe das Video-Skript Szene fuer Szene. Call-to-Action: Abonnieren.'\n  },\n  x_twitter: {\n    contentType: 'tweet',\n    needsImage: true,\n    needsVideo: false,\n    imageResolution: '1600x900',\n    maxCaptionChars: 280,\n    targetCaptionChars: '70-100',\n    hashtagCount: '1-2',\n    tone: 'praegnant, meinungsstark, Gespraechsstarter',\n    rules: '70-100 Zeichen optimal (max 280). 1-2 Hashtags. Praegnant und meinungsstark. Gespraechsstarter — Antworten provozieren. Kann auch als Thread geplant werden.'\n  }\n};\n\nconst items = [];\n\nfor (const platform of data.activePlatforms) {\n  const rules = PLATFORM_RULES[platform];\n  if (!rules) continue;\n\n  // Find platform-specific performance data\n  const perfForPlatform = (data.performanceData || []).find(\n    p => p.platform === platform\n  ) || {};\n\n  // Find competitor insights for this platform\n  const compForPlatform = (data.competitorData || []).filter(\n    c => c.platform === platform\n  );\n\n  items.push({\n    json: {\n      platform,\n      platformRules: rules,\n      performanceContext: perfForPlatform,\n      competitorContext: compForPlatform,\n      projectName: data.projectName,\n      brandName: data.brandName,\n      brandDescription: data.brandDescription,\n      branche: data.branche,\n      targetAudience: data.targetAudience,\n      brandTone: data.brandTone,\n      calendarWeek: data.calendarWeek,\n      year: data.year,\n      timestamp: data.timestamp\n    }\n  });\n}\n\nif (items.length === 0) {\n  items.push({\n    json: {\n      skip: true,\n      reason: 'Keine aktiven Plattformen fuer Content-Erstellung'\n    }\n  });\n}\n\nreturn items;"
}
```

**Output:** Array of items, one per active platform, each containing platform-specific rules, performance context, and competitor context.

---

#### Node 10: SplitInBatches

| Property | Value |
|---|---|
| **ID** | `wf4-split` |
| **Name** | `SplitInBatches` |
| **Type** | `n8n-nodes-base.splitInBatches` |
| **typeVersion** | `3` |
| **Position** | `[2080, 460]` |

**Parameters:**
```json
{
  "batchSize": 1,
  "options": {}
}
```

**Connections:**
- Output 0 (done) -> `Ergebnisse aufbereiten`
- Output 1 (loop) -> `Claude Prompt aufbauen`

---

#### Node 11: Claude Prompt aufbauen

| Property | Value |
|---|---|
| **ID** | `wf4-build-prompt` |
| **Name** | `Claude Prompt aufbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2340, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Build platform-specific Claude prompt for content generation\nconst item = $input.first().json;\n\n// Skip if no valid platform\nif (item.skip) {\n  return [{ json: { skip: true, reason: item.reason } }];\n}\n\nconst { platform, platformRules, performanceContext, competitorContext,\n        brandName, brandDescription, branche, targetAudience, brandTone } = item;\n\n// Build performance summary\nlet perfSummary = 'Keine Performance-Daten verfuegbar.';\nif (performanceContext && performanceContext.followers) {\n  perfSummary = `Aktuelle Metriken auf ${platform}:\\n` +\n    `- Follower: ${performanceContext.followers || 'N/A'}\\n` +\n    `- Impressions: ${performanceContext.impressions || 'N/A'}\\n` +\n    `- Engagement Rate: ${performanceContext.engagement_rate || 'N/A'}%\\n` +\n    `- Reach: ${performanceContext.reach || 'N/A'}\\n` +\n    `- Likes (Durchschnitt): ${performanceContext.avg_likes || 'N/A'}\\n` +\n    `- Kommentare (Durchschnitt): ${performanceContext.avg_comments || 'N/A'}`;\n}\n\n// Build competitor summary\nlet compSummary = 'Keine Wettbewerber-Insights verfuegbar.';\nif (competitorContext && competitorContext.length > 0) {\n  compSummary = 'Wettbewerber-Insights:\\n';\n  for (const comp of competitorContext.slice(0, 3)) {\n    compSummary += `\\n- ${comp.competitor_name || 'Unbekannt'}:\\n`;\n    compSummary += `  Followers: ${comp.followers || 'N/A'}, Engagement: ${comp.engagement_rate || 'N/A'}%\\n`;\n    if (comp.content_ideas) {\n      const ideas = typeof comp.content_ideas === 'string' ? JSON.parse(comp.content_ideas) : comp.content_ideas;\n      if (Array.isArray(ideas) && ideas.length > 0) {\n        compSummary += `  Top Content-Ideen: ${ideas.slice(0, 2).join(', ')}\\n`;\n      }\n    }\n  }\n}\n\n// System prompt\nconst systemPrompt = `Du bist ein erfahrener Social Media Content Creator fuer den DACH-Markt. Du erstellst plattformspezifischen Content auf Deutsch.\n\nMarke: ${brandName}\nBeschreibung: ${brandDescription}\nBranche: ${branche}\nZielgruppe: ${targetAudience}\nMarkenton: ${brandTone}\n\nDein Output ist IMMER ein valides JSON-Objekt mit exakt dieser Struktur:\n{\n  \"caption\": \"Der fertige Post-Text/Caption\",\n  \"hashtags\": [\"hashtag1\", \"hashtag2\"],\n  \"cta\": \"Call-to-Action Text\",\n  \"content_theme\": \"Kurze Beschreibung des Themas\",\n  \"tone_description\": \"Beschreibung des verwendeten Tons\",\n  \"image_prompt\": \"Englischer Prompt fuer Bildgenerierung (nur wenn Bild benoetigt)\",\n  \"video_concept\": \"Detailliertes Video-Konzept Szene fuer Szene (nur wenn Video benoetigt)\",\n  \"video_prompt\": \"Englischer Prompt fuer Videogenerierung (nur wenn Video benoetigt)\"\n}\n\nWICHTIG: Antworte NUR mit dem JSON-Objekt, kein weiterer Text.`;\n\n// User prompt\nconst userPrompt = `Erstelle einen Social Media Post fuer die Plattform: ${platform.toUpperCase()}\n\n## Plattform-Regeln\n${platformRules.rules}\nTon: ${platformRules.tone}\nContent-Typ: ${platformRules.contentType}\n${platformRules.needsImage ? 'Bild-Aufloesung: ' + platformRules.imageResolution : ''}\n${platformRules.needsVideo ? 'Video-Format: ' + platformRules.videoFormat + ', Dauer: ' + platformRules.videoDuration : ''}\n\n## Performance-Daten\n${perfSummary}\n\n## Wettbewerber-Insights\n${compSummary}\n\n## Aufgabe\nErstelle einen optimalen Post fuer ${platform}, der:\n1. Die Plattform-Regeln exakt einhaelt (Zeichenlimit, Hashtag-Anzahl, Ton)\n2. Auf den Performance-Daten aufbaut (was funktioniert? was verbessern?)\n3. Wettbewerber-Insights beruecksichtigt (Differenzierung, Trends)\n4. Zur Marke \"${brandName}\" passt\n5. Die Zielgruppe \"${targetAudience}\" direkt anspricht\n${platformRules.needsImage ? '6. Einen detaillierten englischen Bild-Prompt enthaelt (fuer AI-Bildgenerierung mit Imagen 4, beschreibe Stil, Komposition, Farben, Stimmung)' : ''}\n${platformRules.needsVideo ? '6. Ein detailliertes Video-Konzept Szene fuer Szene enthaelt\\n7. Einen englischen Video-Prompt enthaelt (fuer AI-Videogenerierung mit Veo 3)' : ''}\n\nAntworte NUR mit dem JSON-Objekt.`;\n\nreturn [{\n  json: {\n    ...item,\n    systemPrompt,\n    userPrompt\n  }\n}];"
}
```

---

#### Node 12: Claude Content generieren

| Property | Value |
|---|---|
| **ID** | `wf4-claude-generate` |
| **Name** | `Claude Content generieren` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[2600, 460]` |
| **Credentials** | Header Auth (Anthropic API Key) |

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
        "name": "content-type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ model: 'claude-sonnet-4-5-20250514', max_tokens: 2000, temperature: 0.7, system: $json.systemPrompt, messages: [{ role: 'user', content: $json.userPrompt }] }) }}",
  "options": {
    "response": {
      "response": {
        "responseFormat": "json"
      }
    },
    "timeout": 60000
  }
}
```

**onError:** `continueRegularOutput`
**retryOnFail:** true, maxTries: 3, waitBetweenTries: 5000

**Notes:**
- Claude Sonnet 4.5 model ID: `claude-sonnet-4-5-20250514`
- Temperature 0.7 for creative content generation
- max_tokens 2000 sufficient for structured JSON response with text content + prompts
- The `x-api-key` header will be set via n8n credential (Header Auth) in production, replacing the placeholder

---

#### Node 13: Claude Response parsen

| Property | Value |
|---|---|
| **ID** | `wf4-parse-claude` |
| **Name** | `Claude Response parsen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2860, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Parse Claude response and extract content fields\nconst item = $input.first().json;\n\nif (item.skip) {\n  return [{ json: item }];\n}\n\nlet content = {};\n\ntry {\n  // Claude API response structure: { content: [{ type: 'text', text: '...' }] }\n  const claudeResponse = item;\n  let responseText = '';\n\n  if (claudeResponse.content && Array.isArray(claudeResponse.content)) {\n    responseText = claudeResponse.content\n      .filter(c => c.type === 'text')\n      .map(c => c.text)\n      .join('');\n  } else if (typeof claudeResponse === 'string') {\n    responseText = claudeResponse;\n  }\n\n  // Extract JSON from response (handle potential markdown code blocks)\n  let jsonStr = responseText.trim();\n  if (jsonStr.startsWith('```')) {\n    jsonStr = jsonStr.replace(/^```(?:json)?\\n?/, '').replace(/\\n?```$/, '');\n  }\n\n  content = JSON.parse(jsonStr);\n} catch (e) {\n  content = {\n    caption: 'Content-Generierung fehlgeschlagen: ' + e.message,\n    hashtags: [],\n    cta: '',\n    content_theme: 'Fehler',\n    tone_description: '',\n    image_prompt: '',\n    video_concept: '',\n    video_prompt: ''\n  };\n}\n\n// Retrieve original item data from previous node context\nconst promptData = $('Claude Prompt aufbauen').first().json;\n\nreturn [{\n  json: {\n    platform: promptData.platform,\n    platformRules: promptData.platformRules,\n    projectName: promptData.projectName,\n    brandName: promptData.brandName,\n    calendarWeek: promptData.calendarWeek,\n    year: promptData.year,\n    performanceContext: promptData.performanceContext,\n    competitorContext: promptData.competitorContext,\n    generatedContent: content,\n    rawClaudeResponse: item,\n    systemPrompt: promptData.systemPrompt,\n    userPrompt: promptData.userPrompt\n  }\n}];"
}
```

---

#### Node 14: Braucht Bild?

| Property | Value |
|---|---|
| **ID** | `wf4-needs-image` |
| **Name** | `Braucht Bild?` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[3120, 460]` |

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
        "id": "needs-image",
        "leftValue": "={{ $json.platformRules.needsImage }}",
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
- **TRUE** (instagram, facebook, linkedin, x_twitter): Generate image via Imagen 4.
- **FALSE** (tiktok, youtube): Skip image generation.

---

#### Node 15: Imagen 4 Bild generieren

| Property | Value |
|---|---|
| **ID** | `wf4-imagen4` |
| **Name** | `Imagen 4 Bild generieren` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[3380, 300]` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "https://generativelanguage.googleapis.com/v1beta/models/imagen-4:generateImages",
  "authentication": "none",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "key",
        "value": "GEMINI_API_KEY_PLACEHOLDER"
      }
    ]
  },
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
  "jsonBody": "={{ JSON.stringify({ instances: [{ prompt: ($json.generatedContent.image_prompt || 'Professional social media image') + '. Aspect ratio: ' + ($json.platformRules.imageResolution === '1200x627' ? '1.91:1 landscape' : ($json.platformRules.imageResolution === '1600x900' ? '16:9 landscape' : '4:5 portrait')) + '. High quality, professional, brand photography style.' }], parameters: { sampleCount: 1, aspectRatio: ($json.platformRules.imageResolution === '1200x627' ? '16:9' : ($json.platformRules.imageResolution === '1600x900' ? '16:9' : '3:4')) } }) }}",
  "options": {
    "response": {
      "response": {
        "responseFormat": "json"
      }
    },
    "timeout": 120000
  }
}
```

**onError:** `continueRegularOutput`
**retryOnFail:** true, maxTries: 2, waitBetweenTries: 10000

**Notes:**
- Imagen 4 API uses `instances[].prompt` for the image description
- `parameters.sampleCount: 1` generates one image per request
- `parameters.aspectRatio` controls output dimensions: `3:4` for portrait (IG/FB), `16:9` for landscape (LI/X)
- Response contains `predictions[].bytesBase64Encoded` with the image data
- The API key is passed as query parameter (Google AI Studio convention)
- Timeout 120s for image generation

**Aspect Ratio Mapping:**
| Platform | Resolution | Aspect Ratio |
|---|---|---|
| Instagram | 1080x1350 | 3:4 |
| Facebook | 1080x1350 | 3:4 |
| LinkedIn | 1200x627 | 16:9 |
| X/Twitter | 1600x900 | 16:9 |

---

#### Node 16: Bild-Response parsen

| Property | Value |
|---|---|
| **ID** | `wf4-parse-image` |
| **Name** | `Bild-Response parsen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3640, 300]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Parse Imagen 4 response and attach image data\nconst item = $input.first().json;\nconst prevData = $('Claude Response parsen').first().json;\n\nlet imageData = {\n  imageUrl: null,\n  imageBase64: null,\n  imageResolution: prevData.platformRules.imageResolution\n};\n\ntry {\n  // Imagen 4 response: { predictions: [{ bytesBase64Encoded: '...' }] }\n  if (item.predictions && item.predictions.length > 0) {\n    imageData.imageBase64 = item.predictions[0].bytesBase64Encoded || null;\n  }\n  // Alternative response format: { images: [{ image: { imageBytes: '...' } }] }\n  if (!imageData.imageBase64 && item.images && item.images.length > 0) {\n    imageData.imageBase64 = item.images[0].image?.imageBytes || null;\n  }\n  // Alternative: generatedImages format\n  if (!imageData.imageBase64 && item.generatedImages && item.generatedImages.length > 0) {\n    imageData.imageBase64 = item.generatedImages[0].image?.imageBytes || null;\n  }\n} catch (e) {\n  // Image generation failed -- continue with text-only content\n}\n\nreturn [{\n  json: {\n    ...prevData,\n    imageData,\n    rawImagenResponse: item\n  }\n}];"
}
```

---

#### Node 17: Kein Bild noetig (NoOp)

| Property | Value |
|---|---|
| **ID** | `wf4-no-image` |
| **Name** | `Kein Bild noetig` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3640, 620]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Pass through data without image -- for video-only platforms\nconst prevData = $('Claude Response parsen').first().json;\n\nreturn [{\n  json: {\n    ...prevData,\n    imageData: { imageUrl: null, imageBase64: null, imageResolution: null },\n    rawImagenResponse: null\n  }\n}];"
}
```

**Connects from:** `Braucht Bild?` (FALSE output)

---

#### Node 18: Braucht Video?

| Property | Value |
|---|---|
| **ID** | `wf4-needs-video` |
| **Name** | `Braucht Video?` |
| **Type** | `n8n-nodes-base.if` |
| **typeVersion** | `2.2` |
| **Position** | `[3900, 460]` |

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
        "id": "needs-video",
        "leftValue": "={{ $json.platformRules.needsVideo }}",
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

**Connects from:** `Bild-Response parsen` and `Kein Bild noetig` (both merge into this node).

**Logic:**
- **TRUE** (tiktok, youtube): Generate video via Veo 3.
- **FALSE** (instagram, facebook, linkedin, x_twitter): Skip video generation.

---

#### Node 19: Veo 3 Video generieren

| Property | Value |
|---|---|
| **ID** | `wf4-veo3-submit` |
| **Name** | `Veo 3 Video generieren` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[4160, 300]` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideos",
  "authentication": "none",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "key",
        "value": "GEMINI_API_KEY_PLACEHOLDER"
      }
    ]
  },
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
  "jsonBody": "={{ JSON.stringify({ instances: [{ prompt: ($json.generatedContent.video_prompt || 'Professional short-form video content') + '. Vertical 9:16 format. ' + ($json.platformRules.videoDuration || '15-30 seconds') + ' duration.' }], parameters: { aspectRatio: '9:16', durationSeconds: ($json.platform === 'tiktok' ? 20 : 30) } }) }}",
  "options": {
    "response": {
      "response": {
        "responseFormat": "json"
      }
    },
    "timeout": 120000
  }
}
```

**onError:** `continueRegularOutput`
**retryOnFail:** true, maxTries: 2, waitBetweenTries: 15000

**Notes:**
- Veo 3 is asynchronous -- the initial POST returns a job/operation ID
- The response may contain a `name` field (operation name) for polling
- If the API returns a synchronous response with video data, the Wait + Poll nodes are skipped
- Timeout 120s for initial submission

---

#### Node 20: Veo 3 Wartezeit

| Property | Value |
|---|---|
| **ID** | `wf4-veo3-wait` |
| **Name** | `Veo 3 Wartezeit` |
| **Type** | `n8n-nodes-base.wait` |
| **typeVersion** | `1.1` |
| **Position** | `[4420, 300]` |

**Parameters:**
```json
{
  "amount": 60,
  "unit": "seconds"
}
```

**Notes:**
- Veo 3 video generation takes 1-5 minutes typically
- 60s initial wait before polling for result
- If result not ready, the Code node after polling handles retry logic

---

#### Node 21: Veo 3 Ergebnis abrufen

| Property | Value |
|---|---|
| **ID** | `wf4-veo3-poll` |
| **Name** | `Veo 3 Ergebnis abrufen` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[4680, 300]` |

**Parameters:**
```json
{
  "method": "GET",
  "url": "={{ 'https://generativelanguage.googleapis.com/v1beta/' + ($('Veo 3 Video generieren').first().json.name || 'operations/placeholder') }}",
  "authentication": "none",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "key",
        "value": "GEMINI_API_KEY_PLACEHOLDER"
      }
    ]
  },
  "options": {
    "response": {
      "response": {
        "responseFormat": "json"
      }
    },
    "timeout": 60000
  }
}
```

**onError:** `continueRegularOutput`
**retryOnFail:** true, maxTries: 3, waitBetweenTries: 30000

**Notes:**
- Polls the operation status using the `name` returned from the submit call
- `retryOnFail` with 30s wait handles the case where video is not yet ready
- Response contains video URL or base64 when complete

---

#### Node 22: Video-Response parsen

| Property | Value |
|---|---|
| **ID** | `wf4-parse-video` |
| **Name** | `Video-Response parsen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[4940, 300]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Parse Veo 3 response and extract video data\nconst item = $input.first().json;\nconst prevData = $('Braucht Video?').first().json;\n\nlet videoData = {\n  videoUrl: null,\n  videoConcept: prevData.generatedContent.video_concept || '',\n  videoPrompt: prevData.generatedContent.video_prompt || '',\n  videoDuration: prevData.platformRules.videoDuration || '',\n  videoFormat: prevData.platformRules.videoFormat || '9:16'\n};\n\ntry {\n  // Check if operation is done\n  if (item.done === true && item.response) {\n    // Completed: extract video URL\n    const videos = item.response.generatedVideos || item.response.videos || [];\n    if (videos.length > 0) {\n      videoData.videoUrl = videos[0].video?.uri || videos[0].uri || null;\n    }\n  } else if (item.generatedVideos && item.generatedVideos.length > 0) {\n    // Direct response format\n    videoData.videoUrl = item.generatedVideos[0].video?.uri || null;\n  }\n} catch (e) {\n  // Video generation failed -- concept is still available\n}\n\nreturn [{\n  json: {\n    ...prevData,\n    videoData,\n    rawVeoResponse: item\n  }\n}];"
}
```

---

#### Node 23: Kein Video noetig (NoOp)

| Property | Value |
|---|---|
| **ID** | `wf4-no-video` |
| **Name** | `Kein Video noetig` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[4940, 620]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Pass through data without video -- for image-only platforms\nconst item = $input.first().json;\n\nreturn [{\n  json: {\n    ...item,\n    videoData: { videoUrl: null, videoConcept: '', videoPrompt: '', videoDuration: '', videoFormat: '' },\n    rawVeoResponse: null\n  }\n}];"
}
```

**Connects from:** `Braucht Video?` (FALSE output)

---

#### Node 24: Ergebnis sammeln

| Property | Value |
|---|---|
| **ID** | `wf4-collect-result` |
| **Name** | `Ergebnis sammeln` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[5200, 460]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Collect result into staticData for final aggregation\nconst item = $input.first().json;\nconst staticData = $getWorkflowStaticData('global');\n\nif (!staticData.results) staticData.results = [];\nif (!staticData.errors) staticData.errors = [];\n\nif (item.skip) {\n  // Skipped platform\n  return [{ json: { collected: true } }];\n}\n\ntry {\n  const result = {\n    platform: item.platform,\n    contentType: item.platformRules.contentType,\n    caption: item.generatedContent.caption || '',\n    hashtags: item.generatedContent.hashtags || [],\n    cta: item.generatedContent.cta || '',\n    contentTheme: item.generatedContent.content_theme || '',\n    toneDescription: item.generatedContent.tone_description || '',\n    imagePrompt: item.generatedContent.image_prompt || '',\n    imageResolution: item.imageData?.imageResolution || null,\n    imageBase64: item.imageData?.imageBase64 || null,\n    imageUrl: item.imageData?.imageUrl || null,\n    videoConcept: item.videoData?.videoConcept || '',\n    videoPrompt: item.videoData?.videoPrompt || '',\n    videoUrl: item.videoData?.videoUrl || null,\n    videoDuration: item.videoData?.videoDuration || '',\n    videoFormat: item.videoData?.videoFormat || '',\n    charCount: (item.generatedContent.caption || '').length,\n    hashtagCount: (item.generatedContent.hashtags || []).length,\n    projectName: item.projectName,\n    calendarWeek: item.calendarWeek,\n    year: item.year\n  };\n\n  staticData.results.push(result);\n} catch (e) {\n  staticData.errors.push({\n    platform: item.platform || 'unknown',\n    error: e.message,\n    timestamp: new Date().toISOString()\n  });\n}\n\nreturn [{ json: { collected: true } }];"
}
```

**Connects from:** `Video-Response parsen` and `Kein Video noetig` (both merge into this node).

---

#### Node 25: API Pause

| Property | Value |
|---|---|
| **ID** | `wf4-api-pause` |
| **Name** | `API Pause` |
| **Type** | `n8n-nodes-base.wait` |
| **typeVersion** | `1.1` |
| **Position** | `[5460, 460]` |

**Parameters:**
```json
{
  "amount": 3,
  "unit": "seconds"
}
```

**Connects to:** Loop back to `SplitInBatches`.

---

#### Node 26: Ergebnisse aufbereiten

| Property | Value |
|---|---|
| **ID** | `wf4-prepare-results` |
| **Name** | `Ergebnisse aufbereiten` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[2340, 720]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Prepare final results from staticData for persistence\nconst staticData = $getWorkflowStaticData('global');\nconst results = staticData.results || [];\nconst errors = staticData.errors || [];\n\n// Clean up staticData\ndelete staticData.results;\ndelete staticData.errors;\n\n// Build Supabase UPSERT rows\nconst supabaseRows = results.map(r => ({\n  project_name: r.projectName,\n  calendar_week: r.calendarWeek,\n  year: r.year,\n  platform: r.platform,\n  content_type: r.contentType,\n  caption: r.caption,\n  hashtags: r.hashtags,\n  cta_text: r.cta,\n  char_count: r.charCount,\n  hashtag_count: r.hashtagCount,\n  image_prompt: r.imagePrompt,\n  image_url: r.imageUrl,\n  image_base64: r.imageBase64 ? '(base64 data stored)' : null,\n  image_resolution: r.imageResolution,\n  video_prompt: r.videoPrompt,\n  video_url: r.videoUrl,\n  video_concept: r.videoConcept,\n  video_duration_target: r.videoDuration,\n  video_format: r.videoFormat,\n  tone_description: r.toneDescription,\n  content_theme: r.contentTheme,\n  status: 'draft',\n  data_source: 'wf4_content_creator'\n}));\n\n// Build Sheet rows\nconst sheetRows = results.map(r => ({\n  Plattform: r.platform,\n  ContentTyp: r.contentType,\n  Caption: r.caption,\n  Hashtags: (r.hashtags || []).join(', '),\n  CTA: r.cta,\n  Thema: r.contentTheme,\n  Ton: r.toneDescription,\n  BildAufloesung: r.imageResolution || '-',\n  BildPrompt: r.imagePrompt || '-',\n  VideoKonzept: r.videoConcept || '-',\n  VideoDauer: r.videoDuration || '-',\n  Status: 'Entwurf',\n  KW: r.calendarWeek,\n  Jahr: r.year,\n  Erstellt: new Date().toISOString()\n}));\n\nreturn [{\n  json: {\n    results,\n    errors,\n    supabaseRows,\n    sheetRows,\n    totalPlatforms: results.length,\n    totalErrors: errors.length,\n    projectName: results.length > 0 ? results[0].projectName : 'unknown'\n  }\n}];"
}
```

**Connects from:** `SplitInBatches` (Output 0 = done).

---

#### Node 27: Supabase UPSERT content_generated

| Property | Value |
|---|---|
| **ID** | `wf4-supabase-upsert` |
| **Name** | `Supabase UPSERT` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.4` |
| **Position** | `[2600, 720]` |

**Parameters:**
```json
{
  "method": "POST",
  "url": "={{ 'SUPABASE_URL_PLACEHOLDER' + '/rest/v1/content_generated' }}",
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
      },
      {
        "name": "Prefer",
        "value": "resolution=merge-duplicates"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify($json.supabaseRows) }}",
  "options": {
    "response": {
      "response": {
        "responseFormat": "json"
      }
    }
  }
}
```

**onError:** `continueRegularOutput`
**retryOnFail:** true, maxTries: 3, waitBetweenTries: 5000

**Notes:**
- UPSERT via `Prefer: resolution=merge-duplicates` header
- Conflict resolution on unique constraint `uq_content_generated` (project_name + platform + content_type + calendar_week + year)
- Note: `image_base64` is NOT stored in Supabase (too large). Only the marker string `(base64 data stored)` is saved. In production, images should be uploaded to a storage service (Google Cloud Storage, etc.) and the URL stored instead.

---

#### Node 28: Content Plan schreiben

| Property | Value |
|---|---|
| **ID** | `wf4-write-sheet` |
| **Name** | `Content Plan schreiben` |
| **Type** | `n8n-nodes-base.googleSheets` |
| **typeVersion** | `4.7` |
| **Position** | `[2860, 720]` |
| **Credentials** | Google Sheets OAuth2 |

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
    "value": "Content Plan"
  },
  "columns": {
    "mappingMode": "defineBelow",
    "value": {},
    "matchingColumns": [],
    "schema": [
      { "id": "Plattform", "displayName": "Plattform", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
      { "id": "ContentTyp", "displayName": "ContentTyp", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "Caption", "displayName": "Caption", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "Hashtags", "displayName": "Hashtags", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "CTA", "displayName": "CTA", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "Thema", "displayName": "Thema", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "Ton", "displayName": "Ton", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "BildAufloesung", "displayName": "BildAufloesung", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "BildPrompt", "displayName": "BildPrompt", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "VideoKonzept", "displayName": "VideoKonzept", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "VideoDauer", "displayName": "VideoDauer", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "Status", "displayName": "Status", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "KW", "displayName": "KW", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "Jahr", "displayName": "Jahr", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false },
      { "id": "Erstellt", "displayName": "Erstellt", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": false }
    ]
  },
  "options": {}
}
```

**Notes:**
- Appends rows to "Content Plan" tab (Tab 6)
- Uses Split Out or iteration to write multiple rows (one per platform)
- The `sheetRows` array from the previous Code node must be split into individual items before this node

**IMPORTANT:** This node expects individual items, not an array. A Split Out node or the Code node must output individual items. Since the `Ergebnisse aufbereiten` Code node outputs `sheetRows` as an array within a single item, we need to add a conversion step. This is handled by making the Sheet write use an expression referencing `$json.sheetRows`, with the Google Sheets node configured to handle arrays via a Loop or by using `specifyBody` mode.

**Alternative approach (simpler):** The `Ergebnisse aufbereiten` Code node can output multiple items directly (one per platform). Let me adjust: the Code node will return `sheetRows` as separate items for the Sheet write, and include `supabaseRows` in the first item for the Supabase UPSERT. However, since Supabase UPSERT sends the full array in one POST, and the Sheet node processes items individually, this needs a Split Out.

**Resolution:** Insert a `Split Out` node between Supabase UPSERT and Sheet write to split `sheetRows` into individual items. See revised connection flow below.

---

#### Node 28b: Sheet Daten splitten

| Property | Value |
|---|---|
| **ID** | `wf4-split-sheet-rows` |
| **Name** | `Sheet Daten splitten` |
| **Type** | `n8n-nodes-base.splitOut` |
| **typeVersion** | `1` |
| **Position** | `[2860, 720]` |

**Parameters:**
```json
{
  "fieldToSplitOut": "sheetRows",
  "options": {}
}
```

**Connects from:** `Supabase UPSERT`
**Connects to:** `Content Plan schreiben` (re-numbered to Node 28c)

---

#### Node 28c: Content Plan schreiben (revised position)

| Property | Value |
|---|---|
| **ID** | `wf4-write-sheet` |
| **Name** | `Content Plan schreiben` |
| **Type** | `n8n-nodes-base.googleSheets` |
| **typeVersion** | `4.7` |
| **Position** | `[3120, 720]` |
| **Credentials** | Google Sheets OAuth2 |

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
    "value": "Content Plan"
  },
  "columns": {
    "mappingMode": "autoMapInputData",
    "value": {}
  },
  "options": {}
}
```

**Notes:** Uses `autoMapInputData` since the Split Out produces items matching the Sheet column names exactly.

---

#### Node 29: Response zusammenbauen

| Property | Value |
|---|---|
| **ID** | `wf4-build-response` |
| **Name** | `Response zusammenbauen` |
| **Type** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Position** | `[3380, 720]` |

**Parameters:**
```json
{
  "mode": "runOnceForAllItems",
  "jsCode": "// Build structured response\nconst resultData = $('Ergebnisse aufbereiten').first().json;\n\nconst hasErrors = (resultData.errors || []).length > 0;\n\nreturn [{\n  json: {\n    success: !hasErrors || resultData.totalPlatforms > 0,\n    workflow: 'WF4_Content_Creator',\n    data: {\n      totalPlatforms: resultData.totalPlatforms,\n      platforms: (resultData.results || []).map(r => ({\n        platform: r.platform,\n        contentType: r.contentType,\n        captionPreview: (r.caption || '').substring(0, 100) + ((r.caption || '').length > 100 ? '...' : ''),\n        hashtagCount: r.hashtagCount,\n        hasImage: !!(r.imageBase64 || r.imageUrl),\n        hasVideo: !!r.videoUrl,\n        hasVideoConcept: !!r.videoConcept\n      })),\n      projectName: resultData.projectName\n    },\n    errors: resultData.errors || [],\n    timestamp: new Date().toISOString()\n  }\n}];"
}
```

---

#### Node 30: Respond to Webhook

| Property | Value |
|---|---|
| **ID** | `wf4-respond` |
| **Name** | `Respond to Webhook` |
| **Type** | `n8n-nodes-base.respondToWebhook` |
| **typeVersion** | `1.1` |
| **Position** | `[3640, 720]` |

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

### Connections Summary

```
Webhook Trigger --> Dual-Trigger Pruefung

Dual-Trigger Pruefung (TRUE)  --> Konfig zusammenfuehren
Dual-Trigger Pruefung (FALSE) --> Konfig aus Sheet lesen --> Konfig zusammenfuehren

Konfig zusammenfuehren --> Braucht Supabase-Daten?

Braucht Supabase-Daten? (TRUE)  --> Supabase Performance lesen --> Supabase Competitor lesen --> Daten zusammenfuehren
Braucht Supabase-Daten? (FALSE) --> Daten zusammenfuehren

Daten zusammenfuehren --> Platform Dispatcher --> SplitInBatches

SplitInBatches (Output 1: loop) --> Claude Prompt aufbauen --> Claude Content generieren --> Claude Response parsen --> Braucht Bild?

Braucht Bild? (TRUE)  --> Imagen 4 Bild generieren --> Bild-Response parsen --> Braucht Video?
Braucht Bild? (FALSE) --> Kein Bild noetig --> Braucht Video?

Braucht Video? (TRUE)  --> Veo 3 Video generieren --> Veo 3 Wartezeit --> Veo 3 Ergebnis abrufen --> Video-Response parsen --> Ergebnis sammeln
Braucht Video? (FALSE) --> Kein Video noetig --> Ergebnis sammeln

Ergebnis sammeln --> API Pause --> SplitInBatches (loop back)

SplitInBatches (Output 0: done) --> Ergebnisse aufbereiten --> Supabase UPSERT --> Sheet Daten splitten --> Content Plan schreiben --> Response zusammenbauen --> Respond to Webhook
```

### Node Count: 30

| # | Node Name | Type | Purpose |
|---|---|---|---|
| 1 | Webhook Trigger | webhook | Entry point |
| 2 | Dual-Trigger Pruefung | if | Master vs standalone routing |
| 3 | Konfig aus Sheet lesen | googleSheets | Read config (standalone) |
| 4 | Konfig zusammenfuehren | code | Merge config from either source |
| 5 | Braucht Supabase-Daten? | if | Skip Supabase if Master provided data |
| 6 | Supabase Performance lesen | httpRequest | GET performance_weekly |
| 7 | Supabase Competitor lesen | httpRequest | GET competitor_weekly |
| 8 | Daten zusammenfuehren | code | Merge context data |
| 9 | Platform Dispatcher | code | Create per-platform items with rules |
| 10 | SplitInBatches | splitInBatches | Process platforms sequentially |
| 11 | Claude Prompt aufbauen | code | Build platform-specific prompt |
| 12 | Claude Content generieren | httpRequest | Anthropic Messages API call |
| 13 | Claude Response parsen | code | Extract JSON content from Claude |
| 14 | Braucht Bild? | if | Route: image vs no image |
| 15 | Imagen 4 Bild generieren | httpRequest | Gemini Imagen 4 API call |
| 16 | Bild-Response parsen | code | Extract image data |
| 17 | Kein Bild noetig | code | Pass-through for video platforms |
| 18 | Braucht Video? | if | Route: video vs no video |
| 19 | Veo 3 Video generieren | httpRequest | Gemini Veo 3 API call (submit) |
| 20 | Veo 3 Wartezeit | wait | 60s wait for video processing |
| 21 | Veo 3 Ergebnis abrufen | httpRequest | Poll for Veo 3 result |
| 22 | Video-Response parsen | code | Extract video data |
| 23 | Kein Video noetig | code | Pass-through for image platforms |
| 24 | Ergebnis sammeln | code | Accumulate in staticData |
| 25 | API Pause | wait | 3s between platforms |
| 26 | Ergebnisse aufbereiten | code | Prepare Supabase + Sheet data |
| 27 | Supabase UPSERT | httpRequest | Write to content_generated |
| 28 | Sheet Daten splitten | splitOut | Split sheetRows for Sheet write |
| 29 | Content Plan schreiben | googleSheets | Append to Content Plan tab |
| 30 | Response zusammenbauen | code | Build final response |
| 31 | Respond to Webhook | respondToWebhook | Return HTTP response |

**Corrected total: 31 nodes**

---

## Node Configuration Summary

### HTTP Request Nodes (Justified)

| Node | Target API | Justification |
|---|---|---|
| Supabase Performance lesen | Supabase REST API | Native Supabase node does not support complex query filters needed here |
| Supabase Competitor lesen | Supabase REST API | Same as above |
| Claude Content generieren | Anthropic Messages API | Dynamic prompt construction not feasible with native LangChain node's fixedCollection parameter |
| Imagen 4 Bild generieren | Google Gemini API | No native n8n node for Imagen 4 image generation |
| Veo 3 Video generieren | Google Gemini API | No native n8n node for Veo 3 video generation |
| Veo 3 Ergebnis abrufen | Google Gemini API | Polling for async Veo 3 result |
| Supabase UPSERT | Supabase REST API | Native Supabase node lacks UPSERT support |

### Credentials Required

| Credential | Nodes Using It | Status |
|---|---|---|
| Google Sheets OAuth2 | Konfig aus Sheet lesen, Content Plan schreiben | Available |
| Anthropic API Key (Header Auth) | Claude Content generieren | Available |
| Supabase API Key (Header Auth) | Supabase Performance lesen, Supabase Competitor lesen, Supabase UPSERT | Available |
| Google Gemini API Key | Imagen 4 Bild generieren, Veo 3 Video generieren, Veo 3 Ergebnis abrufen | NOT YET AVAILABLE |

### Placeholders to Replace Before Deployment

| Placeholder | Nodes | Replace With |
|---|---|---|
| `GOOGLE_SHEET_URL_PLACEHOLDER` | Nodes 3, 29 | Actual Google Sheet URL |
| `SUPABASE_URL_PLACEHOLDER` | Nodes 6, 7, 27 | Actual Supabase project URL |
| `SUPABASE_API_KEY_PLACEHOLDER` | Nodes 6, 7, 27 | Actual Supabase anon/service key |
| `ANTHROPIC_API_KEY_PLACEHOLDER` | Node 12 | Actual Anthropic API key (or use n8n credential) |
| `GEMINI_API_KEY_PLACEHOLDER` | Nodes 15, 19, 21 | Actual Google Gemini API key |

---

## Workflow Settings

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

## Data Flow Summary

### Input (Webhook POST body)

**From Master:**
```json
{
  "config": {
    "project_name": "MeinProjekt",
    "brand_name": "MeinBrand",
    "brand_description": "Beschreibung...",
    "branche": "E-Commerce",
    "target_audience": "Marketing-Entscheider DACH",
    "brand_tone": "professionell, nahbar",
    "active_platforms": "instagram,facebook,linkedin,x_twitter,tiktok,youtube"
  },
  "performance_data": [ ... ],
  "competitor_data": [ ... ]
}
```

**Standalone:**
```json
{
  "sheet_url": "https://docs.google.com/spreadsheets/d/..."
}
```

### Per-Platform Processing

For each active platform, one SplitInBatches iteration produces:
1. **Claude API call** -> Structured JSON with caption, hashtags, CTA, image_prompt, video_concept
2. **Imagen 4 API call** (if needsImage) -> Base64 image data
3. **Veo 3 API call** (if needsVideo) -> Video URL or concept

### Output (Webhook Response)

```json
{
  "success": true,
  "workflow": "WF4_Content_Creator",
  "data": {
    "totalPlatforms": 6,
    "platforms": [
      {
        "platform": "instagram",
        "contentType": "feed_post",
        "captionPreview": "Die ersten 100 Zeichen der Caption...",
        "hashtagCount": 4,
        "hasImage": true,
        "hasVideo": false,
        "hasVideoConcept": false
      }
    ],
    "projectName": "MeinProjekt"
  },
  "errors": [],
  "timestamp": "2026-03-03T10:00:00.000Z"
}
```

### Persistent Storage

**Supabase `content_generated`:** One row per platform per week (UPSERT).
**Google Sheet "Content Plan":** One appended row per platform per run.

---

## Gemini API Notes (Imagen 4 + Veo 3)

### Imagen 4 API

**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/imagen-4:generateImages?key={API_KEY}`

**Request body:**
```json
{
  "instances": [
    {
      "prompt": "Professional brand photography, ..."
    }
  ],
  "parameters": {
    "sampleCount": 1,
    "aspectRatio": "3:4"
  }
}
```

**Response:**
```json
{
  "predictions": [
    {
      "bytesBase64Encoded": "...",
      "mimeType": "image/png"
    }
  ]
}
```

**Supported aspect ratios:** `1:1`, `3:4`, `4:3`, `9:16`, `16:9`

### Veo 3 API (Asynchronous)

**Submit:** `POST https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideos?key={API_KEY}`

**Request body:**
```json
{
  "instances": [
    {
      "prompt": "Vertical 9:16 short-form video..."
    }
  ],
  "parameters": {
    "aspectRatio": "9:16",
    "durationSeconds": 20
  }
}
```

**Submit response:**
```json
{
  "name": "operations/generate-video-xxxxx",
  "done": false
}
```

**Poll:** `GET https://generativelanguage.googleapis.com/v1beta/operations/generate-video-xxxxx?key={API_KEY}`

**Completed response:**
```json
{
  "name": "operations/generate-video-xxxxx",
  "done": true,
  "response": {
    "generatedVideos": [
      {
        "video": {
          "uri": "https://storage.googleapis.com/...",
          "mimeType": "video/mp4"
        }
      }
    ]
  }
}
```

**IMPORTANT:** The exact API endpoints and response formats for Imagen 4 and Veo 3 may vary. The Google Gemini API is evolving. The executor must verify the current API documentation when the Gemini API Key becomes available. The node parameters are designed to be easily adjustable.

---

## Validation Criteria

- [ ] All 31 nodes defined with correct typeVersions
- [ ] No HTTP Request nodes where native nodes exist (all 7 HTTP Requests justified above)
- [ ] All expressions use correct syntax (`={{ }}`)
- [ ] Credentials set for all nodes requiring authentication (Google Sheets, Anthropic, Supabase, Gemini)
- [ ] Error handling: `onError: continueRegularOutput` on all external API nodes
- [ ] `retryOnFail` configured on all HTTP Request nodes
- [ ] SplitInBatches: Output 0 = done, Output 1 = loop (correctly connected)
- [ ] Connections reference nodes by `name` (not `id`)
- [ ] Node positions: no overlap, no [0,0], 260px horizontal spacing
- [ ] Workflow settings include `executionOrder: "v1"`
- [ ] Structured `{ success, data, errors }` response format
- [ ] Result accumulation via `$getWorkflowStaticData('global')` (proven pattern)
- [ ] All text output in German
- [ ] Platform-specific rules correctly implemented for all 6 platforms
- [ ] Gemini API Key placeholder clearly marked for future replacement

---

*Plan created: 2026-03-03*
*Estimated execution time per run: 3-8 minutes (depends on active platforms and video generation)*
