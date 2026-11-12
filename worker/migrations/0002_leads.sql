-- CT FOOD CRM: customer prospect tracking (non-financial).
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  owner_email TEXT NOT NULL REFERENCES app_users(email),
  stage TEXT NOT NULL DEFAULT 'Mới',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_email);
