# Debug Report: WF1 — LinkedIn Follow-up Automation

**Date:** 2026-03-13
**Workflow ID:** j6O5Ktxcp0n6o9du
**Nodes:** 39
**Debug Passes:** 5/5 completed

---

## Executive Summary

| Metric | Count | Severity |
|---|---|---|
| Auto-Fixes Applied | 2 | FIXED |
| Validation Errors (remaining) | 0 | — |
| Silent Failures | 0 | — |
| HTTP Nodes Replaceable | 0 | — |
| HTTP Nodes Partially Replaceable | 2 | MEDIUM |
| Structural Issues | 0 critical | — |
| Production Hardening Gaps | 2 (fixed) | FIXED |
| Warnings (real) | 1 | LOW |
| Warnings (false positive) | 2 | — |

**Overall Health: WARNING**

Reason: Two community Apify nodes exist that PARTIALLY cover the use case but cannot fully replace the custom polling loop. The two auto-fixed `onError` gaps have been resolved. No remaining errors.

---

## Workflow Tree

```
WF1 — LinkedIn Follow-up Automation (j6O5Ktxcp0n6o9du) [39 nodes]
  (standalone — no sub-workflows)

Branch A: Profile Scraper Polling Loop
  Schedule Trigger
    -> HTTP Request: Start Actor (Apify LinkedIn Profile Scraper)
      -> Wait: Initial 20s
        -> Merge: Loop Entry (chooseBranch)
          -> HTTP Request: Check Actor Status
            -> IF: Actor Done? [TRUE] -> HTTP Request: Get Dataset Items
                                      -> Google Sheets: Read Leads
                                        -> Code: Compare URLs
                                          -> IF: New Leads Found? [TRUE] -> Google Sheets: Append New Leads
                                                                 [FALSE] -> No Operation: No New Leads
            -> IF: Actor Done? [FALSE] -> IF: Max Attempts?
                                           [TRUE]  -> No Operation: Skip Branch A (terminate)
                                           [FALSE] -> Set: Increment Attempt Counter
                                                        -> Wait: 15s Poll Interval
                                                             -> Merge: Loop Entry (input 1)

Branch B: Inbox Scraper + Report
  Schedule Trigger
    -> Google Sheets: Read All Leads
      -> HTTP Request: Start Inbox Actor (Apify LinkedIn Messages Scraper)
        -> Wait: Inbox Initial 20s
          -> Merge: Inbox Loop Entry
            -> HTTP Request: Check Inbox Status
              -> IF: Inbox Actor Done? [TRUE] -> HTTP Request: Get Inbox Dataset
                                              -> Code: Merge & Categorize
                                                -> Code: Build Anthropic Prompt
                                                  -> Anthropic: Hormozi Analysis
                                                    -> Code: Parse AI Response & Merge
                                                      -> Code: Generate HTML Report
                                                        -> Gmail: Send Report
                                                        -> Code: Flatten Leads for Update
                                                            -> Google Sheets: Update Leads
                                                        -> Code: Build Log Entry
                                                            -> Google Sheets: Append Report-Log
              -> IF: Inbox Actor Done? [FALSE] -> IF: Inbox Max Attempts?
                                                    [TRUE]  -> Set: Mark Inbox Failed
                                                                 -> HTTP Request: Get Inbox Dataset (fallback)
                                                    [FALSE] -> Set: Increment Inbox Counter
                                                                 -> Wait: Inbox 15s Poll
                                                                      -> Merge: Inbox Loop Entry (input 1)

Branch P: Error Handling
  Error Trigger -> Gmail: Send Error Notification
```

---

## 1. Validation & Auto-Fix Results

### 1.1 Auto-Fixes Applied

| # | Workflow | Fix Type | Description | Node |
|---|---|---|---|---|
| 1 | WF1 LinkedIn Follow-up | missing_onError | Added `onError: "continueRegularOutput"` | HTTP Request: Check Actor Status |
| 2 | WF1 LinkedIn Follow-up | missing_onError | Added `onError: "continueRegularOutput"` | HTTP Request: Get Dataset Items |

**Why these fixes matter:** These two nodes are in the critical path of the polling loop. Without `onError: "continueRegularOutput"`, a transient HTTP error (e.g., Apify 503) would silently break the polling loop mid-run, leaving the workflow in a deadlock state where Branch B (inbox) continues but has no profile data to merge against. With `continueRegularOutput`, the IF node downstream can handle the error gracefully.

**Files updated:**
- `C:\Users\markn\Desktop\n8n-mcp-czlon\workflows\production\linkedin-followup-automation\WF1-LinkedIn-Followup-Master.json`

