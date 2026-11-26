-- Chỉ thêm bảng lịch sử từng đợt import, không thay đổi bảng nghiệp vụ.
CREATE TABLE IF NOT EXISTS import_batches (
 id TEXT PRIMARY KEY,
 entity TEXT NOT NULL CHECK(entity IN ('customers','products','containers')),
 filename TEXT NOT NULL,
 actor_email TEXT NOT NULL REFERENCES app_users(email),
 total_rows INTEGER NOT NULL CHECK(total_rows BETWEEN 1 AND 30),
 created_rows INTEGER NOT NULL CHECK(created_rows >= 0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_import_batches_created ON import_batches(created_at DESC);
