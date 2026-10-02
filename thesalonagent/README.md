# The Salon Agent: outreach site and shared lead dashboard

The public site explains voice, SMS and booking workflows through an interactive 3D illustration, a simulated booking experience, an editable value calculator and a six-slide guided pitch. The contact form saves enquiries in PostgreSQL. `/admin` provides individual team accounts, lead stages, assignments, notes, delivery status, partner notification recipients and invitations.

## Run

```sh
npm ci
npm test
npm start
```

Use Node 20 or later. Set deployment variables through Railway and keep local `.env` files out of Git. `railway.json` uses the `thesalonagent` service root, `node server.js` and `/health`.

## Railway setup

Target the **outreach** service in **webhooks apis and subdomains**. Preserve unrelated services and existing email variables. The outreach database can be hosted in Supabase.

1. Set `DATABASE_URL` using the Supabase instructions below, or a Railway PostgreSQL reference. Set `DATABASE_SCHEMA=outreach`. The default is `public` for compatibility with existing outreach records. Startup creates missing schemas/tables and adds columns without deleting existing enquiries. A schema separates table names; it does not restrict the database credentials' permissions. Railway's private database connection normally uses `DATABASE_SSL=false`.
2. Set a random `ADMIN_SETUP_TOKEN` of at least 32 characters. Visit `/admin` over HTTPS and personally enter your name, email, setup key and a new password (12–128 characters). Only one active owner can be created. Remove the setup variable after setup; existing account login still works.
3. Set `EMAIL_FROM_EMAIL` to a verified sender, `EMAIL_FROM_NAME` if desired, and either `RESEND_API_KEY` or the documented `SMTP_*` variables in `.env.example`. Generic SMTP requires TLS. A working mailbox at the recipient address does not itself configure outbound sending.
4. Set `PUBLIC_SITE_URL` to the live URL so alerts link to the shared dashboard. A custom domain is optional for launch.
5. Submit a clearly labelled release-test enquiry and verify it in the dashboard and in the recipient inbox. `/health` confirms the process, not email arrival.

The initial notification recipient is **contact@fabricioguardia.com**. The owner can add/remove up to ten recipients in **Email notifications**. Changes apply to future enquiries; previously saved enquiries retain their original recipient snapshot. Each recipient receives a separate message. Reply-to is the prospect's submitted email. Recipients do not automatically gain dashboard access.

## Supabase database

Create a separate outreach project in Supabase and personally choose its database password. In the project's **Connect** dialog, copy the **Session pooler** PostgreSQL connection string on port **5432**. This supports Railway's IPv4 connection and retains the session state used by the app. Do not use the transaction pooler on port 6543. Use the exact host and username supplied by Supabase; percent-encode reserved characters in the password when putting it in a URI.

Set the connection privately in Railway's outreach service as `DATABASE_URL`, with `DATABASE_SSL=true` and `DATABASE_SCHEMA=outreach`. Certificate verification stays enabled. If a project CA is required, download it from Supabase's database settings and set its PEM contents in `DATABASE_SSL_CA` (real newlines or escaped `\n` both work). Restart the service and confirm database initialization before creating the owner account.

The server connects directly to PostgreSQL. No Supabase API key is needed in browser code, and the `outreach` schema should remain unexposed through Supabase's Data API. Existing individual dashboard accounts continue to use the app's authentication. See [Supabase connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Team workflow

The owner creates a seven-day, single-use invitation from **Team access** and shares the link privately with the intended partner. The partner chooses their own password. Admins can read and update enquiries; the owner alone controls recipients and account access. Disabling an admin invalidates their sessions. The owner cannot disable themselves through the UI.

Track a lead from New → Contacted → Demo booked → Proposal → Won or Not a fit. Assign a follow-up owner before replying. “Won” is an internal stage, not payment verification. The dashboard shows the newest 200 active enquiries. Versions protect simultaneous edits from silently overwriting each other.

Each submission has an **Actions** dropdown. **Assign to me** fills the follow-up owner; use **Save changes** to commit it. **Delete submission** opens a confirmation and moves the submission to **Trash**, where **Actions → Restore submission** returns it with its original stage, notes and assignment. Both owners and admins can delete and restore. Trash retains the deletion timestamp and acting admin ID while deleted; there is no permanent-delete endpoint. Trashed submissions are excluded from the active inbox and opportunity metrics. Pending notifications are cancelled atomically with deletion; sent or already in-flight mail cannot be recalled. Restoring does not resend cancelled alerts. Retrying the original public submission does not restore a deleted lead.

Passwords use salted scrypt hashes. Server-side sessions use hashed random tokens, HttpOnly/Secure/SameSite=Strict cookies and an eight-hour expiry. Mutations require a CSRF token. Shared `ADMIN_TOKEN` authentication is no longer supported. Password reset is not included; deployment recovery should be handled privately by the operator.

## Reliability and verification

A receipt is returned only after the enquiry and notification queue are saved atomically. The browser reuses an idempotency key for an unchanged retry. Queued alerts survive restarts; failed delivery retries with backoff. An accepted SMTP response is shown as “accepted by mail provider,” which does not prove inbox placement. A provider-side idempotency header reduces duplicate Resend deliveries; generic SMTP can still deliver twice after an ambiguous timeout. The dashboard warns when sending is unconfigured. The contact email and Instagram remain available when form storage is unavailable.

`npm test` runs HTTP, validation, private-file, password and notification tests. Run the full database integration test against a disposable local database:

```sh
TEST_DATABASE_URL=postgresql://user@127.0.0.1:5432/postgres npm test
```

The integration test creates and drops its own random schema; it exercises real PostgreSQL, owner/admin permissions, CSRF, invitation reuse, session revocation, concurrent edits, recoverable deletion/restoration, cancellation of queued alerts, recipient snapshots and persisted notification retry. It uses fictional identities and a fake mail sender. No real email or payment is sent.

`test/preview.js` runs local visual QA on loopback port 4319 using a temporary PostgreSQL schema. It seeds a fictional account, intentionally fails the first form save, and never sends mail. Run only with `TEST_DATABASE_URL` pointed at a disposable database. The QA login is `qa-owner@example.invalid` / `fictional-owner-password`; these credentials never initialize production.

Rate limiting is per process (20 attempts/minute/IP); use a shared limiter before scaling replicas. Public static assets use an explicit allowlist. The booking demo is visibly fictional and makes no external calls, reservations, SMS sends or charges. Capabilities were traced to the reference lash-studio code; each prospect's platform, rules and integration must be verified before quotation. No client result metrics or testimonials are invented.