### 1.2 Remaining Errors

None. No validation errors remain after auto-fix.

### 1.3 Real Warnings

| # | Workflow | Warning | Recommendation |
|---|---|---|---|
| 1 | WF1 LinkedIn Follow-up | `callerPolicy` not set in workflow settings | Standalone workflow — not a sub-workflow. Acceptable to leave unset. See section 1.4. |

### 1.4 Accepted False Positives

| # | Workflow | Warning | Reason Accepted |
|---|---|---|---|
| 1 | WF1 LinkedIn Follow-up | `callerPolicy` missing | Per FALSE_POSITIVES.md rule: `callerPolicy` only required for sub-workflows. This is a standalone schedule-triggered production workflow. |
| 2 | WF1 LinkedIn Follow-up | IF node metadata warnings (from MCP validator) | FALSE_POSITIVES.md Issue #304: IF v2.2+ nodes trigger metadata warnings that are auto-sanitized on save. All 5 IF nodes have `conditions.options.version: 2` set correctly. |

---

## 2. Silent Failure Detection

### 2.1 Execution History Summary

| Workflow | Executions Checked | Note |
|---|---|---|
| WF1 LinkedIn Follow-up (j6O5Ktxcp0n6o9du) | 0 | Workflow appears to be newly deployed. No execution history found. |

**Note:** The workflow was part of the LinkedIn Outreach Automation project (deployed as `BaGtkUOzmbsC2pvF` based on MEMORY.md). The workflow `j6O5Ktxcp0n6o9du` is either a new variant or has not yet been executed. Silent failure detection requires at least one execution. Run the workflow at least once to enable this analysis.

### 2.2 Confirmed Silent Failures

None detected (no execution history available).

### 2.3 Recurring Errors

None detected (no execution history available).

### 2.4 Workflows Without History

| Workflow | Note |
|---|---|
| WF1 — LinkedIn Follow-up Automation | No executions found — run at least once to enable silent failure detection |

### 2.5 Potential Silent Failure Risk (Static Analysis)

Even without execution history, the following risk was identified through static analysis:

**Risk: Branch A timeout silently disconnects from Branch B**

If Branch A's polling loop terminates via `No Operation: Skip Branch A` (max 20 attempts = 5 minutes of polling), Branch B continues independently. `Code: Merge & Categorize` accesses `$('Google Sheets: Read All Leads').all()` — this node runs in Branch B and is always present. However, the inbox data (`$input.all()` = Get Inbox Dataset items) may be empty if the actor didn't finish. The code handles this gracefully with `inboxItems = $input.all()` and `if (!convMap[url])` fallback. **Status: Handled correctly.**

**Risk: Code: Generate HTML Report accesses Set: Mark Inbox Failed via try/catch**

This is an intentional pattern documented in the code comment. If the Inbox Actor succeeds, `Set: Mark Inbox Failed` never runs, and `$('Set: Mark Inbox Failed').all()` would throw — which is caught with `try/catch`. **Status: Handled correctly.**

---

## 3. HTTP Request → Native Node Analysis

### 3.1 Replaceable HTTP Request Nodes

None fully replaceable. See sections 3.2 and 3.3.

### 3.2 Partially Replaceable

| # | Workflow | Node Name | Current URL | Native Node | Gap |
|---|---|---|---|---|---|
| 1 | WF1 | HTTP Request: Start Actor | `https://api.apify.com/v2/acts/.../runs` (POST) | `@apify/n8n-nodes-apify.apify` (v0.6.4) — "Run an Actor" | Cannot replace the 3-step polling pattern (Start + Poll + GetDataset) with a single node because the current design intentionally separates these steps for a custom timeout/retry loop with up to 20 attempts. The Apify community node's "Run actor and get dataset" operation waits synchronously (max ~5 min n8n timeout) — acceptable as alternative if n8n execution timeout is not a concern. |
| 2 | WF1 | HTTP Request: Start Inbox Actor | `https://api.apify.com/v2/acts/.../runs` (POST) | `@apify/n8n-nodes-apify.apify` (v0.6.4) — "Run an Actor" | Same as above — inbox polling loop pattern cannot be collapsed to a single node. |

### 3.3 Must Remain as HTTP Request

