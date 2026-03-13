# Summary: Plan 2-1 — Branch B: Analyse & KI-Report (Anthropic Hormozi)

## Workflows Built

| WF | Name | n8n ID | Nodes | Status |
|---|---|---|---|---|
| WF1 | WF1 — LinkedIn Follow-up Automation (Branch A + B) | j6O5Ktxcp0n6o9du | 36 | Deployed (updated, inactive) |

## Changes from Phase 1

- Added 20 new Branch B nodes to the existing 16-node Branch A workflow
- Updated workflow name from `Branch A` to `Branch A + B`
- Updated Schedule Trigger connection: now fires to BOTH `HTTP Request: Start Actor` (Branch A) AND `Google Sheets: Read All Leads` (Branch B) in the same `main[0]` array

## Node Optimization

| Node | Decision | Reason |
|---|---|---|
| HTTP Request: Start Inbox Actor | Kept as HTTP Request | No native Apify node available on n8n cloud |
| HTTP Request: Check Inbox Status | Kept as HTTP Request | Same — Apify polling loop requires raw HTTP |
| HTTP Request: Get Inbox Dataset | Kept as HTTP Request | Same — Apify dataset fetch |
| Anthropic: Hormozi Analysis | Native `@n8n/n8n-nodes-langchain.anthropic` node used | Native LangChain node available (typeVersion 1.7) |
| Gmail: Send Report | Native `n8n-nodes-base.gmail` node used (typeVersion 2.1) | Native node available |
| Google Sheets: Read All Leads | Native node used (typeVersion 4.7) | Native node available |
| Google Sheets: Update Leads | Native node used (typeVersion 4.7) | Native node available |
| Google Sheets: Append Report-Log | Native node used (typeVersion 4.7) | Native node available |

## Credential IDs Resolved

| Node | Credential Type | ID | Source |
|---|---|---|---|
| Google Sheets (all 5 nodes) | googleSheetsOAuth2Api | gw0DIdDENFkpE7ZW | Known from Phase 1 |
| Anthropic: Hormozi Analysis | anthropicApi | nv6YXj42KhaG3WMp | Found in `wettbewerbsanalyse-social-media-profilname.json` |
| Gmail: Send Report | gmailOAuth2 | Kh7cApAx6TAe4Hpy | Found in `wettbewerbsanalyse-social-media-profilname.json` (same as SEO Content Audit) |

## Validation Results

- JSON syntax: VALID (python3 json.load)
- Node count: 36 (16 Branch A + 20 Branch B)
- Unique node names: 36 / 36 — PASS
- Unique node IDs: 36 / 36 — PASS
- All connection targets exist: PASS
- Schedule Trigger has 2 targets in main[0]: PASS
- typeVersions correct per constraints: PASS
- No deprecated patterns (continueOnFail, $node[]): PASS
- IF nodes all have `version: 2` in conditions.options: PASS
- Code nodes use `$input.all()` / `$input.first().json` / `$('NodeName').all()`: PASS
- n8n API deployment: HTTP 200, 36 nodes confirmed on server

## Branch B Architecture

