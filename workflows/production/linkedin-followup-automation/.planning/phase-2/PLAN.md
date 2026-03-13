---
phase: 2
plan: 2-1
workflows: [WF1 — Branch B added to j6O5Ktxcp0n6o9du]
type: n8n-workflow
---

# Plan 2-1: Branch B — Analyse & KI-Report (Anthropic Hormozi)

## Objective

Add Branch B to the existing WF1 workflow (`j6O5Ktxcp0n6o9du`). Branch B starts from
the Schedule Trigger in parallel with Branch A. It reads all leads from Google Sheets,
scrapes the LinkedIn Inbox via Apify (polling loop, max 60 attempts), merges and
categorizes leads into 4 groups, calls Anthropic Claude (native node) once for all
contacts, generates an HTML report, sends it via Gmail, updates the Leads sheet, and
appends to Report-Log.

## Requirements Covered

| Req ID | Description |
|---|---|
| TRIG-03 | Branch B receives all Leads from Google Sheet + Apify Inbox data |
| DATA-02 | Merge Sheet leads with Apify conversations, calc day diffs, classify 4 categories |
| DATA-03 | Stern / Unbeantwortet / 3 Tage still / 5 Tage still categorization logic |
| DATA-04 | Parse Anthropic JSON response (backtick cleanup), merge AI results into leads |
| DATA-05 | Generate full HTML report with 4 color-coded sections, header stats, linked names |
| API-02 | POST to start Apify Inbox Actor with cookie + includeMessageHistory |
| API-04 | Polling loop max 60 attempts x 15s; on FAILED continue with sheet-only + error note |
| API-05 | Fetch Apify dataset items after successful actor run |
| AI-01 | Exactly 1 Anthropic Claude call for ALL contacts from all 4 categories |
| AI-02 | System prompt defines 4 Hormozi methods |
| AI-03 | Claude returns pure JSON array, one object per contact |
| AI-04 | Personalization: Name + Unternehmen/Position in each suggestion, max 3 sentences |
| AI-05 | On Claude failure: fallback texts, report still runs |
| OUT-03 | Gmail sends HTML report to REPORT_EMAIL |
| OUT-04 | Google Sheets update all categorized leads (Lookup by LinkedIn_URL) |
| OUT-05 | Google Sheets append row to Report-Log |

## Deployment Strategy

The executor uses `n8n_update_full_workflow` to replace the existing workflow with an
updated version that contains all 16 Branch A nodes PLUS the new Branch B nodes.
The workflow name changes to `WF1 — LinkedIn Follow-up Automation (Branch A + B)`.

The Schedule Trigger gets a second output connection added: its `main[0]` array now
contains two targets — the existing Branch A start AND the new Branch B start node.

---

## Node Inventory: Branch B (19 new nodes)

| ID | Name | Type | typeVersion | Position |
|---|---|---|---|---|
| b01-read-all-leads | Google Sheets: Read All Leads | n8n-nodes-base.googleSheets | 4.7 | [100, 700] |
| b02-start-inbox-actor | HTTP Request: Start Inbox Actor | n8n-nodes-base.httpRequest | 4.4 | [350, 700] |
| b03-wait-inbox-initial | Wait: Inbox Initial 20s | n8n-nodes-base.wait | 1.1 | [600, 700] |
| b04-merge-inbox-loop | Merge: Inbox Loop Entry | n8n-nodes-base.merge | 3.1 | [850, 700] |
| b05-check-inbox-status | HTTP Request: Check Inbox Status | n8n-nodes-base.httpRequest | 4.4 | [1100, 700] |
| b06-if-inbox-done | IF: Inbox Actor Done? | n8n-nodes-base.if | 2.2 | [1350, 700] |
| b07-if-inbox-max | IF: Inbox Max Attempts? | n8n-nodes-base.if | 2.2 | [1600, 850] |
| b08-set-inbox-failed | Set: Mark Inbox Failed | n8n-nodes-base.set | 3.4 | [1850, 950] |
| b09-set-inbox-counter | Set: Increment Inbox Counter | n8n-nodes-base.set | 3.4 | [1850, 750] |
| b10-wait-inbox-poll | Wait: Inbox 15s Poll | n8n-nodes-base.wait | 1.1 | [2100, 750] |
| b11-get-inbox-dataset | HTTP Request: Get Inbox Dataset | n8n-nodes-base.httpRequest | 4.4 | [1600, 550] |
| b12-merge-categorize | Code: Merge & Categorize | n8n-nodes-base.code | 2 | [1850, 550] |
| b13-build-prompt | Code: Build Anthropic Prompt | n8n-nodes-base.code | 2 | [2100, 550] |
| b14-anthropic | Anthropic: Hormozi Analysis | @n8n/n8n-nodes-langchain.anthropic | 1.7 | [2350, 550] |
| b15-parse-ai | Code: Parse AI Response & Merge | n8n-nodes-base.code | 2 | [2600, 550] |
| b16-html-report | Code: Generate HTML Report | n8n-nodes-base.code | 2 | [2850, 550] |
| b17-flatten-leads | Code: Flatten Leads for Update | n8n-nodes-base.code | 2 | [3100, 700] |
| b18-gmail-send | Gmail: Send Report | n8n-nodes-base.gmail | 2.1 | [3100, 550] |
| b19-update-leads | Google Sheets: Update Leads | n8n-nodes-base.googleSheets | 4.7 | [3350, 700] |
| b20-append-log | Google Sheets: Append Report-Log | n8n-nodes-base.googleSheets | 4.7 | [3100, 400] |

**Total nodes after Phase 2:** 36 (16 Branch A + 20 Branch B)

Note: b17-flatten-leads is an additional node not in the original count of 19 — it is
required to flatten categorized leads into a flat array before the Google Sheets Update
loop. The prompt's architecture diagram shows B18 as Google Sheets Update but the
cleanest approach needs a flatten step first.

---

## Connections Map

### Updated Schedule Trigger connection (key change from Phase 1)

```
"Schedule Trigger": {
  "main": [
    [
      { "node": "HTTP Request: Start Actor", "type": "main", "index": 0 },
      { "node": "Google Sheets: Read All Leads", "type": "main", "index": 0 }
    ]
  ]
}
```

Both Branch A and Branch B start simultaneously from output index 0 of the
Schedule Trigger. n8n routes to multiple targets in a single output array.

### Branch B internal connections