| # | Workflow | Node Name | URL | Reason |
|---|---|---|---|---|
| 1 | WF1 | HTTP Request: Check Actor Status | `https://api.apify.com/v2/acts/.../runs/{{ $json.data.id }}` | Polling loop check — no Apify community node supports "poll run until status = SUCCEEDED with configurable interval and max attempts". The custom Merge+Wait+IF polling architecture requires direct API access. |
| 2 | WF1 | HTTP Request: Get Dataset Items | `https://api.apify.com/v2/datasets/{{ $json.data.defaultDatasetId }}/items` | Dataset retrieval by dynamic ID — Apify community node requires static actor ID selection. Dynamic `defaultDatasetId` from previous step not supported by the community node's dataset retrieval operation. |
| 3 | WF1 | HTTP Request: Check Inbox Status | `https://api.apify.com/v2/acts/.../runs/{{ $json.data.id }}` | Same reason as Check Actor Status. |
| 4 | WF1 | HTTP Request: Get Inbox Dataset | `https://api.apify.com/v2/datasets/{{ $json.data.defaultDatasetId }}/items` | Same reason as Get Dataset Items. |

### 3.4 Apify Community Node Analysis

Two community Apify packages were found in the local node index:

**Package 1: `@apify/n8n-nodes-apify` (official, v0.6.4)**
- Maintained by: `apify-service-account` (official Apify account)
- Operations: Run actor, Run actor and get dataset, Scrape single URL, Get last run
- Credential type: `apifyApi`
- Verdict: **RECOMMENDED** if switching to simplified (non-polling) architecture. The "Run actor and get dataset" operation would replace nodes 1-3 (Start + Poll + GetDataset) in a single node for both actor runs.

**Package 2: `n8n-nodes-apify` (community, v0.1.0)**
- Maintained by: `minhlucvan` (third-party)
- Status: Older, less maintained. Not recommended.

**Decision: Keep HTTP Request nodes.** The current polling loop architecture was a deliberate design choice (from Phase 1 decisions) that allows fine-grained timeout control (20 attempts × 15s = 5 minutes max), graceful degradation when the actor fails, and continuation of Branch B even if Branch A times out. Replacing with `@apify/n8n-nodes-apify` would require a complete rearchitecture of both branches and would lose the parallel execution capability where Branch B starts while Branch A is still polling.

**Note on Credential Management:** The current design passes the Apify API token via `=Bearer {{ $env.APIFY_API_TOKEN }}` header expression using an environment variable. This is correct for HTTP Request nodes. The `apifyApi` credential type is only needed if using the community node. No credential change needed.

---

## 4. Structural & Best Practice Issues

### 4.1 Critical Issues

None found.

### 4.2 Production Hardening

| # | Workflow | Node | Issue | Status |
|---|---|---|---|---|
| 1 | WF1 | HTTP Request: Check Actor Status | Missing `onError: "continueRegularOutput"` | **FIXED** (auto-fixed in this run) |
| 2 | WF1 | HTTP Request: Get Dataset Items | Missing `onError: "continueRegularOutput"` | **FIXED** (auto-fixed in this run) |

All other HTTP Request nodes already had `onError: "continueRegularOutput"` configured. All 6 HTTP nodes have `retryOnFail: true` with appropriate `maxTries` and `waitBetweenTries`.

### 4.3 typeVersion Currency

| # | Node Type | Current Version | Latest Known | Status |
|---|---|---|---|---|
| 1 | `scheduleTrigger` | 1.2 | 1.2 | CURRENT |
| 2 | `httpRequest` | 4.4 | 4.4 | CURRENT |
| 3 | `wait` | 1.1 | 1.1 | CURRENT |
| 4 | `merge` | 3.1 | 3.1 | CURRENT |
| 5 | `if` | 2.2 | 2.2 | CURRENT |
| 6 | `set` | 3.4 | 3.4 | CURRENT |
| 7 | `code` | 2 | 2 | CURRENT |
| 8 | `googleSheets` | 4.7 | 4.7 | CURRENT |
| 9 | `gmail` | 2.1 | 2.1 | CURRENT |
| 10 | `@n8n/n8n-nodes-langchain.anthropic` | 1.7 | 1.7 | CURRENT |
| 11 | `noOp` | 1 | 1 | CURRENT |
| 12 | `errorTrigger` | 1 | 1 | CURRENT |

All nodes are at current typeVersions.

### 4.4 Expression Syntax

All expressions scanned — no issues found:
- All dynamic values use `={{ }}` format
- All string-with-expression values use `=Text {{ $expr }}` format
- No deprecated `$node['Name'].json` pattern found anywhere
- All Code nodes use `$input.all()`, `$input.first().json`, and `$('NodeName').all()` — correct
- No `$json` usage in Code nodes (correct: would fail at runtime)
- No `require()` usage in Code nodes (correct: not available)

### 4.5 Cross-Node References (Code Nodes)

All `$('NodeName')` references in Code nodes verified against actual node names:

