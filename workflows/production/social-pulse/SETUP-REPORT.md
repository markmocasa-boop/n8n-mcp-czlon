# SocialPulse Setup Report

Alle 7 Workflows sind deployed. Dieser Report listet alles, was du manuell einrichten musst, bevor die Workflows laufen.

## Deployed Workflows

| WF | Name | n8n ID | Nodes |
|---|---|---|---|
| WF1 | Performance Collector | gPlbmjGXwadiLN1N | 29 |
| WF2 | Meta Ads Analyzer | lskKYkMe4HXUGcbN | 18 |
| WF3 | Competitor Monitor | YcZYIpV4JCUorkcT | 33 |
| WF4 | Content Creator | zTJLSoNRIq0wDL69 | 31 |
| WF5 | Report Generator | ktZULf0dTXbr6QrD | 17 |
| WF6 | Report Sender | SZtoxWFIQln8Fggg | 10 |
| WF7 | Master Controller | j2DQUiHlVtQP7t82 | 26 |

**Gesamt: 164 Nodes in 7 Workflows**

---

## Schritt 1: Supabase-Tabellen erstellen

Fuehre folgendes SQL im Supabase SQL-Editor aus (Dashboard > SQL Editor > New Query):

```sql
-- ============================================
-- 1. performance_weekly (WF1)
-- ============================================
CREATE TABLE IF NOT EXISTS performance_weekly (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  platform              TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x_twitter')),
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  followers             INTEGER DEFAULT 0,
  follower_growth       INTEGER DEFAULT 0,
  posts_published       INTEGER DEFAULT 0,
  impressions           BIGINT DEFAULT 0,
  reach                 BIGINT DEFAULT 0,
  likes                 INTEGER DEFAULT 0,
  comments              INTEGER DEFAULT 0,
  shares                INTEGER DEFAULT 0,
  engagement_rate       NUMERIC(6,4) DEFAULT 0,
  top_post_url          TEXT,
  top_post_engagement   INTEGER DEFAULT 0,
  worst_post_url        TEXT,
  worst_post_engagement INTEGER DEFAULT 0,
  video_views           BIGINT,
  story_views           BIGINT,
  link_clicks           INTEGER,
  watch_time_hours      NUMERIC(10,2),
  avg_view_duration_sec NUMERIC(10,2),
  collected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf1_performance_collector',
  raw_data              JSONB,
  CONSTRAINT uq_performance_weekly UNIQUE (project_name, platform, calendar_week, year)
);

-- ============================================
-- 2. meta_ads_weekly (WF2)
-- ============================================
CREATE TABLE IF NOT EXISTS meta_ads_weekly (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  ad_account_id         TEXT NOT NULL,
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
  top_3_ads             JSONB,
  bottom_3_ads          JSONB,
  facebook_spend        NUMERIC(12,2) DEFAULT 0,
  facebook_impressions  BIGINT DEFAULT 0,
  instagram_spend       NUMERIC(12,2) DEFAULT 0,
  instagram_impressions BIGINT DEFAULT 0,
  analysis_text         TEXT,
  analysis_json         JSONB,
  raw_campaigns         JSONB,
  raw_adsets            JSONB,
  raw_ads               JSONB,
  date_range_start      DATE,
  date_range_end        DATE,
  collected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf2_meta_ads_analyzer',
  CONSTRAINT uq_meta_ads_weekly UNIQUE (project_name, ad_account_id, calendar_week, year)
);

-- ============================================
-- 3. competitor_weekly (WF3)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_weekly (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  competitor_name       TEXT NOT NULL,
  platform              TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x_twitter')),
  account_url           TEXT,
  followers             INTEGER DEFAULT 0,
  posts_scraped         INTEGER DEFAULT 0,
  avg_likes             NUMERIC(12,2) DEFAULT 0,
  avg_comments          NUMERIC(12,2) DEFAULT 0,
  avg_shares            NUMERIC(12,2) DEFAULT 0,
  engagement_rate       NUMERIC(6,4) DEFAULT 0,
  top_posts             JSONB,
  top_comments          JSONB,
  analysis              JSONB,
  content_ideas         JSONB,
  collected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf3_competitor_monitor',
  raw_data              JSONB,
  CONSTRAINT uq_competitor_weekly UNIQUE (project_name, competitor_name, platform, calendar_week, year)
);

-- ============================================
-- 4. content_generated (WF4)
-- ============================================
CREATE TABLE IF NOT EXISTS content_generated (
  id                    BIGSERIAL PRIMARY KEY,
  project_name          TEXT NOT NULL,
  calendar_week         INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  platform              TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x_twitter')),
  content_type          TEXT NOT NULL CHECK (content_type IN ('feed_post', 'reel', 'story', 'short', 'tweet', 'article')),
  caption               TEXT,
  hashtags              TEXT[],
  cta                   TEXT,
  image_prompt          TEXT,
  image_url             TEXT,
  image_base64          TEXT,
  video_concept         TEXT,
  video_url             TEXT,
  status                TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'rejected')),
  collected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source           TEXT DEFAULT 'wf4_content_creator',
  raw_data              JSONB,
  CONSTRAINT uq_content_generated UNIQUE (project_name, platform, content_type, calendar_week, year)
);

-- ============================================
-- 5. workflow_runs (alle WFs)
-- ============================================
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
  platforms_ok      TEXT[],
  platforms_error   TEXT[],
  error_details     JSONB,
  items_processed   INTEGER DEFAULT 0,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_workflow ON workflow_runs (workflow_name);
CREATE INDEX IF NOT EXISTS idx_runs_project ON workflow_runs (project_name);

-- ============================================
-- RLS deaktivieren (fuer Service-Key-Zugriff)
-- ============================================
ALTER TABLE performance_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_generated ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service key" ON performance_weekly FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service key" ON meta_ads_weekly FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service key" ON competitor_weekly FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service key" ON content_generated FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service key" ON workflow_runs FOR ALL USING (true) WITH CHECK (true);
```

