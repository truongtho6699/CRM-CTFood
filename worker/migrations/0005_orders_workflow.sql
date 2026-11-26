-- CT FOOD CRM: ORDER-01 — đơn hàng nhiều dòng theo tab "Lưu đồ" (giả định tạm, chờ BGĐ chốt C01–C05).
-- An toàn trên D1 đang có dữ liệu: chỉ ALTER ADD COLUMN, trigger và chỉ mục.

-- Thông tin đầu đơn theo Lưu đồ: mã đơn hệ thống, cọc dự kiến, số container dự kiến, lý do/ai hủy.
ALTER TABLE orders ADD COLUMN code TEXT;
ALTER TABLE orders ADD COLUMN deposit_expected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN container_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN created_by TEXT;
ALTER TABLE orders ADD COLUMN status_note TEXT;
ALTER TABLE orders ADD COLUMN status_by TEXT;
ALTER TABLE orders ADD COLUMN status_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_code ON orders(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Hoa hồng/kg do Sale nhập (Lưu đồ mục 11). Đơn vị: đồng/kg, số nguyên.
ALTER TABLE order_lines ADD COLUMN commission_per_kg INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);

-- 3 trạng thái theo Lưu đồ: CHỜ GIAO / THÀNH CÔNG / HỦY. Đơn cũ (nếu có) đưa về PENDING.
UPDATE orders SET status='PENDING' WHERE status NOT IN ('PENDING','SUCCESS','CANCELLED');
CREATE TRIGGER IF NOT EXISTS trg_orders_status_ins BEFORE INSERT ON orders
 WHEN NEW.status NOT IN ('PENDING','SUCCESS','CANCELLED')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_order_status'); END;
CREATE TRIGGER IF NOT EXISTS trg_orders_status_upd BEFORE UPDATE OF status ON orders
 WHEN NEW.status NOT IN ('PENDING','SUCCESS','CANCELLED')
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_order_status'); END;
-- Đơn đã HỦY hoặc THÀNH CÔNG không được đổi trạng thái nữa (muốn mở lại phải có quy trình riêng).
CREATE TRIGGER IF NOT EXISTS trg_orders_status_final BEFORE UPDATE OF status ON orders
 WHEN OLD.status IN ('SUCCESS','CANCELLED') AND NEW.status<>OLD.status
 BEGIN SELECT RAISE(ABORT,'ctfood_order_status_final'); END;
-- Hủy đơn bắt buộc có lý do.
CREATE TRIGGER IF NOT EXISTS trg_orders_cancel_reason BEFORE UPDATE OF status ON orders
 WHEN NEW.status='CANCELLED' AND trim(coalesce(NEW.status_note,''))=''
 BEGIN SELECT RAISE(ABORT,'ctfood_cancel_reason_required'); END;
-- Không thêm dòng hàng vào đơn đã chốt. (Xoá/thay dòng được API chặn bằng điều kiện status='PENDING';
-- không đặt trigger chặn DELETE để script dọn dữ liệu DEMO và quy trình lưu trữ sau này vẫn xoá được đơn cũ.)
CREATE TRIGGER IF NOT EXISTS trg_order_lines_locked_ins BEFORE INSERT ON order_lines
 WHEN (SELECT status FROM orders WHERE id=NEW.order_id)<>'PENDING'
 BEGIN SELECT RAISE(ABORT,'ctfood_order_locked'); END;
