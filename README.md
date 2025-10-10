# Postmark Scheduler

The **Postmark Scheduler** adds **scheduled sending** to Postmark’s transactional email by orchestrating Airtable (jobs), ActiveCampaign (audiences & templates), and Postmark (delivery).  
It personalizes content per contact, batches sends efficiently, and includes uptime safeguards and progressive retries suitable for production workloads.

– Built for reliability: idempotent workers, re-entrancy guards, progressive backoff, and external pingers  
– Human-friendly ops: auto-fills human-readable metadata, clear alerts, and manually-accessible job queue  

## 🧭 Overview

- **Store**: Airtable table — required schema below
- **Audience**: ActiveCampaign **Automations**
- **Content**: ActiveCampaign **Campaign Templates**
- **Sender**: Postmark **batch transactional API**
- **Orchestrator**: Next.js service with five endpoints  
  - `/ping` → dispatches all workers  
  - `/updateMetadata` → fills human-readable names  
  - `/testEmails` → preview pipeline (single-attempt)  
  - `/sendEmails` → production pipeline (progressive retry)  
  - `/sendWarnings` → SLA & readiness alerts

Each worker is **re-entrancy protected** with an in-memory `isPending` flag and returns **HTTP 429** if already running.

## 🔄 How It Works

### 1) Dispatcher — `GET /ping`
- Reads `APP_URL` and **fires (without awaiting)**:
  - `/updateMetadata`
  - `/testEmails`
  - `/sendEmails`
  - `/sendWarnings`
- Returns `{ status: 200 }` immediately.
- Intended to be pinged by a scheduler (cron/uptime pingers) every 1–5 minutes.

### 2) Metadata Backfill — `GET /updateMetadata`
- Guard: returns **429** if a run is in progress.
- Pulls rows that **need display updates** (ID fields changed).
- For each row:
  - `getAutomationDetails(Automation ID) → automation.name`
  - `getTemplateDetails(Template ID) → template.name`
  - `saveMetadata(Airtable ID, automationName, templateName)`
- Result: read-only **Template** and **Automation** names filled for quick visual QA.

### 3) Test Pipeline — `GET /testEmails`
- Guard: returns **429** if a run is in progress.
- Picks emails **ready for test** (e.g., `Status = "Needs Testing"`).
- Forces a dedicated test automation: `email["Automation ID"] = TEST_AUTOMATION` (from settings).
- Builds contextual test subject:
  - Reads `Schedule Date` → formats `MM-DD H{am/pm}` (or `ASAP`)
  - Prefixes `TEST #``Test Number`
- Loads resources: fields, test automation contacts, template HTML, per-contact variables.
- Personalizes & sends via Postmark batch.
- Marks tested with `markEmailAsTested(Airtable ID, Test Number)`.
- **Error policy**: single-attempt actions (no retry) — log and continue.

### 4) Production Pipeline — `GET /sendEmails`
- Guard: returns **429** if a run is in progress.
- Pulls emails **ready to send** (e.g., `Status = "Ready to Send"` and `Schedule Date <= now`).
- Loads resources **with retries** (progressive backoff): fields, automation details & contacts, template HTML, per-contact variables.
- Personalizes & sends via Postmark batch; logs success/error counts; posts a summary to your chat webhook.
- Marks sent with `markEmailAsSent(Airtable ID)`.
- **Error policy**: `tryAction(..., tryHard=true)` with `ERROR_DELAY_SEC` backoff; on exhaustion, notify and defer to next tick.

### 5) SLA & Readiness Alerts — `GET /sendWarnings`
- Guard: returns **429** if a run is in progress.
- Every ~2 hours resets throttles (`clearWarnings()`).
- Warns for:
  - **Behind on Review**: past `Schedule Date` while `Status = "Under QA Review"`.
  - **Behind on Send**: 5+ minutes late while `Status = "Ready to Send"`.
- Alerts repeat after a ~30-minute cooldown until resolved.

## 🧰 Error Handling & Retries

- `tryAction(fn, description, tryHard, tryNumber=0)`  
  – When `tryHard=false` → single attempt  
  – When `tryHard=true` → progressive retry using `ERROR_DELAY_SEC` (with interim alerts)  
  – On exhaustion: send a final alert and throw
- `sendError(description)` → posts a structured alert (and logs)

## 🗂️ Airtable Specification (Database – Scheduled Emails)

> One Airtable table drives the scheduler. Field names are **exact** and **case-sensitive**.

### Required (Input) Fields

