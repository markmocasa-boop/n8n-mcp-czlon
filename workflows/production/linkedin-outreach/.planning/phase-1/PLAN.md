---
phase: 1
plan: 1
workflows: [WF1]
type: n8n-workflow
requirements: [TRIG-01, TRIG-02, DATA-01, DATA-02, DATA-03, API-01, API-02, API-03, AI-01, AI-02, OUT-01, OUT-02, ERR-01, ERR-02]
---

# Plan 1-1: LinkedIn Outreach Generator (WF1)

## Objective

Build and deploy WF1 — a single workflow that accepts filter parameters via an n8n Form,
reads matching LinkedIn connections from Google Sheets, scrapes each profile via Apify,
generates a personalized German DM using OpenAI gpt-4o-mini, and writes results back
to an output Google Sheet. Contacts missing a LinkedIn URL are logged with status
"Kein URL". Contacts where Apify returns no data fall back to a Sheets-only DM with
status "Fallback". All successful DMs receive status "Entwurf".

---

## Workflow Overview

### WF1: LinkedIn Outreach Generator

**Trigger**: n8n Form Trigger (manual, on-demand)
**Pattern**: Form Input → Bulk Read + Filter → Loop (SplitInBatches) → Branch (URL check) → Apify Scrape → Branch (data quality) → LLM Chain → Merge → Sheets Write

### Node List (in execution order)

| # | Node Name | Type | Purpose |
|---|---|---|---|
| 1 | Form Trigger | `n8n-nodes-base.formTrigger` | Accepts 4 filter fields from user |
| 2 | Read Connections Sheet | `n8n-nodes-base.googleSheets` | Reads all rows from source sheet |
| 3 | Filter Contacts | `n8n-nodes-base.filter` | Filters rows by form field values |
| 4 | Check LinkedIn URL | `n8n-nodes-base.if` | Splits: has URL vs. no URL |
| 5 | Write Kein URL | `n8n-nodes-base.googleSheets` | Writes "Kein URL" row for contacts without URL |
| 6 | Loop Contacts | `n8n-nodes-base.splitInBatches` | Processes 1 contact at a time |
| 7 | Scrape LinkedIn Profile | `n8n-nodes-base.httpRequest` | Calls Apify LinkedIn Profile Scraper |
| 8 | Check Apify Data | `n8n-nodes-base.if` | Splits: valid profile data vs. empty response |
| 9 | Prepare Full Context | `n8n-nodes-base.set` | Assembles full profile context for LLM prompt |
| 10 | Prepare Fallback Context | `n8n-nodes-base.set` | Assembles minimal Sheets-only context for LLM prompt |
| 11 | Generate DM (Full) | `@n8n/n8n-nodes-langchain.chainLlm` | Generates personalized DM with full profile data |
| 12 | OpenAI Model (Full) | `@n8n/n8n-nodes-langchain.lmChatOpenAi` | gpt-4o-mini model sub-node for Full path |
| 13 | Generate DM (Fallback) | `@n8n/n8n-nodes-langchain.chainLlm` | Generates DM from minimal data |
| 14 | OpenAI Model (Fallback) | `@n8n/n8n-nodes-langchain.lmChatOpenAi` | gpt-4o-mini model sub-node for Fallback path |
| 15 | Set Full Output | `n8n-nodes-base.set` | Shapes output item: adds Status="Entwurf", GeneratedAt |
| 16 | Set Fallback Output | `n8n-nodes-base.set` | Shapes output item: adds Status="Fallback", GeneratedAt |
| 17 | Merge Paths | `n8n-nodes-base.merge` | Reunites Full and Fallback paths |
| 18 | Write Output Sheet | `n8n-nodes-base.googleSheets` | Appends row to output sheet |

---

## Google Sheets Schema

### Source Sheet (LinkedIn Connections)

**Sheet name**: `Connections` (placeholder until CSV confirmed)
**Spreadsheet**: user-provided Google Spreadsheet ID — set in node parameter

| Column | Field Name | Description |
|---|---|---|
| A | FirstName | Contact first name |
| B | LastName | Contact last name |
| C | EmailAddress | Email address |
| D | Company | Current company |
| E | Position | Job title / position |
| F | ConnectedOn | Date of LinkedIn connection |
| G | LinkedInURL | LinkedIn profile URL |
| H | Region | (optional enrichment column) |
| I | Branche | (optional enrichment column) |
| J | Mitarbeiteranzahl | (optional enrichment column) |

> Note: The Filter node uses contains-matching on Position, Company (for Branche), Region,
> and Mitarbeiteranzahl columns. If these optional columns are absent in the export,
> only Position and Company can be matched. The filter conditions use `isEmpty` checks
> on form fields so empty form inputs skip their respective filter condition.

### Output Sheet (Generated DMs)

**Sheet name**: `DM-Output` (create manually before first run)

| Column | Field Name | Value source |
|---|---|---|
| A | FirstName | from source sheet |
| B | LastName | from source sheet |
| C | Company | from source sheet |
| D | Position | from source sheet |
| E | LinkedInURL | from source sheet |
| F | GeneratedDM | LLM output text |
| G | Status | "Entwurf" / "Fallback" / "Kein URL" |
| H | GeneratedAt | ISO timestamp of execution |

---

## Node-by-Node Specification

### Node 1: Form Trigger

```
Name:         "Form Trigger"
Type:         n8n-nodes-base.formTrigger
typeVersion:  2.2
Position:     [100, 300]
```