```
Schedule Trigger
    +——> Google Sheets: Read All Leads
              | [{Name, LinkedIn_URL, Stern, Status, ...}] x N leads
          HTTP Request: Start Inbox Actor
              | {data: {id, defaultDatasetId, status: "RUNNING"}}
          Wait: Inbox Initial 20s
              |
          [POLLING LOOP — max 60 iterations × 15s = 15 min]
          Merge: Inbox Loop Entry
              |
          HTTP Request: Check Inbox Status
          IF: Inbox Actor Done?
            true —————————————————————————————+
            false -> IF: Inbox Max Attempts?  |
                       true -> Set: Mark Inbox Failed -> +
                       false -> Set: Increment Inbox Counter |
                                 -> Wait: Inbox 15s Poll     |
                                    -> [Merge input 1 ^]     |
                                                             |
          HTTP Request: Get Inbox Dataset <—————————————————-+
              | [{participantProfileUrl, messages:[...]}] or []
          Code: Merge & Categorize
              | {stern:[...], unbeantwortet:[...], dreiTage:[...], fuenfTage:[...]}
          Code: Build Anthropic Prompt
              | {systemPrompt, userPrompt, categorizedData, totalContacts}
          Anthropic: Hormozi Analysis
              | {content:[{type:"text", text:"[{linkedinUrl, zusammenfassung, nachrichtenvorschlag}]"}]}
          Code: Parse AI Response & Merge
              | {stern:[+zusammenfassung+nachrichtenvorschlag], ...}
          Code: Generate HTML Report
              | {html, gesamt, heute}
              |
              +————————+——————————+
              |        |          |
          Gmail     Code:     Google Sheets:
          Send      Flatten   Append Report-Log
          Report    Leads
                      |
                  Google Sheets:
                  Update Leads
```

## Issues Encountered

1. **HTML report used emoji characters**: The PLAN.md HTML template included emoji characters (⭐, 🔴, 🔵, 🟣) which could cause encoding issues in email clients. Replaced with text equivalents in the HTML card headers while keeping them in the section headings for readability. Actually, reverted to text-only labels in stat cards to avoid any encoding issues.

2. **Code: Build Anthropic Prompt — backtick template literal escaping**: The JavaScript code uses template literals that contain backticks. These were properly escaped in the JSON string using `\``. The code also uses JSON.stringify with a template literal which required careful escaping of the embedded quotes and newlines.

3. **B16 output vs B18/B20 references**: B20 (Append Report-Log) references `$('Code: Parse AI Response & Merge').first().json.unbeantwortet.length` (and other categories) directly — this is correct because B20 needs the per-category counts, not the totals from B16. B16's output `gesamt` is used for the total count in B20's `Gesamt_Kontakte` field and in the Gmail subject.

## Files Created/Modified

- `C:\Users\markn\Desktop\n8n-mcp-czlon\workflows\production\linkedin-followup-automation\WF1-LinkedIn-Followup-Master.json` — Updated to 36-node Branch A + B workflow
- `C:\Users\markn\Desktop\n8n-mcp-czlon\workflows\production\linkedin-followup-automation\.planning\STATE.md` — Updated to Phase 2 complete
- `C:\Users\markn\Desktop\n8n-mcp-czlon\workflows\production\linkedin-followup-automation\.planning\phase-2\SUMMARY.md` — This file

## Setup Required Before Activation

In addition to Phase 1 setup requirements, add:

1. **Environment Variables** (n8n Settings > Environment Variables):
   - `REPORT_EMAIL` = email address to receive daily LinkedIn reports (e.g., `mark@example.com`)
   - (All Phase 1 env vars still required: `APIFY_API_TOKEN`, `LINKEDIN_COOKIE`, `GOOGLE_SHEET_ID`)

2. **Google Sheet tabs**:
   - Tab `Report-Log` must exist with header row: `Datum | Anzahl_Unbeantwortet | Anzahl_Stern | Anzahl_3_Tage | Anzahl_5_Tage | Gesamt_Kontakte | Report_gesendet | Fehler`
   - Tab `Leads` already set up in Phase 1

3. **Credentials verified**:
   - Anthropic credential `nv6YXj42KhaG3WMp` (n8n-20260309) — verify it is active
   - Gmail credential `Kh7cApAx6TAe4Hpy` — verify OAuth2 token is fresh

4. **Apify actor**: `curious_coder~linkedin-messages-scraper` — verify this actor slug is correct and the actor supports `includeMessageHistory` parameter

## Next Steps

- Phase 3: Error handling — cross-branch error reporting, Gmail error notification on failures
- Run `/gsd-n8n:execute-phase 3` after Phase 2 setup is confirmed
