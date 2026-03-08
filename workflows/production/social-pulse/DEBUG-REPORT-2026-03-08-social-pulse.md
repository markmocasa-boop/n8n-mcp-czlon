# n8n Debug Report — SocialPulse "Franka" — Alle 7 Workflows

**Datum:** 2026-03-08
**Scope:** Vollständiger Workflow-Baum (7 Workflows, 163 Nodes)
**Methode:** Statische JSON-Analyse + Validierungs-Regelwerk (5 Passes pro Workflow)

---

## Executive Summary

| Metrik | Anzahl | Schwere |
|---|---|---|
| CRITICAL — Muss vor erstem Run behoben werden | 13 | CRITICAL |
| HIGH — Behebt Produktionsfehler | 6 | HIGH |
| MEDIUM — Best Practice / Robustheit | 7 | MEDIUM |
| LOW — Optional | 5 | LOW |
| HTTP Nodes: Ersetzbar | 1 | MEDIUM |
| HTTP Nodes: Muss bleiben | 22 | INFO |
| Falsch-Positiv-Warnungen | 13 | -- |

**Gesamtzustand: WARNING — Nicht produktionsbereit (Credentials + Placeholder fehlen)**

Alle 7 Workflows haben valide Struktur und 0 Blocking-Errors. Kein Workflow darf jedoch aktiviert werden, bevor die unten aufgelisteten Critical-Fixes angewendet wurden.

---

## Workflow-Baum

```
WF7: Master Controller        (j2DQUiHlVtQP7t82)  [25 Nodes]
├── WF1: Performance Collector  (gPlbmjGXwadiLN1N)  [29 Nodes]
├── WF2: Meta Ads Analyzer      (lskKYkMe4HXUGcbN)  [18 Nodes]
├── WF3: Competitor Monitor     (YcZYIpV4JCUorkcT)  [33 Nodes]
├── WF4: Content Creator        (zTJLSoNRIq0wDL69)  [31 Nodes]
├── WF5: Report Generator       (ktZULf0dTXbr6QrD)  [17 Nodes]
└── WF6: Report Sender          (SZtoxWFIQln8Fggg)  [10 Nodes]
Total: 163 Nodes
```

> Architekturhinweis: WF7 ruft alle Sub-Workflows via HTTP POST auf Webhook-URLs auf — kein
> `executeWorkflow`-Node. Das ist eine gültige Architekturentscheidung, erfordert aber, dass alle
> Sub-Workflows aktiv sind und ihre Webhooks registriert haben, bevor WF7 läuft.

---

## CRITICAL-Fixes (vor erstem Run)

### 1. WF7 — `baseUrl` ist auf `webhook-test` gesetzt

**Node:** `Konfig verarbeiten` (Code-Node)
**Problem:** `baseUrl = 'https://meinoffice.app.n8n.cloud/webhook-test'` — alle 6 Sub-Workflow-Aufrufe
erhalten HTTP 404 in Produktion, da aktivierte Webhooks unter `/webhook/` erreichbar sind, nicht `/webhook-test/`.
**Fix:**
```javascript
// Zeile ändern von:
const baseUrl = 'https://meinoffice.app.n8n.cloud/webhook-test';
// zu:
const baseUrl = 'https://meinoffice.app.n8n.cloud/webhook';
```

---

### 2. WF3 — `competitors`-Array ist leer wenn von WF7 aufgerufen

**Node:** `Konfig zusammenfuehren` (Code-Node)
**Problem:** WF7 sendet `{ config: configPayload }` an WF3, aber kein `competitors`-Array. WF3 setzt
`competitors = webhookData.competitors || []`. Im Master-Modus: 0 Wettbewerber → keine Daten.
**Fix (Option A — empfohlen):** WF3 liest immer aus dem Sheet, unabhängig vom Trigger-Modus. Die
Sheet-Read-Logik in der standalone-Pfad bereits vorhanden — Bedingung entfernen, immer lesen.
**Fix (Option B):** WF7 liest das Wettbewerber-Sheet und übergibt die Liste im POST-Body an WF3.

