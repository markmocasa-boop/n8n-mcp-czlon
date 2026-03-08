# Phase 2 Verification Report

**Date:** 2026-03-08
**Verifier:** gsd-n8n-verifier (Claude Sonnet 4.6)
**Overall Status:** PASS WITH FIX APPLIED

---

## Workflows Verified

| WF | Name | n8n ID | Errors | Warnings | Result |
|---|---|---|---|---|---|
| WF1 | Sales Agent — WF1 Lead Enrichment | mPtLL7QxoW1lJKu2 | 0 | 0 | PASS |
| WF2 | Sales Agent — WF2 Lead Scoring | GAqEpcFUuLrKGYFH | 0 | 1 fixed | PASS (after fix) |

---

## Checks Performed

### WF1: Lead Enrichment

**Node structure (13 nodes):**
- Execute Workflow Trigger: typeVersion 1.1 — PASS
- IF: Has Website?: typeVersion 2.2, operator `string / notEmpty` — PASS
- Tavily: Website-Suche: community node `@tavily/n8n-nodes-tavily.tavily`, typeVersion 1, `onError: continueRegularOutput`, `retryOnFail: true`, maxTries 3 — PASS
- Tavily: Herausforderungen-Suche: same config as above — PASS
- Code: Merge Tavily Results: typeVersion 2, mode `runOnceForAllItems` — PASS
- Set: Empty Website Data: typeVersion 3.4, fields.values array — PASS
- Merge: Website-Enrichment: typeVersion 3.1, mode `passThrough`, output `input1` — PASS
- IF: Has LinkedIn?: typeVersion 2.2, operator `string / notEmpty` — PASS
- Apify: LinkedIn Scraper: community node `@apify/n8n-nodes-apify.apify`, typeVersion 1, `onError: continueRegularOutput`, `retryOnFail: true`, maxTries 2 — PASS
- Code: Extract LinkedIn Data: typeVersion 2 — PASS
- Set: Empty LinkedIn Data: typeVersion 3.4 — PASS
- Merge: LinkedIn-Enrichment: typeVersion 3.1, mode `passThrough`, output `input1` — PASS
- Code: Build WF1 Output: typeVersion 2, try/catch to handle both branches — PASS

**Connections:** All 12 connection sources map to valid node names. All connection targets exist in nodes array. No broken references.

**Credentials:**
- Tavily: `a6ZN4T8aDN1bVzeY` (Tavily account) — real ID, no placeholder — PASS
- Apify: `wWgQDWC9aV3UcUEJ` (Apify MN1975) — real ID, no placeholder — PASS

**Expression syntax:**
- All expressions use `={{ }}` wrapper — PASS
- Node references use `$('NodeName').first().json` pattern — PASS
- No `$node[]` deprecated references — PASS
- No placeholder strings (TAVILY_CREDENTIAL_ID, etc.) remaining — PASS

**Error handling:** Both Tavily nodes and Apify node have `onError: continueRegularOutput` — satisfies ERR-03/ERR-04. PASS

**Workflow settings:** `executionOrder: v1`, data saving enabled, `callerPolicy: workflowsFromSameOwner` — PASS

**API optimisation:** Zero `n8n-nodes-base.httpRequest` nodes. All external calls via native/community nodes — PASS

---

### WF2: Lead Scoring

**Node structure (11 nodes):**
- Execute Workflow Trigger: typeVersion 1.1 — PASS
- Set: Build Claude Prompt: typeVersion 3.4, `include: all` — PASS
- Basic LLM Chain: typeVersion 1.4, promptType `define`, `onError: continueRegularOutput` — PASS
- Anthropic Chat Model: typeVersion 1.3, model `claude-sonnet-4-20250514` via `mode: id`, maxTokens 1000, temp 0.3 — PASS
- Code: Parse Score JSON: typeVersion 2, handles markdown code block stripping, parse fallback — PASS
- IF: Score < 30?: typeVersion 2.2, operator `number / lt`, rightValue 30 — PASS
- Execute WF6: Set Kalt Status: typeVersion 2, `mode: id`, WF6 ID `HxOD2a8He72tvKmR`, `waitForSubWorkflow: true`, `onError: continueRegularOutput`, retryOnFail — PASS
- Set: Scoring Output (Kalt): typeVersion 3.4 — PASS
- IF: Score >= 80?: typeVersion 2.2, operator `number / gte`, rightValue 80 — PASS
- Set: Scoring Output (Heiss): typeVersion 3.4, routing `HEISS_PREMIUM` — PASS
- Set: Scoring Output (Warm): typeVersion 3.4, routing `WARM_STANDARD` — PASS

**Connections:** All valid. `Anthropic Chat Model` connects via `ai_languageModel` type to `Basic LLM Chain` — correct LangChain pattern. No broken references.