```
Google Sheets: Read All Leads       -> HTTP Request: Start Inbox Actor       (main[0][0])
HTTP Request: Start Inbox Actor     -> Wait: Inbox Initial 20s               (main[0][0])
Wait: Inbox Initial 20s             -> Merge: Inbox Loop Entry               (main[0] index 0)
Merge: Inbox Loop Entry             -> HTTP Request: Check Inbox Status      (main[0][0])
HTTP Request: Check Inbox Status    -> IF: Inbox Actor Done?                 (main[0][0])
IF: Inbox Actor Done?    [true=0]   -> HTTP Request: Get Inbox Dataset       (main[0][0])
IF: Inbox Actor Done?    [false=1]  -> IF: Inbox Max Attempts?               (main[1][0])
IF: Inbox Max Attempts?  [true=0]   -> Set: Mark Inbox Failed                (main[0][0])
IF: Inbox Max Attempts?  [false=1]  -> Set: Increment Inbox Counter          (main[1][0])
Set: Mark Inbox Failed              -> HTTP Request: Get Inbox Dataset       (main[0][0])
Set: Increment Inbox Counter        -> Wait: Inbox 15s Poll                  (main[0][0])
Wait: Inbox 15s Poll                -> Merge: Inbox Loop Entry               (main[0] index 1)
HTTP Request: Get Inbox Dataset     -> Code: Merge & Categorize              (main[0][0])
Code: Merge & Categorize            -> Code: Build Anthropic Prompt          (main[0][0])
Code: Build Anthropic Prompt        -> Anthropic: Hormozi Analysis           (main[0][0])
Anthropic: Hormozi Analysis         -> Code: Parse AI Response & Merge       (main[0][0])
Code: Parse AI Response & Merge     -> Code: Generate HTML Report            (main[0][0])
Code: Generate HTML Report          -> Gmail: Send Report                    (main[0][0])
Code: Generate HTML Report          -> Code: Flatten Leads for Update        (main[0][1])
Code: Generate HTML Report          -> Google Sheets: Append Report-Log      (main[0][2])
Code: Flatten Leads for Update      -> Google Sheets: Update Leads           (main[0][0])
```

**Important:** The three parallel outputs from `Code: Generate HTML Report` are achieved
by adding THREE targets in `main[0]`:
```json
"Code: Generate HTML Report": {
  "main": [
    [
      { "node": "Gmail: Send Report",                "type": "main", "index": 0 },
      { "node": "Code: Flatten Leads for Update",    "type": "main", "index": 0 },
      { "node": "Google Sheets: Append Report-Log",  "type": "main", "index": 0 }
    ]
  ]
}
```

---

## Detailed Node Specifications

### B01 — Google Sheets: Read All Leads

```json
{
  "id": "b01-read-all-leads",
  "name": "Google Sheets: Read All Leads",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [100, 700],
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "parameters": {
    "operation": "read",
    "documentId": {
      "__rl": true,
      "value": "={{ $env.GOOGLE_SHEET_ID }}",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Leads",
      "mode": "name"
    },
    "filtersUI": {},
    "options": {
      "range": "A:M"
    }
  }
}
```

Data output: array of items, each `json` has keys: Name, LinkedIn_URL, Unternehmen,
Position, Erstkontakt_Datum, Letzter_Reply_Datum, Anzahl_Nachrichten, Status, Stern,
Letzte_Kategorie, Letzter_Report, Zuletzt_gesehen, Quelle

---

### B02 — HTTP Request: Start Inbox Actor

```json
{
  "id": "b02-start-inbox-actor",
  "name": "HTTP Request: Start Inbox Actor",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [350, 700],
  "parameters": {
    "method": "POST",
    "url": "https://api.apify.com/v2/acts/curious_coder~linkedin-messages-scraper/runs",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $env.APIFY_API_TOKEN }}"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"cookie\": \"{{ $env.LINKEDIN_COOKIE }}\",\n  \"includeMessageHistory\": true\n}",
    "options": {
      "timeout": 30000
    }
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "onError": "continueRegularOutput"
}
```

Data output: `{ data: { id, defaultDatasetId, status } }`

Note: `onError: "continueRegularOutput"` ensures that if Apify start fails, the flow
continues rather than halting (the polling loop will detect the missing run ID and
the Max Attempts path will eventually trigger the failed-inbox path).

---

### B03 — Wait: Inbox Initial 20s

```json
{
  "id": "b03-wait-inbox-initial",
  "name": "Wait: Inbox Initial 20s",
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "position": [600, 700],
  "parameters": {
    "resume": "timeInterval",
    "amount": 20,
    "unit": "seconds"
  }
}
```

---

### B04 — Merge: Inbox Loop Entry

```json
{
  "id": "b04-merge-inbox-loop",
  "name": "Merge: Inbox Loop Entry",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.1,
  "position": [850, 700],
  "parameters": {
    "mode": "chooseBranch",
    "output": "input1"
  }
}
```

Input 0: from `Wait: Inbox Initial 20s` (first loop entry)
Input 1: from `Wait: Inbox 15s Poll` (loop re-entry)

The `output: "input1"` means: prefer input 1 (re-entry data which carries attemptCount)
over input 0. On first iteration, input 1 is empty so input 0 data flows through.

---

### B05 — HTTP Request: Check Inbox Status

```json
{
  "id": "b05-check-inbox-status",
  "name": "HTTP Request: Check Inbox Status",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [1100, 700],
  "parameters": {
    "method": "GET",
    "url": "=https://api.apify.com/v2/acts/curious_coder~linkedin-messages-scraper/runs/{{ $json.data.id }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $env.APIFY_API_TOKEN }}"
        }
      ]
    },
    "options": {
      "timeout": 10000
    }
  },
  "retryOnFail": true,
  "maxTries": 2,
  "waitBetweenTries": 3000,
  "onError": "continueRegularOutput"
}
```

---

### B06 — IF: Inbox Actor Done?

```json
{
  "id": "b06-if-inbox-done",
  "name": "IF: Inbox Actor Done?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1350, 700],
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
          "id": "inbox-succeeded",
          "leftValue": "={{ $json.data.status }}",
          "rightValue": "SUCCEEDED",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  }
}
```

true (output 0) -> B11 Get Inbox Dataset
false (output 1) -> B07 IF: Inbox Max Attempts?

---

### B07 — IF: Inbox Max Attempts?