**Parameters**:
```json
{
  "path": "linkedin-outreach",
  "formTitle": "LinkedIn Outreach Filter",
  "formDescription": "Filtere LinkedIn-Kontakte fuer die DM-Generierung. Leere Felder = kein Filter.",
  "responseMode": "lastNode",
  "formFields": {
    "values": [
      {
        "fieldLabel": "Position (enthält)",
        "fieldType": "text",
        "requiredField": false,
        "placeholder": "z.B. CEO, Geschaeftsfuehrer"
      },
      {
        "fieldLabel": "Region (enthält)",
        "fieldType": "text",
        "requiredField": false,
        "placeholder": "z.B. Bayern, Berlin"
      },
      {
        "fieldLabel": "Branche (enthält)",
        "fieldType": "text",
        "requiredField": false,
        "placeholder": "z.B. Software, Beratung"
      },
      {
        "fieldLabel": "Mitarbeiteranzahl (enthält)",
        "fieldType": "text",
        "requiredField": false,
        "placeholder": "z.B. 50-200"
      }
    ]
  }
}
```

**Output shape**:
```json
{
  "Position (enthält)": "CEO",
  "Region (enthält)": "Bayern",
  "Branche (enthält)": "",
  "Mitarbeiteranzahl (enthält)": ""
}
```

---

### Node 2: Read Connections Sheet

```
Name:         "Read Connections Sheet"
Type:         n8n-nodes-base.googleSheets
typeVersion:  4.5
Position:     [350, 300]
Credentials:  { id: "gw0DIdDENFkpE7ZW", name: "Google Sheets account" }
```

**Parameters**:
```json
{
  "operation": "read",
  "documentId": {
    "mode": "id",
    "value": "GOOGLE_SHEET_ID_HIER_EINTRAGEN"
  },
  "sheetName": {
    "mode": "name",
    "value": "Connections"
  },
  "options": {
    "headerRow": 1
  }
}
```

**Notes**:
- Reads ALL rows from the sheet (no server-side filter — filtering is done in Node 3)
- Returns one item per row; field names come from the header row
- `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`

**Output shape** (one item per row):
```json
{
  "FirstName": "Max",
  "LastName": "Mustermann",
  "EmailAddress": "max@example.com",
  "Company": "Muster GmbH",
  "Position": "CEO",
  "ConnectedOn": "2024-01-15",
  "LinkedInURL": "https://www.linkedin.com/in/maxmustermann",
  "Region": "Bayern",
  "Branche": "Software",
  "Mitarbeiteranzahl": "50-200"
}
```

---

### Node 3: Filter Contacts

```
Name:         "Filter Contacts"
Type:         n8n-nodes-base.filter
typeVersion:  2
Position:     [600, 300]
```

**Design principle**: Each condition is only applied if the corresponding form field is
non-empty. This is implemented using an AND-combination of conditions where empty form
fields produce a "passes everything" result.

**Parameters**:

The filter uses `combineConditions: "AND"` with four conditions. Each condition checks
whether the form field is empty (skip filter) OR whether the sheet column contains
the form value (case-insensitive via `contains` operator).

Because the native Filter node does not support "skip condition if empty" natively,
we use a Code node approach alternative — but to keep it native, we use the filter
with a fallback expression pattern:

```json
{
  "conditions": {
    "options": {
      "caseSensitive": false,
      "leftValue": "",
      "typeValidation": "strict",
      "version": 2
    },
    "conditions": [
      {
        "id": "cond-position",
        "leftValue": "={{ $json.Position ?? '' }}",
        "rightValue": "={{ $('Form Trigger').first().json['Position (enthält)'] ?? '' }}",
        "operator": {
          "type": "string",
          "operation": "contains"
        }
      },
      {
        "id": "cond-region",
        "leftValue": "={{ $json.Region ?? '' }}",
        "rightValue": "={{ $('Form Trigger').first().json['Region (enthält)'] ?? '' }}",
        "operator": {
          "type": "string",
          "operation": "contains"
        }
      },
      {
        "id": "cond-branche",
        "leftValue": "={{ ($json.Branche ?? '') + ($json.Company ?? '') }}",
        "rightValue": "={{ $('Form Trigger').first().json['Branche (enthält)'] ?? '' }}",
        "operator": {
          "type": "string",
          "operation": "contains"
        }
      },
      {
        "id": "cond-mitarbeiter",
        "leftValue": "={{ $json.Mitarbeiteranzahl ?? '' }}",
        "rightValue": "={{ $('Form Trigger').first().json['Mitarbeiteranzahl (enthält)'] ?? '' }}",
        "operator": {
          "type": "string",
          "operation": "contains"
        }
      }
    ],
    "combinator": "and"
  }
}
```

**Key insight**: When a form field is empty (e.g., `Branche (enthält)` = ""), the `contains`
check becomes `"<any string>".contains("")` which is always TRUE in n8n's filter
(empty string is contained in every string). This naturally implements "skip filter
when field is empty."

**Output**: Subset of items from Node 2 that match all non-empty filter conditions.

---

### Node 4: Check LinkedIn URL

```
Name:         "Check LinkedIn URL"
Type:         n8n-nodes-base.if
typeVersion:  2.2
Position:     [850, 300]
```

**Parameters**:
```json
{
  "conditions": {
    "options": {
      "caseSensitive": false,
      "leftValue": "",
      "typeValidation": "strict",
      "version": 2
    },
    "conditions": [
      {
        "id": "url-check",
        "leftValue": "={{ $json.LinkedInURL ?? '' }}",
        "rightValue": "",
        "operator": {
          "type": "string",
          "operation": "notEmpty"
        }
      }
    ],
    "combinator": "and"
  }
}
```

**Outputs**:
- Output 0 (true): Contact HAS a LinkedInURL — continues to Node 6 (Loop)
- Output 1 (false): Contact has NO LinkedInURL — goes to Node 5 (Write Kein URL)

---

### Node 5: Write Kein URL