| Field                     | Type                 | Purpose |
|---|---|---|
| `Email ID`            | Single line text     | Human-readable identifier for logs/alerts (e.g., `2025-10-15-reminder`). |
| `Template ID`         | Single line text     | ActiveCampaign **Campaign Template** ID (from URL). |
| `Automation ID`       | Single line text     | ActiveCampaign **Automation** ID (from URL). Overridden to the test automation during `/testEmails`. |
| `Subject`             | Single line text     | Base subject; test pipeline prefixes `TEST #N [time]`. |
| `Schedule Date`       | Date/Time (tz aware) | Earliest time the email may be sent. |
| `Status`              | Single select        | State machine: `Draft → Needs Testing → Under QA Review → Ready to Send → Sent`. |
| `Test Number`         | Number               | Increments per test; included in test subject. |
| `Last Modified`       | Last modified time   | Detects ID-field changes for `/updateMetadata`. |
| `Email Tag`           | Single line text     | Optional label for filtering/reporting (exposed in types). |

### Output (System-Managed) Fields

| Field                  | Type              | Written By | Notes |
|---|---|---|---|
| `Template`         | Single line text | `/updateMetadata` | Human-readable **Template name** looked up from ActiveCampaign. |
| `Automation`       | Single line text | `/updateMetadata` | Human-readable **Automation name** looked up from ActiveCampaign. |
| `Sent At`          | Date/Time        | `/sendEmails`     | Timestamp when marked **Sent**. |
| `Warnings`         | Single line text | `/sendWarnings` / housekeeping | Used to throttle or clear repeating alerts. |

> Note: “Airtable ID” in code refers to the **record ID** from Airtable’s API response (not a column you create).

## 🔧 Configuration

This project distinguishes between **environment variables** (secret, deployment-specific) and **runtime settings** in `settings.ts` (sane defaults you can tweak in code).

### 1) Environment Variables (`.env`)

| Variable                        | Purpose |
|---|---|
| `APP_URL`                   | Base URL of this service (used by `/ping` to dispatch workers). |
| `SLACK_WEBHOOK_URL`         | Incoming webhook for status, errors, and warnings. |
| `AIRTABLE_API_KEY`          | Airtable API key (read/write to the table). |
| `AIRTABLE_BASE_ID`          | Airtable base ID. |
| `AIRTABLE_TABLE_ID`         | Airtable table ID for `Database – Scheduled Emails`. |
| `ACTIVECAMPAIGN_API_KEY`    | ActiveCampaign API key. |
| `ACTIVECAMPAIGN_API_URL`    | ActiveCampaign API base URL (e.g., `https://<account>.api-us1.com/api/3`). |
| `POSTMARK_API_KEY`          | Postmark server token for transactional sends. |

> Do **not** commit real values. Use `.env.local` for development and a secret manager in production.

### 2) Runtime Settings (`settings.ts`)

| Constant                         | Default                                  | Purpose |
|---|---|---|
| `ERROR_DELAY_SEC`          | `[30, 60, 300, 300, 300, 300, 300]` | Progressive backoff (seconds) for production retries. |
| `TEST_AUTOMATION`          | `'272'`                         | ActiveCampaign automation ID used **only** for test sends. |
| `READY_TO_SEND_STATUS`     | `'Ready to Send'`               | Status gate for production pipeline. |
| `READY_TO_TEST_STATUS`     | `'Needs Testing'`               | Status gate for test pipeline. |
| `TESTED_STATUS`            | `'Under QA Review'`             | Marks that tests were sent; awaiting approval. |
| `SENT_STATUS`              | `'Sent'`                        | Final state after successful send. |
| `DRAFT_STATUS`             | `'Draft'`                       | Initial state; ignored by workers. |
| `FETCH_DELAY_SEC`          | `1`                             | Delay between API fetches (seconds) to avoid rate limits. |
| `SHORT_FETCH_DELAY_SEC`    | `0.1`                           | Short delay for lightweight calls. |
| `FROM_EMAIL`               | `'you@domain.com'`              | Sender address used in Postmark messages. |
| `MESSAGE_STREAM`           | `'outbound'`                    | Postmark message stream name. |

> You can adjust these defaults in code. If you need runtime overrides, consider reading them from env in your fork.

## 🧑‍💻 Local Setup

1) Clone & install  
```bash
git clone https://github.com/yourname/postmark-scheduler
cd postmark-scheduler
npm install
```

2) Configure env  
```
cp .env.example .env.local
# Fill in provider keys, Airtable IDs, Slack webhook, etc.
```

3) Start  
```bash
npm run dev
# then in another shell:
curl -s http://localhost:5555/ping
```

## 🔒 Security & Compliance

- Never commit secrets; use environment variables or a secrets manager.
- Ensure contacts are permissioned and honor unsubscribe/compliance requirements.
- Respect Postmark and ActiveCampaign API rate limits and terms of service.