```json
{
  "id": "b07-if-inbox-max",
  "name": "IF: Inbox Max Attempts?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1600, 850],
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
          "id": "inbox-max-attempts-reached",
          "leftValue": "={{ $json.inboxAttemptCount ?? 0 }}",
          "rightValue": 60,
          "operator": {
            "type": "number",
            "operation": "gte"
          }
        },
        {
          "id": "inbox-status-terminal",
          "leftValue": "={{ ['FAILED','TIMED-OUT','ABORTED'].includes($json.data?.status ?? '') }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "equals"
          }
        }
      ],
      "combinator": "or"
    },
    "options": {}
  }
}
```

true (output 0) -> B08 Set: Mark Inbox Failed
false (output 1) -> B09 Set: Increment Inbox Counter

---

### B08 — Set: Mark Inbox Failed

```json
{
  "id": "b08-set-inbox-failed",
  "name": "Set: Mark Inbox Failed",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1850, 950],
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        {
          "id": "inbox-failed-flag",
          "name": "inboxFailed",
          "value": true,
          "type": "boolean"
        },
        {
          "id": "inbox-failed-data",
          "name": "data",
          "value": "={{ $json.data }}",
          "type": "object"
        }
      ]
    },
    "options": {
      "includeBinary": false
    }
  }
}
```

Output: `{ inboxFailed: true, data: { ... } }`
Routes to -> B11 Get Inbox Dataset (empty dataset expected; B12 handles gracefully)

---

### B09 — Set: Increment Inbox Counter

```json
{
  "id": "b09-set-inbox-counter",
  "name": "Set: Increment Inbox Counter",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1850, 750],
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        {
          "id": "inbox-attempt-counter",
          "name": "inboxAttemptCount",
          "value": "={{ ($json.inboxAttemptCount ?? 0) + 1 }}",
          "type": "number"
        },
        {
          "id": "inbox-data-passthrough",
          "name": "data",
          "value": "={{ $json.data }}",
          "type": "object"
        }
      ]
    },
    "options": {
      "includeBinary": false
    }
  }
}
```

---

### B10 — Wait: Inbox 15s Poll

```json
{
  "id": "b10-wait-inbox-poll",
  "name": "Wait: Inbox 15s Poll",
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "position": [2100, 750],
  "parameters": {
    "resume": "timeInterval",
    "amount": 15,
    "unit": "seconds"
  }
}
```

Routes back to -> `Merge: Inbox Loop Entry` input index 1

---

### B11 — HTTP Request: Get Inbox Dataset

```json
{
  "id": "b11-get-inbox-dataset",
  "name": "HTTP Request: Get Inbox Dataset",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [1600, 550],
  "parameters": {
    "method": "GET",
    "url": "=https://api.apify.com/v2/datasets/{{ $json.data.defaultDatasetId }}/items",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $env.APIFY_API_TOKEN }}"
        }
      ]
    },
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        {
          "name": "format",
          "value": "json"
        },
        {
          "name": "clean",
          "value": "true"
        }
      ]
    },
    "options": {
      "timeout": 60000
    }
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "onError": "continueRegularOutput"
}
```

Note: when `inboxFailed: true`, `$json.data.defaultDatasetId` will be undefined or
empty, so the URL will be malformed. `onError: "continueRegularOutput"` ensures the
node passes through an empty response (empty array `[]`) rather than stopping.
B12 checks `$('HTTP Request: Get Inbox Dataset').all()` and handles empty gracefully.

Data output (success): array of conversation objects, each containing:
`participantProfileUrl`, `profileUrl`, `messages: [{ direction, sender, text, timestamp }]`

---

### B12 — Code: Merge & Categorize

Mode: `runOnceForAllItems`

```javascript
// INPUTS:
// $input.all() = items from HTTP Request: Get Inbox Dataset (may be empty)
// $('Google Sheets: Read All Leads').all() = sheet leads

const sheetLeads = $('Google Sheets: Read All Leads').all();
const inboxItems = $input.all();

const today = new Date();
today.setHours(0, 0, 0, 0);

function parseDate(str) {
  if (!str) return null;
  if (String(str).includes('.')) {
    const parts = String(str).split('.');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed) ? null : parsed;
}

function daysDiff(dateStr) {
  const d = parseDate(dateStr);
  if (!d || isNaN(d)) return null;
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function normalizeUrl(url) {
  return (url || '').toLowerCase().replace(/\/$/, '').trim();
}

// Build conversation map keyed by normalized profile URL
const convMap = {};
inboxItems.forEach(item => {
  const key = normalizeUrl(
    item.json.participantProfileUrl || item.json.profileUrl || ''
  );
  if (key) convMap[key] = item.json;
});

const results = {
  stern: [],
  unbeantwortet: [],
  dreiTage: [],
  fuenfTage: []
};

sheetLeads.forEach((leadItem, idx) => {
  const lead = leadItem.json;
  const url = normalizeUrl(lead.LinkedIn_URL);

  // Skip leads with no URL or marked as Abgeschlossen
  if (!url || (lead.Status || '').trim() === 'Abgeschlossen') return;

  const conv = convMap[url];
  const anzahlNachrichten = conv && conv.messages
    ? conv.messages.length
    : parseInt(lead.Anzahl_Nachrichten) || 0;

  // Determine last reply date
  let letzterReplyDatum = lead.Letzter_Reply_Datum || null;
  if (conv && conv.messages) {
    const incoming = conv.messages.filter(m => m.direction === 'incoming');
    if (incoming.length > 0) {
      const lastIncoming = incoming[incoming.length - 1];
      letzterReplyDatum = new Date(lastIncoming.timestamp)
        .toLocaleDateString('de-DE');
    }
  }

  // Build conversation history excerpt (last 6 messages)
  const messageHistory = conv && conv.messages
    ? conv.messages
        .slice(-6)
        .map(m => `[${m.direction === 'outgoing' ? 'Ich' : (m.sender || 'Kontakt')}]: ${m.text || ''}`)
        .join('\n')
    : 'Kein Gesprächsverlauf verfügbar';

  const daysSinceReply = daysDiff(letzterReplyDatum);
  const daysSinceFirst = daysDiff(lead.Erstkontakt_Datum);

  const base = {
    name: lead.Name || '',
    linkedinUrl: lead.LinkedIn_URL || '',
    unternehmen: lead.Unternehmen || '',
    position: lead.Position || '',
    erstkontaktDatum: lead.Erstkontakt_Datum || '',
    letzterReplyDatum: letzterReplyDatum || '',
    anzahlNachrichten,
    messageHistory,
    rowIndex: idx + 2  // 1-based, +1 for header row
  };

  // Categorization — Stern takes priority
  if ((lead.Stern || '').toUpperCase() === 'JA') {
    results.stern.push({ ...base, kategorie: 'Stern' });
  } else if (!letzterReplyDatum && daysSinceFirst !== null && daysSinceFirst >= 3) {
    results.unbeantwortet.push({ ...base, kategorie: 'Unbeantwortet' });
  } else if (daysSinceReply !== null && daysSinceReply >= 2 && daysSinceReply <= 4) {
    results.dreiTage.push({ ...base, kategorie: '3 Tage still' });
  } else if (daysSinceReply !== null && daysSinceReply >= 4 && daysSinceReply <= 6) {
    results.fuenfTage.push({ ...base, kategorie: '5 Tage still' });
  }
  // Leads matching none of these criteria are not in any follow-up category today
});

return [{ json: results }];
```

