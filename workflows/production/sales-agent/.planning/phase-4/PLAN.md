---
phase: 4
plan: 1
workflows: [WF5]
type: n8n-workflow
---

# Plan 4-1: LinkedIn Content Generator (WF5)

## Objective

Replace the WF5 stub (n8n ID: `bQQfeZfngg6AyuwZ`) with the full LinkedIn Content
Generator implementation. For each qualified lead (WARM/HEISS, Score >= 30), WF5
generates:

1. A LinkedIn DM — max. 300 characters, no pitch, modern German (AI-06)
2. A LinkedIn Post idea — Hook + 3-5 paragraphs + community question, 150-250 words,
   returned as structured JSON (AI-07)

Both outputs are written to the CRM via WF6 (column V: `linkedin_nachricht`) and
logged in Sequenz_Log (OUT-08).

---

## Phase Overview

**Phase**: 4 of 5
**Depends on**: WF6 (CRM Updater, ID: HxOD2a8He72tvKmR) — already deployed
**WF5 stub ID**: `bQQfeZfngg6AyuwZ` — will be fully updated (n8n_update_full_workflow)
**WF0 Master ID**: `58ysZ3NLKZfsMfND` — already calls WF5; no structural changes needed

## Success Criteria

- [ ] WF5 generates LinkedIn DM <= 300 characters (no pitch, modern German)
- [ ] WF5 generates LinkedIn Post idea (Hook + Absätze + Community-Frage, 150-250 words)
- [ ] WF5 writes `linkedin_nachricht` field (column V) via WF6 into Leads tab
- [ ] WF5 logs activity in Sequenz_Log tab via WF6
- [ ] WF5 terminates with `Set: Success Output` returning linkedin_dm + linkedin_post
- [ ] validate_workflow passes (warnings checked against FALSE_POSITIVES)

---

## Workflow: WF5 LinkedIn Content Generator

**Trigger**: Execute Workflow Trigger (called by WF0 Master Orchestrator)
**n8n ID**: `bQQfeZfngg6AyuwZ` (stub — replace with full_update)
**Purpose**: Receives lead data from WF0, generates LinkedIn DM + Post, writes to CRM

### Node Chain (top-level flow)

```
Execute Workflow Trigger
  → Set: Store Trigger Data          [passthrough, preserve all fields]
  → LLM: LinkedIn DM                 [Basic LLM Chain — generates DM]
      ↑ ai_languageModel connection
      Anthropic Chat Model 1
  → LLM: LinkedIn Post               [Basic LLM Chain — generates Post-Idee]
      ↑ ai_languageModel connection
      Anthropic Chat Model 2
  → Code: Build WF6 Payload          [assembles update + log payload]
  → Execute WF6: Update CRM          [writes to Leads tab + Sequenz_Log]
  → Set: Success Output              [terminal node, returns dm + post]
```

### Data Flow

**Input** (from WF0 via Execute Workflow):
```json
{
  "lead_id": "string",
  "vorname": "string",
  "nachname": "string",
  "position": "string",
  "unternehmen": "string",
  "branche": "string",
  "mitarbeiter_anzahl": "string",
  "score": "number",
  "klassifikation": "WARM|HEISS",
  "hauptschmerz": "string",
  "kaufmotiv": "string",
  "empfohlene_ansprache": "string",
  "angereichert": {
    "unternehmens_beschreibung": "string",
    "aktuelle_herausforderungen": "string",
    "linkedin_headline": "string",
    "linkedin_about": "string"
  },
  "notizen": "string"
}
```

**After Set: Store Trigger Data**: identical shape, all fields preserved

**After LLM: LinkedIn DM**: adds `text` field (raw LLM output = DM text string)

**After LLM: LinkedIn Post**: adds `text` field (raw LLM output = JSON string with
hook/absaetze/community_frage)

**After Code: Build WF6 Payload**:
```json
{
  "lead_id": "string",
  "updates": "{\"linkedin_nachricht\": \"<JSON string of dm + post>\"}",
  "log_eintrag": "{\"aktion\": \"linkedin_content_generiert\", \"inhalt\": \"DM + Post-Idee erstellt\", \"status\": \"ok\"}"
}
```

**After Set: Success Output**:
```json
{
  "lead_id": "string",
  "linkedin_dm": "string",
  "linkedin_post": { "hook": "...", "absaetze": [...], "community_frage": "..." }
}
```

---

## Complete Node Specifications

### Node 1: Execute Workflow Trigger

```json
{
  "id": "wf5-trigger",
  "name": "Execute Workflow Trigger",
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1,
  "position": [100, 300],
  "parameters": {}
}
```

**Notes**: No parameters needed. Receives all data passed from WF0's Execute Workflow
node. Data is available as `$json.*` in the immediately following node.

---

### Node 2: Set: Store Trigger Data

