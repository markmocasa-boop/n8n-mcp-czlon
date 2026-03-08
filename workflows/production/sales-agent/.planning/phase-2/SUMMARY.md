# Summary: Phase 2 — Enrichment & Scoring

## Status: DEPLOYED ✓

Both workflows deployed on 2026-03-08 via n8n REST API (X-N8N-API-KEY).

## Workflows Deployed

| WF | Name | n8n ID | Nodes | Status |
|---|---|---|---|---|
| WF1 | Sales Agent — WF1 Lead Enrichment | mPtLL7QxoW1lJKu2 | 13 | Deployed, Inactive (credentials pending) |
| WF2 | Sales Agent — WF2 Lead Scoring | GAqEpcFUuLrKGYFH | 11 | Deployed, Inactive (credentials pending) |

## Local File Paths

- `C:\Users\markn\Desktop\n8n-mcp-czlon\workflows\production\sales-agent\WF1-Lead-Enrichment.json`
- `C:\Users\markn\Desktop\n8n-mcp-czlon\workflows\production\sales-agent\WF2-Lead-Scoring.json`

## Node Optimization (Phase 2 check)

| Original | Decision | Reason |
|---|---|---|
| HTTP Request → Tavily | Community node used (`@tavily/n8n-nodes-tavily.tavily`) | Native Tavily community node exists per PLAN.md |
| HTTP Request → Apify | Community node used (`@apify/n8n-nodes-apify.apify`) | Native Apify community node exists, credential `wWgQDWC9aV3UcUEJ` already active |
| HTTP Request → Anthropic | LangChain nodes used (`nodes-langchain.lmChatAnthropic` + `nodes-langchain.chainLlm`) | Native LangChain Anthropic nodes available |

## Credential Placeholders Still Needed

| Placeholder | Node(s) | Action Required |
|---|---|---|
| `TAVILY_CREDENTIAL_ID` | WF1: Tavily: Website-Suche, Tavily: Herausforderungen-Suche | Create Tavily API credential in n8n, replace placeholder |
| `ANTHROPIC_CREDENTIAL_ID` | WF2: Anthropic Chat Model | Create Anthropic API credential in n8n, replace placeholder |

## Community Nodes Required

| Package | Status |
|---|---|
| `@apify/n8n-nodes-apify` | Likely installed (credential exists) |
| `@tavily/n8n-nodes-tavily` | Must verify — install via Settings > Community Nodes if not present |

## Architecture Decisions Made

- **WF2 final merge removed**: Per PLAN.md recommendation — each branch (Kalt/Heiss/Warm) is terminal.
  WF0 receives the output from whichever branch executed (n8n Execute Workflow returns last item).
- **WF1 Code: Build WF1 Output**: Uses try/catch to access website data from whichever branch
  fired (Code: Merge Tavily Results or Set: Empty Website Data).
- **WF2 Anthropic model**: Uses `mode: "id"` instead of `mode: "list"` to ensure
  `claude-sonnet-4-20250514` is accepted even if not in dropdown.
- **callerPolicy**: NOT included in API payload (set separately in n8n workflow settings UI).

## Validation Notes

Before live testing:
- Verify `@tavily/n8n-nodes-tavily` is installed on meinoffice.app.n8n.cloud
- Fill `TAVILY_CREDENTIAL_ID` with real credential ID after creating it
- Fill `ANTHROPIC_CREDENTIAL_ID` with real credential ID after creating it
- Test WF1 with website URL (Tavily branch) and without (empty data branch)
- Test WF2 with score > 80 (Heiss), 30-79 (Warm), < 30 (Kalt + WF6 called)

## Files Created

- `production/sales-agent/WF1-Lead-Enrichment.json` — 13-node enrichment workflow (Tavily + Apify)
- `production/sales-agent/WF2-Lead-Scoring.json` — 11-node scoring workflow (Claude + routing)
- `.planning/phase-2/SUMMARY.md` — this file
