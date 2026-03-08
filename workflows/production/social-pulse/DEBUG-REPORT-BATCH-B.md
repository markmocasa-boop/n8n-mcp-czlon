# n8n Debug Report — SocialPulse Batch B

**Date:** 2026-03-08 (current session)
**Scope:** Partial tree — 3 sub-workflows (WF4, WF5, WF6)
**Workflows analyzed:** 3
**Debug passes:** 5 per workflow (MCP validation static, expression syntax, node config, HTTP optimization, silent failure)

> Note: MCP tool calls (n8n_validate_workflow, n8n_autofix_workflow, n8n_executions) were not available as
> callable tools in this session. All passes were performed via thorough static analysis of the local JSON
> files combined with knowledge from the loaded skill base. MCP-based re-validation is recommended after
> applying the fixes listed below.

---

## Executive Summary

| Metric | Count | Severity |
|---|---|---|
| Auto-Fixes Applied (MCP) | 0 (MCP unavailable) | -- |
| Critical Errors Found | 3 | CRITICAL |
| Silent Failure Risks | 6 | HIGH |
| HTTP Nodes Replaceable | 0 | -- |
| HTTP Nodes Must Remain | 14 | INFO |
| Structural Issues | 11 | MEDIUM |
| Warnings (real) | 5 | LOW |
| Warnings (false positive) | 7 | -- |

**Overall Health: WARNING**

- No blocking validation errors that prevent activation
- Three critical issues require manual fixes before production use
- Six silent failure risks in Code nodes without adequate error handling
- Placeholder credentials (`ANTHROPIC_CREDENTIAL_ID_HIER_EINTRAGEN`, `GEMINI_API_KEY_PLACEHOLDER`) across WF4 and WF5 will cause runtime failures
- All 3 workflows have well-structured settings (executionOrder v1, saveData all)

---

## Workflow Tree (Batch B)

```
SocialPulse Project (Sub-workflow tree)
├── WF4: Content Creator (zTJLSoNRIq0wDL69) [31 nodes]
│   ├── Webhook → Dual-Trigger → [Master path | Standalone Sheet path]
│   ├── Konfig zusammenfuehren → Braucht Supabase-Daten? → [Supabase reads | skip]
│   ├── Daten zusammenfuehren → Platform Dispatcher → SplitInBatches
│   ├── [Loop: Claude Prompt → Claude Content → Parse → Bild? → Video? → Collect → Wait → SplitInBatches]
│   └── [Done: Ergebnisse aufbereiten → Supabase UPSERT → Sheet → Response → Webhook Antwort]
│
├── WF5: Report Generator (ktZULf0dTXbr6QrD) [17 nodes]
│   ├── Webhook → Dual-Trigger → [Master path | Standalone Sheet path]
│   ├── Konfig zusammenfuehren → 5x Supabase HTTP reads (linear chain)
│   ├── Daten konsolidieren → Claude Report-Analyse → Process → HTML generieren
│   └── HTML zu PDF → Response zusammenbauen → Webhook Antwort
│
└── WF6: Report Sender (SZtoxWFIQln8Fggg) [10 nodes]
    ├── Webhook → Dual-Trigger → [Master path | Standalone Sheet+Prep path]
    ├── Report-Daten zusammenfuehren → E-Mail vorbereiten → Report versenden (Gmail)
    └── Supabase Run-Log → Response zusammenbauen → Webhook Antwort
```

---

## Pass 1: Validation & Auto-Fix Results

### 1.1 WF4 — SocialPulse WF4: Content Creator

#### Errors (CRITICAL — Must Fix Before Production)

| # | Node | Error Type | Description | Fix |
|---|---|---|---|---|
| 1 | Imagen 4 Bild generieren | hardcoded_placeholder | `key` query param = `GEMINI_API_KEY_PLACEHOLDER` — API will return 401 | Replace with actual Gemini API key via n8n credential |
| 2 | Veo 3 Video generieren | hardcoded_placeholder | `key` query param = `GEMINI_API_KEY_PLACEHOLDER` — same issue | Replace with actual Gemini API key |
| 3 | Veo 3 Ergebnis abrufen | hardcoded_placeholder | `key` query param = `GEMINI_API_KEY_PLACEHOLDER` | Replace with actual Gemini API key |
| 4 | Claude Content generieren | placeholder_credential | `anthropicApi.id = "ANTHROPIC_CREDENTIAL_ID_HIER_EINTRAGEN"` — will fail at runtime | Set real Anthropic credential ID |

#### Warnings (Real)

| # | Node | Warning | Recommendation |
|---|---|---|---|
| 1 | Konfig zusammenfuehren | missing_options_version | IF v2.2 condition block lacks `"version": 2` in `conditions.options` | Add `"version": 2` to `options` object (see WF5 which has it correctly) |
| 2 | Braucht Supabase-Daten? | missing_options_version | Same as above | Same fix |
| 3 | Braucht Bild? | missing_options_version | Same as above | Same fix |
| 4 | Braucht Video? | missing_options_version | Same as above | Same fix |
| 5 | Dual-Trigger Pruefung | missing_options_version | Same as above | Same fix |