```
Name:         "Write Kein URL"
Type:         n8n-nodes-base.googleSheets
typeVersion:  4.5
Position:     [1100, 500]
Credentials:  { id: "gw0DIdDENFkpE7ZW", name: "Google Sheets account" }
```

**Parameters**:
```json
{
  "operation": "append",
  "documentId": {
    "mode": "id",
    "value": "GOOGLE_SHEET_ID_HIER_EINTRAGEN"
  },
  "sheetName": {
    "mode": "name",
    "value": "DM-Output"
  },
  "columns": {
    "mappingMode": "defineBelow",
    "value": {
      "FirstName": "={{ $json.FirstName }}",
      "LastName": "={{ $json.LastName }}",
      "Company": "={{ $json.Company ?? '' }}",
      "Position": "={{ $json.Position ?? '' }}",
      "LinkedInURL": "",
      "GeneratedDM": "",
      "Status": "Kein URL",
      "GeneratedAt": "={{ $now.toISO() }}"
    }
  },
  "options": {}
}
```

**Note**: This node handles ERR-02. It is a dead-end node — no further connections needed
(the row is written and processing of this contact is complete).

`retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`

---

### Node 6: Loop Contacts

```
Name:         "Loop Contacts"
Type:         n8n-nodes-base.splitInBatches
typeVersion:  3
Position:     [1100, 300]
```

**Parameters**:
```json
{
  "batchSize": 1,
  "options": {}
}
```

**Connection rules**:
- Receives from: Node 4 Output 0 (true — has URL)
- Output Index 0 (done): connects to nothing (loop complete — all contacts processed)
- Output Index 1 (loop): connects to Node 7 (Scrape LinkedIn Profile)

**Important**: SplitInBatches Output 0 = done (all batches finished), Output 1 = loop iteration.
The loop output (index 1) feeds into Node 7. When all items are processed, the workflow
ends naturally via the done output (index 0) having no downstream connection.

---

### Node 7: Scrape LinkedIn Profile

```
Name:         "Scrape LinkedIn Profile"
Type:         n8n-nodes-base.httpRequest
typeVersion:  4.4
Position:     [1350, 300]
```

**Parameters**:
```json
{
  "method": "POST",
  "url": "https://api.apify.com/v2/acts/apify~linkedin-profile-scraper/run-sync-get-dataset-items",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "token",
        "value": "APIFY_API_TOKEN_HIER_EINTRAGEN"
      }
    ]
  },
  "sendBody": true,
  "contentType": "json",
  "body": "={{ JSON.stringify({ startUrls: [{ url: $json.LinkedInURL }] }) }}",
  "options": {
    "response": {
      "response": {
        "neverError": true
      }
    },
    "timeout": 120000
  }
}
```

**Notes**:
- `run-sync-get-dataset-items` makes Apify run the actor synchronously and return dataset items in one call. This can take 30-90 seconds per profile.
- `neverError: true` ensures that HTTP 4xx/5xx responses are passed through as data rather than throwing workflow errors — this enables the fallback path in Node 8.
- `timeout` set to 120000ms (2 minutes) to accommodate Apify's sync run time.
- `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 10000`
- The node merges the contact's original data from the loop with the HTTP response. The response body is available at `$json` (for array responses) or via `$json.body`.

**Output**: Apify returns an array of profile objects. The HTTP Request node will output
the parsed JSON. Expected Apify response shape (array with one element):
```json
[
  {
    "firstName": "Max",
    "lastName": "Mustermann",
    "headline": "CEO at Muster GmbH | Effizienz-Enthusiast",
    "summary": "Ich leite...",
    "positions": [{ "title": "CEO", "companyName": "Muster GmbH", "startDate": "..." }],
    "skills": ["Leadership", "Strategy", "..."]
  }
]
```

**Critical**: The original contact data (FirstName, LastName, etc.) from the loop is
LOST at this point unless explicitly preserved. The Set nodes (9 and 10) must
re-reference `$('Loop Contacts').item.json` to access the original contact fields.

---

### Node 8: Check Apify Data

```
Name:         "Check Apify Data"
Type:         n8n-nodes-base.if
typeVersion:  2.2
Position:     [1600, 300]
```

**Purpose**: Determines if Apify returned usable profile data.

**Parameters**:
```json
{
  "conditions": {
    "options": {
      "caseSensitive": false,
      "leftValue": "",
      "typeValidation": "strict",
      "version": 2
    },
    "conditions": [
      {
        "id": "apify-data-check",
        "leftValue": "={{ Array.isArray($json) && $json.length > 0 && $json[0].headline !== undefined }}",
        "rightValue": "true",
        "operator": {
          "type": "string",
          "operation": "equals"
        }
      }
    ],
    "combinator": "and"
  }
}
```

**Outputs**:
- Output 0 (true): Valid profile data returned — goes to Node 9 (Prepare Full Context)
- Output 1 (false): No data / empty / error — goes to Node 10 (Prepare Fallback Context)

**Alternative expression approach** (simpler, using number comparison):
```
leftValue: ={{ $json.length ?? 0 }}
rightValue: 0
operator: type=number, operation=gt (greater than)
```

---

### Node 9: Prepare Full Context

```
Name:         "Prepare Full Context"
Type:         n8n-nodes-base.set
typeVersion:  3.4
Position:     [1850, 150]
```

**Purpose**: Assembles all available data (sheet + Apify profile) into a single flat
item for the LLM prompt. Accesses original contact via `$('Loop Contacts').item.json`
and Apify data via `$json[0]`.

