---
phase: 5
plan: 1
workflows: [WF7]
type: n8n-workflow
---

# Plan 5-1: Inbox & Calendar Manager (WF7)

## Objective

Deploy WF7 as a single new workflow with two independent Cron triggers. Path A (runs every 15 minutes) monitors the Gmail inbox, identifies replies from known leads, detects appointment requests, creates Google Calendar events, and generates Gmail reply drafts for manual review. Path B (runs daily at 07:00) loads tomorrow's appointments from the Termine tab and generates SPIN-based conversation preparation text saved to the agenda column.

WF7 does NOT replace an existing stub — it must be created via `n8n_create_workflow` (POST).

---

## Pre-Execution Checklist (Executor Must Verify)

### Google Calendar Credential
- In the n8n UI at meinoffice.app.n8n.cloud, go to Credentials and find the Google OAuth2 credential that has calendar + calendar.events scopes.
- The credential type used in the node is `googleCalendarOAuth2Api`.
- The existing `gw0DIdDENFkpE7ZW` credential is for Google Sheets (type: `googleSheetsOAuth2Api`) — do NOT use this for Calendar.
- Expected: A separate OAuth2 credential exists (same Google app, different credential entry in n8n) with calendar scopes. Verify its ID before building nodes.
- If only one Google OAuth2 credential exists with all scopes combined, check if n8n allows reusing it — typically n8n creates separate credential entries per service type even when same Google app.
- Action: Run `n8n_list_credentials` or check UI, find the credential with type `googleCalendarOAuth2Api`, note its ID.

### Gmail Credential Scopes
- ID: `yv1FhLRO54A8dyzi` (name: "Gmail account") — already used in WF4.
- Required scopes for WF7: `gmail.modify` (mark as read), `gmail.compose` (create draft), plus read access.
- Per STATE.md: scopes gmail.modify + gmail.compose are already listed as present. Confirmed usable.
- The `getAll` (list messages), `get` (get message), `createDraft`, and label modification operations all fall within these scopes.

### freebusy Query — Native Calendar Node vs HTTP Request
The native Google Calendar node (`nodes-base.googleCalendar`) only exposes two operations in the docs:
- `availability` — checks a single time slot (timeMin, timeMax) for a given calendar
- Create event — creates an event with parameters

The Google Calendar API's `/freebusy` endpoint (calendar.freebusy.query) checks multiple time ranges across multiple calendars in one call. The native n8n node's `availability` operation is a simplified wrapper — it returns whether the calendar is busy in a given window, but does NOT return the specific busy blocks needed to find free slots.

Decision: Use HTTP Request node with the `googleCalendarOAuth2Api` credential for the freebusy query. This is explicitly documented as acceptable when the native node does not expose the required operation. The native Calendar node IS used for `create` event.

The native `availability` operation returns a boolean `isAvailable`. For slot-finding we need the raw busy array — HTTP Request is the correct choice.

---

## WF7 Architecture

### Overview

One workflow, two independent execution paths starting from separate Cron trigger nodes. n8n supports multiple trigger nodes in one workflow — each trigger node's execution path is independent.

**Path A: Inbox Monitor (every 15 minutes)**
```
Cron: Every 15 Min (TRIG-A)
  → Gmail: Get Unread Messages (getAll, filter unread, max 20)
  → Code: Filter Known Leads (match sender emails against Leads data loaded inline)
  → SplitInBatches: Process each known-lead message
      → Google Sheets: Get Lead Row by Email (lookup)
      → Gmail: Get Thread Messages (getAll by threadId)
      → Code: Build Thread Context (sort chronologically, extract bodies)
      → Code: Check Duplicate Draft (check Sequenz_Log via sheets — separate read)
      → IF: Is Duplicate?
          → [True] Set: Skip — Already Processed (terminal)
          → [False] Set: Store Lead + Thread Context (passthrough, include:all)
              → LLM: Terminwunsch Erkennung + Anthropic A
              → Code: Parse Terminwunsch JSON
              → IF: Terminwunsch erkannt?
                  → [True] HTTP Request: Freebusy Query (5 workdays, 09:00-17:00)
                      → Code: Find Available Slots
                      → Google Calendar: Create Event (with attendee, reminders)
                      → Google Sheets: Append Termine Row (all 15 fields)
                      → Execute WF6: Update lead (termin_vereinbart=TRUE)
                      → Set: Store Termin Context (passthrough, for draft)
                  → [False — no termin] pass through
              → Merge: Termin + No-Termin paths (waitForAll mode)
              → LLM: Draft Generation + Anthropic B
              → Code: Build Draft + WF6 Payload
              → Gmail: Create Draft
              → Execute WF6: Update lead (antwort_erhalten=TRUE, draft_erstellt=TRUE, messageId log)
              → Gmail: Mark as Read (add SEEN label / remove UNREAD)
  → [After all batches done] Set: Path A Complete
```

**Path B: Termin-Vorbereitung (daily 07:00)**
```
Cron: Daily 07:00 (TRIG-B)
  → Google Sheets: Get All Termine (getAll from Termine tab)
  → Code: Filter Termine Tomorrow (date = tomorrow, vorbereitung_erstellt != TRUE)
  → SplitInBatches: Process each termin
      → Google Sheets: Get Lead Data for Termin (lookup by lead_id in Leads tab)
      → Set: Store Termin Context (passthrough, include:all)
      → LLM: Gesprächsvorbereitung + Anthropic C
      → Code: Build Agenda Payload
      → Google Sheets: Update Termine Row (agenda column + vorbereitung_erstellt=TRUE)
  → [After all batches done] Set: Path B Complete
```

### Critical Design Decisions

1. **Lead email lookup in Path A**: Getting all leads upfront (one Sheets read) then filtering in code is more efficient than a per-message lookup. However, with potentially 20 unread messages and hundreds of leads, we do an upfront Google Sheets `getAll` for the Leads tab immediately after getting unread messages.

2. **Duplicate check**: We check Sequenz_Log (Google Sheets getAll on Sequenz_Log tab, filter by aktion = 'draft_erstellt' and inhalt containing the messageId). This avoids a separate HTTP call.

3. **Thread context**: Gmail `getAll` with filter `threadId:XXXX` returns all messages in a thread. We process these in Code to extract text bodies sorted chronologically.

4. **Merge node after IF: Terminwunsch**: Path A needs to generate a draft regardless of whether a Termin was found. The Merge node (mode: passThrough, output 0) accepts both true and false branches. The draft prompt receives context including whether a termin was created.

5. **Gmail Mark as Read**: The Gmail node operation `markAsRead` uses `addLabels`/`removeLabels` — or the dedicated operation if available. In n8n Gmail node v2.1, use `operation: "markAsRead"` if exposed, otherwise use `operation: "modify"` with `removeLabels: ["UNREAD"]`.

6. **SplitInBatches for Path A**: batchSize 1, so each email is processed sequentially. This ensures Gmail API rate limits are respected and each email's context is clean.

7. **Termin row in Termine tab**: We use `appendOrUpdate` with `operation: "appendOrUpdate"` if the row already exists, or `append` for new rows. Since Termine are new for detected appointments, we use `append`.

---

## Node Specifications — Path A (Inbox Monitor)

### Node 1: Cron: Every 15 Min
```json
{
  "id": "wf7-cron-inbox",
  "name": "Cron: Every 15 Min",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "position": [100, 300],
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "minutes",
          "minutesInterval": 15
        }
      ]
    }
  }
}
```

### Node 2: Gmail: Get Unread Messages
Fetches up to 20 unread messages from inbox. Uses `getAll` operation with search filter.