**Credentials:**
- Anthropic: `5LmibcuA2kdHKaqB` (Claude - 20260127) — real ID, no placeholder — PASS

**Expression syntax:** All `={{ }}` wrapped. No deprecated patterns. PASS

**Workflow settings:** `executionOrder: v1`, `callerPolicy: workflowsFromSameOwner` — PASS

**Score routing logic:**
- Score < 30 → Kalt path (Execute WF6 + Set KALT_STOP) — matches DATA-03 — PASS
- Score 30–79 → Standard path (Set WARM_STANDARD) — matches DATA-03 — PASS
- Score >= 80 → Premium path (Set HEISS_PREMIUM) — matches DATA-03 — PASS

---

## Issues Found and Fixed

| # | Workflow | Issue | Severity | Fix Applied | Cycles |
|---|---|---|---|---|---|
| 1 | WF2 | System prompt classified KALT as 0–49 and WARM as 50–79, inconsistent with DATA-03 requirement (< 30 = Kalt, 30–79 = Standard). Routing was numerically correct but Claude would label score-35 leads as KALT in the CRM. | WARNING | Updated system prompt to HEISS (80–100) / WARM (30–79) / KALT (0–29). Also updated Code: Parse Score JSON fallback threshold from `score >= 50` to `score >= 30`. Redeployed via PUT, verified in n8n API. | 2 |

---

## Accepted Warnings (False Positives)

| Warning | Reason Accepted |
|---|---|
| Anthropic Chat Model has no incoming `main` connection (orphan check) | LangChain sub-nodes connect via `ai_languageModel` type, not `main`. This is the correct and required pattern for LangChain nodes. Confirmed via connections API. |
| Community nodes `@tavily/n8n-nodes-tavily` and `@apify/n8n-nodes-apify` not in n8n base | Community nodes, not false errors. Credentials exist on instance confirming installation. |
| Credentials appear empty in GET response | n8n API returns only credential IDs/names in workflow GET, not full credential data. Credentials are stored separately in n8n credential vault. IDs `a6ZN4T8aDN1bVzeY`, `wWgQDWC9aV3UcUEJ`, `5LmibcuA2kdHKaqB` all confirmed set. |

---

## Requirements Coverage (Phase 2)

| Requirement | Description | Met? | Evidence |
|---|---|---|---|
| API-01 | Tavily web search, `search_depth: advanced` | Yes | WF1 nodes Tavily: Website-Suche + Tavily: Herausforderungen-Suche, both with `searchDepth: advanced` |
| API-02 | Apify LinkedIn Profile Scraper async | Yes | WF1 Apify: LinkedIn Scraper, `operation: "Run actor and get dataset"`, `apify/linkedin-profile-scraper` |
| DATA-02 | Enrichment data structured: unternehmens_beschreibung, aktuelle_herausforderungen, linkedin_headline, linkedin_about | Yes | Code: Build WF1 Output returns all 6 fields under `angereichert` key |
| AI-01 | Claude scoring with 5-Schichten framework, JSON with score/klassifikation/begründung/empfohlene_ansprache/hauptschmerz/kaufmotiv | Yes | WF2 Basic LLM Chain with system prompt containing all 5 layers, Code: Parse Score JSON extracts all 6 JSON fields |
| DATA-03 | Score routing: < 30 Kalt (stop), 30–79 Standard, >= 80 Premium | Yes | IF: Score < 30? (lt 30) → Kalt; IF: Score >= 80? (gte 80) → Heiss; else → Warm |
| ERR-03 | Tavily errors handled | Yes | Both Tavily nodes: `onError: continueRegularOutput`, `retryOnFail: true`, maxTries 3 |
| ERR-04 | Apify errors handled | Yes | Apify node: `onError: continueRegularOutput`, `retryOnFail: true`, maxTries 2 |
| ERR-05 | Score < 30 calls WF6 to set Kalt status | Yes | Execute WF6: Set Kalt Status passes `status: 'Kalt'`, `score`, `score_begründung` to WF6 (HxOD2a8He72tvKmR) |

All 8 Phase 2 requirements: **COVERED**

---

## Pre-Live-Testing Requirements (Not Phase 2 blockers)

The following are known prerequisites before running a live end-to-end test (documented in STATE.md):

- Google Sheet must be created and `SALES_AGENT_SHEET_ID` filled in WF6 + WF0
- Verify community nodes `@tavily/n8n-nodes-tavily` and `@apify/n8n-nodes-apify` are installed on meinoffice.app.n8n.cloud

---

## Skills Loaded

- n8n-validation-expert (SKILL.md, ERROR_CATALOG.md, FALSE_POSITIVES.md)
- n8n-rules-summary.md

## Validation Cycles: 2

Cycle 1: Manual checks — found score classification threshold inconsistency in WF2 system prompt and Code fallback.
Cycle 2: Fix applied + redeployed + re-verified via n8n API — confirmed correct.