---

### 3. WF3 — Claude-Node ist HTTP Request mit Placeholder-API-Key

**Node:** `Claude Wettbewerber-Analyse` (httpRequest)
**Problem:** Nutzt direkten HTTP Request zur Anthropic API mit `x-api-key: ANTHROPIC_API_KEY_PLACEHOLDER`.
Jeder Aufruf liefert HTTP 401 — `onError: continueRegularOutput` schluckt den Fehler still.
**Fix:** Diesen HTTP-Request-Node durch einen nativen `@n8n/n8n-nodes-langchain.anthropic`-Node
ersetzen (wie WF2 und WF4 es bereits korrekt tun). Anthropic-Credential setzen.

---

### 4. WF3 — 3x Placeholder-Werte

| Node | Placeholder | Ersetzen durch |
|---|---|---|
| `Supabase Competitor UPSERT` | `SUPABASE_URL_PLACEHOLDER` | `https://xczjbiitstgxrzjlksqg.supabase.co` |
| `Competitor Insights schreiben` | `GOOGLE_SHEET_URL_PLACEHOLDER` | Tatsächliche Google Sheets URL |
| `Konfig aus Sheet lesen` | `GOOGLE_SHEET_URL_PLACEHOLDER` | Tatsächliche Google Sheets URL |

---

### 5. WF1 — 2x leere Credential-IDs

| Node | Credential-Typ | Problem |
|---|---|---|
| `YouTube Channel Statistiken` | `youTubeOAuth2Api` | `id: ""` — YouTube wird nie abgerufen |
| `Supabase Run-Log` (nativer Node) | `supabaseApi` | `id: ""` — crasht Workflow am Ende (kein onError gesetzt) |

---

### 6. WF2 — Anthropic-Credential ist Placeholder

**Node:** `Claude Analyse`
**Problem:** `credentials.anthropicApi.id = "ANTHROPIC_CREDENTIAL_ID_HIER_EINTRAGEN"` — keine KI-Analyse läuft.
**Fix:** Echte Anthropic-Credential-ID aus der n8n-Instanz eintragen.

---

### 7. WF4 — 3x Gemini-API-Key-Placeholder

| Node | Problem |
|---|---|
| `Imagen 4 Bild generieren` | `key: "GEMINI_API_KEY_PLACEHOLDER"` im Query-Parameter |
| `Veo 3 Video generieren` | `key: "GEMINI_API_KEY_PLACEHOLDER"` |
| `Veo 3 Ergebnis abrufen` | `key: "GEMINI_API_KEY_PLACEHOLDER"` |

**Fix:** Echten Gemini-API-Key eintragen. Besser: `httpHeaderAuth`-Credential erstellen und referenzieren
(Key im Header statt URL-Parameter — sicherer und nicht in Logs sichtbar).

---

### 8. WF4 — Anthropic-Credential ist Placeholder

**Node:** `Claude Content generieren`
**Problem:** `credentials.anthropicApi.id = "ANTHROPIC_CREDENTIAL_ID_HIER_EINTRAGEN"`
**Fix:** Echte Anthropic-Credential-ID eintragen. Gleiche ID wie WF2/WF5.

---

### 9. WF5 — Anthropic-Credential ist Placeholder

**Node:** `Claude Report-Analyse`
**Problem:** `credentials.anthropicApi.id = "ANTHROPIC_CREDENTIAL_ID_HIER_EINTRAGEN"`
**Fix:** Gleiche Anthropic-Credential-ID wie WF2/WF4.

---

### 10. WF5 — html2pdf.app ohne Auth-Header

**Node:** `HTML zu PDF konvertieren`
**Problem:** Kein `Authorization`-Header gesetzt — API-Key fehlt. PDF-Generierung schlägt mit
401/403 fehl. `onError: continueRegularOutput` schluckt den Fehler still.
**Fix:** `Authorization`-Header (oder `X-Api-Key`) mit html2pdf.app-API-Key hinzufügen.

---

