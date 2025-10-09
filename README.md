# Postmark Scheduler

The **Postmark Scheduler** sends **one-time transactional emails** on a schedule, as this is not a supported feature of Postmark.
It stores jobs in Airtable, reads audience and template data from ActiveCampaign, personalizes content per contact, and delivers via Postmark — with uptime safeguards and explicit retries for production sends.

## 🧭 Overview

- **Store**: Airtable table - Required schema described below
- **Audience**: ActiveCampaign **Automations**
- **Content**: ActiveCampaign **Campaign Templates**
- **Sender**: Postmark **batch transactional API**
- **Orchestrator**: Next.js service with four endpoints:
  - `/ping` → dispatches all workers
  - `/updateMetadata` → fill human-readable names
  - `/testEmails` → preview pipeline (single-attempt)
  - `/sendEmails` → production pipeline (progressive retry)
  - `/sendWarnings` → SLA & readiness alerts

Each worker is **re-entrancy protected** with an in-memory `isPending` flag and returns **HTTP 429** if already running.

## ✅ When To Use (and Not Use)

**Use for:** one-time, synchronous sends to an audience.

**Do not use for:** continuously-triggered flows or where a contact may be added later.
These are best supported by **ActiveCampaign Automations**.

## 🔄 Exact Execution Flow

### 1) Dispatcher: `GET /ping`
- Reads `APP_URL`, then **fires (without awaiting)**:
  - `/updateMetadata`
  - `/testEmails`
  - `/sendEmails`
  - `/sendWarnings`
- Returns `{ status: 200 }` immediately.
- Invoked by cron (local every ~1 min, external every ~5 min).

### 2) Metadata Backfill: `GET /updateMetadata`
- Guards with `isPending` → returns **429** if already running.
- Fetches emails that **need display updates** (IDs changed since last run).
- For each email:
  - `getAutomationDetails(Automation ID)` → `automation.name`
  - `getTemplateDetails(Template ID)` → `template.name`
  - `saveMetadata(Airtable ID, automationName, templateName)`
- Populates read-only columns so reviewers can verify the IDs at a glance.

### 3) Test Pipeline: `GET /testEmails`
- Guards with `isPending` → returns **429** if running.
- Pulls emails **ready for test** (typically `Status = "Needs Testing"`).
- Uses a **dedicated test automation**: sets `email["Automation ID"] = TEST_AUTOMATION`.
- Builds a contextualized **test subject**:
  - Reads `Schedule Date`
  - Formats to `MM-DD H{am/pm}` (or `ASAP` if in the past)
  - Prefixes with `TEST #``Test Number`
- Loads resources:
  - `listFields()` (ActiveCampaign fields)
  - `getActiveContactsInAutomation(TEST_AUTOMATION)`
  - `getTemplateDetails(Template ID)` → `parseTemplateContent`
  - `getAllContactVariables(contacts, fields)`
- Personalizes & sends:
  - `createBatchEmailArray(contacts, email, html, variables)`
  - `sendBatchEmail(messages)` (Postmark)
- Marks tested via `markEmailAsTested(Airtable ID, Test Number)`.
- **Error policy**: most actions run **without retries** (`tryHard = false`); failures are logged and surfaced without blocking other emails.

### 4) Production Pipeline: `GET /sendEmails`
- Guards with `isPending` → returns **429** if running.
- Pulls emails **ready to send now** (e.g., `Status = "Ready to Send"` and `Schedule Date <= now`).
- Loads resources (**with retries**):
  - `listFields()`
  - `getAutomationDetails(Automation ID)`
  - `getActiveContactsInAutomation(Automation ID)`
  - `getTemplateDetails(Template ID) → parseTemplateContent`
  - `getAllContactVariables(contacts, fields)`
- Personalizes & sends:
  - `createBatchEmailArray` → `sendBatchEmail`
  - Logs success/error counts; **posts a summary to Slack**.
- Marks sent via `markEmailAsSent(Airtable ID)`.
- **Error policy**: all critical actions use `tryAction(..., tryHard=true)`  
  → retries with **progressive backoff** using `ERROR_DELAY_SEC`.  
  If max retries are exceeded, the job is skipped and will be retried on the next tick; Slack receives an error notification.

### 5) SLA & Readiness Alerts: `GET /sendWarnings`
- Guards with `isPending` → returns **429** if running.
- Every 2 hours: `clearWarnings()` to allow repeats.
- Warns in Slack for:
  - **Behind on Review**: past **Schedule Date** while `Status = "Under QA Review"`.
  - **Behind on Send**: 5+ minutes past **Schedule Date** while `Status = "Ready to Send"`.
- Alerts have a **30-minute cooldown** per email, then repeat until resolved.

## 🧰 Error Handling & Retries

