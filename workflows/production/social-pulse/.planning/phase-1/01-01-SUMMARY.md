# Summary: Plan 1-1 (WF1 Performance Collector)

## Workflows Built

| WF | Name | n8n ID | Nodes | Status |
|---|---|---|---|---|
| WF1 | SocialPulse WF1: Performance Collector | gPlbmjGXwadiLN1N | 29 | Deployed (inactive) |

## Node Breakdown

| # | Node Name | Type | Credentials |
|---|---|---|---|
| 1 | Webhook Trigger | n8n-nodes-base.webhook v2 | None |
| 2 | Dual-Trigger Pruefung | n8n-nodes-base.if v2.2 | None |
| 3 | Konfig aus Sheet lesen | n8n-nodes-base.googleSheets v4.7 | Google Sheets OAuth2 |
| 4 | Accounts aus Sheet lesen | n8n-nodes-base.googleSheets v4.7 | Google Sheets OAuth2 |
| 5 | Konfig zusammenfuehren | n8n-nodes-base.code v2 | None |
| 6 | Plattform Dispatcher | n8n-nodes-base.code v2 | None |
| 7 | Plattform-Batches | n8n-nodes-base.splitInBatches v3 | None |
| 8 | Plattform Switch | n8n-nodes-base.switch v3.2 | None |
| 9 | Apify Instagram | @apify/n8n-nodes-apify.apify v1 | Apify MN1975 |
| 10 | Facebook Page Metriken | n8n-nodes-base.facebookGraphApi v1 | MISSING (Meta OAuth not set up) |
| 11 | Apify TikTok | @apify/n8n-nodes-apify.apify v1 | Apify MN1975 |
| 12 | Apify LinkedIn | @apify/n8n-nodes-apify.apify v1 | Apify MN1975 |
| 13 | YouTube Channel Statistiken | n8n-nodes-base.youTube v1 | YouTube OAuth2 |
| 14 | Apify X/Twitter | @apify/n8n-nodes-apify.apify v1 | Apify MN1975 |
| 15 | Parse Instagram | n8n-nodes-base.code v2 | None |
| 16 | Parse Facebook | n8n-nodes-base.code v2 | None |
| 17 | Parse TikTok | n8n-nodes-base.code v2 | None |
| 18 | Parse LinkedIn | n8n-nodes-base.code v2 | None |
| 19 | Parse YouTube | n8n-nodes-base.code v2 | None |
| 20 | Parse X/Twitter | n8n-nodes-base.code v2 | None |
| 21 | Ergebnis sammeln | n8n-nodes-base.code v2 | None |
| 22 | Apify Pause | n8n-nodes-base.wait v1.1 | None |
| 23 | Ergebnisse normalisieren | n8n-nodes-base.code v2 | None |
| 24 | Supabase Performance UPSERT | n8n-nodes-base.httpRequest v4.2 | None (header auth, placeholder keys) |
| 25 | Performance in Sheet schreiben | n8n-nodes-base.googleSheets v4.7 | Google Sheets OAuth2 |
| 26 | Run-Log vorbereiten | n8n-nodes-base.code v2 | None |
| 27 | Supabase Run-Log | n8n-nodes-base.supabase v1 | Supabase API |
| 28 | Response zusammenbauen | n8n-nodes-base.code v2 | None |
| 29 | Webhook Antwort | n8n-nodes-base.respondToWebhook v1.1 | None |

## Node Optimization

| Original | Replaced With | Reason |
|---|---|---|
| HTTP Request (Supabase UPSERT) | *Kept as HTTP Request* | Native Supabase node lacks UPSERT operation; PostgREST API with `Prefer: resolution=merge-duplicates` header required |
| Instagram API | Apify community node | No official Instagram Analytics API; Apify actor is the reliable approach |
| TikTok API | Apify community node | No native TikTok node; Apify actor is standard approach |
| LinkedIn API | Apify community node | Native LinkedIn node only supports post creation, not analytics |
| X/Twitter API | Apify community node | Native X node is limited; Apify actor provides full scraping |
| Facebook API | Native facebookGraphApi node | Used native node as planned |
| YouTube API | Native youTube node | Used native node as planned |

## Architecture Decisions

1. **Sequential persistence chain**: Normalize -> Supabase UPSERT -> Sheet Write -> Run-Log -> Supabase Run-Log -> Response -> Webhook (avoids Merge node complexity)
2. **SplitInBatches with Switch**: Each platform routes through its own API node and parse node, converging at the "Ergebnis sammeln" node before looping back
3. **Static data for result aggregation**: Uses `$getWorkflowStaticData('global')` across all parse nodes to collect results without requiring a Merge node
4. **Wait node for rate limiting**: 5-second pause between Apify calls via explicit Wait node

## Placeholders to Replace

| Placeholder | Where | Action |
|---|---|---|
| `GOOGLE_SHEET_URL_PLACEHOLDER` | Nodes 3, 4, 25 | Replace with actual Google Sheet URL after creation |
| `SUPABASE_URL_PLACEHOLDER` | Node 24 (HTTP Request URL) | Replace with actual Supabase project URL |
| `SUPABASE_API_KEY_PLACEHOLDER` | Node 24 (HTTP headers) | Replace with actual Supabase anon/service key |

## Credentials Still Needed

| Credential | Node | Status |
|---|---|---|
| Facebook Graph API OAuth2 | Facebook Page Metriken | Must be created in n8n |
| YouTube OAuth2 credential ID | YouTube Channel Statistiken | Credential exists but ID may need verification |
| Supabase API credential ID | Supabase Run-Log | Credential exists but ID is empty in JSON |

## Issues Encountered

1. **Node count**: Plan mentioned "25 nodes" but actual count is 29 (plan counted groups like 9a-9f as "Node 9"). All 29 nodes are correctly implemented.
2. **Apify `customBody` parameter**: Used `customBody` instead of `body` as per n8n-native-nodes.md reference (the UI shows "Input JSON" but internal parameter name is `customBody`).
3. **No MCP tools available**: The n8n MCP tools were not available as callable functions in this session, so deployment was done directly via the n8n REST API (POST to `/api/v1/workflows`).
4. **Facebook credential missing**: As expected, Meta OAuth is not yet set up on the n8n instance. The Facebook Graph API node is deployed without credentials.

## Files Created/Modified

- `C:/Users/markn/Desktop/n8n-mcp-czlon/workflows/production/social-pulse/wf1-performance-collector.json` -- Complete workflow JSON (29 nodes, 28 connections)
- `C:/Users/markn/Desktop/n8n-mcp-czlon/workflows/production/social-pulse/.planning/STATE.md` -- Updated with deployment info
- `C:/Users/markn/Desktop/n8n-mcp-czlon/workflows/production/social-pulse/.planning/PROJECT.md` -- Updated deployed workflows table
- `C:/Users/markn/Desktop/n8n-mcp-czlon/workflows/production/social-pulse/.planning/phase-1/01-01-SUMMARY.md` -- This summary

---
*Deployed: 2026-03-03T15:15:32.138Z*
