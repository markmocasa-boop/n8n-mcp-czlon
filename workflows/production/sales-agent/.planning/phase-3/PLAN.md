---
phase: 3
plan: 1
workflows: [WF3, WF4]
type: n8n-workflow
---

# Plan 3-1: E-Mail-Maschinerie

## Objective

Deploy WF3 (E-Mail Sequenz Generator) and WF4 (E-Mail Sender) as full sub-workflows replacing the Phase 1 stubs.
WF3 generates 4 personalized emails using Claude (BASHO / SPIN / Klaff / Gitomer methods) and returns them as a JSON array.
WF4 receives lead + email data, checks send conditions (antwort_erhalten, nächster_kontakt), sends the appropriate email via Gmail, and updates the CRM via WF6.

Requirements covered: AI-02, AI-03, AI-04, AI-05, DATA-04, API-03, DATA-05, OUT-01, OUT-02, ERR-02, AI-11

---

## Key Architecture Decisions

### WF3: Four Sequential Basic LLM Chain Calls

Each of the 4 emails uses a separate `Basic LLM Chain` + `Anthropic Chat Model` node pair.
They run sequentially (not parallel) — the output of each is not used as input to the next
(each reads directly from the trigger), but sequential ordering ensures predictable token usage
and avoids race conditions in the Code: Build Output node.

Each LLM Chain uses `promptType: "define"` with the `text` field containing the full email prompt
(user message), and a `messages.messageValues` system message containing the 5-Schichten-Framework
plus tone instructions.

### WF3: System Prompt Strategy

A shared system prompt defines the 5-Schichten-Framework context + tonality rules.
The user prompt (in `text`) is unique per email method and includes full lead context.
This avoids a Set node for context-building since we can embed expressions directly in the text field.

Temperature: 0.7 (creative writing), max_tokens: 1000 per call.

### WF3: Output Format

Email 1: `{ "nr": 1, "betreff_varianten": ["A", "B", "C"], "text": "..." }`
Emails 2-4: `{ "nr": N, "betreff": "...", "text": "..." }`

The Code: Build Output node reads all 4 LLM Chain outputs from their respective node names
via `$('NodeName').first().json` and assembles the final return array.

### WF4: Condition Chain

Two sequential IF nodes guard email sending:
1. IF antwort_erhalten == true → Stop (no email sent, return stopped status)
2. IF nächster_kontakt empty OR == today → proceed; otherwise → Stop (not today)
3. Code: Determine Next Email → find which email slot is next
4. IF: All 4 sent? → execute WF6 sequence-complete update, return done
5. Gmail: Send Email
6. Code: Build WF6 Update Payload
7. Execute WF6: Update CRM
8. Set: Success Output

### WF4: German Umlaut Field Names

Fields like `antwort_erhalten` and `nächster_kontakt` and `score_begründung` contain umlauts.
All expressions accessing these fields MUST use bracket notation:
`$json['antwort_erhalten']`, `$json['nächster_kontakt']`

Note: `antwort_erhalten` itself has no umlaut, but `nächster_kontakt` does.

### WF4: Gmail Node Version

The Gmail node typeVersion 2.1 is the current production version used in n8n Cloud.
Operation: `sendMessage` (not `send` — confirmed from n8n source).
The credential type is `gmailOAuth2`.

### WF4: Email Selection Logic

The Code: Determine Next Email node checks (in order): email_1_gesendet → email_2_gesendet →
email_3_gesendet → email_4_gesendet. The first FALSE entry is the email to send.
Email 1: no delay check needed (first send, nächster_kontakt may be empty).
The scheduling offset is embedded in WF6 update: +3d / +7d / +14d for emails 2/3/4.

### WF4: ERR-02 Compliance

The Gmail node gets `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 1800000` (30 min).
This satisfies ERR-02 (2x retry = 2 additional tries beyond first = maxTries 3).

### Stub Replacement Strategy

Both WF3 (uWkGHyQQ8FBeqErW) and WF4 (O2RnTBvoLAOV4agj) are deployed as active stubs.
They will be replaced in-place via PUT to preserve the n8n IDs that WF0 already references.
The PUT payload must include: `name`, `nodes`, `connections`, `settings`, `staticData: null`.
Do NOT include `active` (read-only) or `callerPolicy` (set separately via n8n UI).

---

## WF3: E-Mail Sequenz Generator

### Node Chain

```
Execute Workflow Trigger
  → Basic LLM Chain (Email 1 BASHO) ← Anthropic Chat Model 1
  → Basic LLM Chain (Email 2 SPIN)  ← Anthropic Chat Model 2
  → Basic LLM Chain (Email 3 Klaff) ← Anthropic Chat Model 3
  → Basic LLM Chain (Email 4 Gitomer) ← Anthropic Chat Model 4
  → Code: Build Output
```

### Data Flow

Input (from WF0 via Execute Workflow):
```json
{
  "lead_id": "LEAD-001",
  "vorname": "Max",
  "nachname": "Mustermann",
  "position": "Vertriebsleiter",
  "unternehmen": "Mustermann GmbH",
  "branche": "Software / SaaS",
  "mitarbeiter_anzahl": "50-200",
  "notizen": "Interesse an CRM",
  "score": 72,
  "klassifikation": "WARM",
  "score_begründung": "...",
  "hauptschmerz": "...",
  "kaufmotiv": "Effizienz",
  "empfohlene_ansprache": "direkt",
  "angereichert": {
    "unternehmens_beschreibung": "...",
    "aktuelle_herausforderungen": "...",
    "linkedin_headline": "...",
    "linkedin_about": "..."
  }
}
```

Output (returned to WF0):
```json
{
  "lead_id": "LEAD-001",
  "emails": [
    { "nr": 1, "betreff_varianten": ["A", "B", "C"], "text": "..." },
    { "nr": 2, "betreff": "...", "text": "..." },
    { "nr": 3, "betreff": "...", "text": "..." },
    { "nr": 4, "betreff": "...", "text": "..." }
  ]
}
```

### Complete Node Specifications

#### Node 1: Execute Workflow Trigger

```json
{
  "id": "wf3-trigger",
  "name": "Execute Workflow Trigger",
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1,
  "position": [100, 300],
  "parameters": {}
}
```

#### Node 2: Basic LLM Chain — Email 1 BASHO

