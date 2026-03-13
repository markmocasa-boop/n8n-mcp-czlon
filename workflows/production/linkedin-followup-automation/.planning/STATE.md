# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Täglich priorisierter Hormozi Follow-up-Report mit personalisierten Nachrichtenvorschlägen im Posteingang.
**Current focus:** Phase 1 — Branch A: Neue Leads erkennen

## Current Position

Phase: 3 of 3 COMPLETE (Error Handling — final deploy)
Workflow: WF1 — LinkedIn Follow-up Automation (Branch A + B + Error Handling)
Status: ALL 3 PHASES COMPLETE + VERIFIED — 39 nodes deployed, ready for activation after user setup
Last activity: 2026-03-13 — Phase 3 verified: PASS WITH WARNINGS (27/28 v1 requirements, ERR-05 deferred to v2)

Progress: [██████████] 100%

## Deployed Workflows

| WF | Name | n8n ID | Status | Deployed |
|---|---|---|---|---|
| WF1 | LinkedIn Follow-up Automation (39 nodes) | j6O5Ktxcp0n6o9du | Deployed (inactive) | 2026-03-13 |

## Accumulated Context

### Decisions

- [Init]: 1 Workflow mit parallelen Branches statt 2 separate Workflows — einfacher zu managen
- [Init]: HTTP Request für Apify (kein nativer Apify-Node auf n8n cloud verfügbar)
- [Init]: 1 GPT-4o Batch-Call für alle Kategorien zur Kostenoptimierung
- [Init]: Google Sheets Update-Lookup über `LinkedIn_URL` als eindeutiger Key

### Critical n8n Constraints (aus Memory)

- Switch Node: `typeVersion 2` + `rules.rules`-Format (NICHT `rules.values` oder typeVersion 3)
- OpenAI fixedCollection: `"prompt": {"messages": [...]}` — KEIN extra `"values"`-Wrapper
- Polling-Loop: Wait + IF + Merge-Node (kein natives Loop-Construct in n8n)

### Validation Issues

- Phase 1 build: JSON structural validation passed (16 nodes, all connections valid)
- n8n API rejected `active` and `tags` as read-only fields on create — removed from POST body

### Blockers/Concerns

- Apify Actor-Slugs müssen vor Build verifiziert werden (können sich ändern)
- LinkedIn-Cookie `li_at` läuft nach Wochen ab — Cookie-Ablauf-Warnung ist v2 Feature
- Umgebungsvariablen in n8n Settings setzen bevor Workflow aktiviert wird: `APIFY_API_TOKEN`, `LINKEDIN_COOKIE`, `GOOGLE_SHEET_ID`
- Google Sheet "LinkedIn Leads" mit Tab "Leads" anlegen (Header-Zeile A-M: Name, LinkedIn_URL, ...)

## Session Continuity

Last session: 2026-03-13
Stopped at: All 3 phases verified — PASS WITH WARNINGS. 27/28 v1 requirements met. ERR-05 deferred to v2.
Next step: User activates workflow after completing setup checklist (env vars + Google Sheet tabs + Apify actor verification)