---

## Schritt 2: Google Sheet erstellen

Erstelle ein neues Google Sheet: **"SocialPulse - [Projektname]"** mit 8 Tabs.

### Tab 1: Konfig

| Einstellung | Wert |
|---|---|
| project_name | (dein Projektname) |
| brand_name | (Markenname) |
| brand_description | (1-2 Saetze) |
| brand_tone | professionell, freundlich |
| brand_colors | #1a73e8, #ffffff |
| active_platforms | instagram, facebook, tiktok, linkedin, youtube, x_twitter |
| active_modules | performance, meta_ads, competitor, content, report |
| report_recipients | email1@example.com |
| report_cc | (optional) |
| report_language | de |
| apify_rate_limit_ms | 5000 |
| apify_max_concurrent | 2 |

Spalten: A = Einstellung, B = Wert

### Tab 2: Plattform-Accounts

| Plattform | Account-Name | Account-ID | Account-URL | Aktiv |
|---|---|---|---|---|
| instagram | @example | 12345 | https://instagram.com/example | TRUE |
| facebook | Example Page | 67890 | https://facebook.com/example | TRUE |
| ... | ... | ... | ... | ... |

### Tab 3: Wettbewerber

| Plattform | Wettbewerber | Account-URL | Aktiv |
|---|---|---|---|
| instagram | Competitor1 | https://instagram.com/comp1 | TRUE |
| ... | ... | ... | ... |

### Tab 4: Meta Ads Konfig

| Einstellung | Wert |
|---|---|
| enabled | TRUE |
| ad_account_id | act_XXXXXXXXX |
| campaign_filter | (optional) |
| date_range_days | 7 |

### Tab 5: Performance Aktuell
Leer lassen (wird automatisch von WF1 befuellt)

### Tab 6: Content Plan
Leer lassen (wird automatisch von WF4 befuellt)

### Tab 7: Competitor Insights
Leer lassen (wird automatisch von WF3 befuellt)

### Tab 8: Run Log
Leer lassen (wird automatisch befuellt)