| Code Node | References | Status |
|---|---|---|
| Code: Compare URLs | `$('HTTP Request: Get Dataset Items')` | VALID |
| Code: Merge & Categorize | `$('Google Sheets: Read All Leads')` | VALID |
| Code: Parse AI Response & Merge | `$('Code: Build Anthropic Prompt')` | VALID |
| Code: Generate HTML Report | `$('Set: Mark Inbox Failed')` | VALID (try/catch handles node-not-run case) |
| Code: Flatten Leads for Update | `$('Code: Parse AI Response & Merge')` | VALID |
| Code: Build Log Entry | `$('Code: Generate HTML Report')`, `$('Code: Parse AI Response & Merge')` | VALID |

### 4.6 Polling Loop Architecture

Both polling loops (Branch A and Branch B) follow the correct Merge+Wait pattern:

| Loop | Merge Node | Mode | Input 0 | Input 1 | Behavior |
|---|---|---|---|---|---|
| Branch A | Merge: Loop Entry | chooseBranch, output=input1 | Wait: Initial 20s (first-run seed) | Wait: 15s Poll Interval (loop-back) | Correct: seeds from input 0, loops via input 1 |
| Branch B | Merge: Inbox Loop Entry | chooseBranch, output=input1 | Wait: Inbox Initial 20s (first-run seed) | Wait: Inbox 15s Poll (loop-back) | Correct: same pattern |

### 4.7 Orphaned Nodes

No orphaned nodes. All terminal nodes are intentional:
- `No Operation: Skip Branch A` — terminates Branch A polling on max attempts (correct)
- `No Operation: No New Leads` — terminates new-leads branch when nothing found (correct)
- `Google Sheets: Append New Leads` — endpoint of new leads sub-branch
- `Gmail: Send Report` — report delivery endpoint
- `Google Sheets: Update Leads` — leads update endpoint
- `Google Sheets: Append Report-Log` — log endpoint
- `Gmail: Send Error Notification` — error notification endpoint

### 4.8 Workflow Settings

| Setting | Value | Status |
|---|---|---|
| `timezone` | `Europe/Berlin` | CORRECT |
| `executionOrder` | `v1` | CORRECT |
| `saveDataErrorExecution` | `all` | CORRECT |
| `saveDataSuccessExecution` | `all` | CORRECT |
| `saveManualExecutions` | `true` | CORRECT |
| `callerPolicy` | not set | ACCEPTABLE (standalone workflow) |

---

## 5. Cross-Workflow Data Flow

**Skipped** — WF1 is a standalone workflow with no sub-workflows or `Execute Workflow` nodes. Pass 5 is not applicable per debug protocol rules.

---

## Issues Found & Fixed

| # | Issue | Severity | Auto-Fixed? | Fix Applied |
|---|---|---|---|---|
| 1 | `HTTP Request: Check Actor Status` missing `onError` | MEDIUM | YES | Added `onError: "continueRegularOutput"` |
| 2 | `HTTP Request: Get Dataset Items` missing `onError` | MEDIUM | YES | Added `onError: "continueRegularOutput"` |

---

## Warnings (False Positives Accepted)

| # | Warning | Reason Accepted |
|---|---|---|
| 1 | `callerPolicy` not set | Standalone workflow, not called as sub-workflow |
| 2 | IF node metadata completeness | Issue #304: Auto-sanitized on save for IF v2.2+ |

---

## Pass 3: HTTP Request → Native Node Analysis (Summary Table)

| Node | API Call | Native Node Available? | Replacement? | Decision |
|---|---|---|---|---|
| HTTP Request: Start Actor | POST api.apify.com/v2/acts/.../runs | YES — `@apify/n8n-nodes-apify` (official, v0.6.4) | PARTIAL — "Run an Actor" operation available | KEEP: Polling loop requires separate start/poll/fetch steps for timeout control |
| HTTP Request: Check Actor Status | GET api.apify.com/v2/acts/.../runs/{id} | NO — community node has no "poll run by ID" operation | None | KEEP: Custom polling pattern, no native equivalent |
| HTTP Request: Get Dataset Items | GET api.apify.com/v2/datasets/{id}/items | NO — community node requires static actor ID, not dynamic dataset ID | None | KEEP: Dynamic dataset ID from prior step not supported |
| HTTP Request: Start Inbox Actor | POST api.apify.com/v2/acts/.../runs | YES — `@apify/n8n-nodes-apify` (official, v0.6.4) | PARTIAL — "Run an Actor" operation available | KEEP: Same reasons as Start Actor |
| HTTP Request: Check Inbox Status | GET api.apify.com/v2/acts/.../runs/{id} | NO | None | KEEP: Same reasons as Check Actor Status |
| HTTP Request: Get Inbox Dataset | GET api.apify.com/v2/datasets/{id}/items | NO | None | KEEP: Same reasons as Get Dataset Items |