Input data shape: `{ stern: [], unbeantwortet: [], dreiTage: [], fuenfTage: [] }`
Each lead object: `{ name, linkedinUrl, unternehmen, position, erstkontaktDatum, letzterReplyDatum, anzahlNachrichten, messageHistory, rowIndex, kategorie }`

---

### B13 — Code: Build Anthropic Prompt

Mode: `runOnceForAllItems`

```javascript
const data = $input.first().json;
const allContacts = [
  ...data.stern,
  ...data.unbeantwortet,
  ...data.dreiTage,
  ...data.fuenfTage
];

const systemPrompt = `Du bist ein LinkedIn-Outreach-Experte und kennst die "100 Million Leads" Methode von Alex Hormozi auswendig.

Deine Aufgabe: Analysiere LinkedIn-Gespräche und erstelle für jeden Kontakt:
1. Eine kurze Zusammenfassung des bisherigen Gesprächs (max. 2 Sätze)
2. Einen konkreten, personalisierten Nachrichtenvorschlag auf Deutsch

Die Nachrichtenvorschläge folgen strikt der Hormozi-Methode:

KATEGORIE "Unbeantwortet" → Hormozi "Soft Opener":
- Kurze, neugierige Frage die keinen Druck aufbaut
- Kein Pitch, keine langen Erklärungen

KATEGORIE "Stern" → Hormozi "High-Value Direct Opener":
- Direkt und spezifisch, zeigt echtes Interesse
- Klarer konkreter nächster Schritt

KATEGORIE "3 Tage still" → Hormozi "Value Drop":
- Liefere echten Wert ohne Gegenleistung zu verlangen
- Insight, Idee oder Ressource

KATEGORIE "5 Tage still" → Hormozi "Breakup Message":
- Freundlicher Abschluss ohne Vorwurf
- Tür offen lassen

WICHTIG:
- Name, Unternehmen oder Position MÜSSEN im Vorschlag vorkommen
- Maximal 3 Sätze pro Nachricht
- Kein Corporate-Speak
- Antworte NUR mit dem JSON-Array, kein erklärender Text, keine Backticks, kein Markdown`;

const userPrompt = `Analysiere diese LinkedIn-Kontakte und erstelle Zusammenfassungen + Nachrichtenvorschläge.

Gib deine Antwort als JSON-Array zurück. WICHTIG: Antworte NUR mit dem rohen JSON-Array, ohne Markdown, ohne Backticks, ohne Code-Blocks.

Format pro Kontakt:
{"linkedinUrl":"<url>","zusammenfassung":"<max 2 Sätze>","nachrichtenvorschlag":"<konkreter Text>"}

Kontakte:
${JSON.stringify(allContacts.map(k => ({
  linkedinUrl: k.linkedinUrl,
  name: k.name,
  unternehmen: k.unternehmen,
  position: k.position,
  kategorie: k.kategorie,
  anzahlNachrichten: k.anzahlNachrichten,
  gespraechsverlauf: k.messageHistory
})), null, 2)}`;

return [{
  json: {
    systemPrompt,
    userPrompt,
    categorizedData: data,
    totalContacts: allContacts.length
  }
}];
```

Output shape: `{ systemPrompt, userPrompt, categorizedData, totalContacts }`

Edge case: if `allContacts.length === 0`, the Anthropic node will receive an empty
contacts list. B15 handles this gracefully (empty aiResults, categories unchanged).

---

### B14 — Anthropic: Hormozi Analysis

```json
{
  "id": "b14-anthropic",
  "name": "Anthropic: Hormozi Analysis",
  "type": "@n8n/n8n-nodes-langchain.anthropic",
  "typeVersion": 1.7,
  "position": [2350, 550],
  "credentials": {
    "anthropicApi": {
      "id": "ANTHROPIC_CREDENTIAL_ID",
      "name": "Anthropic account"
    }
  },
  "parameters": {
    "model": "claude-sonnet-4-5",
    "messages": {
      "values": [
        {
          "type": "text",
          "role": "system",
          "message": "={{ $json.systemPrompt }}"
        },
        {
          "type": "text",
          "role": "user",
          "message": "={{ $json.userPrompt }}"
        }
      ]
    },
    "options": {
      "maxTokensToSample": 4000,
      "temperature": 0.7
    }
  },
  "onError": "continueRegularOutput"
}
```

`onError: "continueRegularOutput"` implements AI-05: if Claude fails, B15 receives the
raw input and produces fallback texts.

The Anthropic node outputs: `{ content: [{ type: "text", text: "..." }] }` or similar.
B15 handles multiple possible response shapes.

Credential: `ANTHROPIC_CREDENTIAL_ID` — executor must resolve this.
Check existing workflows for anthropicApi credential. If not found, use placeholder
and document in SUMMARY.md.

---

### B15 — Code: Parse AI Response & Merge

Mode: `runOnceForAllItems`

