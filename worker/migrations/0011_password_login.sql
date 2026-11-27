-- Đăng nhập bằng tên đăng nhập + mật khẩu (song song với Google qua Cloudflare Access).
-- Mật khẩu chỉ lưu dạng băm PBKDF2-SHA256 có salt; phiên chỉ lưu SHA-256 của mã phiên.
ALTER TABLE app_users ADD COLUMN username TEXT;
ALTER TABLE app_users ADD COLUMN password_hash TEXT;
ALTER TABLE app_users ADD COLUMN password_changed_at TEXT;
ALTER TABLE app_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN locked_until TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username) WHERE username IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_app_users_username_insert BEFORE INSERT ON app_users
WHEN NEW.username IS NOT NULL AND (NEW.username<>lower(NEW.username) OR length(NEW.username) NOT BETWEEN 3 AND 32 OR NEW.username GLOB '*[^a-z0-9._-]*')
BEGIN SELECT RAISE(ABORT,'username không hợp lệ'); END;
CREATE TRIGGER IF NOT EXISTS trg_app_users_username_update BEFORE UPDATE OF username ON app_users
WHEN NEW.username IS NOT NULL AND (NEW.username<>lower(NEW.username) OR length(NEW.username) NOT BETWEEN 3 AND 32 OR NEW.username GLOB '*[^a-z0-9._-]*')
BEGIN SELECT RAISE(ABORT,'username không hợp lệ'); END;

CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY,
 email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
 method TEXT NOT NULL CHECK(method IN ('PASSWORD','GOOGLE')),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 ip TEXT,
 user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_email ON auth_sessions(email);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Nhật ký đăng nhập; cũng dùng để chặn dò mật khẩu theo IP.
CREATE TABLE IF NOT EXISTS auth_events (
 id TEXT PRIMARY KEY,
 at TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('LOGIN_OK','LOGIN_FAIL','LOCKED','LOGOUT','PASSWORD_CHANGED','PASSWORD_RESET','GOOGLE_OK')),
 username TEXT,
 email TEXT,
 ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip ON auth_events(ip,kind,at);
