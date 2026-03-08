---
phase: 2
plan: 1
workflows: [WF1, WF2]
type: n8n-workflow
---

# Plan 2-1: Enrichment & Scoring

## Objective

Deploy WF1 (Lead Enrichment) and WF2 (Lead Scoring) as full sub-workflows replacing the Phase 1 stubs.
WF1 enriches a lead via Tavily web search and Apify LinkedIn scraping.
WF2 scores the enriched lead via Claude and routes by score.
Both are called by WF0 Master Orchestrator via Execute Workflow Node.

Requirements covered: API-01, API-02, DATA-02, AI-01, DATA-03, ERR-03, ERR-04, ERR-05

---

## Key Architecture Decisions

### Tavily: Use Community Node (not HTTP Request)

A native Tavily community node exists: `@tavily/n8n-nodes-tavily`
Node type: `@tavily/n8n-nodes-tavily.tavily`
This replaces HTTP Request for Tavily — cleaner credential handling.
The node supports `query` parameter with a `search` resource operation.

### Apify: Use Community Node Operation "Run an Actor and Get Dataset"

Community node `@apify/n8n-nodes-apify` (type: `@apify/n8n-nodes-apify.apify`) has the operation
"Run an Actor and Get Dataset" which runs the actor, waits for completion, and returns dataset items.
This eliminates the need for manual polling logic entirely.
Existing credential ID: `wWgQDWC9aV3UcUEJ` (Apify MN1975)

### Claude: Basic LLM Chain + Anthropic Chat Model (LangChain nodes)

- `nodes-langchain.lmChatAnthropic` typeVersion 1.3 — the language model
- `nodes-langchain.chainLlm` typeVersion 1.4 — the chain that executes the prompt
- Anthropic Chat Model connects to Basic LLM Chain via `ai_languageModel` connection type
- Credential placeholder: `ANTHROPIC_CREDENTIAL_ID`

### Sub-WF Trigger: executeWorkflowTrigger typeVersion 1.1

Both WF1 and WF2 use `n8n-nodes-base.executeWorkflowTrigger` as entry point.
WF0 calls them via `n8n-nodes-base.executeWorkflow`.
callerPolicy: `workflowsFromSameOwner`

### WF1 Update Strategy

WF1-Stub (n8n ID: `mPtLL7QxoW1lJKu2`) will be replaced via `n8n_update_full_workflow`.
WF2-Stub (n8n ID: `GAqEpcFUuLrKGYFH`) will be replaced via `n8n_update_full_workflow`.

---

## WF1: Lead Enrichment

### Purpose

Receives lead data from WF0, searches for company info via Tavily, scrapes LinkedIn profile
via Apify, merges results into structured enrichment JSON, and returns to WF0.

### Trigger

`n8n-nodes-base.executeWorkflowTrigger` typeVersion 1.1

### Input Data Shape (from WF0)

```json
{
  "lead_id": "LEAD-001",
  "vorname": "Max",
  "nachname": "Mustermann",
  "email": "max@firma.de",
  "unternehmen": "Mustermann GmbH",
  "position": "Vertriebsleiter",
  "branche": "Software / SaaS",
  "mitarbeiter_anzahl": "50-200",
  "website": "https://mustermann.de",
  "linkedin_url": "https://linkedin.com/in/max",
  "notizen": "Interesse an CRM",
  "status": "Neu"
}
```

### Node Chain

```
[1] Execute Workflow Trigger
  ↓ (main)
[2] IF: Has Website?
  → true (main output 0):
    [3] Tavily: Website-Suche
      ↓
    [4] Tavily: Herausforderungen-Suche
      ↓
    [5] Code: Merge Tavily Results
  → false (main output 1):
    [6] Set: Empty Website Data
  ↓ (both branches rejoin via Merge node)
[7] Merge: Website-Enrichment
  ↓
[8] IF: Has LinkedIn?
  → true (main output 0):
    [9] Apify: LinkedIn Scraper
      ↓
    [10] Code: Extract LinkedIn Data
  → false (main output 1):
    [11] Set: Empty LinkedIn Data
  ↓ (both branches rejoin via Merge node)
[12] Merge: LinkedIn-Enrichment
  ↓
[13] Code: Build WF1 Output JSON
```

### Node Specifications

---

#### Node 1: Execute Workflow Trigger

```json
{
  "id": "wf1-trigger",
  "name": "Execute Workflow Trigger",
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1,
  "position": [100, 300],
  "parameters": {}
}
```

---

#### Node 2: IF: Has Website?

Checks whether `$json.website` is non-empty.

