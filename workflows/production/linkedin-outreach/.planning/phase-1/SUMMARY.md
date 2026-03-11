# Summary: Plan 1-1 — LinkedIn Outreach Generator (WF1)

## Workflows Built

| WF | Name | n8n ID | Nodes | Status |
|---|---|---|---|---|
| WF1 | LinkedIn Outreach Generator | BaGtkUOzmbsC2pvF | 18 | Deployed (inactive) |

## Node Overview

| # | Node | Type | Version |
|---|---|---|---|
| 1 | Form Trigger | formTrigger | 2.2 |
| 2 | Read Connections Sheet | googleSheets | 4.5 |
| 3 | Filter Contacts | filter | 2 |
| 4 | Check LinkedIn URL | if | 2.2 |
| 5 | Write Kein URL | googleSheets | 4.5 |
| 6 | Loop Contacts | splitInBatches | 3 |
| 7 | Scrape LinkedIn Profile | httpRequest | 4.4 |
| 8 | Check Apify Data | if | 2.2 |
| 9 | Prepare Full Context | set | 3.4 |
| 10 | Prepare Fallback Context | set | 3.4 |
| 11 | Generate DM Full | chainLlm | 1.7 |
| 12 | OpenAI Model Full | lmChatOpenAi | 1.2 |
| 13 | Generate DM Fallback | chainLlm | 1.7 |
| 14 | OpenAI Model Fallback | lmChatOpenAi | 1.2 |
| 15 | Set Full Output | set | 3.4 |
| 16 | Set Fallback Output | set | 3.4 |
| 17 | Merge Paths | merge | 3 |
| 18 | Write Output Sheet | googleSheets | 4.5 |

## Node Optimization (Phase 2 Result)

| Original Node | Decision | Reason |
|---|---|---|
| HTTP Request → Apify API | Kept as HTTP Request | Native Apify node (`@apify/n8n-nodes-apify.apify`) returns individual items (one per record), not an array. The downstream `Check Apify Data` node checks `Array.isArray($json)` which requires the HTTP Request returning a direct JSON array response. Using HTTP Request preserves the expected data shape. |

## Filter Logic Design

The Filter Contacts node uses boolean expression conditions (one per filter field):

```
For each field (Position, Region, Branche, Mitarbeiteranzahl):
  Expression evaluates to true IF:
    - Form field is empty/null/undefined (skip condition = pass all)
    OR
    - Contact field contains the form field value (case-insensitive)
All 4 conditions combined with AND combinator
```

This is simpler and more reliable than trying to use the filter node's native OR/AND group nesting.

## Issues Encountered & Fixed

1. **tags field read-only**: The n8n API rejected `tags` as a read-only field on workflow creation. Fixed by removing `tags` from the POST body before creating.

2. **Apify native node vs HTTP Request**: Initially planned to use native `@apify/n8n-nodes-apify.apify` node. Reverted to HTTP Request because the native node returns dataset items as individual n8n items (one per array element), while the Check Apify Data node expects `$json` to be the full array. HTTP Request returns the full array as `$json`.

3. **Filter node implementation**: The Filter node v2 with nested OR/AND groups is complex to configure via JSON. Replaced with boolean expression approach (one condition per field, each containing the full OR logic as a JS expression) — simpler and equally effective.

## Files Created

- `C:/Users/markn/Desktop/n8n-mcp-czlon/workflows/production/linkedin-outreach/WF1-linkedin-outreach-generator.json` — Workflow JSON (18 nodes)

## Setup Instructions (Required Before First Use)

### 1. Google Sheets Spreadsheet ID

In the n8n workflow, update these 3 nodes with your actual Google Sheets spreadsheet ID:
- **Read Connections Sheet** — Node parameter `documentId`
- **Write Kein URL** — Node parameter `documentId`
- **Write Output Sheet** — Node parameter `documentId`

Replace `GOOGLE_SHEET_ID_HIER_EINTRAGEN` with the ID from your Google Sheets URL:
`https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### 2. OpenAI Credential

Update **OpenAI Model Full** and **OpenAI Model Fallback** nodes:
- Find your OpenAI credential ID in n8n (Settings → Credentials → find your OpenAI credential → note the ID)
- Replace `OPENAI_CREDENTIAL_ID` in both nodes

### 3. Google Sheets Structure

**Source sheet** (Tab: `Connections`):
```
Column A: FirstName
Column B: LastName
Column C: EmailAddress
Column D: Company
Column E: Position
Column F: ConnectedOn
Column G: LinkedInURL
Column H: Region (optional enrichment)
Column I: Branche (optional enrichment)
Column J: Mitarbeiteranzahl (optional enrichment)
```

**Output sheet** — Create a tab named `DM-Output` with these headers:
```
FirstName | LastName | Company | Position | LinkedInURL | GeneratedDM | Status | GeneratedAt
```

### 4. Apify Rate Limits

The Scrape LinkedIn Profile node uses a 120-second timeout for Apify scraping. Apify's LinkedIn scraper is rate-limited — for large contact lists, the loop will take time. Consider limiting form filter inputs to smaller batches (e.g., 10-20 contacts per run).

### 5. Workflow Activation

The workflow does NOT need to be active — it is triggered on-demand via the Form Trigger URL. Open the Form Trigger node in n8n to get the form URL.

## Requirements Coverage

| Requirement | Status |
|---|---|
| TRIG-01: n8n Form Trigger | Done |
| TRIG-02: 4 filter fields (Position, Region, Branche, Mitarbeiter) | Done |
| DATA-01: Read from Google Sheets Connections | Done |
| DATA-02: Filter by form criteria | Done |
| DATA-03: Loop per contact | Done |
| API-01: Apify LinkedIn Profile Scraper | Done |
| API-02: Error handling (onError: continueErrorOutput) | Done |
| API-03: Fallback path when no Apify data | Done |
| AI-01: OpenAI gpt-4o-mini for DM generation | Done |
| AI-02: German language, max 300 words, personal + open question | Done |
| OUT-01: Write to DM-Output sheet | Done |
| OUT-02: Status field (Entwurf/Fallback/Kein URL) | Done |
| ERR-01: Kein URL contacts logged separately | Done |
| ERR-02: GeneratedAt timestamp on all output rows | Done |
