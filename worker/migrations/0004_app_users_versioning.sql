-- CT FOOD CRM: hỗ trợ màn hình Quản lý người dùng (ADM-01).
-- Thêm updated_at cho app_users để khóa lạc quan khi hai quản trị viên cùng sửa một tài khoản.
-- An toàn trên D1 đang có dữ liệu: không xóa/tái tạo bảng.

ALTER TABLE app_users ADD COLUMN updated_at TEXT;
UPDATE app_users SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at IS NULL;

-- Bản ghi thêm bằng SQL thủ công / seed không ghi updated_at vẫn có phiên bản để sửa trên giao diện.
CREATE TRIGGER IF NOT EXISTS trg_app_users_updated_at_ins AFTER INSERT ON app_users
 WHEN NEW.updated_at IS NULL
 BEGIN UPDATE app_users SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email=NEW.email; END;

-- Email luôn lưu chữ thường để khớp email trong JWT của Cloudflare Access.
CREATE TRIGGER IF NOT EXISTS trg_app_users_email_lower BEFORE INSERT ON app_users
 WHEN NEW.email <> lower(NEW.email)
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_email_case'); END;