**Parameters**:
```json
{
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      {
        "id": "a1",
        "name": "firstName",
        "value": "={{ $('Loop Contacts').item.json.FirstName }}",
        "type": "string"
      },
      {
        "id": "a2",
        "name": "lastName",
        "value": "={{ $('Loop Contacts').item.json.LastName }}",
        "type": "string"
      },
      {
        "id": "a3",
        "name": "company",
        "value": "={{ $('Loop Contacts').item.json.Company ?? '' }}",
        "type": "string"
      },
      {
        "id": "a4",
        "name": "position",
        "value": "={{ $('Loop Contacts').item.json.Position ?? '' }}",
        "type": "string"
      },
      {
        "id": "a5",
        "name": "linkedInURL",
        "value": "={{ $('Loop Contacts').item.json.LinkedInURL }}",
        "type": "string"
      },
      {
        "id": "a6",
        "name": "headline",
        "value": "={{ $json[0].headline ?? '' }}",
        "type": "string"
      },
      {
        "id": "a7",
        "name": "summary",
        "value": "={{ $json[0].summary ?? $json[0].about ?? '' }}",
        "type": "string"
      },
      {
        "id": "a8",
        "name": "currentTitle",
        "value": "={{ $json[0].positions?.[0]?.title ?? $('Loop Contacts').item.json.Position ?? '' }}",
        "type": "string"
      },
      {
        "id": "a9",
        "name": "currentCompany",
        "value": "={{ $json[0].positions?.[0]?.companyName ?? $('Loop Contacts').item.json.Company ?? '' }}",
        "type": "string"
      },
      {
        "id": "a10",
        "name": "skills",
        "value": "={{ ($json[0].skills ?? []).slice(0, 10).join(', ') }}",
        "type": "string"
      },
      {
        "id": "a11",
        "name": "dmStatus",
        "value": "Entwurf",
        "type": "string"
      }
    ]
  },
  "options": {}
}
```

---

### Node 10: Prepare Fallback Context

```
Name:         "Prepare Fallback Context"
Type:         n8n-nodes-base.set
typeVersion:  3.4
Position:     [1850, 450]
```

**Purpose**: Assembles minimal contact data for Sheets-only DM generation.
Accesses original contact via `$('Loop Contacts').item.json`.

**Parameters**:
```json
{
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      {
        "id": "b1",
        "name": "firstName",
        "value": "={{ $('Loop Contacts').item.json.FirstName }}",
        "type": "string"
      },
      {
        "id": "b2",
        "name": "lastName",
        "value": "={{ $('Loop Contacts').item.json.LastName }}",
        "type": "string"
      },
      {
        "id": "b3",
        "name": "company",
        "value": "={{ $('Loop Contacts').item.json.Company ?? '' }}",
        "type": "string"
      },
      {
        "id": "b4",
        "name": "position",
        "value": "={{ $('Loop Contacts').item.json.Position ?? '' }}",
        "type": "string"
      },
      {
        "id": "b5",
        "name": "linkedInURL",
        "value": "={{ $('Loop Contacts').item.json.LinkedInURL }}",
        "type": "string"
      },
      {
        "id": "b6",
        "name": "headline",
        "value": "",
        "type": "string"
      },
      {
        "id": "b7",
        "name": "summary",
        "value": "",
        "type": "string"
      },
      {
        "id": "b8",
        "name": "currentTitle",
        "value": "={{ $('Loop Contacts').item.json.Position ?? '' }}",
        "type": "string"
      },
      {
        "id": "b9",
        "name": "currentCompany",
        "value": "={{ $('Loop Contacts').item.json.Company ?? '' }}",
        "type": "string"
      },
      {
        "id": "b10",
        "name": "skills",
        "value": "",
        "type": "string"
      },
      {
        "id": "b11",
        "name": "dmStatus",
        "value": "Fallback",
        "type": "string"
      }
    ]
  },
  "options": {}
}
```

---

### Node 11: Generate DM (Full)

```
Name:         "Generate DM (Full)"
Type:         @n8n/n8n-nodes-langchain.chainLlm
typeVersion:  1.5
Position:     [2100, 150]
```

**Parameters**:
```json
{
  "promptType": "define",
  "text": "={{ 'Du bist Markus, ein Experte fuer Effizienzsteigerung und Prozessoptimierung fuer Unternehmen.\\n\\nSchreibe eine personalisierte LinkedIn-Direktnachricht (DM) auf Deutsch an ' + $json.firstName + ' ' + $json.lastName + '.\\n\\nKontextdaten:\\n- Name: ' + $json.firstName + ' ' + $json.lastName + '\\n- Aktuelle Position: ' + $json.currentTitle + '\\n- Unternehmen: ' + $json.currentCompany + '\\n- LinkedIn Headline: ' + $json.headline + '\\n- Profil-Zusammenfassung: ' + ($json.summary !== '' ? $json.summary : 'nicht verfuegbar') + '\\n- Skills: ' + ($json.skills !== '' ? $json.skills : 'nicht verfuegbar') + '\\n\\nAnforderungen an die Nachricht:\\n1. Maximal 300 Woerter\\n2. Professioneller aber persoenlicher Ton - kein Spam-Gefuehl\\n3. Beginne mit einer konkreten Beobachtung aus dem Profil (Headline oder aktuelle Rolle)\\n4. Stelle eine Verbindung zu Effizienzthemen oder Prozessoptimierung her, die fuer ihre Rolle relevant sind\\n5. Identifiziere 1-2 moegliche Pain-Points basierend auf Position und Branche\\n6. Erwaehne kurz, dass du bei Effizienzsteigerung helfen kannst - ohne aggressiv zu verkaufen\\n7. Schliesse mit GENAU EINER offenen Frage zu einem konkreten Pain-Point ab\\n8. Kein generisches \"Ich habe Ihr Profil gesehen\"\\n\\nSchreibe NUR die Nachricht, keine Erklaerungen oder Einleitung.' }}"
}
```