```javascript
// Access categorized data from the Code: Build Anthropic Prompt node
const promptData = $('Code: Build Anthropic Prompt').first().json;
const categorizedData = promptData.categorizedData;

// Try to extract text from Anthropic response
// Anthropic node can return content in multiple shapes
const aiResponseRaw =
  $input.first().json?.content?.[0]?.text ||
  $input.first().json?.completion ||
  $input.first().json?.text ||
  '';

let aiResults = [];
if (aiResponseRaw) {
  try {
    // Remove markdown code blocks if present
    const cleaned = aiResponseRaw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    aiResults = JSON.parse(cleaned);
    if (!Array.isArray(aiResults)) aiResults = [];
  } catch (e) {
    // JSON parse failed — fallback to empty (B15 will use fallback texts)
    aiResults = [];
  }
}

// Build lookup map by normalized URL
const aiMap = {};
aiResults.forEach(r => {
  const key = (r.linkedinUrl || '').toLowerCase().replace(/\/$/, '').trim();
  if (key) aiMap[key] = r;
});

function enrichWithAI(contacts) {
  return contacts.map(contact => {
    const key = (contact.linkedinUrl || '').toLowerCase().replace(/\/$/, '').trim();
    const ai = aiMap[key] || {};
    return {
      ...contact,
      zusammenfassung: ai.zusammenfassung || 'Keine KI-Analyse verfügbar',
      nachrichtenvorschlag: ai.nachrichtenvorschlag || 'Bitte manuell prüfen'
    };
  });
}

return [{
  json: {
    stern: enrichWithAI(categorizedData.stern),
    unbeantwortet: enrichWithAI(categorizedData.unbeantwortet),
    dreiTage: enrichWithAI(categorizedData.dreiTage),
    fuenfTage: enrichWithAI(categorizedData.fuenfTage)
  }
}];
```

---

### B16 — Code: Generate HTML Report

Mode: `runOnceForAllItems`

```javascript
const data = $input.first().json;
const heute = new Date().toLocaleDateString('de-DE', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

const gesamt = data.stern.length + data.unbeantwortet.length +
               data.dreiTage.length + data.fuenfTage.length;

function buildTable(contacts, farbe, emoji) {
  if (contacts.length === 0) {
    return `<p style="color:#999;font-style:italic;">Keine Kontakte in dieser Kategorie.</p>`;
  }
  return contacts.map(c => `
  <div style="border:1px solid ${farbe};border-radius:8px;padding:16px;margin-bottom:12px;background:#fff;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong style="font-size:15px;">
        <a href="${c.linkedinUrl}" style="color:#0077B5;text-decoration:none;">${c.name}</a>
      </strong>
      <span style="color:#666;font-size:12px;">${c.unternehmen || ''}${c.position ? ' · ' + c.position : ''}</span>
    </div>
    <div style="margin-top:8px;font-size:13px;color:#444;">
      <strong>Kontext:</strong> ${c.zusammenfassung}
    </div>
    <div style="margin-top:8px;background:#f8f9fa;border-left:3px solid ${farbe};padding:10px;border-radius:4px;font-size:13px;">
      <strong>Vorschlag:</strong> ${c.nachrichtenvorschlag}
    </div>
    <div style="margin-top:6px;font-size:11px;color:#999;">
      Nachrichten: ${c.anzahlNachrichten} · Erstkontakt: ${c.erstkontaktDatum} · Letzter Reply: ${c.letzterReplyDatum || 'nie'}
    </div>
  </div>`).join('');
}

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LinkedIn Follow-up Report ${heute}</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;background:#f4f4f4;">

<div style="background:#0077B5;color:white;padding:24px;border-radius:8px 8px 0 0;">
  <h1 style="margin:0;font-size:22px;">LinkedIn Follow-up Report</h1>
  <p style="margin:6px 0 0;opacity:0.9;">${heute}</p>
</div>

<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;">
  <div style="display:flex;gap:16px;flex-wrap:wrap;">
    <div style="background:#fff9c4;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#f59e0b;">${data.stern.length}</div>
      <div style="font-size:12px;color:#666;">Stern ⭐</div>
    </div>
    <div style="background:#fee2e2;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#ef4444;">${data.unbeantwortet.length}</div>
      <div style="font-size:12px;color:#666;">Unbeantwortet 🔴</div>
    </div>
    <div style="background:#dbeafe;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#3b82f6;">${data.dreiTage.length}</div>
      <div style="font-size:12px;color:#666;">3 Tage still 🔵</div>
    </div>
    <div style="background:#f3e8ff;padding:12px 20px;border-radius:6px;text-align:center;flex:1;">
      <div style="font-size:28px;font-weight:bold;color:#8b5cf6;">${data.fuenfTage.length}</div>
      <div style="font-size:12px;color:#666;">5 Tage still 🟣</div>
    </div>
  </div>
  <p style="text-align:center;color:#666;font-size:13px;margin-top:12px;">
    Gesamt: <strong>${gesamt} Kontakte</strong> heute priorisiert
  </p>
</div>

${data.stern.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#f59e0b;margin-top:0;border-bottom:2px solid #f59e0b;padding-bottom:8px;">
    ⭐ Stern-Kontakte (${data.stern.length})
  </h2>
  ${buildTable(data.stern, '#f59e0b', '⭐')}
</div>` : ''}

${data.unbeantwortet.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#ef4444;margin-top:0;border-bottom:2px solid #ef4444;padding-bottom:8px;">
    🔴 Unbeantwortet (${data.unbeantwortet.length})
  </h2>
  ${buildTable(data.unbeantwortet, '#ef4444', '🔴')}
</div>` : ''}

${data.dreiTage.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#3b82f6;margin-top:0;border-bottom:2px solid #3b82f6;padding-bottom:8px;">
    🔵 3 Tage still (${data.dreiTage.length})
  </h2>
  ${buildTable(data.dreiTage, '#3b82f6', '🔵')}
</div>` : ''}

${data.fuenfTage.length > 0 ? `
<div style="background:#fff;padding:20px;border-left:1px solid #ddd;border-right:1px solid #ddd;margin-top:2px;">
  <h2 style="color:#8b5cf6;margin-top:0;border-bottom:2px solid #8b5cf6;padding-bottom:8px;">
    🟣 5 Tage still (${data.fuenfTage.length})
  </h2>
  ${buildTable(data.fuenfTage, '#8b5cf6', '🟣')}
</div>` : ''}

<div style="background:#374151;color:white;padding:16px;border-radius:0 0 8px 8px;text-align:center;font-size:12px;margin-top:2px;">
  Generiert am ${heute} · LinkedIn Follow-up Automation
</div>

</body>
</html>`;

return [{ json: { html, gesamt, heute } }];
```

Output shape: `{ html: "<full HTML string>", gesamt: 12, heute: "Freitag, 13. März 2026" }`

---

### B17 — Code: Flatten Leads for Update

Mode: `runOnceForAllItems`

This node reads from `Code: Parse AI Response & Merge` (via cross-node reference) and
flattens all 4 category arrays into a single array. Each item carries all fields needed
for the Google Sheets Update (one item per lead row to update).