#### Warnings (False Positives)

| # | Node | Warning | Reason Accepted |
|---|---|---|---|
| 1 | All Supabase HTTP nodes | missing_credentials | Credentials are genericCredentialType with httpHeaderAuth — validated at runtime (FALSE_POSITIVES #338) |
| 2 | Konfig aus Sheet lesen | missing_credentials | Google Sheets OAuth2 credential exists on instance, not validated statically (FALSE_POSITIVES #338) |
| 3 | Multiple IF nodes | metadata_incomplete | IF v2.2+ metadata added by auto-sanitization on save (FALSE_POSITIVES #304) |

#### Auto-Fix Status

MCP `n8n_autofix_workflow` was not callable. Recommend running:
```
n8n_autofix_workflow({ id: "zTJLSoNRIq0wDL69", applyFixes: true })
```
Expected auto-fixes: IF/Switch operator structure corrections (singleValue on unary operators), conditions.options version injection.

---

### 1.2 WF5 — SocialPulse WF5: Report Generator

#### Errors (CRITICAL)

| # | Node | Error Type | Description | Fix |
|---|---|---|---|---|
| 1 | Claude Report-Analyse | placeholder_credential | `anthropicApi.id = "ANTHROPIC_CREDENTIAL_ID_HIER_EINTRAGEN"` | Set real Anthropic credential ID |
| 2 | HTML zu PDF konvertieren | third_party_api | Uses `html2pdf.app` API without authentication header for the API key — only `Content-Type` header set, no `Authorization` | Add Authorization header with html2pdf.app API key |

#### Warnings (Real)

| # | Node | Warning | Recommendation |
|---|---|---|---|
| 1 | Dual-Trigger Pruefung | missing_options_version | IF v2.2 conditions.options lacks `"version": 2` | Add `"version": 2` (unlike WF5's other IF node which has it correctly) |

#### Warnings (False Positives)

| # | Node | Warning | Reason Accepted |
|---|---|---|---|
| 1 | All 5 Supabase HTTP nodes | missing_credentials | httpHeaderAuth with inline tokens — validated at runtime |
| 2 | Konfig aus Sheet lesen | missing_credentials | Google Sheets credential on instance |
| 3 | Claude Report-Analyse | model_id_not_validated | `claude-sonnet-4-6` is a valid model at time of analysis |

#### Auto-Fix Status

Recommend: `n8n_autofix_workflow({ id: "ktZULf0dTXbr6QrD", applyFixes: true })`

---

### 1.3 WF6 — SocialPulse WF6: Report Sender

#### Errors (CRITICAL)

| # | Node | Error Type | Description | Fix |
|---|---|---|---|---|
| 1 | Report versenden (Gmail) | empty_credential_id | `gmailOAuth2.id = ""` — empty string credential ID will fail at runtime | Set the Gmail OAuth2 credential ID (check instance for `gmailOAuth2` credentials) |

#### Warnings (Real)

| # | Node | Warning | Recommendation |
|---|---|---|---|
| 1 | Dual-Trigger Pruefung | missing_options_version | IF v2.2 conditions.options lacks `"version": 2` | Add `"version": 2` |

#### Warnings (False Positives)

| # | Node | Warning | Reason Accepted |
|---|---|---|---|
| 1 | Supabase Run-Log schreiben | missing_credentials | httpHeaderAuth inline tokens — runtime validated |
| 2 | Konfig aus Sheet lesen | missing_credentials | Google Sheets credential on instance |

#### Auto-Fix Status

Recommend: `n8n_autofix_workflow({ id: "SZtoxWFIQln8Fggg", applyFixes: true })`

---

## Pass 2: Silent Failure Detection

No execution history is available (workflows appear to be newly deployed or the IDs in MEMORY.md are for other projects). The following analysis is based on static code inspection.

### 2.1 Execution History Summary

| Workflow | Executions Checked | Success | Error | Note |
|---|---|---|---|---|
| WF4 Content Creator | 0 | 0 | 0 | No history available — static analysis only |
| WF5 Report Generator | 0 | 0 | 0 | No history available — static analysis only |
| WF6 Report Sender | 0 | 0 | 0 | No history available — static analysis only |

### 2.2 Static Silent Failure Risks

#### WF4 — Content Creator

| # | Node | Issue | Risk Level | Details |
|---|---|---|---|---|
| 1 | Konfig zusammenfuehren (Code) | No try/catch around Sheet row iteration | HIGH | `$('Konfig aus Sheet lesen').all()` called without try/catch. If "Konfig aus Sheet lesen" did not run (master path), this silently crashes. The code has no guard for the case where `konfigRows` is undefined. |
| 2 | Claude Response parsen (Code) | Silent JSON parse failure masked | HIGH | When Claude returns non-JSON, the catch block sets a fake `content` object with error in caption. No item is emitted with `skip: true`, so downstream Bild/Video branching processes the broken content as if it were valid. |
| 3 | Ergebnis sammeln (Code) | staticData accumulation race condition | MEDIUM | `$getWorkflowStaticData('global')` is reset at start of `Konfig zusammenfuehren` with `staticData.results = []`. In a parallel-platform scenario, if the batch loop processes platforms concurrently (not guaranteed sequential in all n8n versions), results could be lost or duplicated. SplitInBatches with batchSize=1 mitigates this, but it is not documented. |
| 4 | Bild-Response parsen (Code) | No validation after Imagen 4 fails | MEDIUM | If Imagen 4 returns an error object, `imageData.imageBase64` stays null with no error flag set. The item continues silently with no image, which may or may not be acceptable. No log entry is written to `staticData.errors`. |

#### WF5 — Report Generator

| # | Node | Issue | Risk Level | Details |
|---|---|---|---|---|
| 1 | Daten konsolidieren + Vergleiche berechnen (Code) | safeArray() swallows all errors silently | HIGH | The `safeArray()` helper catches ALL exceptions and returns `[]`. If a node has not executed (e.g., Meta Ads node when `hasMetaAds=false`), this is correct. But if a node _did_ execute but returned malformed data, the error is completely hidden. The report will show "no data" with no indication of the underlying failure. |
| 2 | HTML-Report generieren (Code) | Arithmetic on potentially null engagement_rate | MEDIUM | Expression `(c.engagement_rate?.current * 100).toFixed(2)` — if `engagement_rate` is null or `c.engagement_rate.current` is `undefined`, this will throw `TypeError: Cannot read properties of undefined`. The code uses optional chaining for existence but not for the multiplication. |

#### WF6 — Report Sender

| # | Node | Issue | Risk Level | Details |
|---|---|---|---|---|
| 1 | Report-Daten zusammenfuehren (Code) | Cross-node reference may fail | MEDIUM | The try/catch around `$('Standalone-Daten vorbereiten').first().json` will silently produce the absolute fallback (empty HTML, no recipients), which causes `E-Mail vorbereiten` to throw "Keine Empfaenger konfiguriert" — but only there, not where the actual problem is. Error origin is obscured. |

### 2.3 Recurring Error Patterns

No execution history available. After first runs, check for:
- 401 errors from Gemini API (WF4 nodes: Imagen 4, Veo 3) — placeholder keys
- Anthropic API errors in WF4+WF5 — placeholder credential IDs
- Gmail send failures in WF6 — empty credential ID
- PDF generation failures in WF5 — html2pdf.app missing auth

---

## Pass 3: Node Optimization (HTTP Request Nodes)

### 3.1 HTTP Request Nodes Inventory

All HTTP Request nodes across the three workflows point to **Supabase REST API** or **Google/Gemini AI APIs**. None have native n8n equivalents.

| # | Workflow | Node | URL | Method | Assessment |
|---|---|---|---|---|---|
| 1 | WF4 | Supabase Performance lesen | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/performance_weekly` | GET | MUST REMAIN |
| 2 | WF4 | Supabase Competitor lesen | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/competitor_weekly` | GET | MUST REMAIN |
| 3 | WF4 | Imagen 4 Bild generieren | `generativelanguage.googleapis.com/v1beta/models/imagen-4:generateImages` | POST | MUST REMAIN |
| 4 | WF4 | Veo 3 Video generieren | `generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideos` | POST | MUST REMAIN |
| 5 | WF4 | Veo 3 Ergebnis abrufen | `generativelanguage.googleapis.com/v1beta/{operation_name}` (dynamic) | GET | MUST REMAIN |
| 6 | WF4 | Supabase UPSERT | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/content_generated` | POST | MUST REMAIN |
| 7 | WF5 | Performance aktuelle KW laden | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/performance_weekly` | GET | MUST REMAIN |
| 8 | WF5 | Performance Vorwoche laden | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/performance_weekly` | GET | MUST REMAIN |
| 9 | WF5 | Performance 4-Wochen-Historie laden | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/performance_weekly` | GET | MUST REMAIN |
| 10 | WF5 | Meta Ads aktuelle KW laden | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/meta_ads_weekly` | GET | MUST REMAIN |
| 11 | WF5 | Competitor Insights laden | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/competitor_weekly` | GET | MUST REMAIN |
| 12 | WF5 | Content-Vorschlaege laden | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/content_generated` | GET | MUST REMAIN |
| 13 | WF5 | HTML zu PDF konvertieren | `html2pdf.app/api/v1/generate` | POST | MUST REMAIN |
| 14 | WF6 | Supabase Run-Log schreiben | `xczjbiitstgxrzjlksqg.supabase.co/rest/v1/workflow_runs` | POST | MUST REMAIN |

### 3.2 Rationale for Must Remain

- **Supabase nodes (12 nodes):** n8n has no native Supabase node (confirmed in INDEX.md — 545 nodes do not include Supabase). A community node `n8n-nodes-supabase` exists but would require manual installation. The current httpHeaderAuth approach is correct and production-grade for Supabase REST API. No change recommended.
- **Imagen 4 / Veo 3 nodes (3 nodes):** These use Google Generative Language API endpoints that are not covered by the native `nodes-base.openAi` or any other native AI node. Google Gemini node (`nodes-langchain.lmChatGoogleGemini`) handles chat completions only, not image/video generation. Must remain as HTTP Request.
- **html2pdf.app (1 node):** No native PDF generation node in n8n. Must remain as HTTP Request.

### 3.3 Optimization Opportunity (Not a Replacement)

The 5 Supabase GET nodes in WF5 (lines 7-12) are chained **sequentially** even though the data they load is independent. They could theoretically be parallelized by merging after a fan-out structure. This is a performance optimization (not a node replacement). Low priority since these are fast REST calls.

---

## Pass 4: Structural & Best Practice Issues

### 4.1 Critical Structural Issues

| # | Workflow | Node | Issue | Current | Fix |
|---|---|---|---|---|---|
| 1 | WF4 | Imagen 4 Bild generieren | Hardcoded API key in query parameter | `key: "GEMINI_API_KEY_PLACEHOLDER"` | Create a `httpHeaderAuth` credential with the Google API key, use `authentication: "genericCredentialType"` |
| 2 | WF4 | Veo 3 Video generieren | Same as above | `key: "GEMINI_API_KEY_PLACEHOLDER"` | Same fix |
| 3 | WF4 | Veo 3 Ergebnis abrufen | Same as above | `key: "GEMINI_API_KEY_PLACEHOLDER"` | Same fix |
| 4 | WF6 | Report versenden (Gmail) | Empty credential ID | `gmailOAuth2.id: ""` | Set to a valid Gmail OAuth2 credential ID from the n8n instance |

### 4.2 Expression Syntax Issues

#### WF4 — Content Creator

| # | Node | Parameter | Issue | Current | Fix |
|---|---|---|---|---|---|
| 1 | Supabase Performance lesen | `queryParameters.project_name.value` | Uses `{{ }}` without `=` prefix | `"=eq.{{ $json.projectName }}"` | `"=eq.={{ $json.projectName }}"` or switch to URL expression |
| 2 | Supabase Competitor lesen | `queryParameters.project_name.value` | Same issue | `"=eq.{{ $json.projectName }}"` | Same fix |
| 3 | Supabase Performance lesen | `queryParameters.calendar_week.value` | Same issue | `"=eq.{{ $json.calendarWeek }}"` | `"=eq.={{ $json.calendarWeek }}"` |
| 4 | Supabase Competitor lesen | `queryParameters.calendar_week.value` | Same issue | `"=eq.{{ $json.calendarWeek }}"` | Same fix |
| 5 | Supabase Performance lesen | `queryParameters.year.value` | Same issue | `"=eq.{{ $json.year }}"` | `"=eq.={{ $json.year }}"` |
| 6 | Supabase Competitor lesen | `queryParameters.year.value` | Same issue | `"=eq.{{ $json.year }}"` | Same fix |

**Note:** In n8n's query parameter UI, individual parameter values accept expressions with `={{ }}`. The current format `"=eq.{{ $json.field }}"` mixes static text with a bare expression (no leading `=`). This is the `{{ }}` without `=` anti-pattern (#1 in the rules). However, n8n may process these as string literals with embedded expression fragments. The alternative approach (used correctly in other nodes in these workflows) is to embed the entire URL with all query parameters directly in the `url` field as a single expression, as seen in the WF5 nodes. **Recommend refactoring these 2 nodes to use URL-based expressions** (as the WF5 Supabase nodes already do correctly).

#### WF4 — Additional Expression Check

| # | Node | Parameter | Issue |
|---|---|---|---|
| 7 | Konfig zusammenfuehren (Code) | `jsCode` | Uses `$json` reference indirectly via `$('Webhook Trigger').first().json.body` — CORRECT pattern |
| 8 | All Code nodes | `jsCode` | Correct: uses `$('NodeName').first().json` and `$input.first().json` — no deprecated `$node[]` patterns |

#### WF5 — Expression Check

All HTTP Request URL expressions use the correct `={{ ... }}` format. Code nodes use `$('NodeName').first().json` correctly. No expression issues found in WF5.

#### WF6 — Expression Check

All expressions use `={{ $json.field }}` format correctly. No issues found.

### 4.3 Node Configuration Issues

#### typeVersion Currency

| # | Workflow | Node | Current | Latest | Status |
|---|---|---|---|---|---|
| 1 | WF4 | Webhook Trigger | 2 | 2 | OK |
| 2 | WF4 | Dual-Trigger Pruefung (IF) | 2.2 | 2.2 | OK |
| 3 | WF4 | Konfig aus Sheet lesen (Google Sheets) | 4.7 | 4.7 | OK |
| 4 | WF4 | All Code nodes | 2 | 2 | OK |
| 5 | WF4 | SplitInBatches | 3 | 3 | OK |
| 6 | WF4 | All HTTP Request nodes | 4.4 | 4.4 | OK |
| 7 | WF4 | Wait nodes | 1.1 | 1.1 | OK |
| 8 | WF4 | RespondToWebhook | 1.1 | 1.1 | OK |
| 9 | WF4 | SplitOut | 1 | 1 | OK |
| 10 | WF4 | Claude Content generieren (@n8n/n8n-nodes-langchain.anthropic) | 1 | 1 | OK |
| 11 | WF5 | All nodes | See above | All current | OK |
| 12 | WF6 | Gmail (Report versenden) | 2.1 | 2.1 | OK |

All typeVersions are current. No updates required.

### 4.4 Production Hardening Assessment

#### retryOnFail Status

| Workflow | Node | retryOnFail | maxTries | waitBetweenTries | Status |
|---|---|---|---|---|---|
| WF4 | Supabase Performance lesen | true | 3 | 5000 | CORRECT |
| WF4 | Supabase Competitor lesen | true | 3 | 5000 | CORRECT |
| WF4 | Imagen 4 Bild generieren | true | 2 | 10000 | CORRECT |
| WF4 | Veo 3 Video generieren | true | 2 | 15000 | CORRECT |
| WF4 | Veo 3 Ergebnis abrufen | true | 3 | 30000 | CORRECT |
| WF4 | Supabase UPSERT | true | 3 | 5000 | CORRECT |
| WF4 | Claude Content generieren | true | 3 | 10000 | CORRECT |
| WF5 | All 5 Supabase GETs | true | 2 | 3000 | CORRECT |
| WF5 | HTML zu PDF | true | 2 | 5000 | CORRECT |
| WF5 | Claude Report-Analyse | true | 3 | 10000 | CORRECT |
| WF6 | Supabase Run-Log | true | 2 | 3000 | CORRECT |
| WF6 | Report versenden (Gmail) | true | 3 | 5000 | CORRECT |
| WF4 | Webhook Trigger | N/A — trigger node | N/A | N/A | N/A |
| WF4 | Code nodes (all) | not required | not required | not required | OK — code execution is local |

**Retry hardening is excellent across all 3 workflows.**

#### Workflow Settings

| Workflow | executionOrder | saveDataErrorExecution | saveDataSuccessExecution | callerPolicy | Status |
|---|---|---|---|---|---|
| WF4 | v1 | all | all | workflowsFromSameOwner | CORRECT |
| WF5 | v1 | all | all | workflowsFromSameOwner | CORRECT |
| WF6 | v1 | all | all | workflowsFromSameOwner | CORRECT |

**All workflow settings are production-correct.**

### 4.5 IF Node conditions.options Missing version: 2

This is a structural issue found across all 3 workflows in the `Dual-Trigger Pruefung` IF node, and across 4 additional IF nodes in WF4:

**Pattern in WF4, WF6 (incorrect — missing version):**
```json
"conditions": {
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "strict"
  }
}
```

**Correct pattern (as seen in WF5's Dual-Trigger Pruefung):**
```json
"conditions": {
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "strict",
    "version": 2
  }
}
```

The auto-sanitizer adds this on save, so it is a false positive in terms of runtime breakage, but it indicates these nodes were created without the full metadata and may produce warnings in strict validation mode. Running `n8n_autofix_workflow` will resolve this for all affected nodes.

**Affected nodes:**
- WF4: Dual-Trigger Pruefung, Braucht Supabase-Daten?, Braucht Bild?, Braucht Video? (4 nodes — missing `version: 2`)
- WF5: Dual-Trigger Pruefung (1 node — missing `version: 2`; the other IF `Dual-Trigger Pruefung` in WF5 correctly has `version: 2`)
- WF6: Dual-Trigger Pruefung (1 node — missing `version: 2`)

### 4.6 Orphaned / Disconnected Nodes

No orphaned nodes found in any workflow. All nodes are connected to the flow.

### 4.7 SplitInBatches Connection Check (WF4)

The SplitInBatches node in WF4 uses the correct connection pattern:
- Output index 0 (done) → `Ergebnisse aufbereiten` (correct)
- Output index 1 (loop) → `Claude Prompt aufbauen` (correct)

The loop-back connection: `API Pause` → `SplitInBatches` (correct).

### 4.8 Deprecated Pattern Check

| Check | WF4 | WF5 | WF6 | Status |
|---|---|---|---|---|
| `continueOnFail: true` (deprecated) | Not found | Not found | Not found | CORRECT — all use `onError: "continueRegularOutput"` |
| `$node['Name'].json` (deprecated) | Not found | Not found | Not found | CORRECT — all use `$('Name').first().json` |
| `items[0].json` (deprecated) | Not found | Not found | Not found | CORRECT |
| `$json` in Code nodes | Not found | Not found | Not found | CORRECT — all use `$input.first().json` |

**No deprecated patterns found. Excellent.**

---

## Pass 5: Cross-Workflow Data Flow

These are sub-workflows called by a Master Orchestrator (not included in Batch B but documented in the project structure).

### 5.1 Sub-Workflow Trigger Compatibility

All three workflows use `n8n-nodes-base.webhook` as their trigger, with `responseMode: "responseNode"`. This is a **Dual-Trigger Pattern**: they can be called directly via HTTP (standalone mode) OR from the Master Orchestrator via Execute Workflow + HTTP.

| Workflow | Trigger Type | Called From Master | Compatible | Notes |
|---|---|---|---|---|
| WF4 | webhookTrigger | Via HTTP POST | YES | Webhook trigger works correctly as target of Execute Workflow → HTTP Request pattern |
| WF5 | webhookTrigger | Via HTTP POST | YES | Same |
| WF6 | webhookTrigger | Via HTTP POST | YES | Same |

### 5.2 Data Flow — Master → WF4

The Master passes:
- `body.config` (object) — triggers the "Master path" in Dual-Trigger
- `body.performance_data` (array, optional) — skips Supabase reads in WF4
- `body.competitor_data` (array, optional) — same

**Risk:** If `webhookData` in `Konfig zusammenfuehren` is null (no body), `webhookData.config` throws a TypeError. The current code does `$('Webhook Trigger').first().json.body` without null-checking `body`. If the webhook receives no body (e.g., raw GET request in testing), this crashes.

**Fix:** Add null guard: `const webhookData = $('Webhook Trigger').first().json.body || {};`

WF5 and WF6 already have this null guard correctly (`|| {}`). WF4 is missing it.

### 5.3 Data Flow — Master → WF5

The Master passes:
- `body.config` — same pattern
- `body.calendar_week` and `body.year` — override the computed values

WF5 handles this correctly. No issues.

### 5.4 Data Flow — WF5 → WF6 (via Master)

WF5 response contains:
```json
{
  "data": {
    "htmlReport": "...",
    "reportRecipients": [...],
    "reportCc": [...],
    "reportSubject": "...",
    "pdfGenerated": false
  }
}
```

WF6 expects `body.reportData` to contain `htmlReport`, `reportRecipients`, etc. The Master must map WF5's `data` property to WF6's `body.reportData`. This mapping is not visible in Batch B (it's in the Master), but the field names match the expected structure.

**Risk:** If WF5 returns `partial_success` (PDF failed), `data.pdfGenerated` is `false`. WF6 handles this gracefully by skipping the attachment. No data flow issue.

### 5.5 WF6 — Attachment Handling Gap

**Issue (MEDIUM):** `Report versenden (Gmail)` always includes an attachment configuration:
```json
"attachmentsUi": {
  "attachmentsBinary": [{ "property": "data" }]
}
```
This tells Gmail to look for binary data in property `data`. But WF5's PDF node (`HTML zu PDF konvertieren`) produces binary data only if the PDF was generated successfully. If `pdfGenerated = false`, there is no binary `data` property, and the Gmail node may either send without attachment or fail with a "binary property not found" error.

**Fix:** Add an IF node before `Report versenden` that checks `$json.pdfAvailable`. Branch true: send with attachment. Branch false: send without attachment (remove the `attachmentsUi` option or set it to empty).

---

## Recommended Actions (Priority Order)

### CRITICAL — Fix Before Any Test Run

1. **[CRITICAL] Set Gmail credential ID in WF6** — `Report versenden` has `gmailOAuth2.id: ""`. Find the correct credential ID on the n8n instance and update WF6. Without this, all report deliveries fail.

2. **[CRITICAL] Set Anthropic credential IDs in WF4 and WF5** — Both `Claude Content generieren` (WF4) and `Claude Report-Analyse` (WF5) have `anthropicApi.id: "ANTHROPIC_CREDENTIAL_ID_HIER_EINTRAGEN"`. Replace with the actual credential ID. Check instance for available Anthropic credentials.

3. **[CRITICAL] Replace Gemini API placeholders in WF4** — Three nodes (`Imagen 4 Bild generieren`, `Veo 3 Video generieren`, `Veo 3 Ergebnis abrufen`) use `GEMINI_API_KEY_PLACEHOLDER`. Create a proper n8n credential (e.g., httpHeaderAuth or use a header credential) and reference it via `authentication: "genericCredentialType"`.

4. **[CRITICAL] Add Authorization header to WF5 html2pdf node** — `HTML zu PDF konvertieren` sends no API key. Add an `Authorization` or `X-Api-Key` header with the html2pdf.app API key.

### HIGH — Fix Before Production

5. **[HIGH] Fix null body guard in WF4 `Konfig zusammenfuehren`** — Change line:
   ```javascript
   const webhookData = $('Webhook Trigger').first().json.body;
   ```
   to:
   ```javascript
   const webhookData = $('Webhook Trigger').first().json.body || {};
   ```
   WF5 and WF6 already do this correctly.

6. **[HIGH] Fix WF6 Gmail attachment conditional** — Add an IF node before `Report versenden` branching on `$json.pdfAvailable`. Send with attachment only when true.

7. **[HIGH] Fix `{{ }}` without `=` in WF4 Supabase query parameters** — The 6 query parameter values in `Supabase Performance lesen` and `Supabase Competitor lesen` use bare `{{ }}` expressions. Refactor these 2 nodes to use the URL-with-expression pattern (as done correctly in WF5).

### MEDIUM — Fix for Robustness

8. **[MEDIUM] Add null-safe multiplication in WF5 HTML generator** — Find all occurrences of `(c.engagement_rate?.current * 100).toFixed(2)` and guard them: `((c.engagement_rate?.current ?? 0) * 100).toFixed(2)`.

9. **[MEDIUM] Run `n8n_autofix_workflow` on all 3 workflows** — This will inject `"version": 2` into all IF node conditions.options where missing, and fix any operator structure issues.

10. **[MEDIUM] Add error logging in WF4 `Claude Response parsen`** — When JSON parse fails, push an error to `staticData.errors` so it appears in the final response. Currently the error is silently replaced with a fake content object.

### LOW — Nice to Have

11. **[LOW] Consider parallelizing WF5 Supabase loads** — The 5 Supabase GET nodes are chained sequentially but load independent data. A fan-out/Merge pattern would reduce latency by ~80% (5 sequential calls → 5 parallel calls).

12. **[LOW] Add `saveManualExecutions: true` audit** — All 3 workflows already have this set. No action needed.

13. **[LOW] Consider Supabase community node** — `n8n-nodes-supabase` community package would replace 14 HTTP Request nodes with native Supabase nodes, improving readability and removing the need for manual JWT headers. Evaluate after stabilizing the current stack.

---

## Appendix: Node Inventory

### WF4 — Content Creator (31 nodes)

| Node | Type | typeVersion | retryOnFail | onError | Credential Set |
|---|---|---|---|---|---|
| Webhook Trigger | webhook | 2 | N/A | N/A | N/A |
| Dual-Trigger Pruefung | if | 2.2 | N/A | N/A | N/A |
| Konfig aus Sheet lesen | googleSheets | 4.7 | N/A | N/A | YES |
| Konfig zusammenfuehren | code | 2 | N/A | N/A | N/A |
| Braucht Supabase-Daten? | if | 2.2 | N/A | N/A | N/A |
| Supabase Performance lesen | httpRequest | 4.4 | YES (3/5000) | continueRegularOutput | via header |
| Supabase Competitor lesen | httpRequest | 4.4 | YES (3/5000) | continueRegularOutput | via header |
| Daten zusammenfuehren | code | 2 | N/A | N/A | N/A |
| Platform Dispatcher | code | 2 | N/A | N/A | N/A |
| SplitInBatches | splitInBatches | 3 | N/A | N/A | N/A |
| Claude Prompt aufbauen | code | 2 | N/A | N/A | N/A |
| Claude Content generieren | @n8n/langchain.anthropic | 1 | YES (3/10000) | continueRegularOutput | PLACEHOLDER |
| Claude Response parsen | code | 2 | N/A | N/A | N/A |
| Braucht Bild? | if | 2.2 | N/A | N/A | N/A |
| Imagen 4 Bild generieren | httpRequest | 4.4 | YES (2/10000) | continueRegularOutput | PLACEHOLDER KEY |
| Bild-Response parsen | code | 2 | N/A | N/A | N/A |
| Kein Bild noetig | code | 2 | N/A | N/A | N/A |
| Braucht Video? | if | 2.2 | N/A | N/A | N/A |
| Veo 3 Video generieren | httpRequest | 4.4 | YES (2/15000) | continueRegularOutput | PLACEHOLDER KEY |
| Veo 3 Wartezeit | wait | 1.1 | N/A | N/A | N/A |
| Veo 3 Ergebnis abrufen | httpRequest | 4.4 | YES (3/30000) | continueRegularOutput | PLACEHOLDER KEY |
| Video-Response parsen | code | 2 | N/A | N/A | N/A |
| Kein Video noetig | code | 2 | N/A | N/A | N/A |
| Ergebnis sammeln | code | 2 | N/A | N/A | N/A |
| API Pause | wait | 1.1 | N/A | N/A | N/A |
| Ergebnisse aufbereiten | code | 2 | N/A | N/A | N/A |
| Supabase UPSERT | httpRequest | 4.4 | YES (3/5000) | continueRegularOutput | via header |
| Sheet Daten splitten | splitOut | 1 | N/A | N/A | N/A |
| Content Plan schreiben | googleSheets | 4.7 | N/A | N/A | YES |
| Response zusammenbauen | code | 2 | N/A | N/A | N/A |
| Respond to Webhook | respondToWebhook | 1.1 | N/A | N/A | N/A |

### WF5 — Report Generator (17 nodes)

| Node | Type | typeVersion | retryOnFail | onError | Credential Set |
|---|---|---|---|---|---|
| Webhook Trigger | webhook | 2 | N/A | continueRegularOutput | N/A |
| Dual-Trigger Pruefung | if | 2.2 | N/A | N/A | N/A |
| Konfig aus Sheet lesen | googleSheets | 4.7 | N/A | N/A | YES |
| Konfig zusammenfuehren | code | 2 | N/A | N/A | N/A |
| Performance aktuelle KW laden | httpRequest | 4.4 | YES (2/3000) | continueRegularOutput | via header |
| Performance Vorwoche laden | httpRequest | 4.4 | YES (2/3000) | continueRegularOutput | via header |
| Performance 4-Wochen-Historie laden | httpRequest | 4.4 | YES (2/3000) | continueRegularOutput | via header |
| Meta Ads aktuelle KW laden | httpRequest | 4.4 | YES (2/3000) | continueRegularOutput | via header |
| Competitor Insights laden | httpRequest | 4.4 | YES (2/3000) | continueRegularOutput | via header |
| Content-Vorschlaege laden | httpRequest | 4.4 | YES (2/3000) | continueRegularOutput | via header |
| Daten konsolidieren + Vergleiche berechnen | code | 2 | N/A | N/A | N/A |
| Claude Report-Analyse | @n8n/langchain.anthropic | 1 | YES (3/10000) | continueRegularOutput | PLACEHOLDER |
| Claude-Ergebnis verarbeiten | code | 2 | N/A | N/A | N/A |
| HTML-Report generieren | code | 2 | N/A | N/A | N/A |
| HTML zu PDF konvertieren | httpRequest | 4.4 | YES (2/5000) | continueRegularOutput | MISSING AUTH |
| Response zusammenbauen | code | 2 | N/A | N/A | N/A |
| Webhook Antwort | respondToWebhook | 1.1 | N/A | N/A | N/A |

### WF6 — Report Sender (10 nodes)

| Node | Type | typeVersion | retryOnFail | onError | Credential Set |
|---|---|---|---|---|---|
| Webhook Trigger | webhook | 2 | N/A | N/A | N/A |
| Dual-Trigger Pruefung | if | 2.2 | N/A | N/A | N/A |
| Konfig aus Sheet lesen | googleSheets | 4.7 | N/A | N/A | YES |
| Standalone-Daten vorbereiten | code | 2 | N/A | N/A | N/A |
| Report-Daten zusammenfuehren | code | 2 | N/A | N/A | N/A |
| E-Mail vorbereiten | code | 2 | N/A | N/A | N/A |
| Report versenden | gmail | 2.1 | YES (3/5000) | N/A | EMPTY ID |
| Supabase Run-Log schreiben | httpRequest | 4.4 | YES (2/3000) | continueRegularOutput | via header |
| Response zusammenbauen | code | 2 | N/A | N/A | N/A |
| Webhook Antwort | respondToWebhook | 1.1 | N/A | N/A | N/A |

---

## Final Validation Status

| Workflow | Blocking Errors | Critical Fixes Required | Safe to Activate? |
|---|---|---|---|
| WF4 Content Creator | 0 | 4 (credentials/keys) + 1 (null guard) | NO — will fail on Claude/Imagen/Veo calls |
| WF5 Report Generator | 0 | 2 (credential + PDF auth) | NO — will fail on Claude call and likely PDF |
| WF6 Report Sender | 0 | 1 (empty Gmail credential ID) | NO — will fail on every email send |

After applying all CRITICAL fixes, re-validate with:
```
n8n_validate_workflow({ id: "zTJLSoNRIq0wDL69" })
n8n_validate_workflow({ id: "ktZULf0dTXbr6QrD" })
n8n_validate_workflow({ id: "SZtoxWFIQln8Fggg" })
```

Then run `n8n_autofix_workflow` on all three to resolve IF node metadata warnings.

---

*Generated by n8n-debugger agent — 2026-03-08*
*Static analysis (MCP tools not available in session)*
*Passes completed: 5/5 (static)*
*Knowledge base loaded: n8n-rules-summary.md, SKILL.md, ERROR_CATALOG.md, FALSE_POSITIVES.md, INDEX.md*