**Note**: The `promptType: "define"` with `text` field is the correct way to use
chainLlm with a dynamic expression. The LLM sub-node (Node 12) is connected via
`ai_languageModel`.

**retryOnFail**: Applied at the chainLlm level — `retryOnFail: true`, `maxTries: 2`, `waitBetweenTries: 5000`

---

### Node 12: OpenAI Model (Full)

```
Name:         "OpenAI Model (Full)"
Type:         @n8n/n8n-nodes-langchain.lmChatOpenAi
typeVersion:  1.2
Position:     [2100, 0]
Credentials:  { id: "OPENAI_CREDENTIAL_ID", name: "OpenAI account" }
```

**Connection type**: `ai_languageModel` → connects TO "Generate DM (Full)"

**Parameters**:
```json
{
  "model": {
    "mode": "list",
    "value": "gpt-4o-mini"
  },
  "options": {
    "maxTokens": 600,
    "temperature": 0.7
  }
}
```

---

### Node 13: Generate DM (Fallback)

```
Name:         "Generate DM (Fallback)"
Type:         @n8n/n8n-nodes-langchain.chainLlm
typeVersion:  1.5
Position:     [2100, 450]
```

**Parameters**:
```json
{
  "promptType": "define",
  "text": "={{ 'Du bist Markus, ein Experte fuer Effizienzsteigerung und Prozessoptimierung fuer Unternehmen.\\n\\nSchreibe eine personalisierte LinkedIn-Direktnachricht (DM) auf Deutsch an ' + $json.firstName + ' ' + $json.lastName + '.\\n\\nKontextdaten (nur Basis-Infos verfuegbar):\\n- Name: ' + $json.firstName + ' ' + $json.lastName + '\\n- Position: ' + $json.currentTitle + '\\n- Unternehmen: ' + $json.currentCompany + '\\n\\nAnforderungen an die Nachricht:\\n1. Maximal 300 Woerter\\n2. Professioneller aber persoenlicher Ton - kein Spam-Gefuehl\\n3. Bezug auf typische Herausforderungen in der Position ' + $json.currentTitle + ' nehmen\\n4. Identifiziere 1-2 moegliche Pain-Points fuer jemanden in dieser Rolle\\n5. Erwaehne kurz, dass du bei Effizienzsteigerung und Prozessoptimierung helfen kannst\\n6. Schliesse mit GENAU EINER offenen Frage zu einem konkreten Pain-Point ab\\n7. Kein generisches \"Ich habe Ihr Profil gesehen\"\\n\\nSchreibe NUR die Nachricht, keine Erklaerungen oder Einleitung.' }}"
}
```

**retryOnFail**: `retryOnFail: true`, `maxTries: 2`, `waitBetweenTries: 5000`

---

### Node 14: OpenAI Model (Fallback)

```
Name:         "OpenAI Model (Fallback)"
Type:         @n8n/n8n-nodes-langchain.lmChatOpenAi
typeVersion:  1.2
Position:     [2100, 300]
Credentials:  { id: "OPENAI_CREDENTIAL_ID", name: "OpenAI account" }
```

**Connection type**: `ai_languageModel` → connects TO "Generate DM (Fallback)"

**Parameters**:
```json
{
  "model": {
    "mode": "list",
    "value": "gpt-4o-mini"
  },
  "options": {
    "maxTokens": 500,
    "temperature": 0.7
  }
}
```

---

### Node 15: Set Full Output

```
Name:         "Set Full Output"
Type:         n8n-nodes-base.set
typeVersion:  3.4
Position:     [2350, 150]
```

**Purpose**: Shapes the final output item from the Full path. The chainLlm node
outputs `{ text: "...generated DM..." }`. We need to combine that with the contact
fields and add Status and timestamp.

**Parameters**:
```json
{
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      {
        "id": "o1",
        "name": "FirstName",
        "value": "={{ $('Prepare Full Context').item.json.firstName }}",
        "type": "string"
      },
      {
        "id": "o2",
        "name": "LastName",
        "value": "={{ $('Prepare Full Context').item.json.lastName }}",
        "type": "string"
      },
      {
        "id": "o3",
        "name": "Company",
        "value": "={{ $('Prepare Full Context').item.json.company }}",
        "type": "string"
      },
      {
        "id": "o4",
        "name": "Position",
        "value": "={{ $('Prepare Full Context').item.json.position }}",
        "type": "string"
      },
      {
        "id": "o5",
        "name": "LinkedInURL",
        "value": "={{ $('Prepare Full Context').item.json.linkedInURL }}",
        "type": "string"
      },
      {
        "id": "o6",
        "name": "GeneratedDM",
        "value": "={{ $json.text }}",
        "type": "string"
      },
      {
        "id": "o7",
        "name": "Status",
        "value": "Entwurf",
        "type": "string"
      },
      {
        "id": "o8",
        "name": "GeneratedAt",
        "value": "={{ $now.toISO() }}",
        "type": "string"
      }
    ]
  },
  "options": {}
}
```

---

### Node 16: Set Fallback Output

```
Name:         "Set Fallback Output"
Type:         n8n-nodes-base.set
typeVersion:  3.4
Position:     [2350, 450]
```