```javascript
// Read categorized + AI-enriched data
const data = $('Code: Parse AI Response & Merge').first().json;

const today = new Date().toLocaleDateString('de-DE');

const allLeads = [
  ...data.stern,
  ...data.unbeantwortet,
  ...data.dreiTage,
  ...data.fuenfTage
];

return allLeads.map(lead => ({
  json: {
    LinkedIn_URL: lead.linkedinUrl,
    Anzahl_Nachrichten: lead.anzahlNachrichten,
    Letzter_Reply_Datum: lead.letzterReplyDatum || '',
    Letzte_Kategorie: lead.kategorie,
    Letzter_Report: today,
    Zuletzt_gesehen: today
  }
}));
```

Output: array of items, one per lead, each with the 6 fields to update.
The Google Sheets Update node (B19) will process each item as a separate row update,
using `LinkedIn_URL` as the lookup key.

Note: B17 receives its input from `Code: Generate HTML Report` (which receives from
B15 -> B16 -> B17 in the parallel fan-out from B16). However, B17 uses a cross-node
reference to B15 (`$('Code: Parse AI Response & Merge').first().json`) to get the lead
data, not from `$input` which would only contain the HTML report output.

---

### B18 — Gmail: Send Report

```json
{
  "id": "b18-gmail-send",
  "name": "Gmail: Send Report",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [3100, 550],
  "credentials": {
    "gmailOAuth2": {
      "id": "GMAIL_CREDENTIAL_ID",
      "name": "Gmail account"
    }
  },
  "parameters": {
    "operation": "send",
    "sendTo": "={{ $env.REPORT_EMAIL }}",
    "subject": "={{ 'LinkedIn Report ' + new Date().toLocaleDateString('de-DE') + ' – ' + $('Code: Generate HTML Report').first().json.gesamt + ' Kontakte' }}",
    "emailType": "html",
    "message": "={{ $('Code: Generate HTML Report').first().json.html }}",
    "options": {}
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "onError": "continueRegularOutput"
}
```

Credential: Check existing workflows for `gmailOAuth2` credential ID.
The LinkedIn Outreach workflow (BaGtkUOzmbsC2pvF) likely has Gmail set up.
Executor must resolve `GMAIL_CREDENTIAL_ID` from n8n cloud or use placeholder.

---

### B19 — Google Sheets: Update Leads

```json
{
  "id": "b19-update-leads",
  "name": "Google Sheets: Update Leads",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [3350, 700],
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "parameters": {
    "operation": "update",
    "documentId": {
      "__rl": true,
      "value": "={{ $env.GOOGLE_SHEET_ID }}",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Leads",
      "mode": "name"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "LinkedIn_URL": "={{ $json.LinkedIn_URL }}",
        "Anzahl_Nachrichten": "={{ $json.Anzahl_Nachrichten }}",
        "Letzter_Reply_Datum": "={{ $json.Letzter_Reply_Datum }}",
        "Letzte_Kategorie": "={{ $json.Letzte_Kategorie }}",
        "Letzter_Report": "={{ $json.Letzter_Report }}",
        "Zuletzt_gesehen": "={{ $json.Zuletzt_gesehen }}"
      },
      "matchingColumns": ["LinkedIn_URL"]
    },
    "options": {
      "valueInputMode": "USER_ENTERED"
    }
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "onError": "continueRegularOutput"
}
```

The Google Sheets node with `operation: update` and `matchingColumns: ["LinkedIn_URL"]`
performs an `appendOrUpdate`-style lookup: it finds the row where column LinkedIn_URL
matches `$json.LinkedIn_URL` and updates the specified columns in that row.

The node processes each item from B17's output array separately (one HTTP call per row).
With n8n's default behavior, the node runs once per item, so all leads get updated.

---

### B20 — Google Sheets: Append Report-Log

```json
{
  "id": "b20-append-log",
  "name": "Google Sheets: Append Report-Log",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [3100, 400],
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "parameters": {
    "operation": "append",
    "documentId": {
      "__rl": true,
      "value": "={{ $env.GOOGLE_SHEET_ID }}",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Report-Log",
      "mode": "name"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "Datum": "={{ new Date().toLocaleDateString('de-DE') }}",
        "Anzahl_Unbeantwortet": "={{ $('Code: Parse AI Response & Merge').first().json.unbeantwortet.length }}",
        "Anzahl_Stern": "={{ $('Code: Parse AI Response & Merge').first().json.stern.length }}",
        "Anzahl_3_Tage": "={{ $('Code: Parse AI Response & Merge').first().json.dreiTage.length }}",
        "Anzahl_5_Tage": "={{ $('Code: Parse AI Response & Merge').first().json.fuenfTage.length }}",
        "Gesamt_Kontakte": "={{ $('Code: Generate HTML Report').first().json.gesamt }}",
        "Report_gesendet": "JA",
        "Fehler": ""
      }
    },
    "options": {
      "valueInputMode": "USER_ENTERED"
    }
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "onError": "continueRegularOutput"
}
```

The Report-Log tab must have these 8 header columns:
`Datum | Anzahl_Unbeantwortet | Anzahl_Stern | Anzahl_3_Tage | Anzahl_5_Tage | Gesamt_Kontakte | Report_gesendet | Fehler`

---

## Complete Connections Object (Merged — Branch A + Branch B)

The executor sends this full connections block to `n8n_update_full_workflow`.
Branch A connections are unchanged from Phase 1 except the Schedule Trigger entry.

