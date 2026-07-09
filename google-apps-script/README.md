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

## 2. Email — Gmail SMTP

Sends through a real Gmail account using an **App Password** (not your normal Gmail password — Google blocks plain-password SMTP login).

1. The Google account you're sending from must have **2-Step Verification** turned on (myaccount.google.com/security → 2-Step Verification). App Passwords aren't offered until this is enabled.
2. Go to **myaccount.google.com/apppasswords**.
3. Create a new app password — App: **Mail**, Device: **Other (Custom name)**, name it e.g. "EMS Backend". Click **Generate**.
4. Copy the 16-character password shown (spaces don't matter — you can paste it with or without them).
5. Fill in `backend/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=youraddress@gmail.com
   SMTP_PASS=the16charapppassword
   SMTP_FROM=Recruitment <youraddress@gmail.com>
   COMPANY_NAME=Your Company Name
   ```

Gmail SMTP has a sending cap (~500/day on a regular account) — plenty for a recruitment pipeline, but worth knowing if volume ever grows.

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
5. **Create the four message templates** — Meta requires every business-initiated template to be pre-approved before it can be sent (WhatsApp → Message Templates → Create Template, category **Utility**). Use exactly these names (the code references them by name) and this body text, with the variable count matching:

   **Template name:** `interview_scheduled`
   ```
   Hi {{1}}, thank you for applying for {{2}}. We'd like to invite you for an interview, scheduled for {{3}}. We look forward to speaking with you!
   ```

   **Template name:** `interview_rescheduled`
   ```
   Hi {{1}}, your interview for {{2}} has been rescheduled. The new date and time is {{3}}. We apologize for any inconvenience and look forward to speaking with you then.
   ```

   **Template name:** `applicant_hired`
   ```
   Congratulations {{1}}! We're delighted to offer you the position of {{2}}. Your start date is {{3}}. Why we chose you: {{4}}. Welcome to the team!
   ```

   **Template name:** `application_status_update`
   ```
   Hi {{1}}, thank you for applying for {{2}} and for interviewing with us. After careful consideration, we won't be moving forward at this time. Feedback: {{3}}. We wish you the best in your search.
   ```

   Sample values for `interview_rescheduled`: `{{1}}` → `Priya Sharma`, `{{2}}` → `Video Editor`, `{{3}}` → `15 July 2026, 4:00 PM`.

   Submit each for review — approval is usually a few minutes to a day. Sends will silently fail (logged on the backend, but never block hiring/rejecting/scheduling) until a template is approved.

## Full `.env` checklist

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
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
