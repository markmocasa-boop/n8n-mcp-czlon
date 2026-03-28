---
name: linkedin-automation
description: Automate LinkedIn engagement using Playwright CLI. Reads unanswered post comments and messages, replies using Hormozi-style responses, delivers CTA resources, handles connection requests for 2nd/3rd degree contacts, and manages 5-day follow-ups. Use when automating LinkedIn outreach, managing post comments, or handling message follow-ups.
---

# LinkedIn Automation Skill

Automate LinkedIn engagement via Playwright CLI with Hormozi-style responses.

---

## Overview

This skill automates two LinkedIn workflows:

1. **Post Comment Management**: Read and reply to unanswered comments on your posts
2. **Message Follow-Up**: Find unanswered messages and send follow-ups after 5 days

All responses are crafted using the **hormozi-response-style** skill for maximum engagement.

---

## Prerequisites

- Playwright CLI installed (`npx playwright install chromium`)
- LinkedIn session cookies or logged-in browser profile
- Hormozi response style skill loaded

---

## Workflow 1: Post Comment Management

### Step-by-Step Execution

#### Step 1: Read Recent Posts and Their Comments

```bash
# Launch browser with persistent LinkedIn session
npx playwright cr --save-storage=linkedin-auth.json https://www.linkedin.com

# After login, use saved session for automation
npx playwright cr --load-storage=linkedin-auth.json
```

**Playwright Script — Fetch Posts and Comments:**

