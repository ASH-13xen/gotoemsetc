# Recruitment pipeline — external service setup

Everything below is a one-time setup you do outside the codebase. Once done, fill in `backend/.env` with the values noted at each step, then restart the backend.

## 1. Google Form → backend webhook

1. Pick (or generate) a random secret string — anything works, e.g. run `openssl rand -hex 24` or just mash the keyboard for 32+ characters. Put it in `backend/.env` as `GOOGLE_FORM_WEBHOOK_SECRET`.
2. Open your recruitment Google Form → the **⋮** menu (top right) → **Script editor**. This opens Apps Script already bound to the form.
3. Delete any starter code, then paste the contents of `onFormSubmit.gs` (next to this file) in.
4. Edit the `CONFIG` object at the top:
   - `BACKEND_URL`: your deployed backend's URL + `/api/public/applicants/google-form` (e.g. `https://ems-api.yourdomain.com/api/public/applicants/google-form`). For local testing this needs to be a URL Google's servers can reach — a plain `localhost` won't work, use a tunnel (ngrok etc.) or test against your deployed backend.
   - `WEBHOOK_SECRET`: the exact same string you put in `GOOGLE_FORM_WEBHOOK_SECRET`.
5. Save the script (the file icon, or Ctrl/Cmd+S). Give the project a name if asked (e.g. "Applicant intake webhook").
6. In the left sidebar, click the clock icon (**Triggers**) → **+ Add Trigger** (bottom right):
   - Function to run: `onFormSubmit`
   - Event source: `From form`
   - Event type: `On form submit`
   - Save. The first save will prompt a Google OAuth consent screen ("This app isn't verified") — since it's your own script on your own form, click **Advanced → Go to (project name) → Allow**.
7. Submit a test response on the live form and check **Executions** (the ▷-in-a-circle icon in the sidebar) to confirm it ran without errors, and check the applicant shows up in the EMS Applicants pipeline.

If a question's title in the form is ever edited, update the matching entry in the `TITLE_TO_FIELD` map in `onFormSubmit.gs` (Script editor → save) or that answer will stop reaching the backend (it fails soft — the rest of the submission still comes through).

## 2. Email — Resend

Sends over plain HTTPS to Resend's API — deliberately *not* SMTP, since Render (and most PaaS hosts) block outbound SMTP ports platform-wide to combat spam abuse. An HTTPS API call never hits that block, which is why this is the reliable option for a deployed backend (Gmail SMTP was tried first and does time out from Render, even with correct credentials — confirmed by testing).

**To start testing today, no domain needed:**
1. Sign up at resend.com.
2. Create an API key (dashboard → API Keys).
3. Fill in `backend/.env`:
   ```
   RESEND_API_KEY=re_xxxxxxxx
   RESEND_FROM_EMAIL=Recruitment <onboarding@resend.com>
   COMPANY_NAME=Your Company Name
   ```
   `onboarding@resend.com` is Resend's built-in sandbox sender — works immediately, no setup. **Limitation**: in this mode Resend will only actually deliver to the email address you signed up to Resend with — fine for testing the integration end-to-end, not for real applicants yet.

**When ready for real applicants, verify a domain:**
1. resend.com → **Domains** → **Add Domain**.
2. Add the few DNS records it gives you (TXT/MX) wherever your domain's DNS is managed — takes minutes to a few hours to propagate.
3. Once it shows verified, change `RESEND_FROM_EMAIL` to something like `Recruitment <recruitment@yourdomain.com>` — nothing else changes, same API key, same code.

## 3. WhatsApp — Meta Cloud API

1. Create a Meta Developer app at developers.facebook.com (App type: **Business**).
2. Add the **WhatsApp** product to the app. Meta gives you a test phone number for free to start.
3. From the WhatsApp → API Setup page, grab:
   - A **temporary access token** (24h — for testing) or generate a permanent one via a System User in Meta Business Suite for production.
   - The **Phone number ID** shown on that same page.
4. Fill in `backend/.env`:
   ```
   WHATSAPP_ACCESS_TOKEN=xxxxxxxx
   WHATSAPP_PHONE_NUMBER_ID=xxxxxxxx
   WHATSAPP_API_VERSION=v21.0
   ```
5. **Create these two message templates** — Meta requires every business-initiated template to be pre-approved before it can be sent (WhatsApp → Message Templates → Create Template, category **Utility**). Use exactly these names (the code references them by name) and this body text, with the variable count matching:

   **Template name:** `applicant_hired`
   ```
   Congratulations {{1}}! We're delighted to offer you the position of {{2}}. Your start date is {{3}}. Why we chose you: {{4}}. Welcome to the team!
   ```

   **Template name:** `application_status_update`
   ```
   Hi {{1}}, thank you for applying for {{2}} and for interviewing with us. After careful consideration, we won't be moving forward at this time. Feedback: {{3}}. We wish you the best in your search.
   ```

   Submit each for review — approval is usually a few minutes to a day. Sends will silently fail (logged on the backend, but never block hiring/rejecting) until a template is approved.

   Only the **hire** and **reject** decisions send automatically through this API — interview scheduling/rescheduling and document requests use manual "Send Email"/"Send WhatsApp" buttons instead (they open your own Gmail/WhatsApp prefilled, no template approval needed). If you previously created `interview_scheduled` or `interview_rescheduled` templates in WhatsApp Manager, they're no longer used by the code and can be deleted.

## Full `.env` checklist

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=Recruitment <onboarding@resend.com>
COMPANY_NAME=

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v21.0

GOOGLE_FORM_WEBHOOK_SECRET=
```

## One-off migration (existing applicants only)

If you already have applicants in the database from before this change, run this once after deploying:

```
cd backend
npm run migrate:applicant-v2
```

This updates old `applied` statuses to `pending` and moves the old single `resume` field into the new `resumes` array. Safe to run even if there's nothing to migrate.
