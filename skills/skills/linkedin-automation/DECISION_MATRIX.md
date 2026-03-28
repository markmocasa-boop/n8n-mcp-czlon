# LinkedIn Automation — Decision Matrix

## Comment Response Decision Tree

```
Unanswered Comment on Your Post
│
├── Does comment contain CTA word?
│   │
│   ├── YES + 1st Degree Connection
│   │   └── Action: Reply with resource link + specific tip
│   │       Template: /hormozi → "CTA Comment Reply"
│   │
│   ├── YES + 2nd Degree Connection
│   │   └── Actions:
│   │       1. Reply with resource link + tip
│   │       2. Send connection request with note
│   │       3. Queue DM for after connection accepted
│   │       Templates: /hormozi → "CTA Comment Reply" + "Connection Request"
│   │
│   └── YES + 3rd Degree Connection
│       └── Actions:
│           1. Reply with resource link + tip
│           2. Send connection request with note
│           3. Queue DM for after connection accepted
│           Templates: /hormozi → "CTA Comment Reply" + "Connection Request"
│
└── Does NOT contain CTA word?
    │
    ├── 1st Degree Connection
    │   └── Action: Reply with engaging comment
    │       Template: /hormozi → "General Comment Reply"
    │
    ├── 2nd Degree Connection
    │   └── Actions:
    │       1. Reply with engaging comment
    │       2. Send connection request with note
    │       Templates: /hormozi → "General Comment Reply" + "Connection Request"
    │
    └── 3rd Degree Connection
        └── Actions:
            1. Reply with engaging comment
            2. Send connection request with note
            Templates: /hormozi → "General Comment Reply" + "Connection Request"
```

## Message Follow-Up Decision Tree

```
Inbox Conversation
│
├── Last message from ME + no reply
│   │
│   ├── < 5 days ago
│   │   └── Action: Skip (too early)
│   │
│   ├── 5-7 days ago
│   │   └── Action: Send first follow-up
│   │       Template: /hormozi → "Follow-Up (5 Days No Reply)"
│   │       Content: New value + low-pressure ask
│   │
│   └── > 7 days ago (already followed up once)
│       └── Action: Skip (one follow-up max)
│
├── Last message from THEM + no reply from me
│   │
│   ├── Any timeframe
│   │   └── Action: Flag as priority — reply needed
│   │       Template: /hormozi → context-dependent
│   │
└── Active conversation (recent back-and-forth)
    └── Action: Skip (no follow-up needed)
```

## CTA Word Extraction

The CTA word is extracted from the post text using these patterns:

| Pattern (DE) | Pattern (EN) | Example |
|---|---|---|
| Kommentiere "[WORT]" | Comment "[WORD]" | Kommentiere "Guide" |
| Schreibe "[WORT]" | Type "[WORD]" | Type "YES" below |
| Antworte mit "[WORT]" | Reply "[WORD]" | Reply "SEND" |
| Sag "[WORT]" | Drop "[WORD]" | Drop "ME" in comments |

## Resource Mapping

Each post should have a mapped resource:

```json
{
  "postUrn": "urn:li:activity:123456",
  "ctaWord": "guide",
  "resourceUrl": "https://example.com/guide",
  "resourceName": "Sales Pipeline Guide"
}
```

Store in `linkedin-resources.json` and match by post URN when CTA is triggered.

## Priority Order

When processing, handle in this order:

1. **CTA comments** (highest conversion, people explicitly asked)
2. **Unanswered messages from others** (they reached out first)
3. **General comments from 2nd/3rd degree** (growth opportunity)
4. **General comments from 1st degree** (engagement)
5. **5-day follow-ups** (lowest priority, run last)