```javascript
// navigate-posts.js
// Run with: npx playwright test navigate-posts.js

const { chromium } = require('playwright');

async function fetchPostsAndComments(storageState) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  // Navigate to your activity page
  await page.goto('https://www.linkedin.com/in/me/recent-activity/all/');
  await page.waitForTimeout(3000);

  // Scroll to load posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1500);
  }

  // Extract posts with their CTA and comments
  const posts = await page.evaluate(() => {
    const postElements = document.querySelectorAll('.feed-shared-update-v2');
    return Array.from(postElements).slice(0, 10).map(post => {
      const textEl = post.querySelector('.feed-shared-text__text-view');
      const postText = textEl ? textEl.innerText : '';

      // Extract comment count
      const commentBtn = post.querySelector('button[aria-label*="comment"]');
      const commentCount = commentBtn ?
        parseInt(commentBtn.textContent.match(/\d+/)?.[0] || '0') : 0;

      // Get post URN for direct link
      const urn = post.getAttribute('data-urn') || '';

      return {
        text: postText.substring(0, 500),
        commentCount,
        urn,
        postUrl: urn ? `https://www.linkedin.com/feed/update/${urn}/` : ''
      };
    });
  });

  // For each post with comments, fetch the comments
  const postsWithComments = [];
  for (const post of posts.filter(p => p.commentCount > 0)) {
    await page.goto(post.postUrl);
    await page.waitForTimeout(2000);

    // Click "Load more comments" if available
    const loadMore = page.locator('button:has-text("Load more comments")');
    if (await loadMore.isVisible()) {
      await loadMore.click();
      await page.waitForTimeout(2000);
    }

    const comments = await page.evaluate(() => {
      const commentEls = document.querySelectorAll('.comments-comment-item');
      return Array.from(commentEls).map(comment => {
        const authorEl = comment.querySelector('.comments-post-meta__name-text');
        const textEl = comment.querySelector('.comments-comment-item__main-content');
        const profileLink = comment.querySelector('a[href*="/in/"]');
        const replyEls = comment.querySelectorAll('.comments-reply-item');

        // Check connection degree
        const degreeEl = comment.querySelector('.dist-value');
        const degree = degreeEl ? degreeEl.textContent.trim() : '1st';

        return {
          author: authorEl ? authorEl.innerText.trim() : 'Unknown',
          text: textEl ? textEl.innerText.trim() : '',
          profileUrl: profileLink ? profileLink.href : '',
          degree: degree,
          hasReply: replyEls.length > 0,
          replied: Array.from(replyEls).some(r => {
            const replyAuthor = r.querySelector('.comments-post-meta__name-text');
            return replyAuthor && replyAuthor.innerText.includes('You');
          })
        };
      });
    });

    postsWithComments.push({
      ...post,
      comments: comments.filter(c => !c.replied) // Only unanswered
    });
  }

  await browser.close();
  return postsWithComments;
}
```

#### Step 2: Analyze Comments and Determine Action

For each unanswered comment, determine:

1. **CTA Check**: Does the comment contain the CTA word from the post?
2. **Connection Degree**: Is the commenter 1st, 2nd, or 3rd degree?
3. **Response Type**: Based on the above, select the appropriate template

**Decision Matrix:**

| CTA Mentioned | Connection | Action |
|---|---|---|
| Yes | 1st degree | Reply with resource + tip |
| Yes | 2nd/3rd degree | Reply with resource + send connection request + queue DM |
| No | 1st degree | Reply with engaging comment |
| No | 2nd/3rd degree | Reply with engaging comment + send connection request |

#### Step 3: Extract CTA Word from Post

```javascript
function extractCTA(postText) {
  // Common CTA patterns in LinkedIn posts
  const ctaPatterns = [
    /comment\s+["'](\w+)["']/i,           // Comment "word"
    /type\s+["'](\w+)["']/i,              // Type "word"
    /drop\s+["'](\w+)["']/i,              // Drop "word"
    /say\s+["'](\w+)["']/i,              // Say "word"
    /write\s+["'](\w+)["']\s+below/i,     // Write "word" below
    /reply\s+(?:with\s+)?["'](\w+)["']/i,  // Reply with "word"
    /kommentiere?\s+["'](\w+)["']/i,       // German: Kommentiere "word"
    /schreib(?:e)?\s+["'](\w+)["']/i,     // German: Schreibe "word"
  ];

  for (const pattern of ctaPatterns) {
    const match = postText.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

function commentContainsCTA(commentText, ctaWord) {
  if (!ctaWord) return false;
  return commentText.toLowerCase().includes(ctaWord.toLowerCase());
}
```

#### Step 4: Reply to Comments via Playwright

```javascript
async function replyToComment(page, postUrl, commentIndex, replyText) {
  await page.goto(postUrl);
  await page.waitForTimeout(2000);

  // Find the specific comment
  const comments = page.locator('.comments-comment-item');
  const targetComment = comments.nth(commentIndex);

  // Click reply button
  const replyBtn = targetComment.locator('button:has-text("Reply"), button:has-text("Antworten")');
  await replyBtn.click();
  await page.waitForTimeout(1000);

  // Type reply
  const replyBox = targetComment.locator('.ql-editor[contenteditable="true"]');
  await replyBox.fill(replyText);
  await page.waitForTimeout(500);

  // Submit
  const submitBtn = targetComment.locator('button.comments-comment-box__submit-button');
  await submitBtn.click();
  await page.waitForTimeout(2000);
}
```

#### Step 5: Send Connection Request (2nd/3rd Degree)

```javascript
async function sendConnectionRequest(page, profileUrl, message) {
  await page.goto(profileUrl);
  await page.waitForTimeout(2000);

  // Click Connect button
  const connectBtn = page.locator('button:has-text("Connect"), button:has-text("Vernetzen")');

  if (await connectBtn.isVisible()) {
    await connectBtn.click();
    await page.waitForTimeout(1000);

    // Add note
    const addNoteBtn = page.locator('button:has-text("Add a note"), button:has-text("Nachricht hinzufügen")');
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
      await page.waitForTimeout(500);

      const noteBox = page.locator('textarea[name="message"]');
      await noteBox.fill(message);
      await page.waitForTimeout(500);
    }

    // Send
    const sendBtn = page.locator('button:has-text("Send"), button:has-text("Senden")');
    await sendBtn.click();
    await page.waitForTimeout(1500);

    return true;
  }
  return false;
}
```

---

## Workflow 2: Message Follow-Up Management

### Step 1: Read Inbox Messages

```javascript
async function fetchUnansweredMessages(page, daysThreshold = 5) {
  await page.goto('https://www.linkedin.com/messaging/');
  await page.waitForTimeout(3000);

  // Scroll through conversations
  const sidebar = page.locator('.msg-conversations-container__conversations-list');
  for (let i = 0; i < 5; i++) {
    await sidebar.evaluate(el => el.scrollBy(0, 500));
    await page.waitForTimeout(1000);
  }

  const conversations = await page.evaluate((threshold) => {
    const convEls = document.querySelectorAll('.msg-conversation-listitem');
    const results = [];

    for (const conv of convEls) {
      const nameEl = conv.querySelector('.msg-conversation-listitem__participant-names');
      const timeEl = conv.querySelector('.msg-conversation-listitem__time-stamp');
      const previewEl = conv.querySelector('.msg-conversation-card__message-snippet');

      const name = nameEl ? nameEl.innerText.trim() : '';
      const timeStr = timeEl ? timeEl.innerText.trim() : '';
      const preview = previewEl ? previewEl.innerText.trim() : '';

      // Check if last message was from them (unanswered by us)
      const isUnread = conv.classList.contains('msg-conversation-listitem--unread');

      results.push({
        name,
        timeStr,
        preview,
        isUnread,
        conversationUrl: conv.querySelector('a')?.href || ''
      });
    }

    return results;
  }, daysThreshold);

  return conversations;
}
```

### Step 2: Identify Follow-Up Candidates

```javascript
function identifyFollowUpCandidates(conversations, daysThreshold = 5) {
  const now = new Date();

  return conversations.filter(conv => {
    // Parse relative time strings like "5d", "1w", "3d"
    const dayMatch = conv.timeStr.match(/(\d+)\s*[dT]/i);
    const weekMatch = conv.timeStr.match(/(\d+)\s*[wW]/i);

    let daysSinceLastMessage = 0;
    if (dayMatch) daysSinceLastMessage = parseInt(dayMatch[1]);
    if (weekMatch) daysSinceLastMessage = parseInt(weekMatch[1]) * 7;

    return daysSinceLastMessage >= daysThreshold && !conv.isUnread;
  });
}
```

### Step 3: Read Conversation Context

```javascript
async function readConversationContext(page, conversationUrl) {
  await page.goto(conversationUrl);
  await page.waitForTimeout(2000);

  const messages = await page.evaluate(() => {
    const msgEls = document.querySelectorAll('.msg-s-event-listitem');
    return Array.from(msgEls).slice(-10).map(msg => {
      const senderEl = msg.querySelector('.msg-s-message-group__name');
      const textEl = msg.querySelector('.msg-s-event-listitem__body');
      const timeEl = msg.querySelector('.msg-s-message-group__timestamp');

      return {
        sender: senderEl ? senderEl.innerText.trim() : '',
        text: textEl ? textEl.innerText.trim() : '',
        time: timeEl ? timeEl.innerText.trim() : ''
      };
    });
  });

  return messages;
}
```

### Step 4: Send Follow-Up Message

```javascript
async function sendFollowUp(page, conversationUrl, message) {
  await page.goto(conversationUrl);
  await page.waitForTimeout(2000);

  const msgBox = page.locator('.msg-form__contenteditable');
  await msgBox.fill(message);
  await page.waitForTimeout(500);

  const sendBtn = page.locator('button.msg-form__send-button');
  await sendBtn.click();
  await page.waitForTimeout(1500);
}
```

---

## Complete Orchestration Flow

### Main Execution Script

```javascript
// linkedin-engage.js
// Orchestrates both workflows

const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: 'linkedin-auth.json'
  });
  const page = await context.newPage();

  console.log('=== LinkedIn Engagement Automation ===\n');

  // --- WORKFLOW 1: Post Comments ---
  console.log('📋 Workflow 1: Checking post comments...');

  const posts = await fetchPostsAndComments(page);
  let commentActions = [];

  for (const post of posts) {
    const ctaWord = extractCTA(post.text);
    console.log(`\nPost: "${post.text.substring(0, 80)}..."`);
    console.log(`CTA word: ${ctaWord || 'none'}`);
    console.log(`Unanswered comments: ${post.comments.length}`);

    for (const comment of post.comments) {
      const hasCTA = commentContainsCTA(comment.text, ctaWord);
      const isNonConnection = ['2nd', '3rd'].includes(comment.degree);

      // Determine response using Hormozi style
      // >>> USE /hormozi SKILL to generate the response <<<
      let responseType;
      if (hasCTA) {
        responseType = 'cta_reply'; // Reply with resource
      } else {
        responseType = 'general_reply'; // Engaging reply
      }

      commentActions.push({
        post,
        comment,
        hasCTA,
        isNonConnection,
        responseType,
        // Response text will be generated by Hormozi skill
      });
    }
  }

  // Process comment actions
  for (const action of commentActions) {
    // 1. Reply to the comment
    // >>> Response crafted via /hormozi skill <<<
    await replyToComment(page, action.post.postUrl, /* index */, action.responseText);

    // 2. If 2nd/3rd degree: send connection request
    if (action.isNonConnection) {
      const connMessage = action.connectionMessage; // From Hormozi skill
      await sendConnectionRequest(page, action.comment.profileUrl, connMessage);
      // Queue DM for after connection is accepted (tracked separately)
    }

    // Rate limiting: wait between actions
    await page.waitForTimeout(3000 + Math.random() * 5000);
  }

  // --- WORKFLOW 2: Message Follow-ups ---
  console.log('\n📨 Workflow 2: Checking messages for follow-ups...');

  const conversations = await fetchUnansweredMessages(page);
  const followUpCandidates = identifyFollowUpCandidates(conversations, 5);

  console.log(`Found ${followUpCandidates.length} conversations needing follow-up`);

  for (const candidate of followUpCandidates) {
    const context = await readConversationContext(page, candidate.conversationUrl);

    // >>> USE /hormozi SKILL to generate follow-up based on context <<<
    // Pass conversation history to Hormozi skill for personalized follow-up

    await sendFollowUp(page, candidate.conversationUrl, candidate.followUpMessage);

    // Rate limiting
    await page.waitForTimeout(5000 + Math.random() * 5000);
  }

  console.log('\n=== Done ===');
  await browser.close();
}
```

---

## Integration with Hormozi Skill

For every message generated by this skill, the text MUST be processed through the **hormozi-response-style** skill:

1. **Comment replies**: Use "Comment Reply (CTA Triggered)" or "Comment Reply (General Engagement)" template
2. **Connection requests**: Use "Connection Request Message (2nd/3rd Degree)" template
3. **Post-connection DMs**: Use "Post-Connection DM" template
4. **Follow-ups**: Use "Follow-Up Message (5 Days No Reply)" template

### Hormozi Integration Pattern

```
1. Gather context (post text, comment text, profile info, conversation history)
2. Select appropriate Hormozi template
3. Generate response using /hormozi skill with context
4. Review quality checklist
5. Send via Playwright
```

---

## Safety and Rate Limiting

### LinkedIn Limits (respect these)
- Max 20-25 connection requests per day
- Max 50-70 messages per day
- Max 100 profile views per day
- Wait 3-8 seconds between actions (randomized)
- Run during business hours (8:00-18:00)

### Anti-Detection
- Use `headless: false` — LinkedIn detects headless browsers
- Randomize delays between actions
- Don't run more than once per day
- Use persistent browser profiles (storageState)
- Scroll naturally before interacting

### Tracking
- Log all actions (comment replies, connection requests, messages sent)
- Track which conversations received follow-ups
- Mark CTA deliveries to avoid duplicate resource sends

---

## CLI Quick Reference

```bash
# Initial LinkedIn login (manual, one-time)
npx playwright cr --save-storage=linkedin-auth.json https://www.linkedin.com

# Run the automation
node linkedin-engage.js

# Test with dry-run (log actions without sending)
DRY_RUN=true node linkedin-engage.js
```
