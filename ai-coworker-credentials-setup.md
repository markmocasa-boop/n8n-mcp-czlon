# AI Coworker - Credentials Setup Guide

This guide explains how to configure all required credentials in n8n for the AI Coworker workflow.

## Required Credentials Overview

| Credential ID | Type | Service | Required |
|---------------|------|---------|----------|
| `slack-credentials` | Slack API | Slack Bot | Yes |
| `anthropic-credentials` | HTTP Header Auth | Claude API | Yes |
| `supabase-credentials` | Supabase API | Supabase | Yes |
| `perplexity-credentials` | Perplexity API | Perplexity | Yes |
| `tavily-credentials` | Tavily API | Tavily | Yes |
| `gmail-credentials` | Gmail OAuth2 | Gmail | Yes |
| `google-calendar-credentials` | Google Calendar OAuth2 | Google Calendar | Yes |
| `google-sheets-credentials` | Google Sheets OAuth2 | Google Sheets | Yes |
| `dataforseo-credentials` | HTTP Basic Auth | DataForSEO | Optional |
| `openai-credentials` | HTTP Header Auth | OpenAI Embeddings | Yes |

---

## 1. Slack API Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **Slack API**
3. Choose **OAuth2** authentication
4. Enter your Slack App credentials:
   - **Client ID**: From Slack App > Basic Information
   - **Client Secret**: From Slack App > Basic Information
5. Click **Connect** and authorize

### Slack App Requirements:

Make sure your Slack App has these Bot Token Scopes:
- `app_mentions:read`
- `channels:history`
- `channels:read`
- `chat:write`
- `files:read`
- `files:write`
- `im:history`
- `im:read`
- `im:write`
- `reactions:write`
- `users:read`
- `users:read.email`

---

## 2. Anthropic (Claude) API Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **HTTP Header Auth**
3. Create with these settings:
   - **Name**: `Anthropic API`
   - **Header Name**: `x-api-key`
   - **Header Value**: Your Anthropic API key (sk-ant-...)

### Getting Your API Key:

1. Go to https://console.anthropic.com
2. Navigate to **API Keys**
3. Create a new API key

---

## 3. Supabase API Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **Supabase API**
3. Enter:
   - **Host**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Key**: Your service role key (NOT the anon key!)

### Getting Your Keys:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **API**
3. Copy the **Project URL** and **service_role** key

---

## 4. Perplexity API Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **Perplexity API**
3. Enter your API key

### Getting Your API Key:

1. Go to https://www.perplexity.ai/settings/api
2. Generate a new API key

---

## 5. Tavily API Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **Tavily API**
3. Enter your API key

### Getting Your API Key:

1. Go to https://app.tavily.com
2. Sign up/login and get your API key

---

## 6. Gmail OAuth2 Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **Gmail OAuth2 API**
3. Click **Connect** and authorize with your Google account

### Google Cloud Console Setup:

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable the **Gmail API**
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials
6. Add authorized redirect URI from n8n

---

## 7. Google Calendar OAuth2 Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **Google Calendar OAuth2 API**
3. Click **Connect** and authorize

### Google Cloud Console Setup:

1. Enable the **Google Calendar API** in your project
2. Use the same OAuth credentials as Gmail

---

## 8. Google Sheets OAuth2 Credentials

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **Google Sheets OAuth2 API**
3. Click **Connect** and authorize

### Google Cloud Console Setup:

1. Enable the **Google Sheets API** in your project
2. Use the same OAuth credentials as Gmail

---

## 9. DataForSEO API Credentials (Optional)

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **HTTP Basic Auth**
3. Create with these settings:
   - **Name**: `DataForSEO API`
   - **Username**: Your DataForSEO login email
   - **Password**: Your DataForSEO API password

### Getting Your Credentials:

1. Go to https://app.dataforseo.com
2. Sign up and navigate to **API Access**
3. Copy your login and password

---

## 10. OpenAI API Credentials (for Embeddings)

### Setup in n8n:

1. Go to **Credentials** > **New Credential**
2. Search for **HTTP Header Auth**
3. Create with these settings:
   - **Name**: `OpenAI API`
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer sk-...` (your OpenAI API key with Bearer prefix)

### Getting Your API Key:

1. Go to https://platform.openai.com/api-keys
2. Create a new API key

---

## Importing the Workflow

After setting up all credentials:

1. In n8n, go to **Workflows** > **Import from File**
2. Select the `ai-coworker-workflow.json` file
3. The workflow will be imported with placeholder credentials
4. For each node with a red warning, click on it and select the correct credential

---

## Credential ID Mapping

When importing, you may need to update credential references. The workflow uses these IDs:

```
slack-credentials        -> Your Slack API credential
anthropic-credentials    -> Your Anthropic HTTP Header Auth credential
supabase-credentials     -> Your Supabase API credential
perplexity-credentials   -> Your Perplexity API credential
tavily-credentials       -> Your Tavily API credential
gmail-credentials        -> Your Gmail OAuth2 credential
google-calendar-credentials -> Your Google Calendar OAuth2 credential
google-sheets-credentials   -> Your Google Sheets OAuth2 credential
dataforseo-credentials   -> Your DataForSEO HTTP Basic Auth credential
openai-credentials       -> Your OpenAI HTTP Header Auth credential
```

---

## Webhook URLs

After importing, you need to configure the Slack App with n8n webhook URLs:

1. Activate the workflow to get the webhook URLs
2. Go to your Slack App settings
3. In **Event Subscriptions**, set the Request URL to your n8n Slack Trigger webhook
4. In **Interactivity & Shortcuts**, set the Request URL to your n8n Slack Interaction Trigger webhook

---

## Testing the Setup

1. Invite your Slack bot to a channel
2. Send a test message: `@AI-Coworker Recherchiere die SEO Trends 2026`
3. The bot should respond with research results

If you encounter issues:
- Check the n8n execution logs for errors
- Verify all credentials are correctly configured
- Ensure the Supabase tables are created (see main build prompt)