**Parameters**:
```json
{
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      {
        "id": "p1",
        "name": "FirstName",
        "value": "={{ $('Prepare Fallback Context').item.json.firstName }}",
        "type": "string"
      },
      {
        "id": "p2",
        "name": "LastName",
        "value": "={{ $('Prepare Fallback Context').item.json.lastName }}",
        "type": "string"
      },
      {
        "id": "p3",
        "name": "Company",
        "value": "={{ $('Prepare Fallback Context').item.json.company }}",
        "type": "string"
      },
      {
        "id": "p4",
        "name": "Position",
        "value": "={{ $('Prepare Fallback Context').item.json.position }}",
        "type": "string"
      },
      {
        "id": "p5",
        "name": "LinkedInURL",
        "value": "={{ $('Prepare Fallback Context').item.json.linkedInURL }}",
        "type": "string"
      },
      {
        "id": "p6",
        "name": "GeneratedDM",
        "value": "={{ $json.text }}",
        "type": "string"
      },
      {
        "id": "p7",
        "name": "Status",
        "value": "Fallback",
        "type": "string"
      },
      {
        "id": "p8",
        "name": "GeneratedAt",
        "value": "={{ $now.toISO() }}",
        "type": "string"
      }
    ]
  },
  "options": {}
}
```

---

### Node 17: Merge Paths

```
Name:         "Merge Paths"
Type:         n8n-nodes-base.merge
typeVersion:  3.1
Position:     [2600, 300]
```

**Parameters**:
```json
{
  "mode": "append",
  "options": {}
}
```

**Inputs**:
- Input 0: from "Set Full Output" (Node 15)
- Input 1: from "Set Fallback Output" (Node 16)

**Purpose**: Reunites the Full and Fallback branches into a single stream before
writing to Sheets. Mode "append" simply concatenates the items from both inputs.

---

### Node 18: Write Output Sheet

```
Name:         "Write Output Sheet"
Type:         n8n-nodes-base.googleSheets
typeVersion:  4.5
Position:     [2850, 300]
Credentials:  { id: "gw0DIdDENFkpE7ZW", name: "Google Sheets account" }
```

**Parameters**:
```json
{
  "operation": "append",
  "documentId": {
    "mode": "id",
    "value": "GOOGLE_SHEET_ID_HIER_EINTRAGEN"
  },
  "sheetName": {
    "mode": "name",
    "value": "DM-Output"
  },
  "columns": {
    "mappingMode": "defineBelow",
    "value": {
      "FirstName": "={{ $json.FirstName }}",
      "LastName": "={{ $json.LastName }}",
      "Company": "={{ $json.Company }}",
      "Position": "={{ $json.Position }}",
      "LinkedInURL": "={{ $json.LinkedInURL }}",
      "GeneratedDM": "={{ $json.GeneratedDM }}",
      "Status": "={{ $json.Status }}",
      "GeneratedAt": "={{ $json.GeneratedAt }}"
    }
  },
  "options": {}
}
```

**retryOnFail**: `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`

---

## Connection Map

```
"Form Trigger"                [output 0] → [input 0] "Read Connections Sheet"
"Read Connections Sheet"      [output 0] → [input 0] "Filter Contacts"
"Filter Contacts"             [output 0] → [input 0] "Check LinkedIn URL"
"Check LinkedIn URL"          [output 0] → [input 0] "Loop Contacts"         (true: has URL)
"Check LinkedIn URL"          [output 1] → [input 0] "Write Kein URL"        (false: no URL)
"Loop Contacts"               [output 1] → [input 0] "Scrape LinkedIn Profile"  (loop iteration)
"Scrape LinkedIn Profile"     [output 0] → [input 0] "Check Apify Data"
"Check Apify Data"            [output 0] → [input 0] "Prepare Full Context"   (true: data found)
"Check Apify Data"            [output 1] → [input 0] "Prepare Fallback Context" (false: no data)
"Prepare Full Context"        [output 0] → [input 0] "Generate DM (Full)"
"OpenAI Model (Full)"         [ai_languageModel]    → "Generate DM (Full)"
"Prepare Fallback Context"    [output 0] → [input 0] "Generate DM (Fallback)"
"OpenAI Model (Fallback)"     [ai_languageModel]    → "Generate DM (Fallback)"
"Generate DM (Full)"          [output 0] → [input 0] "Set Full Output"
"Generate DM (Fallback)"      [output 0] → [input 0] "Set Fallback Output"
"Set Full Output"             [output 0] → [input 0] "Merge Paths"
"Set Fallback Output"         [output 0] → [input 1] "Merge Paths"
"Merge Paths"                 [output 0] → [input 0] "Write Output Sheet"
"Write Output Sheet"          [output 0] → [input 0] "Loop Contacts"         (back to loop)
```

**n8n connections JSON format** (for executor reference):
```json
{
  "Form Trigger": {
    "main": [[{ "node": "Read Connections Sheet", "type": "main", "index": 0 }]]
  },
  "Read Connections Sheet": {
    "main": [[{ "node": "Filter Contacts", "type": "main", "index": 0 }]]
  },
  "Filter Contacts": {
    "main": [[{ "node": "Check LinkedIn URL", "type": "main", "index": 0 }]]
  },
  "Check LinkedIn URL": {
    "main": [
      [{ "node": "Loop Contacts", "type": "main", "index": 0 }],
      [{ "node": "Write Kein URL", "type": "main", "index": 0 }]
    ]
  },
  "Loop Contacts": {
    "main": [
      [],
      [{ "node": "Scrape LinkedIn Profile", "type": "main", "index": 0 }]
    ]
  },
  "Scrape LinkedIn Profile": {
    "main": [[{ "node": "Check Apify Data", "type": "main", "index": 0 }]]
  },
  "Check Apify Data": {
    "main": [
      [{ "node": "Prepare Full Context", "type": "main", "index": 0 }],
      [{ "node": "Prepare Fallback Context", "type": "main", "index": 0 }]
    ]
  },
  "Prepare Full Context": {
    "main": [[{ "node": "Generate DM (Full)", "type": "main", "index": 0 }]]
  },
  "OpenAI Model (Full)": {
    "ai_languageModel": [[{ "node": "Generate DM (Full)", "type": "ai_languageModel", "index": 0 }]]
  },
  "Prepare Fallback Context": {
    "main": [[{ "node": "Generate DM (Fallback)", "type": "main", "index": 0 }]]
  },
  "OpenAI Model (Fallback)": {
    "ai_languageModel": [[{ "node": "Generate DM (Fallback)", "type": "ai_languageModel", "index": 0 }]]
  },
  "Generate DM (Full)": {
    "main": [[{ "node": "Set Full Output", "type": "main", "index": 0 }]]
  },
  "Generate DM (Fallback)": {
    "main": [[{ "node": "Set Fallback Output", "type": "main", "index": 0 }]]
  },
  "Set Full Output": {
    "main": [[{ "node": "Merge Paths", "type": "main", "index": 0 }]]
  },
  "Set Fallback Output": {
    "main": [[{ "node": "Merge Paths", "type": "main", "index": 1 }]]
  },
  "Merge Paths": {
    "main": [[{ "node": "Write Output Sheet", "type": "main", "index": 0 }]]
  },
  "Write Output Sheet": {
    "main": [[{ "node": "Loop Contacts", "type": "main", "index": 0 }]]
  }
}
```