```json
{
  "id": "wf1-if-website",
  "name": "IF: Has Website?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [350, 300],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "website-check",
          "leftValue": "={{ $json.website }}",
          "rightValue": "",
          "operator": {
            "type": "string",
            "operation": "notEmpty"
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

---

#### Node 3: Tavily: Website-Suche

Searches for company description using the website URL as context.
Uses community Tavily node (resource: search, operation: query).

```json
{
  "id": "wf1-tavily-website",
  "name": "Tavily: Website-Suche",
  "type": "@tavily/n8n-nodes-tavily.tavily",
  "typeVersion": 1,
  "position": [600, 150],
  "parameters": {
    "resource": "search",
    "operation": "query",
    "query": "={{ $('Execute Workflow Trigger').first().json.unternehmen + ' ' + $('Execute Workflow Trigger').first().json.website + ' Unternehmen Beschreibung Leistungen' }}",
    "options": {
      "searchDepth": "advanced",
      "maxResults": 3,
      "includeAnswer": true
    }
  },
  "credentials": {
    "tavilyApi": {
      "id": "TAVILY_CREDENTIAL_ID",
      "name": "Tavily account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note: If the Tavily community node's credential type is named differently, the executor should
check the credential type from the node's source. The credential type is `tavilyApi`.

---

#### Node 4: Tavily: Herausforderungen-Suche

Second Tavily search — finds current company challenges.

```json
{
  "id": "wf1-tavily-challenges",
  "name": "Tavily: Herausforderungen-Suche",
  "type": "@tavily/n8n-nodes-tavily.tavily",
  "typeVersion": 1,
  "position": [850, 150],
  "parameters": {
    "resource": "search",
    "operation": "query",
    "query": "={{ $('Execute Workflow Trigger').first().json.unternehmen + ' ' + $('Execute Workflow Trigger').first().json.branche + ' Herausforderungen Probleme 2024 2025' }}",
    "options": {
      "searchDepth": "advanced",
      "maxResults": 3,
      "includeAnswer": true
    }
  },
  "credentials": {
    "tavilyApi": {
      "id": "TAVILY_CREDENTIAL_ID",
      "name": "Tavily account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

---

#### Node 5: Code: Merge Tavily Results

Combines the two Tavily searches into a single enrichment object.

```json
{
  "id": "wf1-code-tavily-merge",
  "name": "Code: Merge Tavily Results",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1100, 150],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// Tavily Website search result is in current input\n// The Herausforderungen search was run just before this node\nconst websiteItems = $input.all();\n\n// Extract answer or results text from first Tavily result\nfunction extractTavilyText(items) {\n  if (!items || items.length === 0) return '';\n  const item = items[0].json;\n  // Tavily community node returns answer field or results array\n  if (item.answer) return item.answer;\n  if (item.results && item.results.length > 0) {\n    return item.results.map(r => r.content || r.snippet || '').join(' ').substring(0, 800);\n  }\n  if (item.content) return String(item.content).substring(0, 800);\n  return JSON.stringify(item).substring(0, 400);\n}\n\nconst websiteText = extractTavilyText(websiteItems);\n\nreturn [{\n  json: {\n    unternehmens_beschreibung: websiteText || '',\n    tavily_website_raw: websiteItems[0]?.json || {}\n  }\n}];"
  }
}
```

Note on Tavily chaining: Node 3 → Node 4 → Node 5. Node 5 only has access to the output of Node 4
(Herausforderungen). We need to restructure: use a Code node that makes BOTH Tavily calls OR
use the approach below — run both Tavily nodes in sequence but store intermediate result.

**REVISED APPROACH for Node 5**: Since n8n Code nodes can only access nodes referenced by name
from the execution context, Node 5 receives data from Node 4 as `$input`, and references Node 3
result via `$('Tavily: Website-Suche').first().json`.

```javascript
// Code: Merge Tavily Results — CORRECTED version
const websiteResult = $('Tavily: Website-Suche').first().json;
const challengesResult = $input.first().json;

function extractText(result) {
  if (!result) return '';
  if (result.answer) return result.answer;
  if (result.results && result.results.length > 0) {
    return result.results.map(r => r.content || r.snippet || '').join(' ').substring(0, 800);
  }
  if (result.content) return String(result.content).substring(0, 800);
  return '';
}

return [{
  json: {
    unternehmens_beschreibung: extractText(websiteResult),
    aktuelle_herausforderungen: extractText(challengesResult)
  }
}];
```

Final parameters for Node 5:

```json
{
  "id": "wf1-code-tavily-merge",
  "name": "Code: Merge Tavily Results",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1100, 150],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "const websiteResult = $('Tavily: Website-Suche').first().json;\nconst challengesResult = $input.first().json;\n\nfunction extractText(result) {\n  if (!result) return '';\n  if (result.answer) return result.answer;\n  if (result.results && result.results.length > 0) {\n    return result.results.map(r => r.content || r.snippet || '').join(' ').substring(0, 800);\n  }\n  if (result.content) return String(result.content).substring(0, 800);\n  return '';\n}\n\nreturn [{\n  json: {\n    unternehmens_beschreibung: extractText(websiteResult),\n    aktuelle_herausforderungen: extractText(challengesResult)\n  }\n}];"
  }
}
```

---

#### Node 6: Set: Empty Website Data

Used when lead has no website. Passes empty enrichment fields forward.

```json
{
  "id": "wf1-set-empty-website",
  "name": "Set: Empty Website Data",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [600, 450],
  "parameters": {
    "fields": {
      "values": [
        {"name": "unternehmens_beschreibung", "value": ""},
        {"name": "aktuelle_herausforderungen", "value": ""}
      ]
    },
    "options": {},
    "include": "selected"
  }
}
```

---

#### Node 7: Merge: Website-Enrichment

Merges the TRUE branch (Code: Merge Tavily Results) and FALSE branch (Set: Empty Website Data).
Uses mergeByPosition mode so output is always a single item.

```json
{
  "id": "wf1-merge-website",
  "name": "Merge: Website-Enrichment",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.1,
  "position": [1350, 300],
  "parameters": {
    "mode": "passThrough",
    "output": "input1",
    "options": {}
  }
}
```

Note: Use `passThrough` mode with `output: "input1"` (first arriving input wins).
This ensures the website enrichment data flows through regardless of which branch fired.
The merge node receives from both branches and passes the first-arriving item.

---

#### Node 8: IF: Has LinkedIn?

```json
{
  "id": "wf1-if-linkedin",
  "name": "IF: Has LinkedIn?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1600, 300],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "linkedin-check",
          "leftValue": "={{ $('Execute Workflow Trigger').first().json.linkedin_url }}",
          "rightValue": "",
          "operator": {
            "type": "string",
            "operation": "notEmpty"
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

---

#### Node 9: Apify: LinkedIn Scraper

Uses community Apify node operation "Run an Actor and Get Dataset".
This operation starts the actor AND waits for it to complete, then returns the dataset.
No manual polling needed — the node handles the async wait internally.

Actor: `apify/linkedin-profile-scraper`

```json
{
  "id": "wf1-apify-linkedin",
  "name": "Apify: LinkedIn Scraper",
  "type": "@apify/n8n-nodes-apify.apify",
  "typeVersion": 1,
  "position": [1850, 150],
  "parameters": {
    "operation": "Run actor and get dataset",
    "actorId": {
      "mode": "id",
      "value": "apify/linkedin-profile-scraper"
    },
    "body": "={{ JSON.stringify({ startUrls: [{ url: $('Execute Workflow Trigger').first().json.linkedin_url }], maxRequestsPerCrawl: 1 }) }}"
  },
  "credentials": {
    "apifyApi": {
      "id": "wWgQDWC9aV3UcUEJ",
      "name": "Apify MN1975"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 2,
  "waitBetweenTries": 10000
}
```

Note on `body` parameter: The community Apify node accepts the actor input as a JSON string
in the `body` field for the "Run actor and get dataset" operation. Verify exact parameter name
during execution by checking the node's UI or source. Alternative parameter name may be `input`.

If the actorId requires `mode: "list"` (as per community node docs), use:
```json
"actorId": {
  "mode": "id",
  "value": "apify/linkedin-profile-scraper"
}
```
If "id" mode is not supported, use `"mode": "list"` and select the actor from the Apify account.

Timeout note: The "Run actor and get dataset" operation waits until the actor completes.
n8n Cloud default execution timeout is 1 hour, so a 3-minute Apify actor will complete fine.
No explicit timeout configuration needed at the n8n level.

---

#### Node 10: Code: Extract LinkedIn Data

Parses the Apify dataset response to extract the LinkedIn profile fields we need.

```json
{
  "id": "wf1-code-linkedin",
  "name": "Code: Extract LinkedIn Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [2100, 150],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "const apifyItems = $input.all();\n\n// Apify returns one item per dataset row\n// LinkedIn scraper typically returns profile data in first item\nconst profile = apifyItems.length > 0 ? apifyItems[0].json : {};\n\n// Common LinkedIn scraper output fields vary by actor version\n// Try multiple field name conventions\nconst headline = profile.headline || profile.title || profile.jobTitle || '';\nconst about = profile.about || profile.summary || profile.description || '';\nconst fullName = profile.fullName || (profile.firstName ? `${profile.firstName} ${profile.lastName}` : '') || '';\nconst company = profile.companyName || profile.currentCompany || '';\n\nreturn [{\n  json: {\n    linkedin_headline: headline,\n    linkedin_about: about,\n    linkedin_name: fullName,\n    linkedin_current_company: company\n  }\n}];"
  }
}
```

---

#### Node 11: Set: Empty LinkedIn Data

```json
{
  "id": "wf1-set-empty-linkedin",
  "name": "Set: Empty LinkedIn Data",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1850, 450],
  "parameters": {
    "fields": {
      "values": [
        {"name": "linkedin_headline", "value": ""},
        {"name": "linkedin_about", "value": ""},
        {"name": "linkedin_name", "value": ""},
        {"name": "linkedin_current_company", "value": ""}
      ]
    },
    "options": {},
    "include": "selected"
  }
}
```

---

#### Node 12: Merge: LinkedIn-Enrichment

```json
{
  "id": "wf1-merge-linkedin",
  "name": "Merge: LinkedIn-Enrichment",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.1,
  "position": [2350, 300],
  "parameters": {
    "mode": "passThrough",
    "output": "input1",
    "options": {}
  }
}
```

---

#### Node 13: Code: Build WF1 Output JSON

Combines all enrichment data with the original lead data and returns the final enrichment payload.
Accesses the trigger data via explicit node reference.

```json
{
  "id": "wf1-code-output",
  "name": "Code: Build WF1 Output",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [2600, 300],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "const trigger = $('Execute Workflow Trigger').first().json;\nconst current = $input.first().json;\n\n// Website enrichment was stored in Merge: Website-Enrichment\n// LinkedIn enrichment is in current item (from Merge: LinkedIn-Enrichment)\n// BUT the website data was lost after the second merge — we need to access it differently\n\n// Since both merges use passThrough, the LinkedIn merge output contains LinkedIn fields only.\n// We need to retrieve website enrichment from the earlier node.\nlet websiteData = {};\ntry {\n  const websiteNode = $('Code: Merge Tavily Results').first().json;\n  websiteData = websiteNode;\n} catch(e) {\n  // Website branch was not executed (no website URL)\n  try {\n    const emptyWebsite = $('Set: Empty Website Data').first().json;\n    websiteData = emptyWebsite;\n  } catch(e2) {\n    websiteData = { unternehmens_beschreibung: '', aktuelle_herausforderungen: '' };\n  }\n}\n\nreturn [{\n  json: {\n    lead_id: trigger.lead_id,\n    angereichert: {\n      unternehmens_beschreibung: websiteData.unternehmens_beschreibung || '',\n      aktuelle_herausforderungen: websiteData.aktuelle_herausforderungen || '',\n      linkedin_headline: current.linkedin_headline || '',\n      linkedin_about: current.linkedin_about || '',\n      linkedin_name: current.linkedin_name || '',\n      linkedin_current_company: current.linkedin_current_company || ''\n    }\n  }\n}];"
  }
}
```

---

### WF1 Connections JSON

```json
{
  "Execute Workflow Trigger": {
    "main": [
      [{"node": "IF: Has Website?", "type": "main", "index": 0}]
    ]
  },
  "IF: Has Website?": {
    "main": [
      [{"node": "Tavily: Website-Suche", "type": "main", "index": 0}],
      [{"node": "Set: Empty Website Data", "type": "main", "index": 0}]
    ]
  },
  "Tavily: Website-Suche": {
    "main": [
      [{"node": "Tavily: Herausforderungen-Suche", "type": "main", "index": 0}]
    ]
  },
  "Tavily: Herausforderungen-Suche": {
    "main": [
      [{"node": "Code: Merge Tavily Results", "type": "main", "index": 0}]
    ]
  },
  "Code: Merge Tavily Results": {
    "main": [
      [{"node": "Merge: Website-Enrichment", "type": "main", "index": 0}]
    ]
  },
  "Set: Empty Website Data": {
    "main": [
      [{"node": "Merge: Website-Enrichment", "type": "main", "index": 1}]
    ]
  },
  "Merge: Website-Enrichment": {
    "main": [
      [{"node": "IF: Has LinkedIn?", "type": "main", "index": 0}]
    ]
  },
  "IF: Has LinkedIn?": {
    "main": [
      [{"node": "Apify: LinkedIn Scraper", "type": "main", "index": 0}],
      [{"node": "Set: Empty LinkedIn Data", "type": "main", "index": 0}]
    ]
  },
  "Apify: LinkedIn Scraper": {
    "main": [
      [{"node": "Code: Extract LinkedIn Data", "type": "main", "index": 0}]
    ]
  },
  "Code: Extract LinkedIn Data": {
    "main": [
      [{"node": "Merge: LinkedIn-Enrichment", "type": "main", "index": 0}]
    ]
  },
  "Set: Empty LinkedIn Data": {
    "main": [
      [{"node": "Merge: LinkedIn-Enrichment", "type": "main", "index": 1}]
    ]
  },
  "Merge: LinkedIn-Enrichment": {
    "main": [
      [{"node": "Code: Build WF1 Output", "type": "main", "index": 0}]
    ]
  }
}
```

### WF1 Settings

```json
{
  "executionOrder": "v1",
  "saveDataErrorExecution": "all",
  "saveDataSuccessExecution": "all",
  "saveManualExecutions": true,
  "callerPolicy": "workflowsFromSameOwner"
}
```

### WF1 Output Data Shape (returned to WF0)

```json
{
  "lead_id": "LEAD-001",
  "angereichert": {
    "unternehmens_beschreibung": "Mustermann GmbH ist ein SaaS-Anbieter...",
    "aktuelle_herausforderungen": "Skalierung des Vertriebs...",
    "linkedin_headline": "Vertriebsleiter bei Mustermann GmbH",
    "linkedin_about": "Erfahrener Vertriebsprofi...",
    "linkedin_name": "Max Mustermann",
    "linkedin_current_company": "Mustermann GmbH"
  }
}
```

### WF1 Error Handling

- Tavily nodes: `onError: "continueRegularOutput"` — if search fails, empty data flows through
- Apify node: `onError: "continueRegularOutput"` — if scraper fails, empty LinkedIn data flows
- All enrichment failures are non-fatal — the Code: Build WF1 Output node uses `|| ''` fallbacks
- No hard failures in WF1 — Lead Scoring (WF2) proceeds even with empty enrichment

---

## WF2: Lead Scoring

### Purpose

Receives lead data + enrichment from WF0, builds a structured prompt, calls Claude via
Basic LLM Chain, parses the JSON response, routes by score, and calls WF6 for Kalt leads.

### Trigger

`n8n-nodes-base.executeWorkflowTrigger` typeVersion 1.1

### Input Data Shape (from WF0, after WF1)

```json
{
  "lead_id": "LEAD-001",
  "vorname": "Max",
  "nachname": "Mustermann",
  "position": "Vertriebsleiter",
  "unternehmen": "Mustermann GmbH",
  "mitarbeiter_anzahl": "50-200",
  "branche": "Software / SaaS",
  "notizen": "Interesse an CRM",
  "status": "Neu",
  "angereichert": {
    "unternehmens_beschreibung": "...",
    "aktuelle_herausforderungen": "...",
    "linkedin_headline": "...",
    "linkedin_about": "..."
  }
}
```

### Node Chain

```
[1] Execute Workflow Trigger
  ↓
[2] Set: Build Claude Prompt
  ↓
[3] Basic LLM Chain (+ Anthropic Chat Model as sub-node)
  ↓
[4] Code: Parse Score JSON
  ↓
[5] IF: Score < 30?
  → true (main output 0):
    [6] Execute WF6: Set Kalt Status
      ↓
    [7] Set: Scoring Output (Kalt)
  → false (main output 1):
    [8] IF: Score >= 80?
      → true (main output 0):
        [9] Set: Scoring Output (Heiss)
      → false (main output 1):
        [10] Set: Scoring Output (Warm)
  ↓
[11] Merge: Rejoin All Branches
```

### Node Specifications

---

#### Node 1: Execute Workflow Trigger

```json
{
  "id": "wf2-trigger",
  "name": "Execute Workflow Trigger",
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1,
  "position": [100, 300],
  "parameters": {}
}
```

---

#### Node 2: Set: Build Claude Prompt

Builds the user-facing prompt text that will be sent to Claude.
The system prompt is configured directly in the Basic LLM Chain node.

```json
{
  "id": "wf2-set-prompt",
  "name": "Set: Build Claude Prompt",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [350, 300],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "claude_prompt",
          "value": "={{ 'Lead-Daten:\\n- Name: ' + $json.vorname + ' ' + $json.nachname + '\\n- Position: ' + $json.position + '\\n- Unternehmen: ' + $json.unternehmen + ' (' + $json.mitarbeiter_anzahl + ' Mitarbeiter, Branche: ' + $json.branche + ')\\n- Notizen: ' + ($json.notizen || 'keine') + '\\n- Unternehmens-Beschreibung: ' + ($json.angereichert?.unternehmens_beschreibung || 'nicht verfügbar') + '\\n- Herausforderungen: ' + ($json.angereichert?.aktuelle_herausforderungen || 'nicht verfügbar') + '\\n- LinkedIn Headline: ' + ($json.angereichert?.linkedin_headline || 'nicht verfügbar') + '\\n\\nBewerte diesen Lead.' }}"
        }
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

Note on `include: "all"`: This passes through ALL existing fields (lead_id, vorname, etc.) PLUS
adds the new `claude_prompt` field. The Basic LLM Chain will only use `claude_prompt`.

---

#### Node 3: Basic LLM Chain

The chain uses the Anthropic Chat Model as its language model (via ai_languageModel connection).
The system prompt (5-Schichten-Framework) is defined here.
The user prompt comes from the `claude_prompt` field set in Node 2.

```json
{
  "id": "wf2-llm-chain",
  "name": "Basic LLM Chain",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [600, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ $json.claude_prompt }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein erfahrener B2B-Vertriebsexperte im DACH-Markt.\nBewerte Leads anhand des folgenden 5-Schichten Sales Frameworks:\n\nSCHICHT 1 – PSYCHOLOGIE: Ist der Lead empfänglich? (Signale für Offenheit, Schmerzen, Kaufmotive)\nSCHICHT 2 – METHODIK: Ist der Lead qualifiziert? (Entscheider, Budget, Bedarf, Zeitrahmen – BANT)\nSCHICHT 3 – PITCH-BEREITSCHAFT: Gibt es einen konkreten Anlass für ein Gespräch?\nSCHICHT 4 – POSITIONIERUNG: Passt der Lead zur Zielgruppe (DACH, B2B, relevante Branche)?\nSCHICHT 5 – POTENZIAL: Langfristiges Relationship-Potenzial (Unternehmensgröße, Wachstum, Netzwerk)\n\nGib einen Score von 0–100 zurück sowie eine kurze Begründung (max. 3 Sätze).\nKlassifiziere zusätzlich: HEISS (80–100) / WARM (50–79) / KALT (0–49)\n\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\n{\"score\": 75, \"klassifikation\": \"WARM\", \"begründung\": \"...\", \"empfohlene_ansprache\": \"direkt\", \"hauptschmerz\": \"...\", \"kaufmotiv\": \"Gewinn\"}"
        }
      ]
    }
  }
}
```

Note on `messages` parameter: The Basic LLM Chain typeVersion 1.4 uses `messages.messageValues`
for additional messages (like SystemMessage). The main prompt is in `text`. This adds the system
message as context. The exact parameter structure for system messages in chainLlm may need
validation — if the `messages` parameter does not work as shown, use the Anthropic Chat Model's
built-in system prompt field instead (some versions support it via `options.systemPrompt`).

Fallback approach if `messages.messageValues` is not supported:
Remove `messages` from chainLlm parameters, and instead configure the system message via
the Anthropic Chat Model node's `options` by adding a system prompt as a prepended instruction
in the `claude_prompt` Set node (prepend the system prompt text to the user prompt string).

---

#### Node 3b: Anthropic Chat Model (sub-node)

Connects to Basic LLM Chain via `ai_languageModel` connection type.
Position is below the Basic LLM Chain at the same X coordinate.

```json
{
  "id": "wf2-anthropic",
  "name": "Anthropic Chat Model",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [600, 500],
  "parameters": {
    "model": {
      "mode": "list",
      "value": "claude-sonnet-4-20250514",
      "cachedResultName": "Claude Sonnet 4 (claude-sonnet-4-20250514)"
    },
    "options": {
      "maxTokensToSample": 1000,
      "temperature": 0.3
    }
  },
  "credentials": {
    "anthropicApi": {
      "id": "ANTHROPIC_CREDENTIAL_ID",
      "name": "Anthropic account"
    }
  }
}
```

Note on model value: `claude-sonnet-4-20250514` is the required model per REQUIREMENTS.md AI-11.
The node's model list may not include this version in the dropdown — use `mode: "id"` if "list"
mode does not accept the string:
```json
"model": {
  "mode": "id",
  "value": "claude-sonnet-4-20250514"
}
```

---

#### Node 4: Code: Parse Score JSON

Parses Claude's JSON response. Handles markdown code fence cleanup. Has full try/catch.

```json
{
  "id": "wf2-code-parse",
  "name": "Code: Parse Score JSON",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [850, 300],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "const trigger = $('Execute Workflow Trigger').first().json;\n\n// Basic LLM Chain output is in $input — field is 'text' or 'output'\nconst rawOutput = $input.first().json.text || $input.first().json.output || $input.first().json.response || '';\n\nlet parsed = {};\nlet parseError = false;\n\ntry {\n  // Remove potential markdown code fences\n  const cleaned = rawOutput\n    .replace(/```json\\n?/g, '')\n    .replace(/```\\n?/g, '')\n    .trim();\n  parsed = JSON.parse(cleaned);\n} catch(e) {\n  parseError = true;\n  parsed = {\n    score: 0,\n    klassifikation: 'KALT',\n    begründung: 'JSON-Parsing fehlgeschlagen: ' + e.message,\n    empfohlene_ansprache: 'direkt',\n    hauptschmerz: '',\n    kaufmotiv: 'Gewinn'\n  };\n}\n\nconst score = parseInt(parsed.score) || 0;\nconst klassifikation = parsed.klassifikation || (score >= 80 ? 'HEISS' : score >= 50 ? 'WARM' : 'KALT');\n\nreturn [{\n  json: {\n    // Pass through all original lead data from trigger\n    ...trigger,\n    // Add scoring result\n    score: score,\n    klassifikation: klassifikation,\n    score_begründung: parsed.begründung || '',\n    empfohlene_ansprache: parsed.empfohlene_ansprache || 'direkt',\n    hauptschmerz: parsed.hauptschmerz || '',\n    kaufmotiv: parsed.kaufmotiv || 'Gewinn',\n    parse_error: parseError,\n    raw_claude_output: rawOutput\n  }\n}];"
  }
}
```

---

#### Node 5: IF: Score < 30?

Routes Kalt leads to WF6 for status update. Score < 30 = Kalt (ERR-05).

```json
{
  "id": "wf2-if-kalt",
  "name": "IF: Score < 30?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1100, 300],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "score-kalt-check",
          "leftValue": "={{ $json.score }}",
          "rightValue": 30,
          "operator": {
            "type": "number",
            "operation": "lt"
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

---

#### Node 6: Execute WF6: Set Kalt Status

Calls WF6 (CRM Updater) to set lead status = "Kalt" in Google Sheets.
WF6 n8n ID: `HxOD2a8He72tvKmR`

```json
{
  "id": "wf2-exec-wf6-kalt",
  "name": "Execute WF6: Set Kalt Status",
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 2,
  "position": [1350, 150],
  "parameters": {
    "workflowId": {
      "mode": "id",
      "value": "HxOD2a8He72tvKmR"
    },
    "workflowInputs": {
      "mappingMode": "defineBelow",
      "value": {
        "lead_id": "={{ $json.lead_id }}",
        "updates": "={{ JSON.stringify({ status: 'Kalt', score: $json.score, score_begründung: $json.score_begründung }) }}",
        "aktion": "scoring_abgeschlossen",
        "status": "Kalt"
      }
    },
    "options": {
      "waitForSubWorkflow": true
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 2,
  "waitBetweenTries": 5000
}
```

Note on WF6 input format: Check WF6's expected input schema. WF6 was built in Phase 1.
The exact field names and structure WF6 expects for a status update should be verified against
the WF6 workflow definition. Common pattern from Phase 1: `lead_id`, `updates` (object or string),
`aktion`, `status`.

---

#### Node 7: Set: Scoring Output (Kalt)

Standardizes the output for the Kalt branch before the final merge.

```json
{
  "id": "wf2-set-output-kalt",
  "name": "Set: Scoring Output (Kalt)",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1600, 150],
  "parameters": {
    "fields": {
      "values": [
        {"name": "routing", "value": "KALT_STOP"}
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

---

#### Node 8: IF: Score >= 80?

Routes Premium (HEISS) leads vs. Standard (WARM) leads.

```json
{
  "id": "wf2-if-heiss",
  "name": "IF: Score >= 80?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1350, 450],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "score-heiss-check",
          "leftValue": "={{ $json.score }}",
          "rightValue": 80,
          "operator": {
            "type": "number",
            "operation": "gte"
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

---

#### Node 9: Set: Scoring Output (Heiss)

```json
{
  "id": "wf2-set-output-heiss",
  "name": "Set: Scoring Output (Heiss)",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1600, 350],
  "parameters": {
    "fields": {
      "values": [
        {"name": "routing", "value": "HEISS_PREMIUM"}
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

---

#### Node 10: Set: Scoring Output (Warm)

```json
{
  "id": "wf2-set-output-warm",
  "name": "Set: Scoring Output (Warm)",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1600, 550],
  "parameters": {
    "fields": {
      "values": [
        {"name": "routing", "value": "WARM_STANDARD"}
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

---

#### Node 11: Merge: Rejoin All Branches

Collects all three scoring branches (Kalt, Heiss, Warm) into a single output.
Uses passThrough with input1 — the first arriving item wins (all produce the same structure).

```json
{
  "id": "wf2-merge-final",
  "name": "Merge: Rejoin All Branches",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.1,
  "position": [1850, 350],
  "parameters": {
    "mode": "passThrough",
    "output": "input1",
    "options": {}
  }
}
```

Note: The final Merge node waits for inputs. Since only ONE branch fires per execution
(either Kalt OR Heiss OR Warm), the merge will only receive 1 input. Use passThrough mode.
However, a 3-input merge can cause issues if n8n waits for all inputs. Consider using
a Switch node instead, or chain the branches sequentially.

**Alternative final step**: Instead of a 3-way merge, the executor can use the last Set node in
each branch as the terminal node and let WF0 handle the output from whichever branch executed.
When Execute Workflow is used, the caller (WF0) receives the last item produced by any execution
path. No explicit merge needed — n8n Execute Workflow returns the final output automatically.

**Recommended**: Remove Node 11 entirely and let each branch's Set node be the terminal.
The executor should test both approaches and use whichever validates cleanly.

---

### WF2 Connections JSON

```json
{
  "Execute Workflow Trigger": {
    "main": [
      [{"node": "Set: Build Claude Prompt", "type": "main", "index": 0}]
    ]
  },
  "Set: Build Claude Prompt": {
    "main": [
      [{"node": "Basic LLM Chain", "type": "main", "index": 0}]
    ]
  },
  "Anthropic Chat Model": {
    "ai_languageModel": [
      [{"node": "Basic LLM Chain", "type": "ai_languageModel", "index": 0}]
    ]
  },
  "Basic LLM Chain": {
    "main": [
      [{"node": "Code: Parse Score JSON", "type": "main", "index": 0}]
    ]
  },
  "Code: Parse Score JSON": {
    "main": [
      [{"node": "IF: Score < 30?", "type": "main", "index": 0}]
    ]
  },
  "IF: Score < 30?": {
    "main": [
      [{"node": "Execute WF6: Set Kalt Status", "type": "main", "index": 0}],
      [{"node": "IF: Score >= 80?", "type": "main", "index": 0}]
    ]
  },
  "Execute WF6: Set Kalt Status": {
    "main": [
      [{"node": "Set: Scoring Output (Kalt)", "type": "main", "index": 0}]
    ]
  },
  "Set: Scoring Output (Kalt)": {
    "main": [
      [{"node": "Merge: Rejoin All Branches", "type": "main", "index": 0}]
    ]
  },
  "IF: Score >= 80?": {
    "main": [
      [{"node": "Set: Scoring Output (Heiss)", "type": "main", "index": 0}],
      [{"node": "Set: Scoring Output (Warm)", "type": "main", "index": 0}]
    ]
  },
  "Set: Scoring Output (Heiss)": {
    "main": [
      [{"node": "Merge: Rejoin All Branches", "type": "main", "index": 1}]
    ]
  },
  "Set: Scoring Output (Warm)": {
    "main": [
      [{"node": "Merge: Rejoin All Branches", "type": "main", "index": 2}]
    ]
  }
}
```

### WF2 Settings

```json
{
  "executionOrder": "v1",
  "saveDataErrorExecution": "all",
  "saveDataSuccessExecution": "all",
  "saveManualExecutions": true,
  "callerPolicy": "workflowsFromSameOwner"
}
```

### WF2 Output Data Shape (returned to WF0)

```json
{
  "lead_id": "LEAD-001",
  "vorname": "Max",
  "nachname": "Mustermann",
  "score": 72,
  "klassifikation": "WARM",
  "score_begründung": "Lead zeigt klares BANT-Profil...",
  "empfohlene_ansprache": "direkt",
  "hauptschmerz": "Manuelle CRM-Pflege",
  "kaufmotiv": "Effizienz",
  "routing": "WARM_STANDARD",
  "angereichert": { "..." : "..." }
}
```

### WF2 Error Handling

- Basic LLM Chain: If Claude fails → `onError: "continueRegularOutput"` on the LLM Chain
- Code: Parse Score JSON: Full try/catch — returns score=0, klassifikation=KALT on parse failure
- Execute WF6: `onError: "continueRegularOutput"` — WF6 failure does not stop scoring output
- Score < 30 branch always calls WF6 to update CRM status (ERR-05 compliance)

---

## Credentials Required

| Node | Credential Type | ID | Status |
|---|---|---|---|
| Apify: LinkedIn Scraper | `apifyApi` | `wWgQDWC9aV3UcUEJ` | Available |
| Tavily: Website-Suche | `tavilyApi` | `TAVILY_CREDENTIAL_ID` | Must create |
| Tavily: Herausforderungen-Suche | `tavilyApi` | `TAVILY_CREDENTIAL_ID` | Must create |
| Anthropic Chat Model | `anthropicApi` | `ANTHROPIC_CREDENTIAL_ID` | Must create |

### Creating Credentials (executor action required)

1. **Tavily API credential**:
   - Type: HTTP Header Auth (or Tavily-specific type from community node)
   - Name: "Tavily account"
   - If community node uses its own credential type, check node's credential definition
   - Tavily API key goes in Header: `Authorization: Bearer <key>` OR as dedicated Tavily credential
   - After creation, replace `TAVILY_CREDENTIAL_ID` with actual credential ID

2. **Anthropic credential**:
   - Type: `anthropicApi`
   - Name: "Anthropic account"
   - API key from console.anthropic.com
   - After creation, replace `ANTHROPIC_CREDENTIAL_ID` with actual credential ID

---

## Community Nodes Required

Both WF1 nodes require community packages installed on the n8n instance:

| Package | Node Types | Installation |
|---|---|---|
| `@tavily/n8n-nodes-tavily` | `@tavily/n8n-nodes-tavily.tavily` | Settings > Community Nodes |
| `@apify/n8n-nodes-apify` | `@apify/n8n-nodes-apify.apify` | Settings > Community Nodes |

Check if already installed on meinoffice.app.n8n.cloud before attempting installation.
The Apify credential `wWgQDWC9aV3UcUEJ` already exists, suggesting the Apify node may already
be installed.

---

## Deployment Instructions

### Step 1: Verify community nodes installed

Check n8n instance Settings > Community Nodes for `@tavily/n8n-nodes-tavily` and `@apify/n8n-nodes-apify`.

### Step 2: Create credentials

Create Tavily API credential and Anthropic API credential. Note both IDs.

### Step 3: Deploy WF1 (update stub)

Use `n8n_update_full_workflow` with ID `mPtLL7QxoW1lJKu2`.
Replace stub content with full WF1 definition from this plan.
Fill in `TAVILY_CREDENTIAL_ID` with real ID.
Fill in `wWgQDWC9aV3UcUEJ` for Apify (already known).

### Step 4: Deploy WF2 (update stub)

Use `n8n_update_full_workflow` with ID `GAqEpcFUuLrKGYFH`.
Replace stub content with full WF2 definition from this plan.
Fill in `ANTHROPIC_CREDENTIAL_ID` with real ID.

### Step 5: Validate both workflows

Run `validate_workflow` on both. Expected issues to check:
- Community node type warnings (FALSE POSITIVE — nodes exist on instance)
- Missing credentials (FALSE POSITIVE — credentials set but not exported in JSON)
- Model version warning for `claude-sonnet-4-20250514` (may not be in list mode — switch to id mode)

### Step 6: Test WF1

Manual test with sample lead data:
```json
{
  "lead_id": "TEST-001",
  "vorname": "Test",
  "nachname": "User",
  "unternehmen": "n8n GmbH",
  "branche": "Software / SaaS",
  "mitarbeiter_anzahl": "50-200",
  "website": "https://n8n.io",
  "linkedin_url": "",
  "notizen": "Test",
  "status": "Neu"
}
```
Expected: Returns enrichment JSON with `unternehmens_beschreibung` populated, empty LinkedIn fields.

Test with LinkedIn URL:
```json
{
  "lead_id": "TEST-002",
  "vorname": "Jan",
  "nachname": "Oberhauser",
  "unternehmen": "n8n GmbH",
  "branche": "Software / SaaS",
  "mitarbeiter_anzahl": "50-200",
  "website": "https://n8n.io",
  "linkedin_url": "https://www.linkedin.com/in/jan-oberhauser/",
  "notizen": "Test",
  "status": "Neu"
}
```
Expected: Both website and LinkedIn fields populated.

### Step 7: Test WF2

Manual test with sample lead + enrichment data (WARM case):
```json
{
  "lead_id": "TEST-001",
  "vorname": "Max",
  "nachname": "Mustermann",
  "position": "Geschäftsführer",
  "unternehmen": "Mustermann GmbH",
  "mitarbeiter_anzahl": "50-200",
  "branche": "Software / SaaS",
  "notizen": "Sucht CRM-Lösung für 2025",
  "status": "Neu",
  "angereichert": {
    "unternehmens_beschreibung": "SaaS-Unternehmen im Wachstum",
    "aktuelle_herausforderungen": "Skalierung des Vertriebsteams",
    "linkedin_headline": "Geschäftsführer bei Mustermann GmbH",
    "linkedin_about": ""
  }
}
```
Expected: score between 30-79, klassifikation "WARM", routing "WARM_STANDARD".

Test KALT case (score expected < 30):
```json
{
  "lead_id": "TEST-003",
  "vorname": "Hans",
  "nachname": "Beispiel",
  "position": "Praktikant",
  "unternehmen": "Kleinbetrieb",
  "mitarbeiter_anzahl": "1-10",
  "branche": "Landwirtschaft",
  "notizen": "",
  "status": "Neu",
  "angereichert": {
    "unternehmens_beschreibung": "",
    "aktuelle_herausforderungen": "",
    "linkedin_headline": "",
    "linkedin_about": ""
  }
}
```
Expected: score < 30, routing "KALT_STOP", WF6 called with status="Kalt".

### Step 8: Update WF0

After WF1 and WF2 are deployed and tested, update WF0 to pass enrichment data from WF1
into the WF2 call. The Execute Workflow nodes in WF0 for WF1 and WF2 are already configured
with the stub IDs — since we update the stubs in place, the IDs remain the same. No WF0
changes needed for the workflow IDs, but WF0's Execute WF2 call must pass the enrichment
data returned by WF1.

---

## Data Flow Summary

```
WF0 Lead Loop
  → Execute WF1 (mPtLL7QxoW1lJKu2)
      Trigger → IF Website → Tavily x2 → Code Merge → Merge
              → IF LinkedIn → Apify → Code Extract → Merge
      → Code Build Output → returns { lead_id, angereichert: {...} }
  → WF0 receives enrichment, merges with lead data
  → Execute WF2 (GAqEpcFUuLrKGYFH)
      Trigger → Set Prompt → LLM Chain [+Anthropic] → Code Parse → IF < 30
              → (KALT) Execute WF6 → Set Output
              → (WARM/HEISS) IF >= 80 → Set Output
      → returns { score, klassifikation, routing, ... }
  → WF0 continues with score-based routing
```

---

## Validation Criteria

- [ ] WF1 validates without errors via `validate_workflow`
- [ ] WF2 validates without errors via `validate_workflow`
- [ ] Community nodes `@tavily/n8n-nodes-tavily` and `@apify/n8n-nodes-apify` are installed
- [ ] Tavily credential created and ID filled in WF1
- [ ] Anthropic credential created and ID filled in WF2
- [ ] All node IDs are unique within each workflow
- [ ] No expressions use `{{ }}` without `=` prefix
- [ ] No expressions use `$node['Name']` (use `$('Name').first().json` instead)
- [ ] IF nodes use `version: 2` in conditions.options
- [ ] Code nodes use `$input.first().json` not `$json`
- [ ] Code nodes return `[{ json: {...} }]` format
- [ ] Anthropic Chat Model connects via `ai_languageModel` (not `main`) to Basic LLM Chain
- [ ] Basic LLM Chain's `text` parameter is `={{ $json.claude_prompt }}`
- [ ] WF1 Apify node: `onError: "continueRegularOutput"` set
- [ ] WF2 LLM Chain: `onError: "continueRegularOutput"` set
- [ ] WF6 (HxOD2a8He72tvKmR) is called for Kalt leads with correct payload
- [ ] WF1 test with no website and no LinkedIn returns empty strings (no hard failure)
- [ ] WF2 Claude JSON parse failure returns score=0 with parse_error=true (no hard failure)
- [ ] Both workflows have `callerPolicy: "workflowsFromSameOwner"` in settings

---

*Plan created: 2026-03-08*
*Phase: 2 of 5*
*Next: `/gsd-n8n:execute-phase 2`*