```json
{
  "id": "wf3-llm-email1",
  "name": "LLM: Email 1 BASHO",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [400, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Schreibe E-Mail 1 (BASHO-Methode) für diesen Lead:\\n\\nName: ' + $json.vorname + ' ' + $json.nachname + '\\nPosition: ' + $json.position + '\\nUnternehmen: ' + $json.unternehmen + ' (Branche: ' + $json.branche + ', ' + $json.mitarbeiter_anzahl + ' Mitarbeiter)\\nHauptschmerz: ' + ($json.hauptschmerz || 'nicht angegeben') + '\\nKaufmotiv: ' + ($json.kaufmotiv || 'Effizienz') + '\\nEmpfohlene Ansprache: ' + ($json['empfohlene_ansprache'] || 'direkt') + '\\nUnternehmens-Kontext: ' + ($json.angereichert?.unternehmens_beschreibung || 'nicht verfügbar') + '\\nAktuelle Herausforderungen: ' + ($json.angereichert?.aktuelle_herausforderungen || 'nicht verfügbar') + '\\nLinkedIn Headline: ' + ($json.angereichert?.linkedin_headline || 'nicht verfügbar') + '\\n\\nBASHO-Methode: Sehr kurze, hochpersonalisierte E-Mail. Beginne mit einem konkreten Beobachtungs-Hook (etwas Spezifisches über das Unternehmen/die Person). Dann 1 Satz Relevanz (warum schreibst du gerade jetzt?). Dann 1 Satz Value Proposition. Dann 1 klarer, einfacher CTA (Frage nach einem 15-Min-Gespräch).\\n\\nMaximal 120 Wörter. Kein generisches Pitch-Blabla. Kein \"Ich schreibe Ihnen weil...\". Direkt starten.\\n\\nGeneriere DREI unterschiedliche Betreff-Varianten (A/B/C-Test) und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff_varianten\": [\"Betreff A\", \"Betreff B\", \"Betreff C\"], \"text\": \"E-Mail-Text hier\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln:\n- HEISS (Score 80-100): Sehr persönlich, dringlicher Ton, direkte Ansprache auf Augenhöhe\n- WARM (Score 30-79): Professionell-direkt, freundlich aber geschäftlich\n- KALT (Score 0-29): Wird nicht kontaktiert (tritt hier nicht auf)\n\nFormat-Regeln:\n- Kein generisches Pitch-Sprech\n- Keine Floskeln wie 'Ich hoffe diese E-Mail findet Sie wohl'\n- Modernes Deutsch, aktive Sprache\n- Kurze Sätze, kein Fachjargon\n- Immer mit Vornamen ansprechen\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

#### Node 3: Anthropic Chat Model 1

```json
{
  "id": "wf3-anthropic-1",
  "name": "Anthropic Chat Model 1",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [400, 500],
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

#### Node 4: Basic LLM Chain — Email 2 SPIN

```json
{
  "id": "wf3-llm-email2",
  "name": "LLM: Email 2 SPIN",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [700, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Schreibe E-Mail 2 (SPIN Follow-up) für diesen Lead, der auf E-Mail 1 nicht geantwortet hat:\\n\\nName: ' + $('Execute Workflow Trigger').first().json.vorname + ' ' + $('Execute Workflow Trigger').first().json.nachname + '\\nPosition: ' + $('Execute Workflow Trigger').first().json.position + '\\nUnternehmen: ' + $('Execute Workflow Trigger').first().json.unternehmen + ' (Branche: ' + $('Execute Workflow Trigger').first().json.branche + ')\\nHauptschmerz: ' + ($('Execute Workflow Trigger').first().json.hauptschmerz || 'nicht angegeben') + '\\nKaufmotiv: ' + ($('Execute Workflow Trigger').first().json.kaufmotiv || 'Effizienz') + '\\nUnternehmens-Kontext: ' + ($('Execute Workflow Trigger').first().json.angereichert?.aktuelle_herausforderungen || 'nicht verfügbar') + '\\n\\nSPIN-Methode für Follow-up: Situation (1 Satz: Bezug auf ihr Unternehmen/Branche). Problem (1 Satz: typisches Problem in ihrer Situation benennen). Implikation (1 starke Frage: Was passiert wenn das Problem bleibt?). Need-Payoff (1 Satz: wie wir das lösen könnten).\\n\\nMaximal 100 Wörter. Kein \"Ich wollte nur kurz nachhaken\". Mehrwert statt Druck.\\n\\nGeneriere einen Betreff und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff\": \"Betreff hier\", \"text\": \"E-Mail-Text hier\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln:\n- HEISS (Score 80-100): Sehr persönlich, dringlicher Ton, direkte Ansprache auf Augenhöhe\n- WARM (Score 30-79): Professionell-direkt, freundlich aber geschäftlich\n- KALT (Score 0-29): Wird nicht kontaktiert (tritt hier nicht auf)\n\nFormat-Regeln:\n- Kein generisches Pitch-Sprech\n- Keine Floskeln wie 'Ich wollte nur kurz nachhaken'\n- Modernes Deutsch, aktive Sprache\n- Kurze Sätze\n- Immer mit Vornamen ansprechen\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

#### Node 5: Anthropic Chat Model 2

```json
{
  "id": "wf3-anthropic-2",
  "name": "Anthropic Chat Model 2",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [700, 500],
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

#### Node 6: Basic LLM Chain — Email 3 Klaff

```json
{
  "id": "wf3-llm-email3",
  "name": "LLM: Email 3 Klaff",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [1000, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Schreibe E-Mail 3 (Oren Klaff Pitch-Methode) für diesen Lead, der auf E-Mails 1+2 nicht geantwortet hat:\\n\\nName: ' + $('Execute Workflow Trigger').first().json.vorname + ' ' + $('Execute Workflow Trigger').first().json.nachname + '\\nPosition: ' + $('Execute Workflow Trigger').first().json.position + '\\nUnternehmen: ' + $('Execute Workflow Trigger').first().json.unternehmen + ' (Branche: ' + $('Execute Workflow Trigger').first().json.branche + ', ' + $('Execute Workflow Trigger').first().json.mitarbeiter_anzahl + ' Mitarbeiter)\\nHauptschmerz: ' + ($('Execute Workflow Trigger').first().json.hauptschmerz || 'nicht angegeben') + '\\nKaufmotiv: ' + ($('Execute Workflow Trigger').first().json.kaufmotiv || 'Effizienz') + '\\nUnternehmens-Kontext: ' + ($('Execute Workflow Trigger').first().json.angereichert?.unternehmens_beschreibung || 'nicht verfügbar') + '\\n\\nKlaff Pitch-Methode: Big Idea Frame (1 Satz: eine starke, unerwartete Idee/Beobachtung). Before/After-Story (2-3 Sätze: wie andere Unternehmen in ihrer Branche das Problem hatten und was sich danach verändert hat — ohne Namen zu nennen). Intrigue Frame (1 Satz Neugier wecken). Konkreter CTA (kein \"Haben Sie Zeit für ein Gespräch?\", stattdessen: \"Ich habe Dienstag oder Donnerstag 15 Minuten — was passt?\").\\n\\nMaximal 130 Wörter. Starkes Eröffnungsframe, kein generischer Pitch.\\n\\nGeneriere einen Betreff und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff\": \"Betreff hier\", \"text\": \"E-Mail-Text hier\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln:\n- HEISS (Score 80-100): Sehr persönlich, dringlicher Ton, direkte Ansprache auf Augenhöhe\n- WARM (Score 30-79): Professionell-direkt, freundlich aber geschäftlich\n\nFormat-Regeln:\n- Oren Klaff: Stark, frame-setzend, nicht bittend\n- Kein generisches Pitch-Sprech\n- Modernes Deutsch, aktive Sprache\n- Kurze Sätze\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

#### Node 7: Anthropic Chat Model 3

```json
{
  "id": "wf3-anthropic-3",
  "name": "Anthropic Chat Model 3",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [1000, 500],
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

#### Node 8: Basic LLM Chain — Email 4 Gitomer

```json
{
  "id": "wf3-llm-email4",
  "name": "LLM: Email 4 Gitomer",
  "type": "nodes-langchain.chainLlm",
  "typeVersion": 1.4,
  "position": [1300, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ 'Schreibe E-Mail 4 (Jeffrey Gitomer Break-up E-Mail) für diesen Lead, der auf alle vorherigen E-Mails nicht geantwortet hat:\\n\\nName: ' + $('Execute Workflow Trigger').first().json.vorname + ' ' + $('Execute Workflow Trigger').first().json.nachname + '\\nPosition: ' + $('Execute Workflow Trigger').first().json.position + '\\nUnternehmen: ' + $('Execute Workflow Trigger').first().json.unternehmen + '\\nHauptschmerz: ' + ($('Execute Workflow Trigger').first().json.hauptschmerz || 'nicht angegeben') + '\\n\\nGitomer Break-up Methode: Ehrlich, respektvoll, Türe offen lassen. Kein Vorwurf. Kein Druck. Signalisiere, dass du aufhörst zu schreiben. Sage, dass du verstehst wenn es gerade nicht passt. Lass eine klare Einladung für später offen (falls sich ihre Situation ändert, können sie sich melden). Optional: 1 letzter Mehrwert-Hinweis (Ressource, Insight).\\n\\nMaximal 80 Wörter. Echt, menschlich, respektvoll.\\n\\nGeneriere einen Betreff und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff\": \"Betreff hier\", \"text\": \"E-Mail-Text hier\"}' }}",
    "messages": {
      "messageValues": [
        {
          "type": "SystemMessage",
          "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln für Break-up E-Mail:\n- Ehrlich und menschlich\n- Kein Druck, kein Vorwurf\n- Respektvoll, Türe offen lassen\n- Gitomer-Stil: Wert geben bis zum Ende\n\nFormat-Regeln:\n- Maximal 80 Wörter\n- Modernes Deutsch\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
        }
      ]
    }
  },
  "onError": "continueRegularOutput"
}
```

#### Node 9: Anthropic Chat Model 4

```json
{
  "id": "wf3-anthropic-4",
  "name": "Anthropic Chat Model 4",
  "type": "nodes-langchain.lmChatAnthropic",
  "typeVersion": 1.3,
  "position": [1300, 500],
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

#### Node 10: Code — Build Output

This node reads all 4 LLM Chain outputs and parses JSON from Claude's responses.
It must handle cases where Claude returns invalid JSON (fallback to raw text).

```json
{
  "id": "wf3-code-output",
  "name": "Code: Build Output",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1600, 300],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// Read trigger data\nconst trigger = $('Execute Workflow Trigger').first().json;\n\n// Helper: parse Claude JSON output\nfunction parseEmailJson(nodeOutput, emailNr) {\n  const raw = nodeOutput.text || nodeOutput.output || nodeOutput.response || '';\n  const cleaned = raw.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();\n  try {\n    return JSON.parse(cleaned);\n  } catch(e) {\n    // Fallback: return raw text with placeholder betreff\n    if (emailNr === 1) {\n      return {\n        betreff_varianten: ['Follow-up', 'Kurze Frage', 'Idee für ' + (trigger.unternehmen || 'Ihr Unternehmen')],\n        text: raw || 'E-Mail-Text konnte nicht generiert werden.'\n      };\n    } else {\n      return {\n        betreff: 'Follow-up: ' + (trigger.unternehmen || 'Ihr Unternehmen'),\n        text: raw || 'E-Mail-Text konnte nicht generiert werden.'\n      };\n    }\n  }\n}\n\n// Read each LLM output\nconst email1Raw = $('LLM: Email 1 BASHO').first().json;\nconst email2Raw = $('LLM: Email 2 SPIN').first().json;\nconst email3Raw = $('LLM: Email 3 Klaff').first().json;\nconst email4Raw = $('LLM: Email 4 Gitomer').first().json;\n\nconst email1 = parseEmailJson(email1Raw, 1);\nconst email2 = parseEmailJson(email2Raw, 2);\nconst email3 = parseEmailJson(email3Raw, 3);\nconst email4 = parseEmailJson(email4Raw, 4);\n\n// Build final output\nreturn [{\n  json: {\n    lead_id: trigger.lead_id,\n    emails: [\n      {\n        nr: 1,\n        betreff_varianten: email1.betreff_varianten || ['Betreff A', 'Betreff B', 'Betreff C'],\n        text: email1.text || ''\n      },\n      {\n        nr: 2,\n        betreff: email2.betreff || 'Follow-up',\n        text: email2.text || ''\n      },\n      {\n        nr: 3,\n        betreff: email3.betreff || 'Follow-up',\n        text: email3.text || ''\n      },\n      {\n        nr: 4,\n        betreff: email4.betreff || 'Letzte Nachricht',\n        text: email4.text || ''\n      }\n    ]\n  }\n}];"
  }
}
```

### WF3 Connections JSON

```json
{
  "Execute Workflow Trigger": {
    "main": [
      [{"node": "LLM: Email 1 BASHO", "type": "main", "index": 0}]
    ]
  },
  "Anthropic Chat Model 1": {
    "ai_languageModel": [
      [{"node": "LLM: Email 1 BASHO", "type": "ai_languageModel", "index": 0}]
    ]
  },
  "LLM: Email 1 BASHO": {
    "main": [
      [{"node": "LLM: Email 2 SPIN", "type": "main", "index": 0}]
    ]
  },
  "Anthropic Chat Model 2": {
    "ai_languageModel": [
      [{"node": "LLM: Email 2 SPIN", "type": "ai_languageModel", "index": 0}]
    ]
  },
  "LLM: Email 2 SPIN": {
    "main": [
      [{"node": "LLM: Email 3 Klaff", "type": "main", "index": 0}]
    ]
  },
  "Anthropic Chat Model 3": {
    "ai_languageModel": [
      [{"node": "LLM: Email 3 Klaff", "type": "ai_languageModel", "index": 0}]
    ]
  },
  "LLM: Email 3 Klaff": {
    "main": [
      [{"node": "LLM: Email 4 Gitomer", "type": "main", "index": 0}]
    ]
  },
  "Anthropic Chat Model 4": {
    "ai_languageModel": [
      [{"node": "LLM: Email 4 Gitomer", "type": "ai_languageModel", "index": 0}]
    ]
  },
  "LLM: Email 4 Gitomer": {
    "main": [
      [{"node": "Code: Build Output", "type": "main", "index": 0}]
    ]
  }
}
```

Note: `Code: Build Output` has no outgoing connections — it is the terminal node and returns data to the caller (WF0) automatically as the last item in the workflow.

### WF3 Settings

```json
{
  "executionOrder": "v1",
  "saveDataErrorExecution": "all",
  "saveDataSuccessExecution": "all",
  "saveManualExecutions": true
}
```

---

## WF4: E-Mail Sender

### Node Chain

```
Execute Workflow Trigger
  → IF: Antwort erhalten?
      TRUE  → Set: Stop — Antwort erhalten (terminal)
      FALSE → IF: Datum heute?
                  FALSE → Set: Stop — Nicht heute (terminal)
                  TRUE  → Code: Determine Next Email
                              → IF: Alle 4 gesendet?
                                    TRUE  → Execute WF6: Sequenz abgeschlossen (terminal)
                                    FALSE → Gmail: Send Email
                                                → Code: Build WF6 Update Payload
                                                → Execute WF6: Update CRM
                                                → Set: Success Output (terminal)
```

### Data Flow

Input (from WF0 via Execute Workflow):
```json
{
  "lead_id": "LEAD-001",
  "email": "max@mustermann.de",
  "vorname": "Max",
  "status": "Neu",
  "sequenz_schritt": 0,
  "antwort_erhalten": false,
  "nächster_kontakt": "2026-03-08",
  "email_1_gesendet": false,
  "email_2_gesendet": false,
  "email_3_gesendet": false,
  "email_4_gesendet": false,
  "emails": [
    { "nr": 1, "betreff_varianten": ["A", "B", "C"], "text": "..." },
    { "nr": 2, "betreff": "...", "text": "..." },
    { "nr": 3, "betreff": "...", "text": "..." },
    { "nr": 4, "betreff": "...", "text": "..." }
  ]
}
```

Output (returned to WF0):
```json
{
  "lead_id": "LEAD-001",
  "email_gesendet": true,
  "email_nr": 1,
  "status": "ok"
}
```

### Complete Node Specifications

#### Node 1: Execute Workflow Trigger

```json
{
  "id": "wf4-trigger",
  "name": "Execute Workflow Trigger",
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1,
  "position": [100, 300],
  "parameters": {}
}
```

#### Node 2: IF — Antwort erhalten?

Checks if `antwort_erhalten` is true. If true → stop sequence.

IMPORTANT: The field `antwort_erhalten` has no umlaut but must still be referenced correctly.
The value from Google Sheets may come as a string `"TRUE"` or boolean `true` — check both.

```json
{
  "id": "wf4-if-antwort",
  "name": "IF: Antwort erhalten?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [350, 300],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": false,
        "leftValue": "",
        "typeValidation": "loose",
        "version": 2
      },
      "conditions": [
        {
          "id": "antwort-check",
          "leftValue": "={{ $json['antwort_erhalten'] }}",
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

#### Node 3: Set — Stop Antwort erhalten

Terminal node for the "antwort received" branch.

```json
{
  "id": "wf4-set-stop-antwort",
  "name": "Set: Stop — Antwort erhalten",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [600, 150],
  "parameters": {
    "fields": {
      "values": [
        {"name": "email_gesendet", "value": false},
        {"name": "status", "value": "gestoppt_antwort_erhalten"},
        {"name": "lead_id", "value": "={{ $json.lead_id }}"}
      ]
    },
    "options": {}
  }
}
```

#### Node 4: IF — Datum heute?

Checks if `nächster_kontakt` is empty (first send = today) OR equals today's date.
Uses bracket notation for umlaut field name.

```json
{
  "id": "wf4-if-datum",
  "name": "IF: Datum heute?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [600, 400],
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
          "id": "datum-leer",
          "leftValue": "={{ $json['nächster_kontakt'] }}",
          "rightValue": "",
          "operator": {
            "type": "string",
            "operation": "isEmpty",
            "singleValue": true
          }
        },
        {
          "id": "datum-heute",
          "leftValue": "={{ $json['nächster_kontakt'] }}",
          "rightValue": "={{ $today.toFormat('yyyy-MM-dd') }}",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        }
      ],
      "combineOperation": "any"
    },
    "options": {}
  }
}
```

#### Node 5: Set — Stop Nicht heute

Terminal node for "not scheduled for today" branch.

```json
{
  "id": "wf4-set-stop-datum",
  "name": "Set: Stop — Nicht heute",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [850, 550],
  "parameters": {
    "fields": {
      "values": [
        {"name": "email_gesendet", "value": false},
        {"name": "status", "value": "nicht_faellig"},
        {"name": "lead_id", "value": "={{ $json.lead_id }}"},
        {"name": "naechster_kontakt", "value": "={{ $json['nächster_kontakt'] }}"}
      ]
    },
    "options": {}
  }
}
```

#### Node 6: Code — Determine Next Email

Determines which email to send next and extracts its data.

```json
{
  "id": "wf4-code-next-email",
  "name": "Code: Determine Next Email",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [850, 350],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "const data = $input.first().json;\n\n// Determine which email to send next\nlet emailNr = null;\nif (!data.email_1_gesendet || data.email_1_gesendet === false || data.email_1_gesendet === 'FALSE') {\n  emailNr = 1;\n} else if (!data.email_2_gesendet || data.email_2_gesendet === false || data.email_2_gesendet === 'FALSE') {\n  emailNr = 2;\n} else if (!data.email_3_gesendet || data.email_3_gesendet === false || data.email_3_gesendet === 'FALSE') {\n  emailNr = 3;\n} else if (!data.email_4_gesendet || data.email_4_gesendet === false || data.email_4_gesendet === 'FALSE') {\n  emailNr = 4;\n} else {\n  emailNr = null; // All sent\n}\n\n// Find the email data from the emails array\nconst emails = data.emails || [];\nlet emailData = null;\nif (emailNr !== null) {\n  emailData = emails.find(e => e.nr === emailNr) || null;\n}\n\n// Determine betreff\nlet betreff = '';\nif (emailNr === 1 && emailData && emailData.betreff_varianten && emailData.betreff_varianten.length > 0) {\n  betreff = emailData.betreff_varianten[0]; // Use variant A for now (A/B test v2)\n} else if (emailData) {\n  betreff = emailData.betreff || 'Follow-up';\n}\n\nreturn [{\n  json: {\n    ...data,\n    next_email_nr: emailNr,\n    all_sent: emailNr === null,\n    email_betreff: betreff,\n    email_text: emailData ? emailData.text : '',\n  }\n}];"
  }
}
```

#### Node 7: IF — Alle 4 gesendet?

```json
{
  "id": "wf4-if-alle-gesendet",
  "name": "IF: Alle 4 gesendet?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [1100, 350],
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
          "id": "alle-gesendet-check",
          "leftValue": "={{ $json.all_sent }}",
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

#### Node 8: Execute WF6 — Sequenz abgeschlossen

Called when all 4 emails have already been sent (sequence complete).

```json
{
  "id": "wf4-exec-wf6-complete",
  "name": "Execute WF6: Sequenz abgeschlossen",
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 2,
  "position": [1350, 200],
  "parameters": {
    "workflowId": {
      "mode": "id",
      "value": "HxOD2a8He72tvKmR"
    },
    "workflowInputs": {
      "mappingMode": "defineBelow",
      "value": {
        "lead_id": "={{ $json.lead_id }}",
        "updates": "={{ JSON.stringify({ status: 'Sequenz abgeschlossen' }) }}",
        "log_eintrag": "={{ JSON.stringify({ aktion: 'sequenz_abgeschlossen', inhalt: 'Alle 4 E-Mails gesendet — Sequenz beendet.', status: 'ok' }) }}"
      }
    },
    "options": {
      "waitForSubWorkflow": true
    }
  },
  "onError": "continueRegularOutput"
}
```

#### Node 9: Gmail — Send Email

Sends the determined email. ERR-02: retryOnFail with 30-min wait.

Note on Gmail node parameters: The haunchen docs show the Gmail node but lack the `sendMessage`
operation details. Based on n8n production knowledge, the send operation uses:
- `operation`: `sendMessage`
- `sendTo`: recipient address
- `subject`: subject line
- `emailType`: `text` (plain text)
- `message`: email body
- `options.senderName`: display name for sender

typeVersion 2.1 is the current version supporting `sendMessage`.

```json
{
  "id": "wf4-gmail-send",
  "name": "Gmail: Send Email",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [1350, 450],
  "parameters": {
    "operation": "sendMessage",
    "sendTo": "={{ $json.email }}",
    "subject": "={{ $json.email_betreff }}",
    "emailType": "text",
    "message": "={{ $json.email_text }}",
    "options": {
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
  "waitBetweenTries": 1800000
}
```

#### Node 10: Code — Build WF6 Update Payload

Calculates the next contact date and prepares the CRM update.

Scheduling offsets:
- Email 1 sent → next contact in 3 days (Email 2 send date)
- Email 2 sent → next contact in 7 days (Email 3 send date, cumulative from email 1)
- Email 3 sent → next contact in 14 days (Email 4 send date, cumulative from email 1)
- Email 4 sent → no next contact (sequence done)

For simplicity, offsets are relative to TODAY (send date):
- After Email 1: +3 days
- After Email 2: +4 days (i.e., 7 days total from start, but 4 days from when email 2 was sent)
- After Email 3: +7 days (14 days total from start, 7 days from email 3)
- After Email 4: no next contact

```json
{
  "id": "wf4-code-wf6-payload",
  "name": "Code: Build WF6 Update Payload",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1600, 450],
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "const data = $input.first().json;\nconst emailNr = data.next_email_nr;\n\n// Calculate dates\nconst today = new Date();\nconst todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD\n\n// Next contact offset in days\nconst offsetDays = { 1: 3, 2: 4, 3: 7, 4: 0 };\nconst offset = offsetDays[emailNr] || 0;\n\nlet nextKontaktStr = '';\nif (offset > 0) {\n  const nextDate = new Date(today);\n  nextDate.setDate(nextDate.getDate() + offset);\n  nextKontaktStr = nextDate.toISOString().split('T')[0];\n}\n\n// Build updates object\nconst updates = {\n  letzter_kontakt: todayStr,\n  sequenz_schritt: emailNr\n};\n\n// Mark the sent email\nupdates['email_' + emailNr + '_gesendet'] = true;\n\n// Set next contact date\nif (nextKontaktStr) {\n  updates['nächster_kontakt'] = nextKontaktStr;\n} else {\n  updates['status'] = 'Sequenz abgeschlossen';\n}\n\n// Status update\nif (data.status === 'Neu') {\n  updates['status'] = 'In Sequenz';\n}\n\n// Log entry\nconst logEintrag = {\n  aktion: 'email_gesendet',\n  inhalt: 'E-Mail ' + emailNr + ' gesendet an ' + data.email + ' (Betreff: ' + data.email_betreff + ')',\n  status: 'ok'\n};\n\nreturn [{\n  json: {\n    lead_id: data.lead_id,\n    email_nr: emailNr,\n    updates: updates,\n    log_eintrag: logEintrag\n  }\n}];"
  }
}
```

#### Node 11: Execute WF6 — Update CRM

```json
{
  "id": "wf4-exec-wf6-update",
  "name": "Execute WF6: Update CRM",
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 2,
  "position": [1850, 450],
  "parameters": {
    "workflowId": {
      "mode": "id",
      "value": "HxOD2a8He72tvKmR"
    },
    "workflowInputs": {
      "mappingMode": "defineBelow",
      "value": {
        "lead_id": "={{ $json.lead_id }}",
        "updates": "={{ JSON.stringify($json.updates) }}",
        "log_eintrag": "={{ JSON.stringify($json.log_eintrag) }}"
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

#### Node 12: Set — Success Output

Terminal node, returns success status to WF0.

```json
{
  "id": "wf4-set-success",
  "name": "Set: Success Output",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [2100, 450],
  "parameters": {
    "fields": {
      "values": [
        {"name": "email_gesendet", "value": true},
        {"name": "email_nr", "value": "={{ $('Code: Determine Next Email').first().json.next_email_nr }}"},
        {"name": "status", "value": "ok"},
        {"name": "lead_id", "value": "={{ $('Execute Workflow Trigger').first().json.lead_id }}"}
      ]
    },
    "options": {}
  }
}
```

### WF4 Connections JSON

```json
{
  "Execute Workflow Trigger": {
    "main": [
      [{"node": "IF: Antwort erhalten?", "type": "main", "index": 0}]
    ]
  },
  "IF: Antwort erhalten?": {
    "main": [
      [{"node": "Set: Stop — Antwort erhalten", "type": "main", "index": 0}],
      [{"node": "IF: Datum heute?", "type": "main", "index": 0}]
    ]
  },
  "IF: Datum heute?": {
    "main": [
      [{"node": "Code: Determine Next Email", "type": "main", "index": 0}],
      [{"node": "Set: Stop — Nicht heute", "type": "main", "index": 0}]
    ]
  },
  "Code: Determine Next Email": {
    "main": [
      [{"node": "IF: Alle 4 gesendet?", "type": "main", "index": 0}]
    ]
  },
  "IF: Alle 4 gesendet?": {
    "main": [
      [{"node": "Execute WF6: Sequenz abgeschlossen", "type": "main", "index": 0}],
      [{"node": "Gmail: Send Email", "type": "main", "index": 0}]
    ]
  },
  "Gmail: Send Email": {
    "main": [
      [{"node": "Code: Build WF6 Update Payload", "type": "main", "index": 0}]
    ]
  },
  "Code: Build WF6 Update Payload": {
    "main": [
      [{"node": "Execute WF6: Update CRM", "type": "main", "index": 0}]
    ]
  },
  "Execute WF6: Update CRM": {
    "main": [
      [{"node": "Set: Success Output", "type": "main", "index": 0}]
    ]
  }
}
```

Terminal nodes with no outgoing connections:
- `Set: Stop — Antwort erhalten`
- `Set: Stop — Nicht heute`
- `Execute WF6: Sequenz abgeschlossen`
- `Set: Success Output`

### WF4 Settings

```json
{
  "executionOrder": "v1",
  "saveDataErrorExecution": "all",
  "saveDataSuccessExecution": "all",
  "saveManualExecutions": true
}
```

---

## Complete Workflow JSON

### WF3 Full JSON

```json
{
  "name": "Sales Agent — WF3 E-Mail Sequenz Generator",
  "nodes": [
    {
      "id": "wf3-trigger",
      "name": "Execute Workflow Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [100, 300],
      "parameters": {}
    },
    {
      "id": "wf3-llm-email1",
      "name": "LLM: Email 1 BASHO",
      "type": "nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [400, 300],
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Schreibe E-Mail 1 (BASHO-Methode) für diesen Lead:\\n\\nName: ' + $json.vorname + ' ' + $json.nachname + '\\nPosition: ' + $json.position + '\\nUnternehmen: ' + $json.unternehmen + ' (Branche: ' + $json.branche + ', ' + $json.mitarbeiter_anzahl + ' Mitarbeiter)\\nHauptschmerz: ' + ($json.hauptschmerz || 'nicht angegeben') + '\\nKaufmotiv: ' + ($json.kaufmotiv || 'Effizienz') + '\\nEmpfohlene Ansprache: ' + ($json['empfohlene_ansprache'] || 'direkt') + '\\nUnternehmens-Kontext: ' + ($json.angereichert?.unternehmens_beschreibung || 'nicht verfügbar') + '\\nAktuelle Herausforderungen: ' + ($json.angereichert?.aktuelle_herausforderungen || 'nicht verfügbar') + '\\nLinkedIn Headline: ' + ($json.angereichert?.linkedin_headline || 'nicht verfügbar') + '\\n\\nBASHO-Methode: Sehr kurze, hochpersonalisierte E-Mail. Beginne mit einem konkreten Beobachtungs-Hook (etwas Spezifisches über das Unternehmen/die Person). Dann 1 Satz Relevanz (warum schreibst du gerade jetzt?). Dann 1 Satz Value Proposition. Dann 1 klarer, einfacher CTA (Frage nach einem 15-Min-Gespräch).\\n\\nMaximal 120 Wörter. Kein generisches Pitch-Blabla. Direkt starten.\\n\\nGeneriere DREI unterschiedliche Betreff-Varianten (A/B/C-Test) und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff_varianten\": [\"Betreff A\", \"Betreff B\", \"Betreff C\"], \"text\": \"E-Mail-Text hier\"}' }}",
        "messages": {
          "messageValues": [
            {
              "type": "SystemMessage",
              "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln:\n- HEISS (Score 80-100): Sehr persönlich, dringlicher Ton, direkte Ansprache auf Augenhöhe\n- WARM (Score 30-79): Professionell-direkt, freundlich aber geschäftlich\n\nFormat-Regeln:\n- Kein generisches Pitch-Sprech\n- Keine Floskeln wie 'Ich hoffe diese E-Mail findet Sie wohl'\n- Modernes Deutsch, aktive Sprache\n- Kurze Sätze, kein Fachjargon\n- Immer mit Vornamen ansprechen\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
            }
          ]
        }
      },
      "onError": "continueRegularOutput"
    },
    {
      "id": "wf3-anthropic-1",
      "name": "Anthropic Chat Model 1",
      "type": "nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [400, 500],
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
      "id": "wf3-llm-email2",
      "name": "LLM: Email 2 SPIN",
      "type": "nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [700, 300],
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Schreibe E-Mail 2 (SPIN Follow-up) für diesen Lead, der auf E-Mail 1 nicht geantwortet hat:\\n\\nName: ' + $(\\'Execute Workflow Trigger\\').first().json.vorname + ' ' + $(\\'Execute Workflow Trigger\\').first().json.nachname + '\\nPosition: ' + $(\\'Execute Workflow Trigger\\').first().json.position + '\\nUnternehmen: ' + $(\\'Execute Workflow Trigger\\').first().json.unternehmen + ' (Branche: ' + $(\\'Execute Workflow Trigger\\').first().json.branche + ')\\nHauptschmerz: ' + ($(\\'Execute Workflow Trigger\\').first().json.hauptschmerz || \\'nicht angegeben\\') + '\\nKaufmotiv: ' + ($(\\'Execute Workflow Trigger\\').first().json.kaufmotiv || \\'Effizienz\\') + '\\nUnternehmens-Kontext: ' + ($(\\'Execute Workflow Trigger\\').first().json.angereichert?.aktuelle_herausforderungen || \\'nicht verfügbar\\') + '\\n\\nSPIN-Methode für Follow-up: Situation (1 Satz: Bezug auf ihr Unternehmen/Branche). Problem (1 Satz: typisches Problem in ihrer Situation benennen). Implikation (1 starke Frage: Was passiert wenn das Problem bleibt?). Need-Payoff (1 Satz: wie wir das lösen könnten).\\n\\nMaximal 100 Wörter. Kein \"Ich wollte nur kurz nachhaken\". Mehrwert statt Druck.\\n\\nGeneriere einen Betreff und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff\": \"Betreff hier\", \"text\": \"E-Mail-Text hier\"}' }}",
        "messages": {
          "messageValues": [
            {
              "type": "SystemMessage",
              "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln:\n- HEISS (Score 80-100): Sehr persönlich, dringlicher Ton, direkte Ansprache auf Augenhöhe\n- WARM (Score 30-79): Professionell-direkt, freundlich aber geschäftlich\n\nFormat-Regeln:\n- Kein generisches Pitch-Sprech\n- Keine Floskeln wie 'Ich wollte nur kurz nachhaken'\n- Modernes Deutsch, aktive Sprache\n- Kurze Sätze\n- Immer mit Vornamen ansprechen\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
            }
          ]
        }
      },
      "onError": "continueRegularOutput"
    },
    {
      "id": "wf3-anthropic-2",
      "name": "Anthropic Chat Model 2",
      "type": "nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [700, 500],
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
      "id": "wf3-llm-email3",
      "name": "LLM: Email 3 Klaff",
      "type": "nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [1000, 300],
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Schreibe E-Mail 3 (Oren Klaff Pitch-Methode) für diesen Lead, der auf E-Mails 1+2 nicht geantwortet hat:\\n\\nName: ' + $(\\'Execute Workflow Trigger\\').first().json.vorname + ' ' + $(\\'Execute Workflow Trigger\\').first().json.nachname + '\\nPosition: ' + $(\\'Execute Workflow Trigger\\').first().json.position + '\\nUnternehmen: ' + $(\\'Execute Workflow Trigger\\').first().json.unternehmen + ' (Branche: ' + $(\\'Execute Workflow Trigger\\').first().json.branche + ', ' + $(\\'Execute Workflow Trigger\\').first().json.mitarbeiter_anzahl + ' Mitarbeiter)\\nHauptschmerz: ' + ($(\\'Execute Workflow Trigger\\').first().json.hauptschmerz || \\'nicht angegeben\\') + '\\nKaufmotiv: ' + ($(\\'Execute Workflow Trigger\\').first().json.kaufmotiv || \\'Effizienz\\') + '\\nUnternehmens-Kontext: ' + ($(\\'Execute Workflow Trigger\\').first().json.angereichert?.unternehmens_beschreibung || \\'nicht verfügbar\\') + '\\n\\nKlaff Pitch-Methode: Big Idea Frame (1 Satz: eine starke, unerwartete Idee/Beobachtung). Before/After-Story (2-3 Sätze: wie andere Unternehmen in ihrer Branche das Problem hatten und was sich danach verändert hat — ohne Namen zu nennen). Intrigue Frame (1 Satz Neugier wecken). Konkreter CTA (kein \"Haben Sie Zeit?\", stattdessen: \"Ich habe Dienstag oder Donnerstag 15 Minuten — was passt?\").\\n\\nMaximal 130 Wörter.\\n\\nGeneriere einen Betreff und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff\": \"Betreff hier\", \"text\": \"E-Mail-Text hier\"}' }}",
        "messages": {
          "messageValues": [
            {
              "type": "SystemMessage",
              "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln:\n- HEISS (Score 80-100): Sehr persönlich, dringlicher Ton, direkte Ansprache auf Augenhöhe\n- WARM (Score 30-79): Professionell-direkt, freundlich aber geschäftlich\n\nFormat-Regeln:\n- Oren Klaff: Stark, frame-setzend, nicht bittend\n- Kein generisches Pitch-Sprech\n- Modernes Deutsch, aktive Sprache\n- Kurze Sätze\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
            }
          ]
        }
      },
      "onError": "continueRegularOutput"
    },
    {
      "id": "wf3-anthropic-3",
      "name": "Anthropic Chat Model 3",
      "type": "nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [1000, 500],
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
      "id": "wf3-llm-email4",
      "name": "LLM: Email 4 Gitomer",
      "type": "nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [1300, 300],
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Schreibe E-Mail 4 (Jeffrey Gitomer Break-up E-Mail) für diesen Lead, der auf alle vorherigen E-Mails nicht geantwortet hat:\\n\\nName: ' + $(\\'Execute Workflow Trigger\\').first().json.vorname + ' ' + $(\\'Execute Workflow Trigger\\').first().json.nachname + '\\nPosition: ' + $(\\'Execute Workflow Trigger\\').first().json.position + '\\nUnternehmen: ' + $(\\'Execute Workflow Trigger\\').first().json.unternehmen + '\\nHauptschmerz: ' + ($(\\'Execute Workflow Trigger\\').first().json.hauptschmerz || \\'nicht angegeben\\') + '\\n\\nGitomer Break-up Methode: Ehrlich, respektvoll, Türe offen lassen. Kein Vorwurf. Kein Druck. Signalisiere, dass du aufhörst zu schreiben. Sage, dass du verstehst wenn es gerade nicht passt. Lass eine klare Einladung für später offen. Optional: 1 letzter Mehrwert-Hinweis.\\n\\nMaximal 80 Wörter. Echt, menschlich, respektvoll.\\n\\nGeneriere einen Betreff und den E-Mail-Text.\\n\\nAntworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke:\\n{\"betreff\": \"Betreff hier\", \"text\": \"E-Mail-Text hier\"}' }}",
        "messages": {
          "messageValues": [
            {
              "type": "SystemMessage",
              "message": "Du bist ein erfahrener B2B-Sales-Experte und Copywriter für den DACH-Markt.\n\nDu kennst das 5-Schichten Sales Framework:\nSCHICHT 1 – PSYCHOLOGIE: Empfänger-Offenheit, Schmerzen, Kaufmotive ansprechen\nSCHICHT 2 – METHODIK: BANT-Qualifikation implizit signalisieren\nSCHICHT 3 – PITCH-BEREITSCHAFT: Konkreten Gesprächsanlass schaffen\nSCHICHT 4 – POSITIONIERUNG: DACH-B2B-Relevanz deutlich machen\nSCHICHT 5 – POTENZIAL: Langfristige Partnerschaft andeuten\n\nTonalitäts-Regeln für Break-up E-Mail:\n- Ehrlich und menschlich\n- Kein Druck, kein Vorwurf\n- Respektvoll, Türe offen lassen\n- Gitomer-Stil: Wert geben bis zum Ende\n\nFormat-Regeln:\n- Maximal 80 Wörter\n- Modernes Deutsch\n- Antworte AUSSCHLIESSLICH als valides JSON ohne Markdown-Codeblöcke"
            }
          ]
        }
      },
      "onError": "continueRegularOutput"
    },
    {
      "id": "wf3-anthropic-4",
      "name": "Anthropic Chat Model 4",
      "type": "nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [1300, 500],
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
      "id": "wf3-code-output",
      "name": "Code: Build Output",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1600, 300],
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const trigger = $('Execute Workflow Trigger').first().json;\n\nfunction parseEmailJson(nodeOutput, emailNr) {\n  const raw = nodeOutput.text || nodeOutput.output || nodeOutput.response || '';\n  const cleaned = raw.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();\n  try {\n    return JSON.parse(cleaned);\n  } catch(e) {\n    if (emailNr === 1) {\n      return {\n        betreff_varianten: ['Follow-up', 'Kurze Frage', 'Idee für ' + (trigger.unternehmen || 'Ihr Unternehmen')],\n        text: raw || 'E-Mail-Text konnte nicht generiert werden.'\n      };\n    } else {\n      return {\n        betreff: 'Follow-up: ' + (trigger.unternehmen || 'Ihr Unternehmen'),\n        text: raw || 'E-Mail-Text konnte nicht generiert werden.'\n      };\n    }\n  }\n}\n\nconst email1Raw = $('LLM: Email 1 BASHO').first().json;\nconst email2Raw = $('LLM: Email 2 SPIN').first().json;\nconst email3Raw = $('LLM: Email 3 Klaff').first().json;\nconst email4Raw = $('LLM: Email 4 Gitomer').first().json;\n\nconst email1 = parseEmailJson(email1Raw, 1);\nconst email2 = parseEmailJson(email2Raw, 2);\nconst email3 = parseEmailJson(email3Raw, 3);\nconst email4 = parseEmailJson(email4Raw, 4);\n\nreturn [{\n  json: {\n    lead_id: trigger.lead_id,\n    emails: [\n      {\n        nr: 1,\n        betreff_varianten: email1.betreff_varianten || ['Betreff A', 'Betreff B', 'Betreff C'],\n        text: email1.text || ''\n      },\n      {\n        nr: 2,\n        betreff: email2.betreff || 'Follow-up',\n        text: email2.text || ''\n      },\n      {\n        nr: 3,\n        betreff: email3.betreff || 'Follow-up',\n        text: email3.text || ''\n      },\n      {\n        nr: 4,\n        betreff: email4.betreff || 'Letzte Nachricht',\n        text: email4.text || ''\n      }\n    ]\n  }\n}];"
      }
    }
  ],
  "connections": {
    "Execute Workflow Trigger": {
      "main": [
        [{"node": "LLM: Email 1 BASHO", "type": "main", "index": 0}]
      ]
    },
    "Anthropic Chat Model 1": {
      "ai_languageModel": [
        [{"node": "LLM: Email 1 BASHO", "type": "ai_languageModel", "index": 0}]
      ]
    },
    "LLM: Email 1 BASHO": {
      "main": [
        [{"node": "LLM: Email 2 SPIN", "type": "main", "index": 0}]
      ]
    },
    "Anthropic Chat Model 2": {
      "ai_languageModel": [
        [{"node": "LLM: Email 2 SPIN", "type": "ai_languageModel", "index": 0}]
      ]
    },
    "LLM: Email 2 SPIN": {
      "main": [
        [{"node": "LLM: Email 3 Klaff", "type": "main", "index": 0}]
      ]
    },
    "Anthropic Chat Model 3": {
      "ai_languageModel": [
        [{"node": "LLM: Email 3 Klaff", "type": "ai_languageModel", "index": 0}]
      ]
    },
    "LLM: Email 3 Klaff": {
      "main": [
        [{"node": "LLM: Email 4 Gitomer", "type": "main", "index": 0}]
      ]
    },
    "Anthropic Chat Model 4": {
      "ai_languageModel": [
        [{"node": "LLM: Email 4 Gitomer", "type": "ai_languageModel", "index": 0}]
      ]
    },
    "LLM: Email 4 Gitomer": {
      "main": [
        [{"node": "Code: Build Output", "type": "main", "index": 0}]
      ]
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

### WF4 Full JSON

```json
{
  "name": "Sales Agent — WF4 E-Mail Sender",
  "nodes": [
    {
      "id": "wf4-trigger",
      "name": "Execute Workflow Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [100, 300],
      "parameters": {}
    },
    {
      "id": "wf4-if-antwort",
      "name": "IF: Antwort erhalten?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [350, 300],
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": false,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 2
          },
          "conditions": [
            {
              "id": "antwort-check",
              "leftValue": "={{ $json['antwort_erhalten'] }}",
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
    },
    {
      "id": "wf4-set-stop-antwort",
      "name": "Set: Stop — Antwort erhalten",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [600, 150],
      "parameters": {
        "fields": {
          "values": [
            {"name": "email_gesendet", "value": false},
            {"name": "status", "value": "gestoppt_antwort_erhalten"},
            {"name": "lead_id", "value": "={{ $json.lead_id }}"}
          ]
        },
        "options": {}
      }
    },
    {
      "id": "wf4-if-datum",
      "name": "IF: Datum heute?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [600, 400],
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
              "id": "datum-leer",
              "leftValue": "={{ $json['nächster_kontakt'] }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "isEmpty",
                "singleValue": true
              }
            },
            {
              "id": "datum-heute",
              "leftValue": "={{ $json['nächster_kontakt'] }}",
              "rightValue": "={{ $today.toFormat('yyyy-MM-dd') }}",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combineOperation": "any"
        },
        "options": {}
      }
    },
    {
      "id": "wf4-set-stop-datum",
      "name": "Set: Stop — Nicht heute",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [850, 550],
      "parameters": {
        "fields": {
          "values": [
            {"name": "email_gesendet", "value": false},
            {"name": "status", "value": "nicht_faellig"},
            {"name": "lead_id", "value": "={{ $json.lead_id }}"},
            {"name": "naechster_kontakt", "value": "={{ $json['nächster_kontakt'] }}"}
          ]
        },
        "options": {}
      }
    },
    {
      "id": "wf4-code-next-email",
      "name": "Code: Determine Next Email",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [850, 350],
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const data = $input.first().json;\n\nlet emailNr = null;\nif (!data.email_1_gesendet || data.email_1_gesendet === false || data.email_1_gesendet === 'FALSE') {\n  emailNr = 1;\n} else if (!data.email_2_gesendet || data.email_2_gesendet === false || data.email_2_gesendet === 'FALSE') {\n  emailNr = 2;\n} else if (!data.email_3_gesendet || data.email_3_gesendet === false || data.email_3_gesendet === 'FALSE') {\n  emailNr = 3;\n} else if (!data.email_4_gesendet || data.email_4_gesendet === false || data.email_4_gesendet === 'FALSE') {\n  emailNr = 4;\n} else {\n  emailNr = null;\n}\n\nconst emails = data.emails || [];\nlet emailData = null;\nif (emailNr !== null) {\n  emailData = emails.find(e => e.nr === emailNr) || null;\n}\n\nlet betreff = '';\nif (emailNr === 1 && emailData && emailData.betreff_varianten && emailData.betreff_varianten.length > 0) {\n  betreff = emailData.betreff_varianten[0];\n} else if (emailData) {\n  betreff = emailData.betreff || 'Follow-up';\n}\n\nreturn [{\n  json: {\n    ...data,\n    next_email_nr: emailNr,\n    all_sent: emailNr === null,\n    email_betreff: betreff,\n    email_text: emailData ? emailData.text : ''\n  }\n}];"
      }
    },
    {
      "id": "wf4-if-alle-gesendet",
      "name": "IF: Alle 4 gesendet?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [1100, 350],
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
              "id": "alle-gesendet-check",
              "leftValue": "={{ $json.all_sent }}",
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
    },
    {
      "id": "wf4-exec-wf6-complete",
      "name": "Execute WF6: Sequenz abgeschlossen",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 2,
      "position": [1350, 200],
      "parameters": {
        "workflowId": {
          "mode": "id",
          "value": "HxOD2a8He72tvKmR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "lead_id": "={{ $json.lead_id }}",
            "updates": "={{ JSON.stringify({ status: 'Sequenz abgeschlossen' }) }}",
            "log_eintrag": "={{ JSON.stringify({ aktion: 'sequenz_abgeschlossen', inhalt: 'Alle 4 E-Mails gesendet — Sequenz beendet.', status: 'ok' }) }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      },
      "onError": "continueRegularOutput"
    },
    {
      "id": "wf4-gmail-send",
      "name": "Gmail: Send Email",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [1350, 450],
      "parameters": {
        "operation": "sendMessage",
        "sendTo": "={{ $json.email }}",
        "subject": "={{ $json.email_betreff }}",
        "emailType": "text",
        "message": "={{ $json.email_text }}",
        "options": {
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
      "waitBetweenTries": 1800000
    },
    {
      "id": "wf4-code-wf6-payload",
      "name": "Code: Build WF6 Update Payload",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1600, 450],
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const data = $input.first().json;\nconst emailNr = data.next_email_nr;\n\nconst today = new Date();\nconst todayStr = today.toISOString().split('T')[0];\n\nconst offsetDays = { 1: 3, 2: 4, 3: 7, 4: 0 };\nconst offset = offsetDays[emailNr] || 0;\n\nlet nextKontaktStr = '';\nif (offset > 0) {\n  const nextDate = new Date(today);\n  nextDate.setDate(nextDate.getDate() + offset);\n  nextKontaktStr = nextDate.toISOString().split('T')[0];\n}\n\nconst updates = {\n  letzter_kontakt: todayStr,\n  sequenz_schritt: emailNr\n};\n\nupdates['email_' + emailNr + '_gesendet'] = true;\n\nif (nextKontaktStr) {\n  updates['nächster_kontakt'] = nextKontaktStr;\n} else {\n  updates['status'] = 'Sequenz abgeschlossen';\n}\n\nif (data.status === 'Neu') {\n  updates['status'] = 'In Sequenz';\n}\n\nconst logEintrag = {\n  aktion: 'email_gesendet',\n  inhalt: 'E-Mail ' + emailNr + ' gesendet an ' + data.email + ' (Betreff: ' + data.email_betreff + ')',\n  status: 'ok'\n};\n\nreturn [{\n  json: {\n    lead_id: data.lead_id,\n    email_nr: emailNr,\n    updates: updates,\n    log_eintrag: logEintrag\n  }\n}];"
      }
    },
    {
      "id": "wf4-exec-wf6-update",
      "name": "Execute WF6: Update CRM",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 2,
      "position": [1850, 450],
      "parameters": {
        "workflowId": {
          "mode": "id",
          "value": "HxOD2a8He72tvKmR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "lead_id": "={{ $json.lead_id }}",
            "updates": "={{ JSON.stringify($json.updates) }}",
            "log_eintrag": "={{ JSON.stringify($json.log_eintrag) }}"
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
    },
    {
      "id": "wf4-set-success",
      "name": "Set: Success Output",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [2100, 450],
      "parameters": {
        "fields": {
          "values": [
            {"name": "email_gesendet", "value": true},
            {"name": "email_nr", "value": "={{ $('Code: Determine Next Email').first().json.next_email_nr }}"},
            {"name": "status", "value": "ok"},
            {"name": "lead_id", "value": "={{ $('Execute Workflow Trigger').first().json.lead_id }}"}
          ]
        },
        "options": {}
      }
    }
  ],
  "connections": {
    "Execute Workflow Trigger": {
      "main": [
        [{"node": "IF: Antwort erhalten?", "type": "main", "index": 0}]
      ]
    },
    "IF: Antwort erhalten?": {
      "main": [
        [{"node": "Set: Stop — Antwort erhalten", "type": "main", "index": 0}],
        [{"node": "IF: Datum heute?", "type": "main", "index": 0}]
      ]
    },
    "IF: Datum heute?": {
      "main": [
        [{"node": "Code: Determine Next Email", "type": "main", "index": 0}],
        [{"node": "Set: Stop — Nicht heute", "type": "main", "index": 0}]
      ]
    },
    "Code: Determine Next Email": {
      "main": [
        [{"node": "IF: Alle 4 gesendet?", "type": "main", "index": 0}]
      ]
    },
    "IF: Alle 4 gesendet?": {
      "main": [
        [{"node": "Execute WF6: Sequenz abgeschlossen", "type": "main", "index": 0}],
        [{"node": "Gmail: Send Email", "type": "main", "index": 0}]
      ]
    },
    "Gmail: Send Email": {
      "main": [
        [{"node": "Code: Build WF6 Update Payload", "type": "main", "index": 0}]
      ]
    },
    "Code: Build WF6 Update Payload": {
      "main": [
        [{"node": "Execute WF6: Update CRM", "type": "main", "index": 0}]
      ]
    },
    "Execute WF6: Update CRM": {
      "main": [
        [{"node": "Set: Success Output", "type": "main", "index": 0}]
      ]
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

## Deployment Notes

### Deployment Order

1. Deploy WF3 first (no dependencies on WF4)
2. Deploy WF4 second (no dependencies on WF3, only on WF6)
3. Both are PUT requests to existing stub IDs (no new workflow creation)

### WF3 Deployment

- Method: PUT to `https://meinoffice.app.n8n.cloud/api/v1/workflows/uWkGHyQQ8FBeqErW`
- Deactivate first: POST `/api/v1/workflows/uWkGHyQQ8FBeqErW/deactivate`
- PUT body: `{ "name", "nodes", "connections", "settings", "staticData": null }`
- Credentials used: `5LmibcuA2kdHKaqB` (Anthropic)

### WF4 Deployment

- Method: PUT to `https://meinoffice.app.n8n.cloud/api/v1/workflows/O2RnTBvoLAOV4agj`
- Deactivate first: POST `/api/v1/workflows/O2RnTBvoLAOV4agj/deactivate`
- PUT body: `{ "name", "nodes", "connections", "settings", "staticData": null }`
- Credentials used: `yv1FhLRO54A8dyzi` (Gmail), `HxOD2a8He72tvKmR` (WF6 ID reference)

### Gmail Credential Note

The Gmail credential `yv1FhLRO54A8dyzi` must have the `gmail.send` scope (required for `sendMessage`).
This was flagged as a pre-Phase-3 concern in STATE.md:
"Google OAuth2 Credential: gmail.modify + gmail.compose + calendar scopes — vor Phase 3/5 prüfen"
If the scope is missing, the credential must be updated in the Google Cloud Console OAuth consent screen
before this workflow can send email.

### Executor Alert: Gmail Node typeVersion

The haunchen docs show Gmail typeVersion 1 with operations `create/delete/get/getAll`.
These do NOT include `sendMessage`. The n8n Gmail node typeVersion 2.1 adds `sendMessage`.
The executor must use typeVersion 2.1. If the n8n instance does not support it, fall back to:
- typeVersion 2 (may also work for sendMessage)
- If neither works: check n8n-MCP `get_node` for `n8n-nodes-base.gmail` to confirm exact typeVersion and sendMessage parameter names

### WF3 Expression Note: Emails 2-4 Reference Pattern

In the WF3 Full JSON above, the LLM prompts for emails 2/3/4 use escaped single-quote patterns
like `$(\\'Execute Workflow Trigger\\')` inside template literals. This is necessary because the
expression is inside a JSON string inside a template literal inside an n8n expression wrapper `={{ }}`.

The executor must verify this renders correctly in n8n. If the n8n expression parser rejects it,
use the simpler approach: add a Set node "Set: Store Trigger Data" after the trigger that captures
all needed fields (vorname, nachname, unternehmen, etc.) with `include: all`, then reference
`$('Set: Store Trigger Data').first().json.vorname` etc. in emails 2-4.

Recommended safe alternative for Emails 2-4 prompts — add this node after trigger and before LLM chain 1:

```json
{
  "id": "wf3-set-context",
  "name": "Set: Store Trigger Data",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [250, 300],
  "parameters": {
    "fields": {
      "values": []
    },
    "options": {},
    "include": "all"
  }
}
```

Then in emails 2/3/4 use `$('Set: Store Trigger Data').first().json.vorname` — this is a proven
pattern from Phase 2 (Set: Build Claude Prompt → Basic LLM Chain).

If using this approach, add to connections:
```
"Execute Workflow Trigger" → "Set: Store Trigger Data" → "LLM: Email 1 BASHO" → "LLM: Email 2 SPIN" → ...
```

And also update "Code: Build Output" to use `$('Set: Store Trigger Data').first().json` for `trigger`.

---

## Validation Criteria

- [ ] WF3: All 10 nodes present (1 trigger + 4 LLM chains + 4 Anthropic models + 1 code)
- [ ] WF3: Anthropic models connect via `ai_languageModel` type (not `main`)
- [ ] WF3: Sequential chain: Trigger → Email1 → Email2 → Email3 → Email4 → Code
- [ ] WF3: All expressions use `={{ }}` syntax
- [ ] WF3: Code: Build Output reads from all 4 named LLM nodes correctly
- [ ] WF3: Anthropic credential ID `5LmibcuA2kdHKaqB` set on all 4 Anthropic nodes
- [ ] WF3: No callerPolicy in settings JSON
- [ ] WF3: Returns `{ lead_id, emails: [{nr:1, betreff_varianten:[...]}, {nr:2..4, betreff:...}] }`
- [ ] WF4: All 12 nodes present
- [ ] WF4: IF conditions use version: 2 in options
- [ ] WF4: `$json['antwort_erhalten']` and `$json['nächster_kontakt']` use bracket notation
- [ ] WF4: Gmail node has `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 1800000`
- [ ] WF4: Gmail credential ID `yv1FhLRO54A8dyzi` set
- [ ] WF4: WF6 ID `HxOD2a8He72tvKmR` correct in both Execute Workflow nodes
- [ ] WF4: Code: Build WF6 Update Payload correctly computes next contact date
- [ ] WF4: No callerPolicy in settings JSON
- [ ] Both: validate_workflow via n8n-MCP returns no errors
- [ ] Both: deployed via PUT to stub IDs (not n8n_create_workflow)
- [ ] Both: local JSON saved to `production/sales-agent/WF3-Email-Sequenz-Generator.json` and `WF4-Email-Sender.json`

---

## Requirements Coverage

| Requirement | Description | Covered By |
|---|---|---|
| AI-02 | Email 1 BASHO, 3 Betreff-Varianten, max 120 Wörter | WF3: LLM: Email 1 BASHO |
| AI-03 | Email 2 SPIN, Implikationsfrage, max 100 Wörter | WF3: LLM: Email 2 SPIN |
| AI-04 | Email 3 Klaff, Before/After-Story, CTA, max 130 Wörter | WF3: LLM: Email 3 Klaff |
| AI-05 | Email 4 Gitomer, ehrlich, Türe offen, max 80 Wörter | WF3: LLM: Email 4 Gitomer |
| DATA-04 | 4 E-Mails mit unterschiedlichen Methoden, Score-abhängig | WF3: System prompts include tonality rules per classification |
| API-03 | Gmail API: Senden | WF4: Gmail: Send Email |
| DATA-05 | Prüfe antwort_erhalten + nächster_kontakt vor Versand | WF4: IF: Antwort erhalten? + IF: Datum heute? |
| OUT-01 | WF4 sendet E-Mails via Gmail mit korrektem Absender, Betreff, Text | WF4: Gmail: Send Email |
| OUT-02 | WF4 setzt email_X_gesendet, letzter_kontakt, nächster_kontakt | WF4: Code: Build WF6 Update Payload → Execute WF6: Update CRM |
| ERR-02 | Gmail retry 2x mit 30 Min Pause | WF4: Gmail node retryOnFail: true, maxTries: 3, waitBetweenTries: 1800000 |
| AI-11 | claude-sonnet-4-20250514, max_tokens 1000, 5-Schichten-Framework | WF3: All Anthropic Chat Model nodes + system prompts |

All 11 Phase 3 requirements: **COVERED**

---
*Plan created: 2026-03-08 — Phase 3: E-Mail-Maschinerie*