---

## Key Expressions Reference

| Location | Expression | Purpose |
|---|---|---|
| Filter Contacts | `={{ $('Form Trigger').first().json['Position (enthält)'] ?? '' }}` | Read form field value with null safety |
| Filter Contacts | `={{ $json.Position ?? '' }}` | Read sheet column with null safety |
| Check LinkedIn URL | `={{ $json.LinkedInURL ?? '' }}` | URL presence check |
| Scrape LinkedIn Profile (body) | `={{ JSON.stringify({ startUrls: [{ url: $json.LinkedInURL }] }) }}` | Build Apify request body |
| Check Apify Data | `={{ Array.isArray($json) && $json.length > 0 && $json[0].headline !== undefined }}` | Validate Apify response |
| Prepare Full Context | `={{ $('Loop Contacts').item.json.FirstName }}` | Access original contact data after HTTP Request |
| Prepare Full Context | `={{ $json[0].headline ?? '' }}` | Access first Apify result with null safety |
| Prepare Full Context | `={{ $json[0].positions?.[0]?.title ?? $('Loop Contacts').item.json.Position ?? '' }}` | Optional chaining for nested Apify data |
| Prepare Full Context | `={{ ($json[0].skills ?? []).slice(0, 10).join(', ') }}` | Convert skills array to string, limit to 10 |
| Set Full Output | `={{ $('Prepare Full Context').item.json.firstName }}` | Re-reference context after LLM chain |
| Set Full Output | `={{ $json.text }}` | Extract generated DM from chainLlm output |
| Set Full Output | `={{ $now.toISO() }}` | ISO timestamp for GeneratedAt |

---

## Node Positions (Visual Layout)

```
Y=0    [OpenAI Model (Full)]       x=2100
Y=150  [Prepare Full Context]       x=1850   [Generate DM (Full)]  x=2100   [Set Full Output]    x=2350
Y=300  [Form] [Read] [Filter] [CheckURL] [Loop] [Scrape] [CheckApify]        [Merge]    [WriteSheet]
       x=100  x=350  x=600   x=850  x=1100 x=1350 x=1600              x=2600  x=2850
Y=300  [OpenAI Model (Fallback)]   x=2100
Y=450  [Prepare Fallback Context]  x=1850   [Generate DM (Fallback)] x=2100  [Set Fallback Output] x=2350
Y=500  [Write Kein URL]            x=1100
```

**Exact positions table**:

| Node | x | y |
|---|---|---|
| Form Trigger | 100 | 300 |
| Read Connections Sheet | 350 | 300 |
| Filter Contacts | 600 | 300 |
| Check LinkedIn URL | 850 | 300 |
| Loop Contacts | 1100 | 300 |
| Write Kein URL | 1100 | 500 |
| Scrape LinkedIn Profile | 1350 | 300 |
| Check Apify Data | 1600 | 300 |
| Prepare Full Context | 1850 | 150 |
| Prepare Fallback Context | 1850 | 450 |
| OpenAI Model (Full) | 2100 | 0 |
| Generate DM (Full) | 2100 | 150 |
| OpenAI Model (Fallback) | 2100 | 300 |
| Generate DM (Fallback) | 2100 | 450 |
| Set Full Output | 2350 | 150 |
| Set Fallback Output | 2350 | 450 |
| Merge Paths | 2600 | 300 |
| Write Output Sheet | 2850 | 300 |

---

## Credentials Summary

| Node | Credential Type | Credential ID | Credential Name |
|---|---|---|---|
| Read Connections Sheet | googleSheetsOAuth2Api | gw0DIdDENFkpE7ZW | Google Sheets account |
| Write Kein URL | googleSheetsOAuth2Api | gw0DIdDENFkpE7ZW | Google Sheets account |
| Write Output Sheet | googleSheetsOAuth2Api | gw0DIdDENFkpE7ZW | Google Sheets account |
| Scrape LinkedIn Profile | none (token in query param) | — | — |
| OpenAI Model (Full) | openAiApi | OPENAI_CREDENTIAL_ID | OpenAI account |
| OpenAI Model (Fallback) | openAiApi | OPENAI_CREDENTIAL_ID | OpenAI account |

**Action required before deployment**:
1. Replace `GOOGLE_SHEET_ID_HIER_EINTRAGEN` with the actual Google Spreadsheet ID (found in the Sheets URL)
2. Replace `OPENAI_CREDENTIAL_ID` with the actual OpenAI credential ID from meinoffice.app.n8n.cloud
3. Ensure the "DM-Output" sheet tab exists in the target spreadsheet