```json
{
  "id": "wf7-gmail-get-unread",
  "name": "Gmail: Get Unread Messages",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [350, 300],
  "parameters": {
    "operation": "getAll",
    "filters": {
      "q": "is:unread in:inbox"
    },
    "returnAll": false,
    "limit": 20,
    "options": {
      "format": "full"
    }
  },
  "credentials": {
    "gmailOAuth2": {
      "id": "yv1FhLRO54A8dyzi",
      "name": "Gmail account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note on Gmail getAll response: Each item contains `id` (messageId), `threadId`, `payload.headers` (array with From, Subject, Date), `snippet`, and depending on format may contain `payload.parts` for body. The `From` header contains the sender email.

### Node 3: Google Sheets: Get All Leads (for email matching)
Load full Leads tab to match sender emails. This is a one-time read per 15-min cycle.

```json
{
  "id": "wf7-sheets-get-leads",
  "name": "Google Sheets: Get All Leads",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [600, 300],
  "parameters": {
    "operation": "read",
    "documentId": {
      "mode": "id",
      "value": "SALES_AGENT_SHEET_ID"
    },
    "sheetName": {
      "mode": "name",
      "value": "Leads"
    },
    "filtersUI": {},
    "options": {}
  },
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note: This node will output one item per lead row. The Code node that follows aggregates the unread messages + all lead data together.

**Architecture note on data merging**: After Gmail: Get Unread Messages and Google Sheets: Get All Leads run sequentially (the Gmail node outputs to the Sheets node for sequencing, then the Sheets node passes to Code), the Code node will access Gmail data via `$('Gmail: Get Unread Messages').all()` and Sheets data via `$input.all()`.

Revised connection: Gmail: Get Unread Messages → Google Sheets: Get All Leads (the sheets node receives Gmail output as input to trigger execution, then Code reads both) — actually, since these are independent data sources, we use a Merge node approach.

**Revised Path A Architecture (corrected for data flow)**:

```
Cron: Every 15 Min
  → Gmail: Get Unread Messages
  → [Also] → Merge A (input 0)

  Code: Get Leads Context (reads sheets inline? No — separate branch)
```

Actually, the cleaner pattern used throughout this project is:

```
Cron → Gmail: Get Unread Messages → Google Sheets: Get All Leads → Code: Filter Known Leads
```

The Code node receives Sheets rows as `$input.all()` (all leads) and reads Gmail messages via `$('Gmail: Get Unread Messages').all()`. This is the established cross-node reference pattern from WF3/WF5.

### Node 3 (revised): Google Sheets: Get All Leads
Connected after Gmail node to form a sequential chain. The Sheets node receives the Gmail output but ignores it (passthrough trigger). Code then reads both.

Position: [600, 300]

### Node 4: Code: Filter Known Leads
Receives all Leads rows as input (`$input.all()`), reads Gmail messages via cross-node reference. Outputs one item per unread message from a known lead.

```javascript
// Mode: runOnceForAllItems
const allLeads = $input.all().map(item => item.json);
const gmailMessages = $('Gmail: Get Unread Messages').all().map(item => item.json);

// Build email -> lead lookup map
const emailToLead = {};
for (const lead of allLeads) {
  if (lead.email) {
    emailToLead[lead.email.toLowerCase().trim()] = lead;
  }
}

const results = [];

for (const msg of gmailMessages) {
  // Extract sender from headers
  const headers = msg.payload?.headers || [];
  const fromHeader = headers.find(h => h.name === 'From' || h.name === 'from');
  const fromValue = fromHeader?.value || '';

  // Extract email from "Name <email@domain.com>" or "email@domain.com"
  const emailMatch = fromValue.match(/<([^>]+)>/) || fromValue.match(/([^\s]+@[^\s]+)/);
  const senderEmail = emailMatch ? emailMatch[1].toLowerCase().trim() : '';

  if (!senderEmail || !emailToLead[senderEmail]) {
    // Unknown sender — ignore
    continue;
  }

  const lead = emailToLead[senderEmail];
  const subjectHeader = headers.find(h => h.name === 'Subject' || h.name === 'subject');
  const dateHeader = headers.find(h => h.name === 'Date' || h.name === 'date');

  results.push({
    json: {
      message_id: msg.id,
      thread_id: msg.threadId,
      sender_email: senderEmail,
      subject: subjectHeader?.value || '',
      date: dateHeader?.value || '',
      snippet: msg.snippet || '',
      lead_id: lead.lead_id,
      lead_vorname: lead.vorname,
      lead_nachname: lead.nachname,
      lead_email: lead.email,
      lead_unternehmen: lead.unternehmen,
      lead_position: lead.position,
      lead_branche: lead.branche,
      lead_hauptschmerz: lead.hauptschmerz || '',
      lead_status: lead.status,
      lead_antwort_erhalten: lead.antwort_erhalten,
      lead_draft_erstellt: lead.draft_erstellt,
      lead_termin_vereinbart: lead.termin_vereinbart,
      lead_score: lead.score || 0,
      lead_score_klassifikation: lead.score_klassifikation || ''
    }
  });
}

return results;
```

**Node config**:
```json
{
  "id": "wf7-code-filter-leads",
  "name": "Code: Filter Known Leads",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [850, 300],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 5: IF: Any Known Leads?
Check if we have any items to process. If no known leads replied, stop cleanly.

```json
{
  "id": "wf7-if-any-leads",
  "name": "IF: Known Lead Emails Found?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1100, 300],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "loose",
        "version": 2
      },
      "conditions": [
        {
          "id": "has-leads-check",
          "leftValue": "={{ $input.all().length }}",
          "rightValue": 0,
          "operator": {
            "type": "number",
            "operation": "gt"
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

True output (index 0) → SplitInBatches
False output (index 1) → Set: No Known Leads (terminal)

### Node 6: Set: No Known Leads Found (terminal for empty case)
```json
{
  "id": "wf7-set-no-leads",
  "name": "Set: No Known Leads Found",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1350, 450],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "status",
          "value": "no_known_leads"
        }
      ]
    },
    "options": {}
  }
}
```

### Node 7: SplitInBatches: Per Email
Process each known-lead email one at a time.

```json
{
  "id": "wf7-split-emails",
  "name": "SplitInBatches: Per Email",
  "type": "n8n-nodes-base.splitInBatches",
  "typeVersion": 3,
  "position": [1350, 300],
  "parameters": {
    "batchSize": 1,
    "options": {}
  }
}
```

Connections: Output 0 (done) → Set: Path A Complete. Output 1 (loop) → Google Sheets: Get Sequenz Log.

### Node 8: Google Sheets: Get Sequenz Log (for duplicate check)
Load Sequenz_Log to check if a draft was already created for this messageId.

```json
{
  "id": "wf7-sheets-get-log",
  "name": "Google Sheets: Get Sequenz Log",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [1600, 300],
  "parameters": {
    "operation": "read",
    "documentId": {
      "mode": "id",
      "value": "SALES_AGENT_SHEET_ID"
    },
    "sheetName": {
      "mode": "name",
      "value": "Sequenz_Log"
    },
    "filtersUI": {},
    "options": {}
  },
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

### Node 9: Code: Check Duplicate Draft
Checks whether a 'draft_erstellt' log entry already contains this messageId.

```javascript
// Mode: runOnceForAllItems
const currentItem = $('SplitInBatches: Per Email').first().json;
const messageId = currentItem.message_id;

const logEntries = $input.all().map(item => item.json);

const isDuplicate = logEntries.some(entry => {
  return entry.aktion === 'draft_erstellt' &&
         typeof entry.inhalt === 'string' &&
         entry.inhalt.includes(messageId);
});

return [{
  json: {
    ...currentItem,
    is_duplicate: isDuplicate,
    message_id: messageId
  }
}];
```

```json
{
  "id": "wf7-code-check-duplicate",
  "name": "Code: Check Duplicate Draft",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1850, 300],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 10: IF: Is Duplicate?
```json
{
  "id": "wf7-if-duplicate",
  "name": "IF: Already Processed?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [2100, 300],
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
          "id": "duplicate-check",
          "leftValue": "={{ $json.is_duplicate }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "true",
            "singleValue": true
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

True (index 0) → Set: Skip Already Processed (then loop back to SplitInBatches)
False (index 1) → Gmail: Get Thread Messages

### Node 11: Set: Skip Already Processed
```json
{
  "id": "wf7-set-skip",
  "name": "Set: Skip Already Processed",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [2350, 150],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "skipped",
          "value": true
        },
        {
          "name": "reason",
          "value": "duplicate_draft"
        }
      ]
    },
    "options": {}
  }
}
```

Note: After Set: Skip, we need to loop back to the SplitInBatches node to process the next email. Connect Set: Skip → SplitInBatches output (this is the standard loop-back pattern — connect Set: Skip back to the SplitInBatches node input).

Actually, in n8n's SplitInBatches pattern, the loop-back connection is: the processing terminal nodes connect BACK to the SplitInBatches node via `main[0]` input. The SplitInBatches node's output 1 goes to processing, and all terminal processing nodes loop back to SplitInBatches input. This is how n8n SplitInBatches works.

Connection: Set: Skip → SplitInBatches: Per Email (input 0)

### Node 12: Gmail: Get Thread Messages
Fetches all messages in the thread to build conversation context.

```json
{
  "id": "wf7-gmail-get-thread",
  "name": "Gmail: Get Thread Messages",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [2350, 350],
  "parameters": {
    "operation": "getAll",
    "filters": {
      "q": "={{ 'threadId:' + $json.thread_id }}"
    },
    "returnAll": true,
    "options": {
      "format": "full"
    }
  },
  "credentials": {
    "gmailOAuth2": {
      "id": "yv1FhLRO54A8dyzi",
      "name": "Gmail account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note: The Gmail `getAll` operation with `q: "threadId:XXXX"` filters messages to only those in the thread.

### Node 13: Code: Build Thread Context
Sorts messages chronologically, extracts text bodies, builds a formatted thread string.

```javascript
// Mode: runOnceForAllItems
const threadMessages = $input.all().map(item => item.json);
const triggerData = $('Code: Check Duplicate Draft').first().json;

// Sort by internalDate (milliseconds since epoch as string)
const sorted = [...threadMessages].sort((a, b) => {
  return parseInt(a.internalDate || '0') - parseInt(b.internalDate || '0');
});

// Extract text body from a Gmail message payload
function extractBody(payload) {
  if (!payload) return '';

  // Direct body
  if (payload.body && payload.body.data) {
    try {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } catch(e) { return ''; }
  }

  // Parts
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        try {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        } catch(e) { return ''; }
      }
    }
    // Try nested parts
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return payload.snippet || '';
}

const threadContext = sorted.map(msg => {
  const headers = msg.payload?.headers || [];
  const fromHeader = headers.find(h => h.name === 'From' || h.name === 'from');
  const dateHeader = headers.find(h => h.name === 'Date' || h.name === 'date');
  const body = extractBody(msg.payload);

  // Clean body (remove excessive whitespace, limit length)
  const cleanBody = body
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 1000);

  return `[${dateHeader?.value || 'unbekannt'}] Von: ${fromHeader?.value || 'unbekannt'}\n${cleanBody}`;
}).join('\n\n---\n\n');

return [{
  json: {
    ...triggerData,
    thread_context: threadContext,
    thread_message_count: sorted.length
  }
}];
```

```json
{
  "id": "wf7-code-thread-context",
  "name": "Code: Build Thread Context",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [2600, 350],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 14: Set: Store Message Context (passthrough)
Preserve all data across subsequent LLM calls using the established pattern.

```json
{
  "id": "wf7-set-msg-context",
  "name": "Set: Store Message Context",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [2850, 350],
  "parameters": {
    "fields": {
      "values": []
    },
    "options": {},
    "include": "all"
  }
}
```

### Node 15: LLM: Terminwunsch Erkennung
Detects if the email contains an appointment request. Returns JSON.

```json
{
  "id": "wf7-llm-termin-check",
  "name": "LLM: Terminwunsch Erkennung",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [3100, 350],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Analysiere diesen E-Mail-Thread und erkenne ob ein Terminwunsch vorliegt.\\n\\nLead: ' + $json.lead_vorname + ' ' + $json.lead_nachname + ' (' + $json.lead_unternehmen + ')\\n\\nE-Mail-Thread (chronologisch):\\n' + $json.thread_context + '\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown:\\n{\\\"terminwunsch_erkannt\\\": true/false, \\\"konfidenz\\\": 0.0-1.0, \\\"vorgeschlagene_zeiten\\\": [\\\"Zeitangabe 1\\\", \\\"Zeitangabe 2\\\"], \\\"terminnotiz\\\": \\\"kurze Zusammenfassung des Terminwunschs oder leer\\\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein Assistent der B2B-Sales-E-Mails analysiert. Deine Aufgabe ist es, Terminwuensche in E-Mail-Threads zu erkennen.\n\nEin Terminwunsch liegt vor wenn:\n- Die Person explizit einen Termin, ein Meeting, ein Gespraech oder einen Call vorschlaegt\n- Die Person nach Verfuegbarkeit fragt\n- Die Person eine konkrete Zeit/Datum nennt fuer ein Treffen\n- Die Person auf einen Terminvorschlag aus der Sequenz reagiert\n\nKein Terminwunsch:\n- Allgemeine Fragen zum Angebot ohne Terminvorschlag\n- Absagen ohne Terminvorschlag\n- Reine Informationsanfragen\n\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks."
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

### Node 16: Anthropic Chat Model A (for Terminwunsch LLM)
```json
{
  "id": "wf7-anthropic-a",
  "name": "Anthropic Chat Model A",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [3100, 550],
  "parameters": {
    "model": {
      "mode": "id",
      "value": "claude-sonnet-4-20250514"
    },
    "options": {
      "maxTokensToSample": 1000,
      "temperature": 0.1
    }
  },
  "credentials": {
    "anthropicApi": {
      "id": "5LmibcuA2kdHKaqB",
      "name": "Claude - 20260127"
    }
  }
}
```

Note: Temperature 0.1 for detection tasks (factual, low creativity needed).

### Node 17: Code: Parse Terminwunsch JSON
```javascript
// Mode: runOnceForAllItems
const llmOutput = $input.first().json;
const storeData = $('Set: Store Message Context').first().json;

const rawText = llmOutput.text || '';
const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

let parsed = {
  terminwunsch_erkannt: false,
  konfidenz: 0,
  vorgeschlagene_zeiten: [],
  terminnotiz: ''
};

try {
  parsed = JSON.parse(cleaned);
} catch(e) {
  // Keep defaults
}

return [{
  json: {
    ...storeData,
    terminwunsch_erkannt: parsed.terminwunsch_erkannt === true,
    termin_konfidenz: parsed.konfidenz || 0,
    vorgeschlagene_zeiten: parsed.vorgeschlagene_zeiten || [],
    terminnotiz: parsed.terminnotiz || ''
  }
}];
```

```json
{
  "id": "wf7-code-parse-termin",
  "name": "Code: Parse Terminwunsch JSON",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [3350, 350],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 18: IF: Terminwunsch erkannt?
```json
{
  "id": "wf7-if-terminwunsch",
  "name": "IF: Terminwunsch erkannt?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [3600, 350],
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
          "id": "termin-check",
          "leftValue": "={{ $json.terminwunsch_erkannt }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "true",
            "singleValue": true
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

True (index 0) → HTTP Request: Freebusy Query
False (index 1) → Set: No Termin (passthrough to Merge)

### Node 19: Set: No Termin Found (passthrough)
```json
{
  "id": "wf7-set-no-termin",
  "name": "Set: No Termin Found",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [3850, 550],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "termin_erstellt",
          "value": false
        },
        {
          "name": "calendar_event_id",
          "value": ""
        },
        {
          "name": "termin_datum",
          "value": ""
        },
        {
          "name": "termin_uhrzeit",
          "value": ""
        }
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

### Node 20: HTTP Request: Freebusy Query
Uses Google Calendar API freebusy.query endpoint. Checks next 5 workdays 09:00–17:00.

The credential for this HTTP Request must use the Google Calendar OAuth2 credential (type: `googleCalendarOAuth2Api`). The credential ID needs to be verified before execution (see Pre-Execution Checklist).

```json
{
  "id": "wf7-http-freebusy",
  "name": "HTTP Request: Freebusy Query",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [3850, 300],
  "parameters": {
    "method": "POST",
    "url": "https://www.googleapis.com/calendar/v3/freeBusy",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "googleCalendarOAuth2Api",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ (function() {\n  const now = $now;\n  // Find next 5 workdays (Mon-Fri)\n  const workdays = [];\n  let day = now.plus({ days: 1 });\n  while (workdays.length < 5) {\n    const weekday = day.weekday; // 1=Mon, 7=Sun\n    if (weekday >= 1 && weekday <= 5) {\n      workdays.push(day.toFormat('yyyy-MM-dd'));\n    }\n    day = day.plus({ days: 1 });\n  }\n  const timeMin = workdays[0] + 'T09:00:00+01:00';\n  const timeMax = workdays[workdays.length - 1] + 'T17:00:00+01:00';\n  return JSON.stringify({\n    timeMin: timeMin,\n    timeMax: timeMax,\n    items: [{ id: 'primary' }]\n  });\n})() }}",
    "options": {}
  },
  "credentials": {
    "googleCalendarOAuth2Api": {
      "id": "GOOGLE_CALENDAR_CREDENTIAL_ID",
      "name": "Google Calendar account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note on jsonBody expression: The expression inside `={{ }}` uses an IIFE (immediately invoked function expression) to build the JSON string. This is the only way to use complex JavaScript logic within a single expression field. The executor should verify this pattern works in n8n 4.4 — if not, use a Code node before the HTTP Request to build the body, then reference it via `$json.freebusy_body`.

**Alternative (safer) approach**: Add a `Code: Build Freebusy Body` node before the HTTP Request that computes and outputs the body as a JSON field, then reference it as `={{ $json.freebusy_body }}` in the HTTP Request body.

### Node 20b (alternative): Code: Build Freebusy Body
If the IIFE expression approach fails, insert this Code node before the HTTP Request:

```javascript
// Mode: runOnceForAllItems
const inputData = $input.first().json;

// Luxon DateTime is available as $now equivalent in Code via DateTime
const now = DateTime.now().setZone('Europe/Berlin');

const workdays = [];
let day = now.plus({ days: 1 });
while (workdays.length < 5) {
  const weekday = day.weekday; // Luxon: 1=Mon, 7=Sun
  if (weekday >= 1 && weekday <= 5) {
    workdays.push(day.toFormat('yyyy-MM-dd'));
  }
  day = day.plus({ days: 1 });
}

const timeMin = workdays[0] + 'T09:00:00+01:00';
const timeMax = workdays[workdays.length - 1] + 'T17:00:00+01:00';

const freebusyBody = {
  timeMin: timeMin,
  timeMax: timeMax,
  items: [{ id: 'primary' }]
};

return [{
  json: {
    ...inputData,
    freebusy_body: freebusyBody,
    freebusy_workdays: workdays,
    freebusy_time_min: timeMin,
    freebusy_time_max: timeMax
  }
}];
```

### Node 21: Code: Find Available Slots
Processes freebusy response to find open 1-hour slots in the 09:00-17:00 window.

```javascript
// Mode: runOnceForAllItems
const inputData = $input.first().json;
// freebusy response is in inputData (merged from HTTP Request output)
// The HTTP Request response is in $json for this node,
// but we need the message context from before
const prevData = $('IF: Terminwunsch erkannt?').first().json;

// Parse freebusy response
const freebusyResponse = inputData;
const busyPeriods = freebusyResponse.calendars?.primary?.busy || [];

// Get workdays list (from Code: Build Freebusy Body if used, or compute again)
const now = DateTime.now().setZone('Europe/Berlin');
const workdays = [];
let checkDay = now.plus({ days: 1 });
while (workdays.length < 5) {
  if (checkDay.weekday >= 1 && checkDay.weekday <= 5) {
    workdays.push(checkDay.toFormat('yyyy-MM-dd'));
  }
  checkDay = checkDay.plus({ days: 1 });
}

// Find available 1-hour slots
const availableSlots = [];
for (const dateStr of workdays) {
  for (let hour = 9; hour <= 16; hour++) {
    const slotStart = DateTime.fromISO(dateStr + 'T' + String(hour).padStart(2, '0') + ':00:00', { zone: 'Europe/Berlin' });
    const slotEnd = slotStart.plus({ hours: 1 });

    const isBusy = busyPeriods.some(period => {
      const busyStart = DateTime.fromISO(period.start);
      const busyEnd = DateTime.fromISO(period.end);
      // Check overlap
      return slotStart < busyEnd && slotEnd > busyStart;
    });

    if (!isBusy) {
      availableSlots.push({
        start: slotStart.toISO(),
        end: slotEnd.toISO(),
        display: slotStart.toFormat('EEEE, dd.MM.yyyy HH:mm') + ' Uhr'
      });
    }

    if (availableSlots.length >= 3) break;
  }
  if (availableSlots.length >= 3) break;
}

// Use first available slot for the calendar event
const chosenSlot = availableSlots[0] || null;

return [{
  json: {
    ...prevData,
    available_slots: availableSlots,
    chosen_slot_start: chosenSlot?.start || '',
    chosen_slot_end: chosenSlot?.end || '',
    chosen_slot_display: chosenSlot?.display || '',
    termin_available: chosenSlot !== null
  }
}];
```

```json
{
  "id": "wf7-code-find-slots",
  "name": "Code: Find Available Slots",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [4100, 300],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

Note: The Code node in this position receives the HTTP Request output as `$input`. It reads the calendar response directly from `$input.first().json` and re-reads the pre-freebusy lead context via `$('IF: Terminwunsch erkannt?').first().json` (or the node before the IF, since IF passes data through unchanged). Use `$('Code: Parse Terminwunsch JSON').first().json` for the lead context.

### Node 22: IF: Slot Available?
```json
{
  "id": "wf7-if-slot-available",
  "name": "IF: Slot Available?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [4350, 300],
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
          "id": "slot-check",
          "leftValue": "={{ $json.termin_available }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "true",
            "singleValue": true
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

True → Google Calendar: Create Event
False → Set: No Slot Available (set termin_erstellt=false, pass through to Merge)

### Node 23: Set: No Slot Available
```json
{
  "id": "wf7-set-no-slot",
  "name": "Set: No Slot Available",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [4600, 450],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "termin_erstellt",
          "value": false
        },
        {
          "name": "calendar_event_id",
          "value": ""
        }
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

### Node 24: Google Calendar: Create Event
Creates the appointment with the lead as attendee and 2 reminders.

```json
{
  "id": "wf7-gcal-create",
  "name": "Google Calendar: Create Event",
  "type": "n8n-nodes-base.googleCalendar",
  "typeVersion": 1.3,
  "position": [4600, 250],
  "parameters": {
    "operation": "create",
    "calendar": {
      "mode": "id",
      "value": "primary"
    },
    "start": "={{ $json.chosen_slot_start }}",
    "end": "={{ $json.chosen_slot_end }}",
    "additionalFields": {
      "summary": "={{ 'Sales Call: ' + $json.lead_vorname + ' ' + $json.lead_nachname + ' (' + $json.lead_unternehmen + ')' }}",
      "description": "={{ 'Automatisch erstellt durch Sales Agent.\\nLead: ' + $json.lead_vorname + ' ' + $json.lead_nachname + '\\nUnternehmen: ' + $json.lead_unternehmen + '\\nPosition: ' + $json.lead_position + '\\nTerminnotiz: ' + ($json.terminnotiz || '') }}",
      "attendees": "={{ [{ email: $json.lead_email }] }}",
      "reminders": {
        "useDefault": false,
        "overrides": [
          {
            "method": "email",
            "minutes": 1440
          },
          {
            "method": "popup",
            "minutes": 30
          }
        ]
      }
    }
  },
  "credentials": {
    "googleCalendarOAuth2Api": {
      "id": "GOOGLE_CALENDAR_CREDENTIAL_ID",
      "name": "Google Calendar account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note on typeVersion: The haunchen docs show typeVersion 1. Check n8n instance for current version — it may be 1.1 or 1.3. The executor should use `get_node` via n8n-MCP to verify exact typeVersion of `nodes-base.googleCalendar`. The `additionalFields` structure (including attendees as array and reminders with overrides) follows n8n Calendar node conventions.

Note on attendees: In Google Calendar node v1+, attendees is typically a string (comma-separated emails) or a specific fixedCollection. If the node does not support attendees natively, fall back to HTTP Request for event creation. The executor must verify by examining the `get_node` output for `n8n-nodes-base.googleCalendar`.

### Node 25: Code: Build Termin Record
Prepares the Termine tab row and the WF6 update payload.

```javascript
// Mode: runOnceForAllItems
const calResponse = $input.first().json;
const prevData = $('Code: Find Available Slots').first().json;

// Generate termin_id
const terminId = 'TERM-' + Date.now();
const now = new Date();
const erstelltAm = now.toISOString().split('T')[0];

// Parse chosen slot
const slotStart = prevData.chosen_slot_start || '';
const datumPart = slotStart ? slotStart.split('T')[0] : '';
const uhrPart = slotStart ? slotStart.split('T')[1]?.substring(0, 5) : '';

// Calendar event ID from response
const calendarEventId = calResponse.id || '';

const terminRow = {
  termin_id: terminId,
  lead_id: prevData.lead_id,
  datum: datumPart,
  uhrzeit: uhrPart,
  dauer: '60', // minutes
  titel: 'Sales Call: ' + prevData.lead_vorname + ' ' + prevData.lead_nachname + ' (' + prevData.lead_unternehmen + ')',
  beschreibung: prevData.terminnotiz || '',
  attendees: prevData.lead_email,
  calendar_event_id: calendarEventId,
  erstellt_am: erstelltAm,
  status: 'geplant',
  vorbereitung_erstellt: 'FALSE',
  agenda: '',
  notizen: '',
  gespraechsziel: ''
};

// WF6 update for lead
const leadUpdates = JSON.stringify({
  termin_vereinbart: true,
  letzter_kontakt: erstelltAm
});

const logEintrag = JSON.stringify({
  aktion: 'termin_erstellt',
  inhalt: 'Termin am ' + datumPart + ' um ' + uhrPart + ' Uhr. Calendar ID: ' + calendarEventId,
  status: 'ok'
});

return [{
  json: {
    ...prevData,
    termin_erstellt: true,
    calendar_event_id: calendarEventId,
    termin_id: terminId,
    termin_datum: datumPart,
    termin_uhrzeit: uhrPart,
    termin_row: terminRow,
    wf6_lead_updates: leadUpdates,
    wf6_log_eintrag: logEintrag
  }
}];
```

```json
{
  "id": "wf7-code-termin-record",
  "name": "Code: Build Termin Record",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [4850, 250],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 26: Google Sheets: Append Termine Row
```json
{
  "id": "wf7-sheets-append-termin",
  "name": "Google Sheets: Append Termine Row",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [5100, 250],
  "parameters": {
    "operation": "append",
    "documentId": {
      "mode": "id",
      "value": "SALES_AGENT_SHEET_ID"
    },
    "sheetName": {
      "mode": "name",
      "value": "Termine"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "termin_id": "={{ $json.termin_row.termin_id }}",
        "lead_id": "={{ $json.termin_row.lead_id }}",
        "datum": "={{ $json.termin_row.datum }}",
        "uhrzeit": "={{ $json.termin_row.uhrzeit }}",
        "dauer": "={{ $json.termin_row.dauer }}",
        "titel": "={{ $json.termin_row.titel }}",
        "beschreibung": "={{ $json.termin_row.beschreibung }}",
        "attendees": "={{ $json.termin_row.attendees }}",
        "calendar_event_id": "={{ $json.termin_row.calendar_event_id }}",
        "erstellt_am": "={{ $json.termin_row.erstellt_am }}",
        "status": "={{ $json.termin_row.status }}",
        "vorbereitung_erstellt": "={{ $json.termin_row.vorbereitung_erstellt }}",
        "agenda": "={{ $json.termin_row.agenda }}",
        "notizen": "={{ $json.termin_row.notizen }}",
        "gespraechsziel": "={{ $json.termin_row.gespraechsziel }}"
      }
    },
    "options": {}
  },
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

### Node 27: Execute WF6: Update Lead Termin
Updates the lead with termin_vereinbart=TRUE.

```json
{
  "id": "wf7-exec-wf6-termin",
  "name": "Execute WF6: Update Lead Termin",
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1.2,
  "position": [5350, 250],
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
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note on Execute Workflow input data: WF6 expects `lead_id`, `updates`, and `log_eintrag` as input fields. The data from `Code: Build Termin Record` contains `wf6_lead_updates` and `wf6_log_eintrag`. We need a Set node before Execute WF6 to map these correctly.

Insert **Set: Map WF6 Termin Inputs** before Execute WF6:

```json
{
  "id": "wf7-set-wf6-termin-inputs",
  "name": "Set: Map WF6 Termin Inputs",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [5100, 250],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "lead_id",
          "type": "stringValue",
          "stringValue": "={{ $json.lead_id }}"
        },
        {
          "name": "updates",
          "type": "stringValue",
          "stringValue": "={{ $json.wf6_lead_updates }}"
        },
        {
          "name": "log_eintrag",
          "type": "stringValue",
          "stringValue": "={{ $json.wf6_log_eintrag }}"
        }
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

(Adjust positions accordingly — the Google Sheets: Append and Set: Map WF6 can be at the same level with Calendar: Create at [4600,250], then Build Termin at [4850,250], then Append at [5100,250], then Set: Map at [5350,250], then Execute WF6 at [5600,250])

### Node 28: Set: Termin Path Done (passthrough to Merge)
After Execute WF6 completes for the termin branch, pass data forward to the Merge.

```json
{
  "id": "wf7-set-termin-done",
  "name": "Set: Termin Path Done",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [5850, 250],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "termin_erstellt",
          "value": true
        }
      ]
    },
    "options": {},
    "include": "all"
  }
}
```

### Node 29: Merge: Termin + No-Termin Paths
Brings both the termin-found and no-termin branches together before draft generation. Uses `passThrough` mode (output whichever branch finishes, pass first input).

```json
{
  "id": "wf7-merge-termin",
  "name": "Merge: Termin Paths",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.1,
  "position": [6100, 350],
  "parameters": {
    "mode": "passThrough",
    "output": "input1"
  }
}
```

Inputs:
- input1 (index 0): from Set: Termin Path Done (termin found)
- input2 (index 1): from Set: No Termin Found (no termin)
- input3 (index 2): from Set: No Slot Available (termin wanted but no slot)

Note: Merge node in passThrough mode with `output: "input1"` outputs items from input1. Since both the "termin_found" AND "no_termin_found" paths need to continue to draft generation, consider using `output: "input1"` and connect BOTH false branches of IF: Terminwunsch erkannt? and IF: Slot Available? to input2. The termin success path connects to input1.

Alternative: Use `mode: "combine"` with `combineBy: "combineAll"` — but this requires BOTH inputs to have data, which fails if one path doesn't execute. PassThrough is correct here.

Since passThrough only passes one input, we need to route carefully. The Merge node should be:
- Input 0 (from termin path) → arrives when termin was created
- Input 0 (from no-termin path) → arrives when no termin

Since only ONE of these paths executes per message, passThrough with `output: "input1"` receiving from whichever executes works correctly. Connect both terminal nodes of the termin/no-termin branches to the same Merge input (both to index 0), using passThrough. n8n handles this correctly for exclusive OR branches.

### Node 30: LLM: Draft Generation
Generates the context-aware reply draft.

```json
{
  "id": "wf7-llm-draft",
  "name": "LLM: Draft Generation",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [6350, 350],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Erstelle einen E-Mail-Entwurf als Antwort auf diese E-Mail.\\n\\nLEAD-KONTEXT:\\nName: ' + $json.lead_vorname + ' ' + $json.lead_nachname + '\\nUnternehmen: ' + $json.lead_unternehmen + '\\nPosition: ' + $json.lead_position + '\\nBranche: ' + $json.lead_branche + '\\nHauptschmerz: ' + ($json.lead_hauptschmerz || 'unbekannt') + '\\nScore: ' + $json.lead_score + ' (' + $json.lead_score_klassifikation + ')\\n\\nTERMIN-STATUS:\\n' + ($json.termin_erstellt === true ? 'Termin wurde ERSTELLT am ' + $json.termin_datum + ' um ' + $json.termin_uhrzeit + ' Uhr. Bestaetigung des Termins in der Antwort erwaehnen.' : 'Kein Termin erstellt. Falls ein Terminwunsch vorlag aber kein Slot verfuegbar war: Alternativtermine anbieten.') + '\\n\\nE-MAIL-THREAD (zur Kontextualisierung):\\n' + $json.thread_context + '\\n\\nANFORDERUNGEN:\\n- Beantworte die letzte E-Mail direkt und authentisch\\n- Max. 150 Woerter\\n- Kein generisches Blabla\\n- Professionell aber persoenlich\\n- Wenn Termin bestaetigt: Datum/Uhrzeit explizit nennen\\n- Wenn kein Termin: Proaktiv Verfuegbarkeit anbieten\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown:\\n{\\\"betreff\\\": \\\"Re: Ursprungsbetreff\\\", \\\"text\\\": \\\"E-Mail-Text hier\\\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein B2B-Sales-Experte im DACH-Markt und schreibst Antwort-E-Mails im Namen des Absenders.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 - PSYCHOLOGIE: Empfaenger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 - METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 - PITCH-BEREITSCHAFT: Konkreten Gespraechsanlass schaffen\nSCHICHT 4 - POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 - POTENZIAL: Langfristige Partnerschaft andeuten\n\nRegeln:\n- Schreibe aus der Ich-Perspektive des Absenders (nicht als KI)\n- Authentisch, menschlich, keine Floskeln\n- Klarer CTA am Ende (Termin bestaetigen ODER Terminvorschlag)\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks"
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

### Node 31: Anthropic Chat Model B (for Draft LLM)
```json
{
  "id": "wf7-anthropic-b",
  "name": "Anthropic Chat Model B",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [6350, 550],
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
      "name": "Claude - 20260127"
    }
  }
}
```

### Node 32: Code: Build Draft + WF6 Payload
Parses LLM output, builds Gmail draft params and WF6 update payload.

```javascript
// Mode: runOnceForAllItems
const llmOutput = $input.first().json;
const ctxData = $('Merge: Termin Paths').first().json;

const rawText = llmOutput.text || '';
const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

let parsed = { betreff: 'Re: ' + (ctxData.subject || 'Ihre Nachricht'), text: '' };
try {
  parsed = JSON.parse(cleaned);
} catch(e) {
  parsed.text = rawText.trim();
}

const draftBetreff = parsed.betreff || ('Re: ' + (ctxData.subject || 'Ihre Nachricht'));
const draftText = parsed.text || '';

// WF6 updates for lead
const updates = {
  antwort_erhalten: true,
  draft_erstellt: true,
  letzter_kontakt: new Date().toISOString().split('T')[0]
};

const wf6Updates = JSON.stringify(updates);
const wf6LogEintrag = JSON.stringify({
  aktion: 'draft_erstellt',
  inhalt: 'Draft erstellt fuer messageId: ' + ctxData.message_id + ' | Betreff: ' + draftBetreff,
  status: 'ok'
});

return [{
  json: {
    ...ctxData,
    draft_betreff: draftBetreff,
    draft_text: draftText,
    wf6_updates: wf6Updates,
    wf6_log_eintrag: wf6LogEintrag
  }
}];
```

```json
{
  "id": "wf7-code-build-draft",
  "name": "Code: Build Draft + WF6 Payload",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [6600, 350],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 33: Gmail: Create Draft
Creates the reply draft in Gmail. NOT sent — requires manual review.

```json
{
  "id": "wf7-gmail-create-draft",
  "name": "Gmail: Create Draft",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [6850, 350],
  "parameters": {
    "operation": "createDraft",
    "sendTo": "={{ $json.lead_email }}",
    "subject": "={{ $json.draft_betreff }}",
    "emailType": "text",
    "message": "={{ $json.draft_text }}",
    "options": {
      "threadId": "={{ $json.thread_id }}",
      "senderName": "Mark"
    }
  },
  "credentials": {
    "gmailOAuth2": {
      "id": "yv1FhLRO54A8dyzi",
      "name": "Gmail account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note on `createDraft` operation: Verify this operation name is correct for Gmail node v2.1. In n8n Gmail node, draft creation may use `operation: "createDraft"` or it may be under a `draft` resource with `create` operation. The executor must verify via `get_node` for `n8n-nodes-base.gmail` typeVersion 2.1. If the operation is not `createDraft`, check what operations are available.

Alternative if createDraft is not available as a direct operation: Use HTTP Request with Gmail API to create a draft:
```
POST https://gmail.googleapis.com/gmail/v1/users/me/drafts
Body: { message: { raw: base64url(MIME message), threadId: threadId } }
```

### Node 34: Execute WF6: Update Lead Draft
Updates lead with antwort_erhalten=TRUE, draft_erstellt=TRUE, logs the draft with messageId.

```json
{
  "id": "wf7-exec-wf6-draft",
  "name": "Execute WF6: Update Lead Draft",
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1.2,
  "position": [7100, 350],
  "parameters": {
    "source": "database",
    "workflowId": {
      "__rl": true,
      "mode": "id",
      "value": "HxOD2a8He72tvKmR"
    },
    "workflowInputs": {
      "mappingMode": "defineBelow",
      "value": {
        "lead_id": "={{ $json.lead_id }}",
        "updates": "={{ $json.wf6_updates }}",
        "log_eintrag": "={{ $json.wf6_log_eintrag }}"
      }
    },
    "options": {
      "waitForSubWorkflow": true
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

### Node 35: Gmail: Mark as Read
Removes the UNREAD label from the message.

```json
{
  "id": "wf7-gmail-mark-read",
  "name": "Gmail: Mark as Read",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [7350, 350],
  "parameters": {
    "operation": "markAsRead",
    "messageId": "={{ $json.message_id }}",
    "options": {}
  },
  "credentials": {
    "gmailOAuth2": {
      "id": "yv1FhLRO54A8dyzi",
      "name": "Gmail account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note: If `markAsRead` is not a direct operation in Gmail node v2.1, use `operation: "modify"` with:
```json
"removeLabels": ["UNREAD"],
"messageId": "={{ $json.message_id }}"
```

Or if neither is available, use HTTP Request:
```
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/modify
Body: { removeLabelIds: ["UNREAD"] }
```

### Node 36: Set: Email Processed (loop back to SplitInBatches)
```json
{
  "id": "wf7-set-email-done",
  "name": "Set: Email Processed",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [7600, 350],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "processed",
          "value": true
        },
        {
          "name": "lead_id",
          "value": "={{ $json.lead_id }}"
        },
        {
          "name": "draft_created",
          "value": true
        }
      ]
    },
    "options": {}
  }
}
```

Connect: Set: Email Processed → SplitInBatches: Per Email (input 0, loop back)

### Node 37: Set: Path A Complete (from SplitInBatches done output)
```json
{
  "id": "wf7-set-path-a-done",
  "name": "Set: Path A Complete",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1600, 150],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "path",
          "value": "inbox_monitor"
        },
        {
          "name": "status",
          "value": "complete"
        }
      ]
    },
    "options": {}
  }
}
```

---

## Node Specifications — Path B (Termin-Vorbereitung)

### Node 38: Cron: Daily 07:00
```json
{
  "id": "wf7-cron-vorbereitung",
  "name": "Cron: Daily 07:00",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "position": [100, 800],
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 7 * * *"
        }
      ]
    }
  }
}
```

### Node 39: Google Sheets: Get All Termine
```json
{
  "id": "wf7-sheets-get-termine",
  "name": "Google Sheets: Get All Termine",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [350, 800],
  "parameters": {
    "operation": "read",
    "documentId": {
      "mode": "id",
      "value": "SALES_AGENT_SHEET_ID"
    },
    "sheetName": {
      "mode": "name",
      "value": "Termine"
    },
    "filtersUI": {},
    "options": {}
  },
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

### Node 40: Code: Filter Termine Tomorrow
```javascript
// Mode: runOnceForAllItems
const allTermine = $input.all().map(item => item.json);

// Calculate tomorrow's date in Berlin time
const tomorrow = DateTime.now().setZone('Europe/Berlin').plus({ days: 1 }).toFormat('yyyy-MM-dd');

const filtered = allTermine.filter(termin => {
  // datum field must equal tomorrow
  if (!termin.datum) return false;

  // Normalize date format (sheet may store as yyyy-MM-dd or dd.MM.yyyy)
  let datumNorm = termin.datum;
  if (datumNorm.includes('.')) {
    // Convert dd.MM.yyyy to yyyy-MM-dd
    const parts = datumNorm.split('.');
    if (parts.length === 3) {
      datumNorm = parts[2] + '-' + parts[1] + '-' + parts[0];
    }
  }

  const isTomorrow = datumNorm === tomorrow;
  const notYetPrepared = !termin.vorbereitung_erstellt ||
                          termin.vorbereitung_erstellt === 'FALSE' ||
                          termin.vorbereitung_erstellt === false ||
                          termin.vorbereitung_erstellt === '';

  return isTomorrow && notYetPrepared;
});

return filtered.map(termin => ({ json: termin }));
```

```json
{
  "id": "wf7-code-filter-tomorrow",
  "name": "Code: Filter Termine Tomorrow",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [600, 800],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 41: IF: Termine for Tomorrow?
```json
{
  "id": "wf7-if-termine",
  "name": "IF: Termine for Tomorrow?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [850, 800],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "loose",
        "version": 2
      },
      "conditions": [
        {
          "id": "termine-count-check",
          "leftValue": "={{ $input.all().length }}",
          "rightValue": 0,
          "operator": {
            "type": "number",
            "operation": "gt"
          }
        }
      ],
      "combineOperation": "all"
    },
    "options": {}
  }
}
```

True → SplitInBatches: Per Termin
False → Set: No Termine Tomorrow (terminal)

### Node 42: Set: No Termine Tomorrow
```json
{
  "id": "wf7-set-no-termine",
  "name": "Set: No Termine Tomorrow",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1100, 950],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "status",
          "value": "no_termine_tomorrow"
        }
      ]
    },
    "options": {}
  }
}
```

### Node 43: SplitInBatches: Per Termin
```json
{
  "id": "wf7-split-termine",
  "name": "SplitInBatches: Per Termin",
  "type": "n8n-nodes-base.splitInBatches",
  "typeVersion": 3,
  "position": [1100, 800],
  "parameters": {
    "batchSize": 1,
    "options": {}
  }
}
```

Output 0 (done) → Set: Path B Complete
Output 1 (loop) → Google Sheets: Get Lead for Termin

### Node 44: Google Sheets: Get Lead for Termin
Lookup lead data by lead_id from the current termin.

```json
{
  "id": "wf7-sheets-get-lead-for-termin",
  "name": "Google Sheets: Get Lead for Termin",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [1350, 800],
  "parameters": {
    "operation": "read",
    "documentId": {
      "mode": "id",
      "value": "SALES_AGENT_SHEET_ID"
    },
    "sheetName": {
      "mode": "name",
      "value": "Leads"
    },
    "filtersUI": {
      "values": [
        {
          "lookupColumn": "lead_id",
          "lookupValue": "={{ $json.lead_id }}"
        }
      ]
    },
    "options": {}
  },
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note: Google Sheets node v4.7 with `filtersUI` does row-level filtering. The `lookupColumn` is the column header name, `lookupValue` is the value to match. This returns matching rows.

### Node 45: Code: Build Termin+Lead Context
Merges the termin data (from SplitInBatches) with the lead data (from Sheets read).

```javascript
// Mode: runOnceForAllItems
const terminData = $('SplitInBatches: Per Termin').first().json;
const leadRows = $input.all();
const lead = leadRows.length > 0 ? leadRows[0].json : {};

return [{
  json: {
    // Termin data
    termin_id: terminData.termin_id,
    lead_id: terminData.lead_id,
    termin_datum: terminData.datum,
    termin_uhrzeit: terminData.uhrzeit,
    termin_dauer: terminData.dauer,
    termin_titel: terminData.titel,
    termin_beschreibung: terminData.beschreibung,
    termin_gespraechsziel: terminData.gespraechsziel || '',
    // Lead data
    lead_vorname: lead.vorname || '',
    lead_nachname: lead.nachname || '',
    lead_email: lead.email || '',
    lead_unternehmen: lead.unternehmen || '',
    lead_position: lead.position || '',
    lead_branche: lead.branche || '',
    lead_hauptschmerz: lead.hauptschmerz || '',
    lead_kaufmotiv: lead.kaufmotiv || '',
    lead_score: lead.score || 0,
    lead_score_klassifikation: lead.score_klassifikation || '',
    // Enrichment if available
    unternehmens_beschreibung: lead.angereichert_unternehmens_beschreibung || '',
    aktuelle_herausforderungen: lead.angereichert_aktuelle_herausforderungen || '',
    linkedin_headline: lead.angereichert_linkedin_headline || ''
  }
}];
```

```json
{
  "id": "wf7-code-termin-lead-ctx",
  "name": "Code: Build Termin+Lead Context",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1600, 800],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 46: Set: Store Termin Context (passthrough)
```json
{
  "id": "wf7-set-termin-ctx",
  "name": "Set: Store Termin Context",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1850, 800],
  "parameters": {
    "fields": {
      "values": []
    },
    "options": {},
    "include": "all"
  }
}
```

### Node 47: LLM: Gesprächsvorbereitung
Generates SPIN questions, objections, conversation goal, opening line.

```json
{
  "id": "wf7-llm-vorbereitung",
  "name": "LLM: Gesprächsvorbereitung",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [2100, 800],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Erstelle eine Gespraecharsvorbereitung fuer dieses B2B-Gespraech.\\n\\nTERMIN-DETAILS:\\nDatum: ' + $json.termin_datum + ' um ' + $json.termin_uhrzeit + ' Uhr\\nDauer: ' + $json.termin_dauer + ' Minuten\\n\\nLEAD:\\nName: ' + $json.lead_vorname + ' ' + $json.lead_nachname + '\\nPosition: ' + $json.lead_position + ' bei ' + $json.lead_unternehmen + '\\nBranche: ' + $json.lead_branche + '\\nHauptschmerz: ' + ($json.lead_hauptschmerz || 'unbekannt') + '\\nKaufmotiv: ' + ($json.lead_kaufmotiv || 'unbekannt') + '\\nScore: ' + $json.lead_score + ' (' + $json.lead_score_klassifikation + ')\\n\\nUNTERNEHMENS-KONTEXT:\\n' + ($json.unternehmens_beschreibung || 'nicht verfuegbar') + '\\n\\nHERAUSFORDERUNGEN:\\n' + ($json.aktuelle_herausforderungen || 'nicht verfuegbar') + '\\n\\nErstelle eine strukturierte Gespraecharsvorbereitung mit maximal 300 Woertern.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown:\\n{\\\"gespraechsziel\\\": \\\"konkretes Ziel\\\", \\\"einstiegssatz\\\": \\\"erster Satz des Calls\\\", \\\"spin_fragen\\\": {\\\"situation\\\": [\\\"Frage 1\\\", \\\"Frage 2\\\"], \\\"problem\\\": [\\\"Frage 1\\\", \\\"Frage 2\\\"], \\\"implication\\\": [\\\"Frage 1\\\"], \\\"need_payoff\\\": [\\\"Frage 1\\\"]}, \\\"moegliche_einwaende\\\": [{\\\"einwand\\\": \\\"Einwand 1\\\", \\\"antwort\\\": \\\"Antwort darauf\\\"}], \\\"wichtige_hinweise\\\": \\\"kurze Stichpunkte\\\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein erfahrener B2B-Sales-Coach im DACH-Markt. Du bereitest Verkaeufer auf wichtige Kundengespaeche vor.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 - PSYCHOLOGIE: Empfaenger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 - METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 - PITCH-BEREITSCHAFT: Konkreten Gespraechsanlass schaffen\nSCHICHT 4 - POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 - POTENZIAL: Langfristige Partnerschaft andeuten\n\nDeine SPIN-Fragen sind konkret und auf den Lead zugeschnitten — keine generischen Fragen.\nDie Einwaende sind realistisch fuer die Branche und Position des Leads.\n\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblocks. Max. 300 Woerter Gesamtinhalt."
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

### Node 48: Anthropic Chat Model C (for Vorbereitung LLM)
```json
{
  "id": "wf7-anthropic-c",
  "name": "Anthropic Chat Model C",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [2100, 1000],
  "parameters": {
    "model": {
      "mode": "id",
      "value": "claude-sonnet-4-20250514"
    },
    "options": {
      "maxTokensToSample": 1000,
      "temperature": 0.6
    }
  },
  "credentials": {
    "anthropicApi": {
      "id": "5LmibcuA2kdHKaqB",
      "name": "Claude - 20260127"
    }
  }
}
```

### Node 49: Code: Build Agenda Payload
Parses LLM output, builds the agenda string for the Termine tab.

```javascript
// Mode: runOnceForAllItems
const llmOutput = $input.first().json;
const ctxData = $('Set: Store Termin Context').first().json;

const rawText = llmOutput.text || '';
const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

let parsed = {
  gespraechsziel: '',
  einstiegssatz: '',
  spin_fragen: { situation: [], problem: [], implication: [], need_payoff: [] },
  moegliche_einwaende: [],
  wichtige_hinweise: ''
};

try {
  parsed = JSON.parse(cleaned);
} catch(e) {
  // Keep defaults, store raw text as agenda
  return [{
    json: {
      ...ctxData,
      agenda_text: rawText.trim().substring(0, 2000),
      gespraechsziel_text: ''
    }
  }];
}

// Format agenda as readable text for the sheet cell
const agendaLines = [
  '=== GESPRÄCHSZIEL ===',
  parsed.gespraechsziel || '',
  '',
  '=== EINSTIEGSSATZ ===',
  parsed.einstiegssatz || '',
  '',
  '=== SPIN-FRAGEN ===',
  'SITUATION:',
  ...(parsed.spin_fragen?.situation || []).map((q, i) => `  ${i+1}. ${q}`),
  'PROBLEM:',
  ...(parsed.spin_fragen?.problem || []).map((q, i) => `  ${i+1}. ${q}`),
  'IMPLICATION:',
  ...(parsed.spin_fragen?.implication || []).map((q, i) => `  ${i+1}. ${q}`),
  'NEED-PAYOFF:',
  ...(parsed.spin_fragen?.need_payoff || []).map((q, i) => `  ${i+1}. ${q}`),
  '',
  '=== MÖGLICHE EINWÄNDE ===',
  ...(parsed.moegliche_einwaende || []).map(e => `E: ${e.einwand}\nA: ${e.antwort}`),
  '',
  '=== WICHTIGE HINWEISE ===',
  parsed.wichtige_hinweise || ''
];

const agendaText = agendaLines.join('\n').trim().substring(0, 3000);

return [{
  json: {
    ...ctxData,
    agenda_text: agendaText,
    gespraechsziel_text: parsed.gespraechsziel || ''
  }
}];
```

```json
{
  "id": "wf7-code-agenda-payload",
  "name": "Code: Build Agenda Payload",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [2350, 800],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// [see code above]"
  }
}
```

### Node 50: Google Sheets: Update Termine Agenda
Updates the agenda and gespraechsziel columns in the matching Termine row.

```json
{
  "id": "wf7-sheets-update-agenda",
  "name": "Google Sheets: Update Termine Agenda",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.7,
  "position": [2600, 800],
  "parameters": {
    "operation": "update",
    "documentId": {
      "mode": "id",
      "value": "SALES_AGENT_SHEET_ID"
    },
    "sheetName": {
      "mode": "name",
      "value": "Termine"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "termin_id": "={{ $json.termin_id }}",
        "agenda": "={{ $json.agenda_text }}",
        "vorbereitung_erstellt": "TRUE",
        "gespraechsziel": "={{ $json.gespraechsziel_text }}"
      }
    },
    "options": {
      "handlingExtraData": "ignoreIt"
    }
  },
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "gw0DIdDENFkpE7ZW",
      "name": "Google Sheets account"
    }
  },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

Note: Google Sheets `update` operation v4.7 requires a key column to match the row. The `mappingMode: "defineBelow"` with `termin_id` as the key column means n8n will find the row where `termin_id` matches and update the other columns. This requires `termin_id` to be a column header in the Termine tab.

### Node 51: Set: Termin Vorbereitung Done (loop back)
```json
{
  "id": "wf7-set-vorbereitung-done",
  "name": "Set: Vorbereitung Done",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [2850, 800],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "vorbereitung_erstellt",
          "value": true
        },
        {
          "name": "termin_id",
          "value": "={{ $json.termin_id }}"
        }
      ]
    },
    "options": {}
  }
}
```

Connect: Set: Vorbereitung Done → SplitInBatches: Per Termin (input 0, loop back)

### Node 52: Set: Path B Complete
```json
{
  "id": "wf7-set-path-b-done",
  "name": "Set: Path B Complete",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [1350, 650],
  "parameters": {
    "fields": {
      "values": [
        {
          "name": "path",
          "value": "termin_vorbereitung"
        },
        {
          "name": "status",
          "value": "complete"
        }
      ]
    },
    "options": {}
  }
}
```

---

## Complete Connections Object

```json
{
  "Cron: Every 15 Min": {
    "main": [[{ "node": "Gmail: Get Unread Messages", "type": "main", "index": 0 }]]
  },
  "Gmail: Get Unread Messages": {
    "main": [[{ "node": "Google Sheets: Get All Leads", "type": "main", "index": 0 }]]
  },
  "Google Sheets: Get All Leads": {
    "main": [[{ "node": "Code: Filter Known Leads", "type": "main", "index": 0 }]]
  },
  "Code: Filter Known Leads": {
    "main": [[{ "node": "IF: Known Lead Emails Found?", "type": "main", "index": 0 }]]
  },
  "IF: Known Lead Emails Found?": {
    "main": [
      [{ "node": "SplitInBatches: Per Email", "type": "main", "index": 0 }],
      [{ "node": "Set: No Known Leads Found", "type": "main", "index": 0 }]
    ]
  },
  "SplitInBatches: Per Email": {
    "main": [
      [{ "node": "Set: Path A Complete", "type": "main", "index": 0 }],
      [{ "node": "Google Sheets: Get Sequenz Log", "type": "main", "index": 0 }]
    ]
  },
  "Google Sheets: Get Sequenz Log": {
    "main": [[{ "node": "Code: Check Duplicate Draft", "type": "main", "index": 0 }]]
  },
  "Code: Check Duplicate Draft": {
    "main": [[{ "node": "IF: Already Processed?", "type": "main", "index": 0 }]]
  },
  "IF: Already Processed?": {
    "main": [
      [{ "node": "Set: Skip Already Processed", "type": "main", "index": 0 }],
      [{ "node": "Gmail: Get Thread Messages", "type": "main", "index": 0 }]
    ]
  },
  "Set: Skip Already Processed": {
    "main": [[{ "node": "SplitInBatches: Per Email", "type": "main", "index": 0 }]]
  },
  "Gmail: Get Thread Messages": {
    "main": [[{ "node": "Code: Build Thread Context", "type": "main", "index": 0 }]]
  },
  "Code: Build Thread Context": {
    "main": [[{ "node": "Set: Store Message Context", "type": "main", "index": 0 }]]
  },
  "Set: Store Message Context": {
    "main": [[{ "node": "LLM: Terminwunsch Erkennung", "type": "main", "index": 0 }]]
  },
  "Anthropic Chat Model A": {
    "ai_languageModel": [[{ "node": "LLM: Terminwunsch Erkennung", "type": "ai_languageModel", "index": 0 }]]
  },
  "LLM: Terminwunsch Erkennung": {
    "main": [[{ "node": "Code: Parse Terminwunsch JSON", "type": "main", "index": 0 }]]
  },
  "Code: Parse Terminwunsch JSON": {
    "main": [[{ "node": "IF: Terminwunsch erkannt?", "type": "main", "index": 0 }]]
  },
  "IF: Terminwunsch erkannt?": {
    "main": [
      [{ "node": "HTTP Request: Freebusy Query", "type": "main", "index": 0 }],
      [{ "node": "Set: No Termin Found", "type": "main", "index": 0 }]
    ]
  },
  "HTTP Request: Freebusy Query": {
    "main": [[{ "node": "Code: Find Available Slots", "type": "main", "index": 0 }]]
  },
  "Code: Find Available Slots": {
    "main": [[{ "node": "IF: Slot Available?", "type": "main", "index": 0 }]]
  },
  "IF: Slot Available?": {
    "main": [
      [{ "node": "Google Calendar: Create Event", "type": "main", "index": 0 }],
      [{ "node": "Set: No Slot Available", "type": "main", "index": 0 }]
    ]
  },
  "Google Calendar: Create Event": {
    "main": [[{ "node": "Code: Build Termin Record", "type": "main", "index": 0 }]]
  },
  "Code: Build Termin Record": {
    "main": [[{ "node": "Google Sheets: Append Termine Row", "type": "main", "index": 0 }]]
  },
  "Google Sheets: Append Termine Row": {
    "main": [[{ "node": "Set: Map WF6 Termin Inputs", "type": "main", "index": 0 }]]
  },
  "Set: Map WF6 Termin Inputs": {
    "main": [[{ "node": "Execute WF6: Update Lead Termin", "type": "main", "index": 0 }]]
  },
  "Execute WF6: Update Lead Termin": {
    "main": [[{ "node": "Set: Termin Path Done", "type": "main", "index": 0 }]]
  },
  "Set: Termin Path Done": {
    "main": [[{ "node": "Merge: Termin Paths", "type": "main", "index": 0 }]]
  },
  "Set: No Termin Found": {
    "main": [[{ "node": "Merge: Termin Paths", "type": "main", "index": 0 }]]
  },
  "Set: No Slot Available": {
    "main": [[{ "node": "Merge: Termin Paths", "type": "main", "index": 0 }]]
  },
  "Merge: Termin Paths": {
    "main": [[{ "node": "LLM: Draft Generation", "type": "main", "index": 0 }]]
  },
  "Anthropic Chat Model B": {
    "ai_languageModel": [[{ "node": "LLM: Draft Generation", "type": "ai_languageModel", "index": 0 }]]
  },
  "LLM: Draft Generation": {
    "main": [[{ "node": "Code: Build Draft + WF6 Payload", "type": "main", "index": 0 }]]
  },
  "Code: Build Draft + WF6 Payload": {
    "main": [[{ "node": "Gmail: Create Draft", "type": "main", "index": 0 }]]
  },
  "Gmail: Create Draft": {
    "main": [[{ "node": "Execute WF6: Update Lead Draft", "type": "main", "index": 0 }]]
  },
  "Execute WF6: Update Lead Draft": {
    "main": [[{ "node": "Gmail: Mark as Read", "type": "main", "index": 0 }]]
  },
  "Gmail: Mark as Read": {
    "main": [[{ "node": "Set: Email Processed", "type": "main", "index": 0 }]]
  },
  "Set: Email Processed": {
    "main": [[{ "node": "SplitInBatches: Per Email", "type": "main", "index": 0 }]]
  },
  "Cron: Daily 07:00": {
    "main": [[{ "node": "Google Sheets: Get All Termine", "type": "main", "index": 0 }]]
  },
  "Google Sheets: Get All Termine": {
    "main": [[{ "node": "Code: Filter Termine Tomorrow", "type": "main", "index": 0 }]]
  },
  "Code: Filter Termine Tomorrow": {
    "main": [[{ "node": "IF: Termine for Tomorrow?", "type": "main", "index": 0 }]]
  },
  "IF: Termine for Tomorrow?": {
    "main": [
      [{ "node": "SplitInBatches: Per Termin", "type": "main", "index": 0 }],
      [{ "node": "Set: No Termine Tomorrow", "type": "main", "index": 0 }]
    ]
  },
  "SplitInBatches: Per Termin": {
    "main": [
      [{ "node": "Set: Path B Complete", "type": "main", "index": 0 }],
      [{ "node": "Google Sheets: Get Lead for Termin", "type": "main", "index": 0 }]
    ]
  },
  "Google Sheets: Get Lead for Termin": {
    "main": [[{ "node": "Code: Build Termin+Lead Context", "type": "main", "index": 0 }]]
  },
  "Code: Build Termin+Lead Context": {
    "main": [[{ "node": "Set: Store Termin Context", "type": "main", "index": 0 }]]
  },
  "Set: Store Termin Context": {
    "main": [[{ "node": "LLM: Gesprächsvorbereitung", "type": "main", "index": 0 }]]
  },
  "Anthropic Chat Model C": {
    "ai_languageModel": [[{ "node": "LLM: Gesprächsvorbereitung", "type": "ai_languageModel", "index": 0 }]]
  },
  "LLM: Gesprächsvorbereitung": {
    "main": [[{ "node": "Code: Build Agenda Payload", "type": "main", "index": 0 }]]
  },
  "Code: Build Agenda Payload": {
    "main": [[{ "node": "Google Sheets: Update Termine Agenda", "type": "main", "index": 0 }]]
  },
  "Google Sheets: Update Termine Agenda": {
    "main": [[{ "node": "Set: Vorbereitung Done", "type": "main", "index": 0 }]]
  },
  "Set: Vorbereitung Done": {
    "main": [[{ "node": "SplitInBatches: Per Termin", "type": "main", "index": 0 }]]
  }
}
```

---

## Node Position Layout

### Path A (Y: 300 range, X: 100 → 7600+)
```
[100, 300]  Cron: Every 15 Min
[350, 300]  Gmail: Get Unread Messages
[600, 300]  Google Sheets: Get All Leads
[850, 300]  Code: Filter Known Leads
[1100, 300] IF: Known Lead Emails Found?
[1350, 300] SplitInBatches: Per Email
[1350, 150] Set: Path A Complete           ← from SplitInBatches output 0
[1350, 450] Set: No Known Leads Found      ← from IF false output
[1600, 300] Google Sheets: Get Sequenz Log
[1850, 300] Code: Check Duplicate Draft
[2100, 300] IF: Already Processed?
[2350, 150] Set: Skip Already Processed    ← loops back to SplitInBatches
[2350, 350] Gmail: Get Thread Messages
[2600, 350] Code: Build Thread Context
[2850, 350] Set: Store Message Context
[3100, 350] LLM: Terminwunsch Erkennung
[3100, 550] Anthropic Chat Model A
[3350, 350] Code: Parse Terminwunsch JSON
[3600, 350] IF: Terminwunsch erkannt?
[3850, 300] HTTP Request: Freebusy Query
[3850, 550] Set: No Termin Found           ← from IF false
[4100, 300] Code: Find Available Slots
[4350, 300] IF: Slot Available?
[4600, 250] Google Calendar: Create Event
[4600, 450] Set: No Slot Available         ← from IF false
[4850, 250] Code: Build Termin Record
[5100, 250] Google Sheets: Append Termine Row
[5350, 250] Set: Map WF6 Termin Inputs
[5600, 250] Execute WF6: Update Lead Termin
[5850, 250] Set: Termin Path Done
[6100, 350] Merge: Termin Paths
[6350, 350] LLM: Draft Generation
[6350, 550] Anthropic Chat Model B
[6600, 350] Code: Build Draft + WF6 Payload
[6850, 350] Gmail: Create Draft
[7100, 350] Execute WF6: Update Lead Draft
[7350, 350] Gmail: Mark as Read
[7600, 350] Set: Email Processed           ← loops back to SplitInBatches
```

### Path B (Y: 800 range, X: 100 → 2850+)
```
[100, 800]  Cron: Daily 07:00
[350, 800]  Google Sheets: Get All Termine
[600, 800]  Code: Filter Termine Tomorrow
[850, 800]  IF: Termine for Tomorrow?
[1100, 800] SplitInBatches: Per Termin
[1100, 650] Set: Path B Complete           ← from SplitInBatches output 0
[1100, 950] Set: No Termine Tomorrow       ← from IF false
[1350, 800] Google Sheets: Get Lead for Termin
[1600, 800] Code: Build Termin+Lead Context
[1850, 800] Set: Store Termin Context
[2100, 800] LLM: Gesprächsvorbereitung
[2100, 1000] Anthropic Chat Model C
[2350, 800] Code: Build Agenda Payload
[2600, 800] Google Sheets: Update Termine Agenda
[2850, 800] Set: Vorbereitung Done         ← loops back to SplitInBatches: Per Termin
```

---

## Workflow Settings

```json
{
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true
  }
}
```

Note: `callerPolicy` is NOT set in JSON — set in n8n UI if needed.

---

## Error Handling Strategy (ERR-03 + ERR-04)

All external API calls have:
- `onError: "continueRegularOutput"` — execution continues even if node fails
- `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000` (5 seconds for Gmail/Sheets/Calendar)

For WF6 execute calls:
- `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`

The requirement ERR-04 specifies "2 retries with 5 min pause before error status". For a strict interpretation:
- Use `maxTries: 2` and `waitBetweenTries: 300000` (5 minutes = 300,000 ms) on critical external calls
- The 15-minute cron interval means a 5-minute retry still fits within one cycle

Decision: For production hardening, Gmail and Calendar nodes use `maxTries: 3, waitBetweenTries: 5000` (standard API retry). For WF6 calls, use `maxTries: 2, waitBetweenTries: 300000` to match ERR-04 specification exactly.

If an error persists after all retries, `continueRegularOutput` means the workflow continues with the last successful data (or empty data from the failed node). Downstream nodes may produce incorrect output. A full error-status write to sheet would require adding IF nodes after each critical node to check for errors — this is marked as v2 enhancement. For MVP, `continueRegularOutput` is the accepted pattern (consistent with Phases 1–4).

---

## Critical Verification Steps for Executor

1. **Google Calendar Credential ID**: Before building nodes, run `n8n_list_credentials` and find the credential with type `googleCalendarOAuth2Api`. Replace `GOOGLE_CALENDAR_CREDENTIAL_ID` in all Calendar/HTTP Request nodes.

2. **Gmail createDraft operation name**: Run `get_node` for `n8n-nodes-base.gmail` typeVersion 2.1. Verify the exact operation value for creating a draft. Common values: `createDraft`, `draft.create`, or `create` with `resource: "draft"`.

3. **Gmail markAsRead operation**: Verify if `markAsRead` exists or if it should be `modify` with `removeLabels: ["UNREAD"]`.

4. **Google Calendar Create Event additionalFields**: Run `get_node` for `n8n-nodes-base.googleCalendar` and check the exact typeVersion (likely 1.1 or 1.2 not 1.3) and whether `attendees` is a supported field. If not supported, use HTTP Request for event creation with the Calendar OAuth credential.

5. **Google Sheets Update operation**: Verify that `update` with `mappingMode: "defineBelow"` and a key column (`termin_id`) works in v4.7. Alternative: use `upsert` operation.

6. **Merge node passThrough**: Verify that all three branches (termin created, no termin wanted, termin wanted but no slot) connect correctly to the Merge node. In n8n, since only ONE branch fires per execution, passThrough mode with all connecting to index 0 works correctly.

7. **HTTP Request freebusy body**: Test if the IIFE expression approach works for the `specifyBody: "json"` + `jsonBody` expression parameter. If not, insert a Code node before the HTTP Request.

8. **SALES_AGENT_SHEET_ID placeholder**: This placeholder from Phases 1–4 must still be replaced with the actual Google Sheet ID before live testing.

---

## Data Flow Summary

### Path A Input → Output
```
Input: None (Cron trigger)
After Gmail getAll: { id, threadId, payload.headers, snippet } per message
After Filter Known Leads: { message_id, thread_id, lead_id, lead_vorname, lead_email, ... } per known-lead message
After Thread Context: + { thread_context, thread_message_count }
After Terminwunsch LLM: + { terminwunsch_erkannt, termin_konfidenz, vorgeschlagene_zeiten }
After Freebusy: + { available_slots, chosen_slot_start, chosen_slot_end }
After Calendar Create: + { calendar_event_id, termin_id, termin_datum, termin_uhrzeit }
After Draft LLM: + { draft_betreff, draft_text }
Output: Gmail Draft created + WF6 updated + message marked read
```

### Path B Input → Output
```
Input: None (Cron trigger)
After Sheets getAll: { termin_id, lead_id, datum, uhrzeit, ... } per Termine row
After Filter Tomorrow: only rows where datum = tomorrow AND vorbereitung_erstellt != TRUE
After Lead Lookup: + { lead_vorname, lead_nachname, lead_unternehmen, lead_position, ... }
After Vorbereitung LLM: + { agenda_text, gespraechsziel_text }
Output: Termine row updated with agenda + vorbereitung_erstellt=TRUE
```

---

## Node Count

| Path | Nodes |
|---|---|
| Path A (Inbox Monitor) | 37 nodes (including Anthropic model nodes A+B) |
| Path B (Termin-Vorbereitung) | 15 nodes (including Anthropic model node C) |
| **Total** | **~52 nodes** |

This is the most complex workflow in the project. Validate carefully in cycles.

---

## Validation Criteria

- [ ] All workflows validate via n8n-MCP `validate_workflow` — no errors
- [ ] No HTTP Request nodes where native nodes exist (1 HTTP Request for freebusy is justified — native Calendar node does not expose full freebusy response)
- [ ] All expressions use `={{ }}` wrapper
- [ ] Credentials set for all nodes requiring authentication
- [ ] Error handling configured on all external API nodes (`onError: "continueRegularOutput"`)
- [ ] SplitInBatches: Output 0 = done (to Set: Path Complete), Output 1 = loop (to processing chain)
- [ ] Loop-back connections: Set: Skip/Set: Email Processed/Set: Vorbereitung Done → SplitInBatches input
- [ ] Merge node connections: all three terminal nodes of termin branch → Merge input 0
- [ ] No deprecated patterns (`continueOnFail`, `$node[]`)
- [ ] typeVersions correct: Gmail 2.1, Sheets 4.7, Code 2, IF 2.2, Set 3.4, SplitInBatches 3, Merge 3.1
- [ ] Anthropic credential ID `5LmibcuA2kdHKaqB` on all three model nodes
- [ ] Gmail credential ID `yv1FhLRO54A8dyzi` on all Gmail nodes
- [ ] Google Calendar credential ID (verified) on Calendar node + HTTP Request freebusy
- [ ] Google Sheets credential ID `gw0DIdDENFkpE7ZW` on all Sheets nodes
- [ ] WF6 ID `HxOD2a8He72tvKmR` in both Execute Workflow nodes
- [ ] SALES_AGENT_SHEET_ID placeholder noted for user to replace
- [ ] Workflow name: "Sales Agent — WF7 Inbox & Calendar Manager"
- [ ] Deployed via `n8n_create_workflow` (new workflow, not update)
- [ ] Local JSON saved to `production/sales-agent/WF7-Inbox-Calendar-Manager.json`

---

*Plan created: 2026-03-08*
*Phase: 5 of 5*
*Status: Ready for execution*
