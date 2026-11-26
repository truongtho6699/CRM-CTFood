-- CT FOOD CRM: LOG-01 — phiếu cân / giao nhiều lần (giả định tạm theo tab "Lưu đồ", chờ BGĐ chốt D01, D03, D04).
-- An toàn trên D1 đang có dữ liệu: chỉ ALTER ADD COLUMN, trigger và chỉ mục.

ALTER TABLE deliveries ADD COLUMN container_no TEXT;      -- số container ghi trên phiếu (mã công trình trong template), chưa ràng buộc bảng containers
ALTER TABLE deliveries ADD COLUMN weigh_ticket_no TEXT;   -- số phiếu cân
ALTER TABLE deliveries ADD COLUMN note TEXT;
ALTER TABLE deliveries ADD COLUMN status_note TEXT;       -- lý do hủy phiếu / ghi chú khi xác nhận
ALTER TABLE deliveries ADD COLUMN created_by TEXT;
ALTER TABLE deliveries ADD COLUMN updated_at TEXT;
UPDATE deliveries SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- 3 trạng thái phiếu: PENDING (chờ Kế toán xác nhận) / VERIFIED (đã xác nhận, căn cứ KPI) / CANCELLED (phiếu sai, bắt buộc lý do).
UPDATE deliveries SET status='PENDING' WHERE status NOT IN ('PENDING','VERIFIED','CANCELLED');
CREATE TRIGGER IF NOT EXISTS trg_deliveries_status_ins BEFORE INSERT ON deliveries
 WHEN NEW.status NOT IN ('PENDING','VERIFIED','CANCELLED')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_delivery_status'); END;
CREATE TRIGGER IF NOT EXISTS trg_deliveries_status_upd BEFORE UPDATE OF status ON deliveries
 WHEN NEW.status NOT IN ('PENDING','VERIFIED','CANCELLED')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_delivery_status'); END;
-- Chỉ thêm phiếu cho đơn đang Chờ giao.
CREATE TRIGGER IF NOT EXISTS trg_deliveries_order_open BEFORE INSERT ON deliveries
 WHEN (SELECT o.status FROM order_lines l JOIN orders o ON o.id=l.order_id WHERE l.id=NEW.order_line_id)<>'PENDING'
 BEGIN SELECT RAISE(ABORT,'ctfood_order_locked'); END;
-- Phiếu đã xác nhận hoặc đã hủy thì không sửa được nữa.
CREATE TRIGGER IF NOT EXISTS trg_deliveries_locked BEFORE UPDATE ON deliveries
 WHEN OLD.status<>'PENDING'
 BEGIN SELECT RAISE(ABORT,'ctfood_delivery_locked'); END;
-- Hủy phiếu bắt buộc có lý do.
CREATE TRIGGER IF NOT EXISTS trg_deliveries_cancel_reason BEFORE UPDATE OF status ON deliveries
 WHEN NEW.status='CANCELLED' AND trim(coalesce(NEW.status_note,''))=''
 BEGIN SELECT RAISE(ABORT,'ctfood_cancel_reason_required'); END;
