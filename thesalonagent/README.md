# Salon Agent outreach site

Express serves the public marketing pages and a three-step enquiry form. PostgreSQL stores leads. Resend SMTP or a configured SMTP provider can notify the business inbox.

## Run and verify

```sh
npm ci
npm test
npm start
```

Use a supported Node release (20+ recommended). Configure deployment variables in Railway's variable settings; keep local `.env` files out of Git.

## Deployment configuration

- Railway service root: `thesalonagent`.
- `DATABASE_URL`: Railway PostgreSQL connection. Without it, the page offers Instagram contact and the API refuses to acknowledge submissions.
- `ADMIN_TOKEN`: a strong secret for admin retrieval. Supply it in the `x-admin-token` header, never in a URL.
- `ADMIN_EMAIL`: the owner's monitored notification inbox.
- `EMAIL_FROM_EMAIL`: an actual sender verified by the chosen email provider. No unverified default sender is used.
- `EMAIL_FROM_NAME`: optional display name.
- `RESEND_API_KEY`, or `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: configure one email transport.

The form returns success only after the database insert completes. Notifications occur afterward; a notification failure is logged by enquiry ID, and the saved lead remains available through `/api/submissions`. If email is not configured, the operator must actively check saved leads. Email delivery has not been verified merely by deploying these files.

Only `index.html`, `app.js`, `style.css` and `privacy.html` are public files. `/health` reports that the process is running, not inbox deliverability. The rate limit is per process; use shared infrastructure when scaling to multiple instances.

## Release check

1. Confirm public prices and final service terms with the owner.
2. Confirm DB and admin retrieval using a clearly labeled test enquiry and approved owner contact data.
3. Configure a verified sender and monitored inbox; confirm the notification actually arrives.
4. Confirm browser errors preserve entered details and offer the Instagram fallback.
5. Confirm the walkthrough/demo is a real isolated test before describing it as live.

The site labels its dialogue as an illustrative example. It does not make zero-error, unlimited-usage, fixed launch-time or customer-results claims. Direct booking and payment integrations must be demonstrated before inclusion in a sales scope.

`test/preview.js` is a local visual QA harness with an in-memory stub and an intentional first-submission failure. It is never the production start command and sends no email. Automated tests verify service behavior with injected storage; real PostgreSQL and inbox delivery still require deployment verification.
