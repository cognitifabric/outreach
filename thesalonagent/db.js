async function initDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS intake_submissions (
    id SERIAL PRIMARY KEY,name TEXT NOT NULL,salon TEXT NOT NULL,email TEXT NOT NULL,
    phone TEXT,size TEXT,calls TEXT,booking_system TEXT,services TEXT,pain_points TEXT,
    decision TEXT,submitted_at TIMESTAMPTZ DEFAULT NOW(),ip TEXT
  )`);
  await db.query(`ALTER TABLE intake_submissions
    ADD COLUMN IF NOT EXISTS request_key UUID,
    ADD COLUMN IF NOT EXISTS notification_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS business_type TEXT,
    ADD COLUMN IF NOT EXISTS contact_preference TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'New',
    ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`);
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS intake_request_key_idx ON intake_submissions(request_key)');
  await db.query(`CREATE TABLE IF NOT EXISTS notification_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id),emails JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await db.query(`INSERT INTO notification_settings(id,emails) VALUES(TRUE,$1::jsonb) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(['contact@fabricioguardia.com'])]);
  await db.query(`CREATE TABLE IF NOT EXISTS lead_notifications (
    id SERIAL PRIMARY KEY,lead_id INTEGER NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),sent_at TIMESTAMPTZ,
    UNIQUE(lead_id,recipient)
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS lead_notifications_due_idx ON lead_notifications(status,next_attempt)');
  await db.query(`CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','admin')),active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS one_active_owner_idx ON admin_users(role) WHERE role='owner' AND active`);
  await db.query(`CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS admin_invites (
    token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,name TEXT NOT NULL,
    created_by UUID REFERENCES admin_users(id),expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ
  )`);
}
module.exports={initDb};
