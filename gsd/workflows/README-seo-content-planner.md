# n8n SEO Content Planner Workflow

Automatisierte SEO-Content-Planung: Keywords, Cluster, Outlines.

## Features

- Webhook-Trigger (POST) mit JSON-Input
- DATAFORSEO-Integration (Search Volume, Related Keywords)
- LLM-Support (OpenAI/Anthropic) oder heuristischer Fallback
- Keyword-Clustering (semantisch oder token-basiert)
- Content-Piece-Generierung (Pillar, Supporting, Commercial)
- Outline-Templates (DE/EN)
- Error-Handling mit Retry und Exponential Backoff
- Idempotenz via request_id Hash

## Endpoint

```
POST /webhook/seo-content-planner
Content-Type: application/json
```

## Minimal Request

```json
{
  "topic": "Content Marketing",
  "dataforseo": {
    "login": "your-login",
    "password": "your-password"
  }
}
```

## Vollständiger Request

```json
{
  "topic": "Content Marketing",
  "language": "de",
  "location": "DE",
  "industry": "B2B SaaS",
  "target_audience": "Marketing Manager",
  "business_goal": "leads",
  "seed_keywords": ["content strategie", "blog marketing"],
  "max_clusters": 4,
  "supporting_per_cluster": 5,
  "include_commercial_piece": true,
  "dataforseo": {
    "login": "your-login",
    "password": "your-password"
  },
  "llm": {
    "provider": "openai",
    "api_key": "sk-...",
    "model": "gpt-4o-mini"
  }
}
```

## Response-Struktur

```json
{
  "success": true,
  "meta": {
    "topic": "...",
    "language": "de",
    "location": "DE",
    "generated_at": "ISO timestamp",
    "request_id": "hash",
    "assumptions": ["..."],
    "statistics": {
      "total_keywords": 50,
      "total_clusters": 4,
      "total_content_pieces": 24
    }
  },
  "topic_definition": {...},
  "keywords": [...],
  "clusters": [
    {
      "cluster_name": "...",
      "core_keyword": "...",
      "content_pieces": [
        {
          "type": "pillar",
          "title": "...",
          "outline": [...],
          "faq": [...]
        }
      ]
    }
  ]
}
```

## Setup in n8n

1. Workflow importieren (JSON)
2. DATAFORSEO HTTP Basic Auth Credentials anlegen (ID: `dataforseo-creds`)
3. Webhook aktivieren
4. Testen mit POST-Request

## Nodes-Übersicht

| Nr | Node | Funktion |
|----|------|----------|
| 01 | Webhook Trigger | POST-Endpoint |
| 02 | Validate Input | Pflichtfelder prüfen |
| 03 | Check Validation | Branch valid/invalid |
| 04 | Normalize Defaults | Standardwerte setzen |
| 05 | Seeds vorhanden? | Check seed_keywords |
| 06 | LLM für Seeds? | LLM oder Heuristik |
| 08 | Prepare Batches | DATAFORSEO Batches |
| 09-13 | DATAFORSEO | API-Calls + Parsing |
| 14-15 | Keyword Processing | Cleaning, Scoring |
| 16 | Clustering | LLM oder heuristisch |
| 18 | Content Pieces | Generierung |
| 19 | Outline Enhancement | Optional LLM |
| 21 | Final Assembly | Response bauen |
| 22 | Respond | Webhook-Response |
