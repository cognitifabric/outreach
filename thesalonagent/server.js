require('dotenv').config();
const express  = require('express');
const path     = require('path');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ── Database ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS intake_submissions (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      salon          TEXT NOT NULL,
      email          TEXT NOT NULL,
      phone          TEXT,
      size           TEXT,
      calls          TEXT,
      booking_system TEXT,
      services       TEXT,
      pain_points    TEXT,
      decision       TEXT,
      submitted_at   TIMESTAMPTZ DEFAULT NOW(),
      ip             TEXT
    );
  `);
  console.log('Database table ready.');
}

// ── Email transport ────────────────────────────────────────
function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Fallback: no email configured
  return null;
}

async function sendAdminEmail(data) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log('ADMIN_EMAIL not set — skipping email notification.');
    return;
  }
  const transport = createTransport();
  if (!transport) {
    console.log('SMTP not configured — skipping email notification.');
    return;
  }

  const painMap = {
    missed_calls: '📵 Missed calls losing bookings',
    after_hours:  '🌙 No one to answer after hours',
    no_shows:     '🚫 High no-show / no deposit rate',
    interruptions:'📞 Calls interrupting services',
    staff_cost:   '💸 Receptionist costs too much',
    reschedules:  '🔄 Too many reschedules to manage',
  };
  const painLabels = (data.painPoints || '')
    .split(',')
    .map(p => painMap[p.trim()] || p.trim())
    .filter(Boolean)
    .join('\n  • ');

  const fromName  = process.env.EMAIL_FROM_NAME  || 'The Salon Agent';
  const fromEmail = process.env.EMAIL_FROM_EMAIL || process.env.SMTP_USER || 'noreply@thesalonagent.com';

  await transport.sendMail({
    from:    `"${fromName}" <${fromEmail}>`,
    to:      adminEmail,
    subject: `🎯 New Intake: ${data.salon} (${data.name})`,
    text: [
      '── NEW INTAKE SUBMISSION ──────────────────────',
      '',
      `Name:            ${data.name}`,
      `Salon:           ${data.salon}`,
      `Email:           ${data.email}`,
      `Phone:           ${data.phone || '—'}`,
      `Staff size:      ${data.size || '—'}`,
      `Calls/week:      ${data.calls || '—'}`,
      `Booking system:  ${data.bookingSystem || '—'}`,
      `Decision maker:  ${data.decision || '—'}`,
      '',
      'Services offered:',
      `  ${data.services || '—'}`,
      '',
      'Pain points:',
      `  • ${painLabels || '—'}`,
      '',
      `Submitted:       ${data.submittedAt}`,
      `IP:              ${data.ip || '—'}`,
      '',
      '───────────────────────────────────────────────',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="background:#1a1a2e;padding:24px 32px">
          <h2 style="color:#fff;margin:0;font-size:20px">🎯 New Intake Submission</h2>
          <p style="color:#a78bfa;margin:6px 0 0">The Salon Agent</p>
        </div>
        <div style="padding:32px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#6b7280;width:140px">Name</td><td style="padding:8px 0;font-weight:600">${data.name}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 4px;color:#6b7280">Salon</td><td style="padding:8px 4px;font-weight:600">${data.salon}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0"><a href="mailto:${data.email}" style="color:#7c3aed">${data.email}</a></td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 4px;color:#6b7280">Phone</td><td style="padding:8px 4px">${data.phone || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Staff size</td><td style="padding:8px 0">${data.size || '—'}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 4px;color:#6b7280">Calls/week</td><td style="padding:8px 4px">${data.calls || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Booking system</td><td style="padding:8px 0">${data.bookingSystem || '—'}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 4px;color:#6b7280">Decision maker</td><td style="padding:8px 4px">${data.decision || '—'}</td></tr>
          </table>
          <div style="margin-top:24px;padding:16px;background:#f5f3ff;border-radius:8px;border-left:4px solid #7c3aed">
            <p style="margin:0 0 8px;font-weight:600;color:#1a1a2e">Services offered</p>
            <p style="margin:0;color:#374151">${(data.services || '—').replace(/\n/g, '<br>')}</p>
          </div>
          ${painLabels ? `<div style="margin-top:16px;padding:16px;background:#fdf4ff;border-radius:8px">
            <p style="margin:0 0 8px;font-weight:600;color:#1a1a2e">Pain points</p>
            <p style="margin:0;color:#374151">${painLabels.replace(/\n/g, '<br>')}</p>
          </div>` : ''}
          <p style="margin-top:24px;color:#9ca3af;font-size:13px">Submitted ${data.submittedAt} · IP ${data.ip || '—'}</p>
        </div>
      </div>
    `,
  });
  console.log(`Admin email sent to ${adminEmail}`);
}

// ── POST /api/intake ───────────────────────────────────────
app.post('/api/intake', async (req, res) => {
  const {
    name, salon, email, phone,
    size, calls, bookingSystem, services,
    painPoints, decision, submittedAt,
  } = req.body;

  // Basic validation
  if (!name || !salon || !email) {
    return res.status(400).json({ ok: false, error: 'Missing required fields.' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  try {
    // Save to DB
    await pool.query(
      `INSERT INTO intake_submissions
        (name, salon, email, phone, size, calls, booking_system, services, pain_points, decision, submitted_at, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [name, salon, email, phone || null, size || null, calls || null,
       bookingSystem || null, services || null, painPoints || null,
       decision || null, submittedAt || new Date().toISOString(), ip]
    );

    // Send admin email (non-blocking — don't fail the response if email fails)
    sendAdminEmail({ name, salon, email, phone, size, calls, bookingSystem, services, painPoints, decision, submittedAt, ip })
      .catch(err => console.error('Email error:', err.message));

    return res.json({ ok: true, message: 'Submission received.' });
  } catch (err) {
    console.error('DB error:', err.message);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again.' });
  }
});

// ── GET /api/submissions (simple auth-guarded admin view) ──
app.get('/api/submissions', async (req, res) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await pool.query('SELECT * FROM intake_submissions ORDER BY submitted_at DESC LIMIT 200');
    res.json({ count: result.rowCount, submissions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Catch-all: serve index.html ────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────
async function start() {
  if (process.env.DATABASE_URL) {
    await initDb().catch(err => {
      console.error('DB init failed:', err.message);
      process.exit(1);
    });
  } else {
    console.warn('WARNING: DATABASE_URL not set. Submissions will not be persisted.');
  }
  app.listen(PORT, () => console.log(`The Salon Agent running on port ${PORT}`));
}

start();