```json
{
  "Schedule Trigger": {
    "main": [
      [
        { "node": "HTTP Request: Start Actor", "type": "main", "index": 0 },
        { "node": "Google Sheets: Read All Leads", "type": "main", "index": 0 }
      ]
    ]
  },
  "HTTP Request: Start Actor": {
    "main": [[ { "node": "Wait: Initial 20s", "type": "main", "index": 0 } ]]
  },
  "Wait: Initial 20s": {
    "main": [[ { "node": "Merge: Loop Entry", "type": "main", "index": 0 } ]]
  },
  "Merge: Loop Entry": {
    "main": [[ { "node": "HTTP Request: Check Actor Status", "type": "main", "index": 0 } ]]
  },
  "HTTP Request: Check Actor Status": {
    "main": [[ { "node": "IF: Actor Done?", "type": "main", "index": 0 } ]]
  },
  "IF: Actor Done?": {
    "main": [
      [ { "node": "HTTP Request: Get Dataset Items", "type": "main", "index": 0 } ],
      [ { "node": "IF: Max Attempts?", "type": "main", "index": 0 } ]
    ]
  },
  "IF: Max Attempts?": {
    "main": [
      [ { "node": "No Operation: Skip Branch A", "type": "main", "index": 0 } ],
      [ { "node": "Set: Increment Attempt Counter", "type": "main", "index": 0 } ]
    ]
  },
  "Set: Increment Attempt Counter": {
    "main": [[ { "node": "Wait: 15s Poll Interval", "type": "main", "index": 0 } ]]
  },
  "Wait: 15s Poll Interval": {
    "main": [[ { "node": "Merge: Loop Entry", "type": "main", "index": 1 } ]]
  },
  "HTTP Request: Get Dataset Items": {
    "main": [[ { "node": "Google Sheets: Read Leads", "type": "main", "index": 0 } ]]
  },
  "Google Sheets: Read Leads": {
    "main": [[ { "node": "Code: Compare URLs", "type": "main", "index": 0 } ]]
  },
  "Code: Compare URLs": {
    "main": [[ { "node": "IF: New Leads Found?", "type": "main", "index": 0 } ]]
  },
  "IF: New Leads Found?": {
    "main": [
      [ { "node": "Google Sheets: Append New Leads", "type": "main", "index": 0 } ],
      [ { "node": "No Operation: No New Leads", "type": "main", "index": 0 } ]
    ]
  },
  "Google Sheets: Read All Leads": {
    "main": [[ { "node": "HTTP Request: Start Inbox Actor", "type": "main", "index": 0 } ]]
  },
  "HTTP Request: Start Inbox Actor": {
    "main": [[ { "node": "Wait: Inbox Initial 20s", "type": "main", "index": 0 } ]]
  },
  "Wait: Inbox Initial 20s": {
    "main": [[ { "node": "Merge: Inbox Loop Entry", "type": "main", "index": 0 } ]]
  },
  "Merge: Inbox Loop Entry": {
    "main": [[ { "node": "HTTP Request: Check Inbox Status", "type": "main", "index": 0 } ]]
  },
  "HTTP Request: Check Inbox Status": {
    "main": [[ { "node": "IF: Inbox Actor Done?", "type": "main", "index": 0 } ]]
  },
  "IF: Inbox Actor Done?": {
    "main": [
      [ { "node": "HTTP Request: Get Inbox Dataset", "type": "main", "index": 0 } ],
      [ { "node": "IF: Inbox Max Attempts?", "type": "main", "index": 0 } ]
    ]
  },
  "IF: Inbox Max Attempts?": {
    "main": [
      [ { "node": "Set: Mark Inbox Failed", "type": "main", "index": 0 } ],
      [ { "node": "Set: Increment Inbox Counter", "type": "main", "index": 0 } ]
    ]
  },
  "Set: Mark Inbox Failed": {
    "main": [[ { "node": "HTTP Request: Get Inbox Dataset", "type": "main", "index": 0 } ]]
  },
  "Set: Increment Inbox Counter": {
    "main": [[ { "node": "Wait: Inbox 15s Poll", "type": "main", "index": 0 } ]]
  },
  "Wait: Inbox 15s Poll": {
    "main": [[ { "node": "Merge: Inbox Loop Entry", "type": "main", "index": 1 } ]]
  },
  "HTTP Request: Get Inbox Dataset": {
    "main": [[ { "node": "Code: Merge & Categorize", "type": "main", "index": 0 } ]]
  },
  "Code: Merge & Categorize": {
    "main": [[ { "node": "Code: Build Anthropic Prompt", "type": "main", "index": 0 } ]]
  },
  "Code: Build Anthropic Prompt": {
    "main": [[ { "node": "Anthropic: Hormozi Analysis", "type": "main", "index": 0 } ]]
  },
  "Anthropic: Hormozi Analysis": {
    "main": [[ { "node": "Code: Parse AI Response & Merge", "type": "main", "index": 0 } ]]
  },
  "Code: Parse AI Response & Merge": {
    "main": [[ { "node": "Code: Generate HTML Report", "type": "main", "index": 0 } ]]
  },
  "Code: Generate HTML Report": {
    "main": [
      [
        { "node": "Gmail: Send Report", "type": "main", "index": 0 },
        { "node": "Code: Flatten Leads for Update", "type": "main", "index": 0 },
        { "node": "Google Sheets: Append Report-Log", "type": "main", "index": 0 }
      ]
    ]
  },
  "Code: Flatten Leads for Update": {
    "main": [[ { "node": "Google Sheets: Update Leads", "type": "main", "index": 0 } ]]
  }
}
```

---

## Credential Resolution Tasks for Executor

| Node | Credential Type | Known ID | Action |
|---|---|---|---|
| Google Sheets: Read All Leads | googleSheetsOAuth2Api | `gw0DIdDENFkpE7ZW` | Use directly |
| Google Sheets: Update Leads | googleSheetsOAuth2Api | `gw0DIdDENFkpE7ZW` | Use directly |
| Google Sheets: Append Report-Log | googleSheetsOAuth2Api | `gw0DIdDENFkpE7ZW` | Use directly |
| Anthropic: Hormozi Analysis | anthropicApi | unknown | Check existing workflows; use `ANTHROPIC_CREDENTIAL_ID` if not found |
| Gmail: Send Report | gmailOAuth2 | unknown | Check LinkedIn Outreach workflow (BaGtkUOzmbsC2pvF) or other existing workflows; use `GMAIL_CREDENTIAL_ID` if not found |

---

## Data Flow Summary

```
Schedule Trigger
    |
    +——> [Branch A: existing 16 nodes, unchanged]
    |
    +——> Google Sheets: Read All Leads
             | [{Name, LinkedIn_URL, ...}] x N leads
         HTTP Request: Start Inbox Actor
             | {data: {id, defaultDatasetId, status: "RUNNING"}}
         Wait: Inbox Initial 20s
             |
         [POLLING LOOP — max 60 iterations × 15s = 15 min]
         Merge: Inbox Loop Entry
             |
         HTTP Request: Check Inbox Status
             | {data: {id, status, defaultDatasetId}}
         IF: Inbox Actor Done?
           true ————————————————————————————+
           false -> IF: Inbox Max Attempts? |
                      true -> Set: Mark Inbox Failed -> +
                      false -> Set: Increment Inbox Counter  |
                                -> Wait: Inbox 15s Poll      |
                                   -> [Merge input 1 ^]      |
                                                             |
         HTTP Request: Get Inbox Dataset <——————————————————-+
             | [{participantProfileUrl, messages:[...]}] or []
         Code: Merge & Categorize
             | {stern:[...], unbeantwortet:[...], dreiTage:[...], fuenfTage:[...]}
         Code: Build Anthropic Prompt
             | {systemPrompt, userPrompt, categorizedData, totalContacts}
         Anthropic: Hormozi Analysis
             | {content:[{type:"text", text:"[{linkedinUrl, zusammenfassung, nachrichtenvorschlag}]"}]}
         Code: Parse AI Response & Merge
             | {stern:[+zusammenfassung+nachrichtenvorschlag], unbeantwortet, dreiTage, fuenfTage}
         Code: Generate HTML Report
             | {html:"<!DOCTYPE html>...", gesamt:12, heute:"..."}
             |
             +—————+——————————+
             |     |          |
         Gmail   Code:     Google Sheets:
         Send    Flatten   Append Report-Log
         Report  Leads
                   |
               Google Sheets:
               Update Leads
```

