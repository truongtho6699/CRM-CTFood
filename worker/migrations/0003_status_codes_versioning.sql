-- CT FOOD CRM: chuẩn hóa mã trạng thái + hỗ trợ khóa lạc quan (updated_at).
-- An toàn để chạy trên D1 đang có dữ liệu: không xóa/tái tạo bảng.

-- 1) Chuẩn hóa trạng thái khách hàng đã lưu bằng nhãn tiếng Việt về mã chuẩn.
UPDATE customers SET status='ACTIVE'   WHERE status IN ('Đang giao dịch','active','Active');
UPDATE customers SET status='PROSPECT' WHERE status IN ('Tiềm năng','prospect','Prospect');
UPDATE customers SET status='INACTIVE' WHERE status IN ('Ngừng giao dịch','inactive','Inactive');
-- Giá trị lạ còn sót được đưa về ACTIVE và ghi nhật ký để kiểm tra lại thủ công.
INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json)
 SELECT 'mig0003-c-'||id,'system:migration-0003','NORMALIZE','customers',id,json_object('status',status),json_object('status','ACTIVE')
 FROM customers WHERE status NOT IN ('ACTIVE','PROSPECT','INACTIVE');
UPDATE customers SET status='ACTIVE' WHERE status NOT IN ('ACTIVE','PROSPECT','INACTIVE');

-- 2) Chuẩn hóa giai đoạn khách tiềm năng.
UPDATE leads SET stage='NEW'        WHERE stage='Mới';
UPDATE leads SET stage='CONTACTING' WHERE stage='Đang liên hệ';
UPDATE leads SET stage='QUOTED'     WHERE stage='Đã báo giá';
UPDATE leads SET stage='CONVERTED'  WHERE stage='Chuyển đổi';
UPDATE leads SET stage='REJECTED'   WHERE stage='Không phù hợp';
INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json)
 SELECT 'mig0003-l-'||id,'system:migration-0003','NORMALIZE','leads',id,json_object('stage',stage),json_object('stage','NEW')
 FROM leads WHERE stage NOT IN ('NEW','CONTACTING','QUOTED','CONVERTED','REJECTED');
UPDATE leads SET stage='NEW' WHERE stage NOT IN ('NEW','CONTACTING','QUOTED','CONVERTED','REJECTED');

-- 3) Ràng buộc tương đương CHECK (SQLite không thêm CHECK vào bảng có sẵn nếu không tái tạo bảng).
CREATE TRIGGER IF NOT EXISTS trg_customers_status_ins BEFORE INSERT ON customers
 WHEN NEW.status NOT IN ('ACTIVE','PROSPECT','INACTIVE')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_customer_status'); END;
CREATE TRIGGER IF NOT EXISTS trg_customers_status_upd BEFORE UPDATE OF status ON customers
 WHEN NEW.status NOT IN ('ACTIVE','PROSPECT','INACTIVE')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_customer_status'); END;
CREATE TRIGGER IF NOT EXISTS trg_leads_stage_ins BEFORE INSERT ON leads
 WHEN NEW.stage NOT IN ('NEW','CONTACTING','QUOTED','CONVERTED','REJECTED')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_lead_stage'); END;
CREATE TRIGGER IF NOT EXISTS trg_leads_stage_upd BEFORE UPDATE OF stage ON leads
 WHEN NEW.stage NOT IN ('NEW','CONTACTING','QUOTED','CONVERTED','REJECTED')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_lead_stage'); END;

-- 4) Sản phẩm chưa có updated_at: thêm cột (ALTER không cho DEFAULT CURRENT_TIMESTAMP) rồi điền giá trị.
ALTER TABLE products ADD COLUMN updated_at TEXT;
UPDATE products SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at IS NULL;
CREATE TRIGGER IF NOT EXISTS trg_products_updated_at_ins AFTER INSERT ON products
 WHEN NEW.updated_at IS NULL
 BEGIN UPDATE products SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.id; END;

-- 5) Hỗ trợ tìm khách hàng theo số điện thoại.
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_email);
