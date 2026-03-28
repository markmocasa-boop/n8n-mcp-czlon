# Playwright Setup for LinkedIn Automation

## Installation

```bash
# Install Playwright
npm init -y
npm install playwright

# Install Chromium browser
npx playwright install chromium
```

## Authentication

LinkedIn requires a logged-in session. Use Playwright's storage state feature:

### Initial Login (One-Time, Manual)

```bash
# Open browser for manual login
npx playwright cr --save-storage=linkedin-auth.json https://www.linkedin.com
```

1. Browser opens LinkedIn
2. Log in manually (including 2FA if enabled)
3. Close the browser — session is saved to `linkedin-auth.json`

### Using Saved Session

```javascript
const context = await browser.newContext({
  storageState: 'linkedin-auth.json'
});
```

### Session Refresh

LinkedIn sessions expire after ~7 days. Re-authenticate when you see:
- Redirect to login page
- 401/403 responses
- "Session expired" messages

```bash
# Re-authenticate
npx playwright cr --save-storage=linkedin-auth.json https://www.linkedin.com
```

## Configuration File

Create `linkedin-config.json`:

```json
{
  "storageState": "linkedin-auth.json",
  "headless": false,
  "language": "de",
  "delays": {
    "betweenActions": [3000, 8000],
    "betweenPages": [2000, 4000],
    "typing": [30, 80]
  },
  "limits": {
    "maxConnectionRequestsPerDay": 20,
    "maxMessagesPerDay": 50,
    "maxCommentRepliesPerDay": 30
  },
  "followUp": {
    "daysBeforeFollowUp": 5,
    "maxFollowUps": 1
  },
  "resources": "linkedin-resources.json",
  "actionLog": "linkedin-actions.json",
  "dryRun": false
}
```

## Resource Mapping File

Create `linkedin-resources.json` to map CTA words to resources:

```json
[
  {
    "postUrn": "urn:li:activity:7100000000000000000",
    "ctaWord": "guide",
    "resourceUrl": "https://example.com/sales-guide",
    "resourceName": "Sales Pipeline Automation Guide",
    "active": true
  },
  {
    "postUrn": "urn:li:activity:7100000000000000001",
    "ctaWord": "checklist",
    "resourceUrl": "https://example.com/checklist",
    "resourceName": "LinkedIn Outreach Checklist",
    "active": true
  }
]
```

## Action Log

All actions are logged to `linkedin-actions.json`:

```json
[
  {
    "timestamp": "2026-03-28T09:15:00Z",
    "type": "comment_reply",
    "postUrn": "urn:li:activity:123",
    "targetName": "Sarah Mueller",
    "targetProfileUrl": "https://linkedin.com/in/sarah-mueller",
    "ctaTriggered": true,
    "resourceSent": true,
    "connectionRequested": false,
    "message": "Sarah, here you go: https://..."
  },
  {
    "timestamp": "2026-03-28T09:16:30Z",
    "type": "connection_request",
    "targetName": "Marco Bianchi",
    "targetProfileUrl": "https://linkedin.com/in/marco-bianchi",
    "degree": "2nd",
    "message": "Marco, saw your comment on..."
  },
  {
    "timestamp": "2026-03-28T09:20:00Z",
    "type": "follow_up",
    "targetName": "Thomas Weber",
    "conversationUrl": "https://linkedin.com/messaging/thread/...",
    "daysSinceLastMessage": 6,
    "message": "Thomas, just bumping this..."
  }
]
```

## Dry Run Mode

Set `DRY_RUN=true` or `"dryRun": true` in config to:
- Read all posts, comments, and messages
- Generate all responses via Hormozi skill
- Log planned actions
- Skip actual sending

Use for testing and review before live execution.

## Troubleshooting

| Issue | Solution |
|---|---|
| Session expired | Re-run `npx playwright cr --save-storage=linkedin-auth.json` |
| Elements not found | LinkedIn updates UI frequently — update selectors |
| Rate limited | Reduce limits in config, increase delays |
| 2FA prompt | Log in manually, session will persist |
| Headless detected | Always use `headless: false` |