**Wichtig:** Notiere die Google Sheet URL. Du brauchst sie im naechsten Schritt.

---

## Schritt 3: Placeholders ersetzen

In jedem Workflow muessen Placeholder-Werte durch echte Werte ersetzt werden. Oeffne jeden Workflow in n8n und ersetze:

### GOOGLE_SHEET_URL_PLACEHOLDER (17 Stellen in 7 Workflows)

Ersetze mit der URL deines Google Sheets.

| Workflow | n8n ID | Betroffene Nodes |
|---|---|---|
| WF1 | gPlbmjGXwadiLN1N | 3 Nodes (Konfig lesen, Performance schreiben, Run Log) |
| WF2 | lskKYkMe4HXUGcbN | 2 Nodes (Konfig lesen, Meta Ads Konfig lesen) |
| WF3 | YcZYIpV4JCUorkcT | 3 Nodes (Konfig lesen, Wettbewerber lesen, Competitor Insights schreiben) |
| WF4 | zTJLSoNRIq0wDL69 | 2 Nodes (Konfig lesen, Content Plan schreiben) |
| WF5 | ktZULf0dTXbr6QrD | 1 Node (Konfig lesen) |
| WF6 | SZtoxWFIQln8Fggg | 1 Node (Konfig lesen) |
| WF7 | j2DQUiHlVtQP7t82 | 2 Nodes (Konfig-Tab lesen, Run Log schreiben) |

### SUPABASE_URL_PLACEHOLDER (15 Stellen)

Ersetze mit deiner Supabase-Projekt-URL (z.B. `https://xxxxx.supabase.co`).

| Workflow | n8n ID | Stellen |
|---|---|---|
| WF1 | gPlbmjGXwadiLN1N | 1 |
| WF2 | lskKYkMe4HXUGcbN | 1 |
| WF3 | YcZYIpV4JCUorkcT | 1 |
| WF4 | zTJLSoNRIq0wDL69 | 3 |
| WF5 | ktZULf0dTXbr6QrD | 6 |
| WF6 | SZtoxWFIQln8Fggg | 1 |
| WF7 | j2DQUiHlVtQP7t82 | 1 |

### SUPABASE_API_KEY_PLACEHOLDER (30 Stellen)

Ersetze mit deinem Supabase Service Key (nicht anon key!).
Kommt doppelt vor pro Node (einmal als `apikey` Header, einmal als `Authorization: Bearer` Header).

Gleiche Workflows wie SUPABASE_URL_PLACEHOLDER.

### ANTHROPIC_API_KEY_PLACEHOLDER (5 Stellen)

Ersetze mit deinem Anthropic API Key.

| Workflow | n8n ID | Node |
|---|---|---|
| WF2 | lskKYkMe4HXUGcbN | Claude Analyse |
| WF3 | YcZYIpV4JCUorkcT | Claude Wettbewerber-Analyse |
| WF4 | zTJLSoNRIq0wDL69 | Claude Content generieren |
| WF5 | ktZULf0dTXbr6QrD | Claude Report-Analyse |

### GEMINI_API_KEY_PLACEHOLDER (3 Stellen, nur WF4)

Ersetze mit deinem Google Gemini API Key (fuer Imagen 4 + Veo 3).

| Workflow | n8n ID | Nodes |
|---|---|---|
| WF4 | zTJLSoNRIq0wDL69 | Imagen 4 Bild generieren, Veo 3 Video generieren, Veo 3 Ergebnis abrufen |

---

## Schritt 4: Credentials einrichten

Diese n8n Credentials muessen gesetzt/erstellt werden:

| Credential | Status | Benoetigt fuer |
|---|---|---|
| Google Sheets OAuth2 | ✅ Vorhanden (gw0DIdDENFkpE7ZW) | WF1-WF7 (bereits gesetzt) |
| Apify API Token | ✅ Vorhanden (wWgQDWC9aV3UcUEJ) | WF1, WF3 (bereits gesetzt) |
| Meta (Facebook) OAuth | ❌ Einrichten | WF2: 3x facebookGraphApi Nodes |
| Gmail OAuth2 | ❌ Pruefen/Einrichten | WF6: Report versenden |
| YouTube OAuth | ✅ Vorhanden | WF1 (bereits gesetzt) |