---

## Implementation Notes

### Polling Loop Architecture Detail

The `Merge: Inbox Loop Entry` node uses `mode: chooseBranch, output: input1`.

On first run: input 0 receives data from `Wait: Inbox Initial 20s` (which carries the
actor start response: `{data: {id, defaultDatasetId, status}}`). Input 1 has no data
yet. The Merge node selects input 1 but since it is empty, it falls back to input 0.

On subsequent runs: input 1 receives data from `Wait: Inbox 15s Poll` (which carries
the incremented counter data from `Set: Increment Inbox Counter`). The Merge node
selects input 1.

This is the same architecture used in Branch A (validated working).

### Failed Inbox Path

When `Set: Mark Inbox Failed` routes to `HTTP Request: Get Inbox Dataset`:
- The node URL references `$json.data.defaultDatasetId` which will be defined
  (it came from the original actor start response, carried through the polling
  items via `Set` passthrough of `data`)
- If the actor truly failed, the dataset will exist but be empty (0 items)
- `onError: "continueRegularOutput"` on B11 catches URL/network errors
- B12 handles the empty array case by setting `messageHistory: 'Kein Gesprächsverlauf verfügbar'` for all leads

### Google Sheets Update Strategy

The `appendOrUpdate` approach via `matchingColumns: ["LinkedIn_URL"]` is the cleanest
pattern. The Google Sheets node (typeVersion 4.7) with `operation: update` and
`matchingColumns` specified performs a lookup and updates matching rows. The B17 flatten
node produces one item per lead, and n8n runs B19 once per item automatically.

### Anthropic Node Response Format

The `@n8n/n8n-nodes-langchain.anthropic` node (typeVersion 1.7) typically returns:
```json
{
  "content": [{"type": "text", "text": "[{...}]"}],
  "model": "claude-sonnet-4-5",
  "usage": {...}
}
```

B15 accesses `$input.first().json?.content?.[0]?.text` as primary, with fallbacks for
`completion` and `text` properties covering older API versions.

### Workflow Name Update

The workflow name should be updated to reflect both branches:
`WF1 — LinkedIn Follow-up Automation (Branch A + B)`

---

## Validation Checklist

- [ ] All 20 Branch B nodes present in merged nodes array (16 Branch A + 20 Branch B = 36 total)
- [ ] All node IDs unique across full workflow
- [ ] All node names unique across full workflow
- [ ] Schedule Trigger connection updated to include both Branch A and Branch B start nodes
- [ ] Merge: Inbox Loop Entry receives input 0 from Wait: Inbox Initial 20s and input 1 from Wait: Inbox 15s Poll
- [ ] Set: Mark Inbox Failed connects to HTTP Request: Get Inbox Dataset (same node as SUCCEEDED path)
- [ ] Code: Generate HTML Report connects to 3 targets (Gmail, Code: Flatten, Google Sheets: Append Log)
- [ ] All expressions use `={{ }}` syntax (not `{{ }}`)
- [ ] Code nodes use `$input.first().json` or `$input.all()` (not `$json` directly)
- [ ] Cross-node references use `$('NodeName').first().json` or `.all()`
- [ ] No Switch nodes used (only IF nodes with typeVersion 2.2)
- [ ] IF nodes all have `version: 2` inside `conditions.options`
- [ ] Merge node typeVersion 3.1 with `mode: chooseBranch, output: input1`
- [ ] Google Sheets nodes typeVersion 4.7
- [ ] Gmail node typeVersion 2.1
- [ ] HTTP Request nodes typeVersion 4.4
- [ ] Anthropic node typeVersion 1.7
- [ ] Code nodes typeVersion 2
- [ ] `onError: "continueRegularOutput"` on Anthropic node (AI-05 fallback)
- [ ] `onError: "continueRegularOutput"` on all HTTP Request nodes that must not block
- [ ] retryOnFail on Gmail and Google Sheets output nodes (3x / 5000ms)
- [ ] No deprecated `continueOnFail: true` anywhere
- [ ] No `$node['Name'].json` references anywhere
- [ ] Anthropic credential ID resolved (or documented as placeholder)
- [ ] Gmail credential ID resolved (or documented as placeholder)
- [ ] Google Sheets credential ID `gw0DIdDENFkpE7ZW` used for all 3 GSheets nodes
- [ ] Node positions: all non-overlapping, 250px horizontal spacing, 150px vertical
- [ ] Workflow settings: `executionOrder: "v1"`, `timezone: "Europe/Berlin"` preserved
- [ ] validate_workflow passes (or all warnings resolved against FALSE_POSITIVES)
- [ ] Deployed via n8n_update_full_workflow to ID `j6O5Ktxcp0n6o9du`
- [ ] Local JSON file updated at `WF1-LinkedIn-Followup-Master.json`

---

## Environment Variables Required (Pre-Activation)

These must be set in n8n Settings before the workflow is activated:

| Variable | Value |
|---|---|
| `APIFY_API_TOKEN` | `apify_api_REDACTED_SEE_MEMORY_MD` |
| `LINKEDIN_COOKIE` | LinkedIn `li_at` session cookie |
| `GOOGLE_SHEET_ID` | Google Sheet ID for "LinkedIn Leads" |
| `REPORT_EMAIL` | Email address to receive the daily report |

The `Report-Log` tab must be created in the Google Sheet with header row:
`Datum | Anzahl_Unbeantwortet | Anzahl_Stern | Anzahl_3_Tage | Anzahl_5_Tage | Gesamt_Kontakte | Report_gesendet | Fehler`

---
*Plan written: 2026-03-13 — Phase 2, Plan 2-1*