### 11. WF6 — Gmail-Credential leer

**Node:** `Report versenden` (Gmail)
**Problem:** `credentials.gmailOAuth2.id = ""` — jede E-Mail-Sendung schlägt fehl.
**Fix:** Valide Gmail-OAuth2-Credential-ID aus der n8n-Instanz eintragen.
Auf der Instanz gibt es bereits eine Gmail-Credential: ID `Kh7cApAx6TAe4Hpy` (aus dem SEO Content Agent-Projekt).

---

### 12. WF3 — Google Sheets Spaltenmapping falsches Format

**Node:** `Competitor Insights schreiben`
**Problem:** Nutzt `columns.value.mappings: [...]` (Array) — Google Sheets Node v4.7 erwartet
`columns.value` als Key-Value-Objekt.
**Fix:**
```json
"columns": {
  "mappingMode": "defineBelow",
  "value": {
    "Plattform": "={{ $json.platform }}",
    "Wettbewerber": "={{ $json.competitor }}",
    ...
  }
}
```

---

### 13. WF1 — `Supabase Run-Log` nativer Node ohne `onError`

**Node:** `Supabase Run-Log` (nativer Supabase-Node)
**Problem:** Kein `onError: "continueRegularOutput"` gesetzt. Wenn der Supabase-Write fehlschlägt
(z.B. wegen leerer Credential-ID — siehe Fix #5), bricht der Workflow ab, statt die Webhook-Antwort
an WF7 zurückzugeben. WF7 wartet dann bis zum Timeout.
**Fix:** `onError: "continueRegularOutput"` zum Node hinzufügen.

---

## HIGH-Fixes (vor Produktionsbetrieb)

### H1. WF4 — Null-Guard fehlt in `Konfig zusammenfuehren`

```javascript
// Aktuell (crasht bei leerem Body):
const webhookData = $('Webhook Trigger').first().json.body;

// Fix (wie WF5/WF6 es korrekt machen):
const webhookData = $('Webhook Trigger').first().json.body || {};
```

---

### H2. WF6 — Gmail sendet immer Anhang, auch wenn kein PDF vorhanden

**Problem:** `attachmentsUi` ist immer gesetzt. Wenn WF5 kein PDF generiert hat (`pdfGenerated: false`),
gibt es keine Binärdaten → Gmail-Node wirft Fehler "binary property not found".
**Fix:** IF-Node vor `Report versenden` einfügen:
- Branch TRUE (`pdfAvailable = true`): Gmail mit Anhang
- Branch FALSE: Gmail ohne Anhang

---

### H3. WF4 — 6 Supabase-Query-Parameter mit falschem `{{ }}`-Format

**Nodes:** `Supabase Performance lesen` + `Supabase Competitor lesen`
**Problem:** Query-Parameter-Werte nutzen `"=eq.{{ $json.field }}"` statt `"=eq.={{ $json.field }}"`.
**Fix:** Die 2 Nodes auf URL-basierte Expression-Schreibweise umstellen (wie WF5 es korrekt macht):
```
={{ $json.supabaseUrl }}/rest/v1/performance_weekly?project_name=eq.{{ $json.projectName }}&calendar_week=eq.{{ $json.calendarWeek }}&year=eq.{{ $json.year }}
```

---

### H4. WF1/WF3 — `Supabase Run-Log` nativer Node hat kein `onError`

Beide Run-Log-Nodes können den finalen Webhook-Response blockieren wenn sie fehlschlagen.
**Fix:** `onError: "continueRegularOutput"` hinzufügen.

---

### H5. WF2 — `Konfig aus Sheet lesen` + `Meta Ads Konfig lesen` ohne `retryOnFail`

Beide Google Sheets Reads in WF2 haben kein Retry. Bei transienten Fehlern bricht WF2 ab.
**Fix:** `retryOnFail: true, maxTries: 3, waitBetweenTries: 5000` für beide Nodes.

---

### H6. WF5 — Null-Unsafe Multiplikation in `HTML-Report generieren`

**Problem:** `(c.engagement_rate?.current * 100).toFixed(2)` — wenn `current` undefined ist,
wird `NaN` → führt zu kaputtem HTML-Report.
**Fix:** `((c.engagement_rate?.current ?? 0) * 100).toFixed(2)`

---

## MEDIUM-Fixes (Robustheit & Best Practices)

### M1. WF7 — Supabase anon-key hardcoded in HTTP-Header

WF7, WF1 und WF2 haben denselben Supabase JWT-Token direkt im Header. Besser als
`httpHeaderAuth`-Credential speichern.

### M2. WF1 — HTTP Request `Supabase Performance UPSERT` auf typeVersion 4.2

Alle anderen HTTP-Request-Nodes sind auf 4.4. Diesen Node auf 4.4 aktualisieren.

### M3. WF4 — WF4 `Claude Response parsen` loggt Parse-Fehler nicht in `staticData.errors`

Bei JSON-Parse-Fehler wird ein Fake-Content-Objekt produziert, aber kein Fehler-Eintrag geschrieben.
Fehler damit im finalen Response unsichtbar.

### M4. WF5 — 5 Supabase GET-Nodes sind sequenziell statt parallel

Alle 5 Supabase-Reads (Performance aktuell, Vorwoche, 4-Wochen, Meta Ads, Competitor) sind unabhängig.
Fan-out + Merge-Pattern würde Latenz um ~80% reduzieren.

### M5. WF3 — `n8n_autofix_workflow` für IF-Node-Metadaten ausführen

6 IF-Nodes in WF4, 1 in WF5, 1 in WF6 fehlt `"version": 2` in `conditions.options`.
`n8n_autofix_workflow` behebt das automatisch für alle.

### M6. WF4 — Gemini-API-Key aus URL-Parameter in Header verschieben

API-Keys in URL-Query-Parametern erscheinen im n8n-Execution-Log (URL wird geloggt).
`Authorization: Bearer <key>` im Header ist sicherer.

### M7. Supabase Community Node evaluieren

Das Community-Package `n8n-nodes-supabase` würde 22 HTTP-Request-Nodes durch native Nodes
ersetzen und JWT-Key-Management vereinfachen. Nach Stabilisierung evaluieren.

---

## Node-Optimierung: HTTP Request → Native Node

### Ersetzbar (1 Node)

| Workflow | Node | Aktuell | Ersetzen durch |
|---|---|---|---|
| WF3 | `Claude Wettbewerber-Analyse` | httpRequest (Anthropic API, Placeholder-Key) | `@n8n/n8n-nodes-langchain.anthropic` — wie WF2/WF4 |

### Muss bleiben (22 Nodes)

| Typ | Anzahl | Grund |
|---|---|---|
| Sub-WF-Aufrufe (WF7 → WF1–WF6) | 6 | Webhook-basierte Architektur — kein nativer ExecuteWorkflow möglich |
| Supabase UPSERT mit `Prefer: merge-duplicates` | 4 | PostgREST-Header nicht vom nativen Supabase-Node unterstützt |
| Supabase GET / INSERT | 8 | Kein nativer Supabase-Node in n8n Core |
| Imagen 4 / Veo 3 (Gemini) | 3 | Kein nativer Gemini-Bildgenerierungs-Node |
| html2pdf.app | 1 | Kein nativer PDF-Node |

---

## Was gut funktioniert

| Bereich | Detail |
|---|---|
| **Retry-Härtung** | Alle externen API-Nodes haben `retryOnFail: true` mit angemessenen maxTries/Wartezeiten — ausgezeichnet |
| **typeVersions** | Fast alle Nodes auf aktueller Version. Einzige Ausnahme: WF1 Supabase HTTP auf 4.2 |
| **Workflow-Settings** | Alle 7: `executionOrder: v1`, `saveDataErrorExecution: all`, `callerPolicy: workflowsFromSameOwner` — korrekt |
| **Dual-Trigger-Muster** | Konsequent in allen Sub-Workflows umgesetzt (standalone + master-triggered) |
| **Deprecated Patterns** | Keine `continueOnFail: true`, kein `$node[]`, kein bare `$json` in Code-Nodes gefunden |
| **WF2 Gesamtstruktur** | Bester aller 7 Workflows — korrektes Anthropic-Node-Format, gutes Error-Handling |
| **SplitInBatches-Pattern** | WF1 + WF3 + WF4 korrekt verdrahtet (Output 0 = done, Output 1 = loop) |
| **Orphaned Nodes** | Keine verwaisten Nodes in allen 7 Workflows |

---

## Prioritätsliste (Reihenfolge für Setup)

```
KRITISCH (vor JEDEM Test):
  1.  WF7: baseUrl → /webhook/ ändern
  2.  WF6: Gmail-Credential-ID setzen (Kh7cApAx6TAe4Hpy)
  3.  WF2: Anthropic-Credential-ID setzen
  4.  WF4: Anthropic-Credential-ID setzen
  5.  WF5: Anthropic-Credential-ID setzen
  6.  WF4: Gemini-API-Keys ersetzen (3 Nodes)
  7.  WF5: html2pdf.app Auth-Header hinzufügen
  8.  WF1: YouTube + Supabase Credential-IDs setzen
  9.  WF3: Supabase-URL Placeholder ersetzen (→ xczjbiitstgxrzjlksqg.supabase.co)
  10. WF3: Google Sheets URL Placeholder ersetzen (2x)
  11. WF3: Claude HTTP-Node → nativer Anthropic-Node (+ kein Placeholder mehr)
  12. WF3: Google Sheets Spaltenmapping Format reparieren
  13. WF1: Supabase Run-Log onError hinzufügen

HIGH (vor Produktionsstart):
  14. WF4: Null-Guard in Konfig zusammenfuehren
  15. WF6: IF-Node vor Gmail für PDF-Attachment-Logik
  16. WF4: Supabase Query-Parameter Expression-Format reparieren
  17. WF1/WF3: Supabase Run-Log onError hinzufügen
  18. WF2: retryOnFail für Sheets-Read-Nodes
  19. WF5: Null-Safe Multiplikation in HTML-Generator

MEDIUM (nach erstem erfolgreichen Lauf):
  20. WF3: competitors-Datenflussproblem lösen (WF7 → WF3)
  21. WF1: typeVersion 4.2 → 4.4
  22. n8n_autofix_workflow für alle 7 Workflows ausführen
  23. Supabase anon-keys in httpHeaderAuth-Credentials auslagern
```

---

## Schnellzusammenfassung pro Workflow

| WF | Name | Kritisch | High | Medium | Sicher aktivieren? |
|---|---|---|---|---|---|
| WF7 | Master Controller | 1 (baseUrl) | — | 1 (Supabase key) | NEIN |
| WF1 | Performance Collector | 3 (YT cred, Supabase cred, onError) | 1 (retryOnFail Sheets) | 1 (typeVersion) | NEIN |
| WF2 | Meta Ads Analyzer | 1 (Anthropic cred) | 1 (retryOnFail) | 1 (Supabase key) | NEIN |
| WF3 | Competitor Monitor | 6 (URL, Keys, Sheets, Claude, Mapping) | 2 (onError, datenfluss) | 1 (autofix) | NEIN |
| WF4 | Content Creator | 2 (Anthropic, Gemini x3) | 2 (null guard, expr) | 2 (autofix, logging) | NEIN |
| WF5 | Report Generator | 2 (Anthropic, html2pdf) | 1 (null-unsafe) | 2 (parallel, autofix) | NEIN |
| WF6 | Report Sender | 1 (Gmail cred) | 1 (PDF attach logic) | 1 (autofix) | NEIN |

---

*Generiert: 2026-03-08*
*Methode: Statische JSON-Analyse (5 Passes) + Validierungsregelwerk + Cross-Workflow-Datenflussanalyse*
*Grundlage: DEBUG-REPORT-BATCH-A.md + DEBUG-REPORT-BATCH-B.md*