```json
{
  "id": "wf5-set-context",
  "name": "Set: Store Trigger Data",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [350, 300],
  "parameters": {
    "fields": {
      "values": []
    },
    "options": {},
    "include": "all"
  }
}
```

**Purpose**: Passthrough node that preserves all trigger data. Subsequent LLM chain
nodes (LLM: LinkedIn Post and beyond) MUST reference trigger data via
`$('Set: Store Trigger Data').first().json.*` — NOT `$json.*` — because the LLM
chain output replaces `$json` in downstream nodes.

**Critical rule**: `include: "all"` with empty `values` array is the correct pattern
(as proven in WF3). This passes all input fields unchanged.

---

### Node 3: LLM: LinkedIn DM

```json
{
  "id": "wf5-llm-dm",
  "name": "LLM: LinkedIn DM",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [600, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Schreibe eine LinkedIn-Direktnachricht fuer diesen Lead:\\n\\nName: ' + $json.vorname + ' ' + $json.nachname + '\\nPosition: ' + $json.position + ' bei ' + $json.unternehmen + '\\nBranche: ' + $json.branche + ' (' + $json.mitarbeiter_anzahl + ' Mitarbeiter)\\nHauptschmerz: ' + ($json.hauptschmerz || 'nicht angegeben') + '\\nLinkedIn Headline: ' + ($json.angereichert?.linkedin_headline || 'nicht verfuegbar') + '\\nLinkedIn About: ' + ($json.angereichert?.linkedin_about || 'nicht verfuegbar') + '\\nEmpfohlene Ansprache: ' + ($json.empfohlene_ansprache || 'direkt') + '\\n\\nANFORDERUNGEN:\\n- Maximal 300 Zeichen (zaehle STRIKT)\\n- Kein Pitch, kein Produkt erwaehnen\\n- Persoenlicher Bezug auf Hauptschmerz oder Branche\\n- Modernes Deutsch, aktive Sprache\\n- Echte Verbindung herstellen, kein Verkauf\\n- Mit Vornamen ansprechen\\n\\nGib NUR den DM-Text zurueck — kein JSON, kein Kommentar, keine Erklaerung.' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein B2B-Sales-Experte im DACH-Markt. Du schreibst LinkedIn-Direktnachrichten, die Verbindung schaffen ohne zu pitchen.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 - PSYCHOLOGIE: Empfaenger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 - METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 - PITCH-BEREITSCHAFT: Konkreten Gespraechsanlass schaffen\nSCHICHT 4 - POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 - POTENZIAL: Langfristige Partnerschaft andeuten\n\nFuer LinkedIn-DMs gilt: Keine Erwaehnung von Produkten oder Loesungen. Nur Verbindung, Neugier, echtes Interesse.\n\nFormat: Gib ausschliesslich den DM-Text zurueck. Kein JSON. Keine Erklaerung. Max. 300 Zeichen."
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

**Notes**:
- Uses `$json.*` for trigger data because this is the first LLM call — `$json` still
  points to the Set node output here, which contains all lead fields.
- `promptType: "define"` activates the `text` parameter (required for chainLlm).
- `onError: "continueRegularOutput"` prevents full workflow stop on LLM failure.
- System message includes 5-Schichten-Framework as required by AI-11.
- Output: `$json.text` = the DM string (raw, no JSON wrapper from LLM).

---

### Node 4: Anthropic Chat Model 1

```json
{
  "id": "wf5-anthropic-1",
  "name": "Anthropic Chat Model 1",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [600, 500],
  "parameters": {
    "model": {
      "mode": "id",
      "value": "claude-sonnet-4-20250514"
    },
    "options": {
      "maxTokensToSample": 1000,
      "temperature": 0.7
    }
  },
  "credentials": {
    "anthropicApi": {
      "id": "5LmibcuA2kdHKaqB",
      "name": "Anthropic account"
    }
  }
}
```

**Connection**: `ai_languageModel` → `LLM: LinkedIn DM`

**Notes**: Same pattern as WF3. Position is BELOW the chain node (same x, +200y).
Model is specified via `mode: "id"` with the exact model string. `maxTokensToSample`
maps to Claude's max_tokens parameter.

---

### Node 5: LLM: LinkedIn Post

```json
{
  "id": "wf5-llm-post",
  "name": "LLM: LinkedIn Post",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [900, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Erstelle eine LinkedIn-Post-Idee fuer folgendes Thema, basierend auf diesem Lead-Kontext:\\n\\nBranche: ' + $(\\'Set: Store Trigger Data\\').first().json.branche + '\\nHauptschmerz: ' + ($(\\'Set: Store Trigger Data\\').first().json.hauptschmerz || \\'nicht angegeben\\') + '\\nUnternehmens-Kontext: ' + ($(\\'Set: Store Trigger Data\\').first().json.angereichert?.unternehmens_beschreibung || \\'nicht verfuegbar\\') + '\\nAktuelle Herausforderungen: ' + ($(\\'Set: Store Trigger Data\\').first().json.angereichert?.aktuelle_herausforderungen || \\'nicht verfuegbar\\') + '\\nKaufmotiv: ' + ($(\\'Set: Store Trigger Data\\').first().json.kaufmotiv || \\'Effizienz\\') + '\\n\\nStruktur PFLICHT:\\n- Hook: 1 starker erster Satz (Aufmerksamkeit sofort)\\n- 3 bis 5 kurze Absaetze (je 2-3 Saetze, Mehrwert-Fokus)\\n- Community-Frage am Ende (offene Frage an die Audience)\\n\\nUmfang: 150 bis 250 Woerter gesamt\\nSprache: Modernes Deutsch, B2B-Kontext, DACH-Markt\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks:\\n{\\\"hook\\\": \\\"Hook-Text hier\\\", \\\"absaetze\\\": [\\\"Absatz 1\\\", \\\"Absatz 2\\\", \\\"Absatz 3\\\"], \\\"community_frage\\\": \\\"Frage hier\\\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein Content-Stratege im B2B-SaaS-Bereich im DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 - PSYCHOLOGIE: Empfaenger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 - METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 - PITCH-BEREITSCHAFT: Konkreten Gespraechsanlass schaffen\nSCHICHT 4 - POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 - POTENZIAL: Langfristige Partnerschaft andeuten\n\nLinkedIn-Posts fuer B2B muessen: Mehrwert vor Verkauf, echte Insights statt Werbung, Diskussion anregen.\n\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks."
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

**CRITICAL — Expression escaping in the `text` parameter**:

The `text` parameter contains single-quoted string literals inside a `={{ }}` expression.
The node references `$('Set: Store Trigger Data').first().json.*` require the node name
to be quoted with single quotes inside the JS expression. Because the outer expression
delimiter is also `'`, the inner `'Set: Store Trigger Data'` must escape the quotes.

In n8n JSON the expression value (inside the `={{ }}`) is a JavaScript string
concatenation. The actual JSON string for the `text` parameter must be:

```
={{ 'Erstelle eine LinkedIn-Post-Idee fuer folgendes Thema, basierend auf diesem Lead-Kontext:\n\nBranche: ' + $('Set: Store Trigger Data').first().json.branche + '\nHauptschmerz: ' + ($('Set: Store Trigger Data').first().json.hauptschmerz || 'nicht angegeben') + '\nUnternehmens-Kontext: ' + ($('Set: Store Trigger Data').first().json.angereichert?.unternehmens_beschreibung || 'nicht verfuegbar') + '\nAktuelle Herausforderungen: ' + ($('Set: Store Trigger Data').first().json.angereichert?.aktuelle_herausforderungen || 'nicht verfuegbar') + '\nKaufmotiv: ' + ($('Set: Store Trigger Data').first().json.kaufmotiv || 'Effizienz') + '\n\nStruktur PFLICHT:\n- Hook: 1 starker erster Satz (Aufmerksamkeit sofort)\n- 3 bis 5 kurze Absaetze (je 2-3 Saetze, Mehrwert-Fokus)\n- Community-Frage am Ende (offene Frage an die Audience)\n\nUmfang: 150 bis 250 Woerter gesamt\nSprache: Modernes Deutsch, B2B-Kontext, DACH-Markt\n\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks:\n{"hook": "Hook-Text hier", "absaetze": ["Absatz 1", "Absatz 2", "Absatz 3"], "community_frage": "Frage hier"}' }}
```

**Executor note**: When building the JSON file, the `text` value should be written as a
raw string where `$('Set: Store Trigger Data')` uses escaped single quotes inside the
JSON string, matching the exact pattern from WF3's Email 2-4 nodes (lines 92, 141, 189).
The JSON-encoded string in the file will have `\\'` for the inner quotes.

**Why `$('Set: Store Trigger Data')` and not `$json`**:
At this node, `$json` contains the output of `LLM: LinkedIn DM`, which has the field
`text` (the DM text). The original lead fields are gone from `$json`. The only safe
way to access lead data is via the stored copy in `Set: Store Trigger Data`.

---

### Node 6: Anthropic Chat Model 2

```json
{
  "id": "wf5-anthropic-2",
  "name": "Anthropic Chat Model 2",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [900, 500],
  "parameters": {
    "model": {
      "mode": "id",
      "value": "claude-sonnet-4-20250514"
    },
    "options": {
      "maxTokensToSample": 1000,
      "temperature": 0.7
    }
  },
  "credentials": {
    "anthropicApi": {
      "id": "5LmibcuA2kdHKaqB",
      "name": "Anthropic account"
    }
  }
}
```

**Connection**: `ai_languageModel` → `LLM: LinkedIn Post`

---

### Node 7: Code: Build WF6 Payload

```json
{
  "id": "wf5-code-payload",
  "name": "Code: Build WF6 Payload",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1200, 300],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "const trigger = $('Set: Store Trigger Data').first().json;\n\n// --- Extract LinkedIn DM ---\nconst dmRaw = $('LLM: LinkedIn DM').first().json.text || '';\nconst linkedin_dm = dmRaw.trim();\n\n// --- Extract LinkedIn Post ---\nconst postRaw = $('LLM: LinkedIn Post').first().json.text || '';\nconst postCleaned = postRaw.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();\nlet linkedin_post = { hook: '', absaetze: [], community_frage: '' };\ntry {\n  linkedin_post = JSON.parse(postCleaned);\n} catch (e) {\n  // Fallback: use raw text as hook\n  linkedin_post = {\n    hook: postRaw.substring(0, 200) || 'Post-Idee konnte nicht geparst werden',\n    absaetze: [],\n    community_frage: 'Was sind eure Erfahrungen damit?'\n  };\n}\n\n// --- Build combined storage value for column V ---\n// linkedin_nachricht stores BOTH dm and post as a JSON string\nconst linkedin_nachricht_value = JSON.stringify({\n  dm: linkedin_dm,\n  post: linkedin_post\n});\n\n// --- Build WF6 inputs ---\nconst updates = JSON.stringify({\n  linkedin_nachricht: linkedin_nachricht_value\n});\n\nconst log_eintrag = JSON.stringify({\n  aktion: 'linkedin_content_generiert',\n  inhalt: 'DM + Post-Idee erstellt',\n  status: 'ok'\n});\n\nreturn [{\n  json: {\n    lead_id: trigger.lead_id,\n    updates: updates,\n    log_eintrag: log_eintrag,\n    // Pass-through for terminal node\n    _linkedin_dm: linkedin_dm,\n    _linkedin_post: linkedin_post\n  }\n}];"
  }
}
```

**Data access pattern**:
- `$('Set: Store Trigger Data').first().json` — lead data (lead_id, etc.)
- `$('LLM: LinkedIn DM').first().json.text` — DM output from first chain
- `$('LLM: LinkedIn Post').first().json.text` — Post output from second chain
- Mode `runOnceForAllItems` with `.first()` accessors — matches WF3 Code: Build Output

**Output shape**:
```json
{
  "lead_id": "ROW_ID",
  "updates": "{\"linkedin_nachricht\": \"{\\\"dm\\\":\\\"...\\\",\\\"post\\\":{...}}\"}",
  "log_eintrag": "{\"aktion\":\"linkedin_content_generiert\",\"inhalt\":\"DM + Post-Idee erstellt\",\"status\":\"ok\"}",
  "_linkedin_dm": "raw DM string",
  "_linkedin_post": { "hook": "...", "absaetze": [...], "community_frage": "..." }
}
```

**Note on `updates` format**: WF6 CRM Updater receives `updates` as a JSON string
(not an object) — it parses it internally. This matches the pattern used in WF4 and
confirmed by the WF6 implementation.

---

### Node 8: Execute WF6: Update CRM

```json
{
  "id": "wf5-exec-wf6",
  "name": "Execute WF6: Update CRM",
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1.2,
  "position": [1450, 300],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "parameters": {
    "source": "database",
    "workflowId": {
      "__rl": true,
      "mode": "id",
      "value": "HxOD2a8He72tvKmR"
    },
    "options": {
      "waitForSubWorkflow": true
    }
  }
}
```

**Notes**:
- typeVersion 1.2 is used in WF0 (not 2 as stated in project prompt — keep consistent
  with deployed WF0 pattern: `source: "database"` + `workflowId.__rl` structure).
- `waitForSubWorkflow: true` ensures WF5 waits for the CRM write to complete before
  returning to WF0.
- retryOnFail: 3x / 5000ms — external system call pattern.
- Passes `lead_id`, `updates`, `log_eintrag` from the previous Code node via `$json`.

---

### Node 9: Set: Success Output

```json
{
  "id": "wf5-success",
  "name": "Set: Success Output",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1700, 300],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "lead_id",
          "type": "stringValue",
          "stringValue": "={{ $('Code: Build WF6 Payload').first().json.lead_id }}"
        },
        {
          "name": "linkedin_dm",
          "type": "stringValue",
          "stringValue": "={{ $('Code: Build WF6 Payload').first().json._linkedin_dm }}"
        },
        {
          "name": "linkedin_post",
          "type": "objectValue",
          "objectValue": "={{ $('Code: Build WF6 Payload').first().json._linkedin_post }}"
        }
      ]
    },
    "include": "selected",
    "options": {}
  }
}
```

**Notes**:
- Terminal node — WF0 receives this output after `Execute: WF5 LinkedIn Generator` completes.
- Uses explicit node reference `$('Code: Build WF6 Payload').first().json.*` because
  `$json` at this point contains the WF6 response (not the payload we built).
- `include: "selected"` — only outputs the three named fields.

---

## Complete Connections Object

```json
"connections": {
  "Execute Workflow Trigger": {
    "main": [
      [
        {
          "node": "Set: Store Trigger Data",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Set: Store Trigger Data": {
    "main": [
      [
        {
          "node": "LLM: LinkedIn DM",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Anthropic Chat Model 1": {
    "ai_languageModel": [
      [
        {
          "node": "LLM: LinkedIn DM",
          "type": "ai_languageModel",
          "index": 0
        }
      ]
    ]
  },
  "LLM: LinkedIn DM": {
    "main": [
      [
        {
          "node": "LLM: LinkedIn Post",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Anthropic Chat Model 2": {
    "ai_languageModel": [
      [
        {
          "node": "LLM: LinkedIn Post",
          "type": "ai_languageModel",
          "index": 0
        }
      ]
    ]
  },
  "LLM: LinkedIn Post": {
    "main": [
      [
        {
          "node": "Code: Build WF6 Payload",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Code: Build WF6 Payload": {
    "main": [
      [
        {
          "node": "Execute WF6: Update CRM",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Execute WF6: Update CRM": {
    "main": [
      [
        {
          "node": "Set: Success Output",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

**Key connection rules**:
- `Anthropic Chat Model 1` connects via `ai_languageModel` to `LLM: LinkedIn DM`
- `Anthropic Chat Model 2` connects via `ai_languageModel` to `LLM: LinkedIn Post`
- All other connections are `main` type, `index: 0`
- No connection FROM `Set: Success Output` — it is the terminal node

---

## Settings Block

```json
"settings": {
  "executionOrder": "v1",
  "saveDataErrorExecution": "all",
  "saveDataSuccessExecution": "all",
  "saveManualExecutions": true
}
```

**Note**: `callerPolicy` is NOT included here — set in n8n UI manually after deployment
(as established in Phase 1 decision log).

---

## Credentials Summary

| Node | Credential Type | ID | Name |
|---|---|---|---|
| Anthropic Chat Model 1 | anthropicApi | `5LmibcuA2kdHKaqB` | Anthropic account |
| Anthropic Chat Model 2 | anthropicApi | `5LmibcuA2kdHKaqB` | Anthropic account |

**No credentials needed on**:
- Execute Workflow Trigger — no auth
- Set: Store Trigger Data — no auth
- LLM: LinkedIn DM — inherits from Anthropic Chat Model 1 via ai_languageModel
- LLM: LinkedIn Post — inherits from Anthropic Chat Model 2 via ai_languageModel
- Code: Build WF6 Payload — no auth
- Execute WF6: Update CRM — no auth (internal sub-workflow call)
- Set: Success Output — no auth

---

## Node Position Layout

```
y=300 (main chain):
[100,300] Execute Workflow Trigger
[350,300] Set: Store Trigger Data
[600,300] LLM: LinkedIn DM
[900,300] LLM: LinkedIn Post
[1200,300] Code: Build WF6 Payload
[1450,300] Execute WF6: Update CRM
[1700,300] Set: Success Output

y=500 (ai_languageModel support nodes, same x as their chain):
[600,500] Anthropic Chat Model 1
[900,500] Anthropic Chat Model 2
```

---

## Complete WF5 JSON Structure

The full JSON to pass to `n8n_update_full_workflow` for workflow ID `bQQfeZfngg6AyuwZ`:

```json
{
  "name": "Sales Agent — WF5 LinkedIn Content Generator",
  "nodes": [
    {
      "id": "wf5-trigger",
      "name": "Execute Workflow Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [100, 300],
      "parameters": {}
    },
    {
      "id": "wf5-set-context",
      "name": "Set: Store Trigger Data",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [350, 300],
      "parameters": {
        "fields": { "values": [] },
        "options": {},
        "include": "all"
      }
    },
    {
      "id": "wf5-llm-dm",
      "name": "LLM: LinkedIn DM",
      "type": "nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [600, 300],
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Schreibe eine LinkedIn-Direktnachricht fuer diesen Lead:\\n\\nName: ' + $json.vorname + ' ' + $json.nachname + '\\nPosition: ' + $json.position + ' bei ' + $json.unternehmen + '\\nBranche: ' + $json.branche + ' (' + $json.mitarbeiter_anzahl + ' Mitarbeiter)\\nHauptschmerz: ' + ($json.hauptschmerz || \\'nicht angegeben\\') + '\\nLinkedIn Headline: ' + ($json.angereichert?.linkedin_headline || \\'nicht verfuegbar\\') + '\\nLinkedIn About: ' + ($json.angereichert?.linkedin_about || \\'nicht verfuegbar\\') + '\\nEmpfohlene Ansprache: ' + ($json.empfohlene_ansprache || \\'direkt\\') + '\\n\\nANFORDERUNGEN:\\n- Maximal 300 Zeichen (zaehle STRIKT)\\n- Kein Pitch, kein Produkt erwaehnen\\n- Persoenlicher Bezug auf Hauptschmerz oder Branche\\n- Modernes Deutsch, aktive Sprache\\n- Echte Verbindung herstellen, kein Verkauf\\n- Mit Vornamen ansprechen\\n\\nGib NUR den DM-Text zurueck — kein JSON, kein Kommentar, keine Erklaerung.' }}",
        "messages": {
          "messageValues": [
            {
              "type": "SystemMessage",
              "message": "Du bist ein B2B-Sales-Experte im DACH-Markt. Du schreibst LinkedIn-Direktnachrichten, die Verbindung schaffen ohne zu pitchen.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 - PSYCHOLOGIE: Empfaenger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 - METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 - PITCH-BEREITSCHAFT: Konkreten Gespraechsanlass schaffen\nSCHICHT 4 - POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 - POTENZIAL: Langfristige Partnerschaft andeuten\n\nFuer LinkedIn-DMs gilt: Keine Erwaehnung von Produkten oder Loesungen. Nur Verbindung, Neugier, echtes Interesse.\n\nFormat: Gib ausschliesslich den DM-Text zurueck. Kein JSON. Keine Erklaerung. Max. 300 Zeichen."
            }
          ]
        }
      },
      "onError": "continueRegularOutput"
    },
    {
      "id": "wf5-anthropic-1",
      "name": "Anthropic Chat Model 1",
      "type": "nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [600, 500],
      "parameters": {
        "model": {
          "mode": "id",
          "value": "claude-sonnet-4-20250514"
        },
        "options": {
          "maxTokensToSample": 1000,
          "temperature": 0.7
        }
      },
      "credentials": {
        "anthropicApi": {
          "id": "5LmibcuA2kdHKaqB",
          "name": "Anthropic account"
        }
      }
    },
    {
      "id": "wf5-llm-post",
      "name": "LLM: LinkedIn Post",
      "type": "nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [900, 300],
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Erstelle eine LinkedIn-Post-Idee fuer folgendes Thema, basierend auf diesem Lead-Kontext:\\n\\nBranche: ' + $(\\'Set: Store Trigger Data\\').first().json.branche + '\\nHauptschmerz: ' + ($(\\'Set: Store Trigger Data\\').first().json.hauptschmerz || \\'nicht angegeben\\') + '\\nUnternehmens-Kontext: ' + ($(\\'Set: Store Trigger Data\\').first().json.angereichert?.unternehmens_beschreibung || \\'nicht verfuegbar\\') + '\\nAktuelle Herausforderungen: ' + ($(\\'Set: Store Trigger Data\\').first().json.angereichert?.aktuelle_herausforderungen || \\'nicht verfuegbar\\') + '\\nKaufmotiv: ' + ($(\\'Set: Store Trigger Data\\').first().json.kaufmotiv || \\'Effizienz\\') + '\\n\\nStruktur PFLICHT:\\n- Hook: 1 starker erster Satz (Aufmerksamkeit sofort)\\n- 3 bis 5 kurze Absaetze (je 2-3 Saetze, Mehrwert-Fokus)\\n- Community-Frage am Ende (offene Frage an die Audience)\\n\\nUmfang: 150 bis 250 Woerter gesamt\\nSprache: Modernes Deutsch, B2B-Kontext, DACH-Markt\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks:\\n{\\\"hook\\\": \\\"Hook-Text hier\\\", \\\"absaetze\\\": [\\\"Absatz 1\\\", \\\"Absatz 2\\\", \\\"Absatz 3\\\"], \\\"community_frage\\\": \\\"Frage hier\\\"}' }}",
        "messages": {
          "messageValues": [
            {
              "type": "SystemMessage",
              "message": "Du bist ein Content-Stratege im B2B-SaaS-Bereich im DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 - PSYCHOLOGIE: Empfaenger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 - METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 - PITCH-BEREITSCHAFT: Konkreten Gespraechsanlass schaffen\nSCHICHT 4 - POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 - POTENZIAL: Langfristige Partnerschaft andeuten\n\nLinkedIn-Posts fuer B2B muessen: Mehrwert vor Verkauf, echte Insights statt Werbung, Diskussion anregen.\n\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks."
            }
          ]
        }
      },
      "onError": "continueRegularOutput"
    },
    {
      "id": "wf5-anthropic-2",
      "name": "Anthropic Chat Model 2",
      "type": "nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [900, 500],
      "parameters": {
        "model": {
          "mode": "id",
          "value": "claude-sonnet-4-20250514"
        },
        "options": {
          "maxTokensToSample": 1000,
          "temperature": 0.7
        }
      },
      "credentials": {
        "anthropicApi": {
          "id": "5LmibcuA2kdHKaqB",
          "name": "Anthropic account"
        }
      }
    },
    {
      "id": "wf5-code-payload",
      "name": "Code: Build WF6 Payload",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1200, 300],
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const trigger = $('Set: Store Trigger Data').first().json;\n\n// --- Extract LinkedIn DM ---\nconst dmRaw = $('LLM: LinkedIn DM').first().json.text || '';\nconst linkedin_dm = dmRaw.trim();\n\n// --- Extract LinkedIn Post ---\nconst postRaw = $('LLM: LinkedIn Post').first().json.text || '';\nconst postCleaned = postRaw.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();\nlet linkedin_post = { hook: '', absaetze: [], community_frage: '' };\ntry {\n  linkedin_post = JSON.parse(postCleaned);\n} catch (e) {\n  linkedin_post = {\n    hook: postRaw.substring(0, 200) || 'Post-Idee konnte nicht geparst werden',\n    absaetze: [],\n    community_frage: 'Was sind eure Erfahrungen damit?'\n  };\n}\n\n// --- Build combined storage value for column V ---\nconst linkedin_nachricht_value = JSON.stringify({\n  dm: linkedin_dm,\n  post: linkedin_post\n});\n\n// --- Build WF6 inputs ---\nconst updates = JSON.stringify({\n  linkedin_nachricht: linkedin_nachricht_value\n});\n\nconst log_eintrag = JSON.stringify({\n  aktion: 'linkedin_content_generiert',\n  inhalt: 'DM + Post-Idee erstellt',\n  status: 'ok'\n});\n\nreturn [{\n  json: {\n    lead_id: trigger.lead_id,\n    updates: updates,\n    log_eintrag: log_eintrag,\n    _linkedin_dm: linkedin_dm,\n    _linkedin_post: linkedin_post\n  }\n}];"
      }
    },
    {
      "id": "wf5-exec-wf6",
      "name": "Execute WF6: Update CRM",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.2,
      "position": [1450, 300],
      "retryOnFail": true,
      "maxTries": 3,
      "waitBetweenTries": 5000,
      "parameters": {
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "HxOD2a8He72tvKmR"
        },
        "options": {
          "waitForSubWorkflow": true
        }
      }
    },
    {
      "id": "wf5-success",
      "name": "Set: Success Output",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [1700, 300],
      "parameters": {
        "fields": {
          "values": [
            {
              "name": "lead_id",
              "type": "stringValue",
              "stringValue": "={{ $('Code: Build WF6 Payload').first().json.lead_id }}"
            },
            {
              "name": "linkedin_dm",
              "type": "stringValue",
              "stringValue": "={{ $('Code: Build WF6 Payload').first().json._linkedin_dm }}"
            },
            {
              "name": "linkedin_post",
              "type": "objectValue",
              "objectValue": "={{ $('Code: Build WF6 Payload').first().json._linkedin_post }}"
            }
          ]
        },
        "include": "selected",
        "options": {}
      }
    }
  ],
  "connections": {
    "Execute Workflow Trigger": {
      "main": [[{ "node": "Set: Store Trigger Data", "type": "main", "index": 0 }]]
    },
    "Set: Store Trigger Data": {
      "main": [[{ "node": "LLM: LinkedIn DM", "type": "main", "index": 0 }]]
    },
    "Anthropic Chat Model 1": {
      "ai_languageModel": [[{ "node": "LLM: LinkedIn DM", "type": "ai_languageModel", "index": 0 }]]
    },
    "LLM: LinkedIn DM": {
      "main": [[{ "node": "LLM: LinkedIn Post", "type": "main", "index": 0 }]]
    },
    "Anthropic Chat Model 2": {
      "ai_languageModel": [[{ "node": "LLM: LinkedIn Post", "type": "ai_languageModel", "index": 0 }]]
    },
    "LLM: LinkedIn Post": {
      "main": [[{ "node": "Code: Build WF6 Payload", "type": "main", "index": 0 }]]
    },
    "Code: Build WF6 Payload": {
      "main": [[{ "node": "Execute WF6: Update CRM", "type": "main", "index": 0 }]]
    },
    "Execute WF6: Update CRM": {
      "main": [[{ "node": "Set: Success Output", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true
  },
  "staticData": null
}
```

---

## Expression Syntax Reference

All expressions in this workflow:

| Node | Parameter | Expression |
|---|---|---|
| LLM: LinkedIn DM | text | `={{ 'Schreibe...' + $json.vorname + ... }}` |
| LLM: LinkedIn Post | text | `={{ 'Erstelle...' + $('Set: Store Trigger Data').first().json.branche + ... }}` |
| Set: Success Output | lead_id | `={{ $('Code: Build WF6 Payload').first().json.lead_id }}` |
| Set: Success Output | linkedin_dm | `={{ $('Code: Build WF6 Payload').first().json._linkedin_dm }}` |
| Set: Success Output | linkedin_post | `={{ $('Code: Build WF6 Payload').first().json._linkedin_post }}` |

**Rules applied**:
- All expressions wrapped in `={{ }}` (never `{{ }}`)
- Node references use `$('NodeName').first().json` (never `$node['Name']`)
- Code node uses `$input.first()` / `$('NodeName').first()` (never bare `$json`)
- Null safety with `|| 'fallback'` on optional fields (hauptschmerz, angereichert.*)

---

## WF0 Master Orchestrator: Update Notes

**WF0 already has WF5 integration** — from the deployed WF0 JSON (ID: `58ysZ3NLKZfsMfND`),
node `exec-wf5-linkedin` (Execute: WF5 LinkedIn Generator) is already present at
position [3100, 100] with workflow ID `bQQfeZfngg6AyuwZ`. The connection chain is:

```
Execute: WF4 Email Sender (Neu) → Execute: WF5 LinkedIn Generator → Merge: After Sequence
```

**No structural changes to WF0 are needed.** WF5 stub replacement is transparent
to WF0 because the workflow ID `bQQfeZfngg6AyuwZ` stays the same.

**WF0 data passed to WF5**: The Execute Workflow node in WF0 passes the entire current
`$json` object from the WF4 output node. This means WF5 receives all lead fields that
were accumulated through WF1 → WF2 → WF3 → WF4 processing.

**Important caveat**: Verify that WF4's terminal output node still carries the full
lead context (lead_id, vorname, nachname, position, unternehmen, branche,
mitarbeiter_anzahl, score, klassifikation, hauptschmerz, kaufmotiv,
empfohlene_ansprache, angereichert.*). If WF4 only outputs email-specific fields,
WF0 may need a Set node between WF4 and WF5 to pass the full lead object. Check
WF4's terminal node output shape before executing Phase 4.

---

## Deployment Checklist

### Pre-deployment
- [ ] Read WF4 terminal node to verify lead fields survive through WF4 output
- [ ] Confirm WF6 accepts `updates` as JSON string (not object) — matches WF4 pattern

### Execution
- [ ] `n8n_update_full_workflow` with workflow ID `bQQfeZfngg6AyuwZ`
- [ ] Include full JSON from "Complete WF5 JSON Structure" section above
- [ ] Save local JSON to: `production/sales-agent/WF5-LinkedIn-Content-Generator.json`

### Validation (Phase 3 of GSD)
- [ ] Load `n8n-validation-expert\SKILL.md` + `ERROR_CATALOG.md` + `FALSE_POSITIVES.md`
- [ ] `validate_workflow` on WF5
- [ ] Check expression syntax warnings (likely false positives on cross-node refs)
- [ ] Verify `ai_languageModel` connections show correctly in validator
- [ ] Fix any real errors → re-validate (expect 2-3 cycles)
- [ ] `n8n_autofix_workflow` if needed

### Post-deployment verification
- [ ] Manual test run in n8n UI with a test lead payload
- [ ] Verify `linkedin_nachricht` (column V) gets written in Leads tab
- [ ] Verify Sequenz_Log entry appears with aktion: 'linkedin_content_generiert'
- [ ] Verify DM output is <= 300 characters
- [ ] Verify Post JSON has hook, absaetze array, community_frage
- [ ] Update STATE.md: WF5 deployed + verified
- [ ] Push WF5 JSON to GitHub: `markmocasa-boop/n8n-mcp-czlon` at `workflows/production/sales-agent/`

---

## Known Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| DM exceeds 300 chars | Medium | Prompt says "zaehle STRIKT", but LLMs can miscound. If verified in test, add post-processing in Code node to truncate to 300 chars. |
| Post JSON parse fails | Low | Code node has explicit try/catch with fallback to raw text in hook field. |
| WF4 output doesn't carry lead fields | Medium | Check WF4 terminal node before executing. May need Set node in WF0. |
| chainLlm text expression escaping error | Medium | Test in n8n UI with a simple lead first; `\\'` escaping is correct for inner single-quotes in JS string concatenation inside n8n expressions. |
| WF6 updates field format mismatch | Low | Pattern matches WF4 exactly — JSON.stringify of object with field:value pairs. |

---

*Plan created: 2026-03-08*
*Phase: 4 of 5*
*Next phase: Phase 5 — Inbox & Calendar Manager (WF7)*