- `tryAction(fn, description, tryHard, tryNumber=0)`
  - Logs start and failures.
  - When `tryHard=false` → **single attempt**, throw on failure.
  - When `tryHard=true` → **progressive retry** using `ERROR_DELAY_SEC`; posts interim Slack messages such as  
    `⛔️ ${description}: ${error}. Retrying in N seconds...`
  - On exhaustion: notifies Slack and throws.
- `sendError(description)` posts a structured Slack alert and logs.

## 🗂️ Airtable Specification (Database – Scheduled Emails)

> The service expects a single Airtable table containing the rows to send.  
> Field names are **exact** and **case-sensitive**.

### Required (Input) Fields

| Field              | Type                 | Purpose |
|---|---|---|
| `Email ID`       | Single line text     | Human-readable identifier used in logs/Slack (e.g., `2025-10-15-reminder`). |
| `Template ID`    | Single line text     | ActiveCampaign **Campaign Template** ID (from AC URL). |
| `Automation ID`  | Single line text     | ActiveCampaign **Automation** ID (from AC URL). (Overridden to `TEST_AUTOMATION` during tests.) |
| `Subject`        | Single line text     | Base subject line. (Test pipeline prefixes `TEST #N [time]`.) |
| `Schedule Date`  | Date/Time (tz aware) | The earliest time the email may be sent. |
| `Status`         | Single select        | Allowed values: `Draft` → `Needs Testing` → `Under QA Review` → `Ready to Send` → `Sent`. Pipelines trigger off this state. |
| `Test Number`    | Number               | Incremented per test; included in test subject line. |
| `Last Modified`  | Last modified time   | Used to detect when ID fields change (for `/updateMetadata`). |

### Output (System-Managed) Fields

| Field            | Type            | Written By | Notes |
|---|---|---|---|
| `Template`   | Single line text | `/updateMetadata` | Human-readable **Template name** looked up from ActiveCampaign. |
| `Automation` | Single line text | `/updateMetadata` | Human-readable **Automation name** looked up from ActiveCampaign. |
| `Sent At`    | Date/Time        | `/sendEmails`     | Timestamp when marked **Sent**. |
| `Warnings`   | Single line text | `/sendWarnings` / housekeeping | Used to throttle or clear repeating alerts (implementation-specific). |

> **Note:** “Airtable ID” in the code is the **record ID** returned by the Airtable API; it is **not** a column you need to create.

## 🔑 Environment

| Variable                 | Purpose |
|---|---|
| `APP_URL`                | Base URL of this service (used by `/ping` to dispatch workers). |
| `AIRTABLE_TOKEN`         | Airtable API token with read/write scope to the table. |
| `AIRTABLE_BASE_ID`       | Airtable base ID. |
| `AIRTABLE_TABLE_ID`      | Airtable table ID for `Database – Scheduled Emails`. |
| `ACTIVECAMPAIGN_API_KEY` | ActiveCampaign API key. |
| `ACTIVECAMPAIGN_BASE_URL`| ActiveCampaign API base URL. |
| `POSTMARK_SERVER_TOKEN`  | Postmark server token used by batch send. |
| `POSTMARK_MESSAGE_STREAM`| (Optional) Message stream for transactional mail. |
| `SLACK_WEBHOOK_URL`      | Incoming webhook for status, errors, and warnings. |
| `TEST_AUTOMATION`        | ActiveCampaign automation ID used exclusively for test sends. |
| `ERROR_DELAY_SEC`        | JSON array of retry delays in seconds for production pipeline (e.g., `[5,15,30,60,120,300]`). |

## 🧪 Personalization & Sending (both pipelines)

1. **Field catalog**: `listFields()` → available contact fields.  
2. **Audience**: `getActiveContactsInAutomation(Automation ID)`.  
3. **Template**: `getTemplateDetails(Template ID)` → `parseTemplateContent` (HTML).  
4. **Variables**: `getAllContactVariables(contacts, fields)`.  
5. **Messages**: `createBatchEmailArray(contacts, email, html, variables)` (merges per-contact data).  
6. **Delivery**: `sendBatchEmail(messages)` (Postmark).  
7. **Result handling**:
   - Logs success count vs. audience size.
   - Aggregates error messages (`ErrorCode !== 0`).
   - Posts Slack summary (production pipeline).
   - Updates Airtable state (tested/sent).

## 🧑‍💻 Local Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/uie-com/postmark-scheduler
   cd postmark-scheduler
   ```

2. Install & run:
   ```bash
   npm install
   npm run dev
   ```

3. Configure environment:
   - See: **Notion → Postmark Scheduler → ENV** for variable names and values.

4. Deploy to production:
   - Follow **CC Droplet** instructions (PM2 process, health checks, cron pings).