**Meta OAuth einrichten:**
1. Facebook Developer App erstellen (falls noch nicht vorhanden)
2. Marketing API Zugriff beantragen
3. In n8n: Credentials > New > Facebook Graph API OAuth2
4. In WF2 (lskKYkMe4HXUGcbN): Credential bei "Kampagnen abrufen", "Anzeigengruppen abrufen", "Anzeigen abrufen" setzen

**Gmail OAuth einrichten:**
1. In n8n: Credentials > New > Gmail OAuth2 (falls nicht vorhanden)
2. In WF6 (SZtoxWFIQln8Fggg): Credential bei "Report versenden" Node setzen

---

## Schritt 5: Testen

### Reihenfolge zum Testen:

1. **WF1 einzeln testen** (Webhook POST an `/socialpulse-performance`)
   - Minimaltest: Nur 1-2 Plattformen aktiv setzen
   - Pruefen: Supabase `performance_weekly` + Sheet "Performance Aktuell"

2. **WF2 einzeln testen** (Webhook POST an `/socialpulse-meta-ads`)
   - Braucht Meta OAuth! Ohne OAuth: "Meta Ads aktiv? = FALSE" umgehen
   - Pruefen: Supabase `meta_ads_weekly`

3. **WF3 einzeln testen** (Webhook POST an `/socialpulse-competitor`)
   - Braucht mindestens 1 Wettbewerber im Sheet
   - Pruefen: Supabase `competitor_weekly` + Sheet "Competitor Insights"

4. **WF4 einzeln testen** (Webhook POST an `/socialpulse-content`)
   - Braucht Daten aus WF1+WF3 in Supabase (oder per Webhook-Body senden)
   - Braucht Gemini API Key fuer Bilder/Videos
   - Pruefen: Supabase `content_generated` + Sheet "Content Plan"

5. **WF5 einzeln testen** (Webhook POST an `/socialpulse-report`)
   - Braucht Daten aus WF1-WF4 in Supabase
   - Pruefen: HTML- und PDF-Output im Response

6. **WF6 einzeln testen** (Webhook POST an `/socialpulse-sender`)
   - Braucht Gmail OAuth + Report-Daten im Body
   - Pruefen: E-Mail im Posteingang

7. **WF7 Master-Controller testen** (Webhook POST an `/socialpulse-master`)
   - Orchestriert alle 6 Sub-Workflows
   - Pruefen: Alle Outputs + Run Log

### Webhook-Test-Body (Beispiel fuer Standalone):

```json
{
  "sheet_url": "https://docs.google.com/spreadsheets/d/DEINE_SHEET_ID/edit"
}
```

---

## Zusammenfassung To-Do

- [ ] Supabase: 5 Tabellen + Indizes + RLS Policies erstellen (SQL oben)
- [ ] Google Sheet: 8 Tabs erstellen + Konfig befuellen
- [ ] GOOGLE_SHEET_URL_PLACEHOLDER ersetzen (7 Workflows, 17 Stellen)
- [ ] SUPABASE_URL_PLACEHOLDER ersetzen (7 Workflows, 15 Stellen)
- [ ] SUPABASE_API_KEY_PLACEHOLDER ersetzen (7 Workflows, 30 Stellen)
- [ ] ANTHROPIC_API_KEY_PLACEHOLDER ersetzen (4 Workflows, 5 Stellen)
- [ ] GEMINI_API_KEY_PLACEHOLDER ersetzen (1 Workflow, 3 Stellen)
- [ ] Meta (Facebook) OAuth einrichten + in WF2 setzen
- [ ] Gmail OAuth pruefen + in WF6 setzen
- [ ] WF1-WF7 einzeln testen
- [ ] WF7 End-to-End testen