---

## Error Handling Design

### ERR-01: Apify Failure / Empty Profile

**Scenario**: Apify returns HTTP 4xx/5xx, returns an empty array `[]`, or returns
data without recognizable profile fields.

**Implementation**:
- `neverError: true` on the HTTP Request node prevents workflow crash on HTTP errors
- Node 8 (Check Apify Data) checks `Array.isArray($json) && $json.length > 0 && $json[0].headline !== undefined`
- When the check fails (false branch), flow goes to Node 10 (Prepare Fallback Context)
- Node 13 generates a DM from Sheets-only data (Name, Company, Position)
- Final output Status = "Fallback"
- Workflow continues normally — no crash, contact still gets a DM

**Additional protection**: `retryOnFail: true, maxTries: 3, waitBetweenTries: 10000` on
the HTTP Request node handles transient network errors before falling back.

### ERR-02: No LinkedIn URL

**Scenario**: A contact row in the source sheet has an empty/null LinkedInURL column.

**Implementation**:
- Node 4 (Check LinkedIn URL) tests `$json.LinkedInURL ?? ''` with `notEmpty` operator
- False branch: directly writes to output sheet with Status = "Kein URL"
- Node 5 (Write Kein URL) is a terminal node — no LLM call, no Apify call
- These contacts are immediately written and skipped from further processing
- The loop (Node 6) never sees these contacts

### General Workflow Error Handling Settings

```json
{
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner"
  }
}
```

Saving all executions is important for debugging the Apify scraping behavior and
reviewing which contacts received which status.

---

## Data Flow Summary

```
[Form Trigger]
  Output: { "Position (enthält)": str, "Region (enthält)": str, "Branche (enthält)": str, "Mitarbeiteranzahl (enthält)": str }

[Read Connections Sheet]
  Input:  1 item (form data, kept as context via $('Form Trigger'))
  Output: N items, each: { FirstName, LastName, EmailAddress, Company, Position, ConnectedOn, LinkedInURL, ... }

[Filter Contacts]
  Input:  N contact items
  Output: M items (M ≤ N) where form filters match

[Check LinkedIn URL]
  Input:  M items
  Output 0: M_url items (have URL) → Loop
  Output 1: M_nourl items (no URL) → Write Kein URL

[Loop Contacts] (batchSize=1)
  Input:  M_url items (initially), then 1 item per iteration
  Output 1 (loop): 1 item per iteration → Scrape

[Scrape LinkedIn Profile]
  Input:  { FirstName, LastName, Company, Position, LinkedInURL, ... }
  Output: Apify response array OR error response — depends on neverError

[Check Apify Data]
  Output 0: items where Apify returned valid data
  Output 1: items where Apify returned empty/invalid data

[Prepare Full/Fallback Context]
  Output: flat object { firstName, lastName, company, position, linkedInURL, headline, summary, currentTitle, currentCompany, skills, dmStatus }

[Generate DM (Full/Fallback)]
  Output: { text: "...generated DM text..." }

[Set Full/Fallback Output]
  Output: { FirstName, LastName, Company, Position, LinkedInURL, GeneratedDM, Status, GeneratedAt }

[Merge Paths]
  Output: combined stream of Full + Fallback items

[Write Output Sheet]
  Appends each item as a row to DM-Output sheet
  Then feeds back to Loop Contacts for next iteration
```

---

## Pre-Deployment Checklist

- [ ] Google Spreadsheet created with two tabs: "Connections" and "DM-Output"
- [ ] Connections tab has header row: FirstName, LastName, EmailAddress, Company, Position, ConnectedOn, LinkedInURL (+ optionally Region, Branche, Mitarbeiteranzahl)
- [ ] DM-Output tab has header row: FirstName, LastName, Company, Position, LinkedInURL, GeneratedDM, Status, GeneratedAt
- [ ] Replace `GOOGLE_SHEET_ID_HIER_EINTRAGEN` with actual Spreadsheet ID in nodes 2, 5, 18
- [ ] Replace `OPENAI_CREDENTIAL_ID` with actual credential ID in nodes 12, 14
- [ ] At least 2-3 test contacts with valid LinkedIn URLs in Connections sheet
- [ ] At least 1 test contact WITHOUT LinkedIn URL to verify ERR-02 path

---

## Validation Criteria

- [ ] All workflows validate via n8n-MCP `validate_workflow`
- [ ] No HTTP Request nodes where native nodes exist (Apify has no native node — HTTP Request is correct here)
- [ ] All expressions use correct syntax `={{ }}`
- [ ] `$('NodeName').item.json` used (not `$node['NodeName'].json`) for cross-node refs inside loop context
- [ ] Credentials set for all Google Sheets nodes and OpenAI nodes
- [ ] Error handling: `onError: "continueRegularOutput"` (NOT `continueOnFail: true`)
- [ ] `retryOnFail` configured on HTTP Request and Google Sheets nodes
- [ ] SplitInBatches: Output 0=done (no connection), Output 1=loop → Scrape
- [ ] Merge node receives from exactly 2 inputs (Full and Fallback paths)
- [ ] OpenAI prompt: direct `text` string (NOT wrapped in `{"values": [...]}`)
- [ ] Switch/IF nodes: typeVersion 2.2, NOT 3/3.2 (canvas crash prevention)
- [ ] Workflow Settings: `executionOrder: "v1"`, all save flags true
- [ ] Form URL path: `linkedin-outreach` — accessible at `https://meinoffice.app.n8n.cloud/form/linkedin-outreach`

---

*Plan created: 2026-03-11*
*Phase: 1 of 1*
*Status: Ready for execution*