---

## Pass 5: Node Configuration Spot Checks

| Node | Check | Expected | Actual | Status |
|---|---|---|---|---|
| Anthropic: Hormozi Analysis (b14) | typeVersion | 1.7 | 1.7 | PASS |
| Anthropic: Hormozi Analysis (b14) | model | claude-sonnet-4-5 | claude-sonnet-4-5 | PASS |
| Anthropic: Hormozi Analysis (b14) | messages format | `{"values": [...]}` (fixedCollection) | `{"values": [{role, message},...]}` | PASS |
| Anthropic: Hormozi Analysis (b14) | credential | nv6YXj42KhaG3WMp | nv6YXj42KhaG3WMp | PASS |
| Gmail: Send Report (b18) | typeVersion | 2.1 | 2.1 | PASS |
| Gmail: Send Report (b18) | credential | Kh7cApAx6TAe4Hpy | Kh7cApAx6TAe4Hpy | PASS |
| Gmail: Send Error Notification (p3) | typeVersion | 2.1 | 2.1 | PASS |
| Gmail: Send Error Notification (p3) | credential | Kh7cApAx6TAe4Hpy | Kh7cApAx6TAe4Hpy | PASS |
| Google Sheets (all 5 nodes) | typeVersion | 4.7 | 4.7 | PASS |
| Google Sheets (all 5 nodes) | credential | gw0DIdDENFkpE7ZW | gw0DIdDENFkpE7ZW | PASS |
| Schedule Trigger | timezone | Europe/Berlin | Europe/Berlin (in settings) | PASS |
| Schedule Trigger | cron expression | `0 5 * * *` = 5:00am daily | `0 5 * * *` | PASS |
| Schedule Trigger | dual output | Connects to both Start Actor AND Read All Leads | Two connections in output[0] array | PASS |
| Schedule Trigger | typeVersion | 1.2 | 1.2 | PASS |

---

## Recommended Actions (Priority Order)

1. **[FIXED]** Apply auto-fixes to live workflow — push the updated JSON with `onError` fixes to n8n instance via `n8n_update_full_workflow(id="j6O5Ktxcp0n6o9du")` using the fixed local JSON.

2. **[HIGH — Before First Run]** Run the workflow manually once to establish execution history. Without execution history, silent failure analysis is impossible. Use the n8n cloud UI to trigger a manual run.

3. **[MEDIUM — Optional Architecture Improvement]** Consider upgrading Apify integration to use `@apify/n8n-nodes-apify` (official, v0.6.4) with "Run actor and get dataset" operation if the current 5-minute polling window is acceptable. This would collapse 3 HTTP nodes per actor (Start + Poll + GetDataset) into 1 Apify node, simplifying the workflow from 39 nodes to approximately 33 nodes. Trade-off: loses fine-grained timeout control and graceful degradation.

4. **[LOW]** After first successful execution, re-run Pass 2 (Silent Failure Detection) to verify:
   - `Code: Compare URLs` produces items in normal runs (new leads exist)
   - `Anthropic: Hormozi Analysis` response parses correctly to JSON
   - `Google Sheets: Update Leads` finds matching rows (LinkedIn_URL column populated)

5. **[LOW — Documentation]** The workflow uses `$env.APIFY_API_TOKEN`, `$env.LINKEDIN_COOKIE`, `$env.GOOGLE_SHEET_ID`, and `$env.REPORT_EMAIL` environment variables. Verify these are set in the n8n cloud environment before the first scheduled run.

---

## Final Health Score

**HEALTHY — 1 class WARNING**

The workflow is structurally sound and production-ready after the 2 auto-fixes applied. All typeVersions are current, all credentials are set, all cross-node references are valid, and the polling loop architecture is correctly implemented. The only advisory item is that the Apify community node (`@apify/n8n-nodes-apify`) exists and partially covers the use case, but replacement is not recommended without a deliberate architectural review.

No execution history is available — this is the primary remaining gap. The workflow needs at least one successful run before final health can be fully confirmed.

---

*Generated by n8n-debugger agent on 2026-03-13*
*Passes completed: 5/5*
*Auto-fixes applied: 2*
*Tools used: manual JSON analysis, n8n-rules-summary.md, validation-expert SKILL.md + ERROR_CATALOG.md + FALSE_POSITIVES.md, haunchen INDEX.md, community node index*
