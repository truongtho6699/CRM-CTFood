-- CT FOOD CRM: FIN-01 — phiếu thu, phân bổ vào đơn, công nợ (giả định tạm, chờ Kế toán/BGĐ chốt E01–E03, C06).
-- An toàn trên D1: payments/payment_allocations đang trống (26/11/2026); chỉ ALTER ADD COLUMN, trigger, chỉ mục.
-- Tiền lưu SỐ NGUYÊN (đồng): cột vẫn kiểu REAL (SQLite không đổi kiểu tại chỗ) nhưng trigger chặn mọi giá trị có phần lẻ.

ALTER TABLE payments ADD COLUMN method TEXT NOT NULL DEFAULT 'BANK';          -- BANK (chuyển khoản) / CASH (tiền mặt)
ALTER TABLE payments ADD COLUMN note TEXT;
ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';        -- ACTIVE / VOID (phiếu nhập sai, bắt buộc lý do)
ALTER TABLE payments ADD COLUMN void_reason TEXT;
ALTER TABLE payments ADD COLUMN voided_by TEXT;
ALTER TABLE payments ADD COLUMN voided_at TEXT;
ALTER TABLE payments ADD COLUMN updated_at TEXT;
ALTER TABLE payment_allocations ADD COLUMN created_by TEXT;
ALTER TABLE payment_allocations ADD COLUMN created_at TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_order ON payment_allocations(order_id);

-- Tiền là số nguyên dương.
CREATE TRIGGER IF NOT EXISTS trg_payments_amount_int BEFORE INSERT ON payments
 WHEN NEW.amount<=0 OR NEW.amount<>CAST(NEW.amount AS INTEGER)
 BEGIN SELECT RAISE(ABORT,'ctfood_money_integer'); END;
CREATE TRIGGER IF NOT EXISTS trg_payments_amount_int_upd BEFORE UPDATE OF amount ON payments
 WHEN NEW.amount<=0 OR NEW.amount<>CAST(NEW.amount AS INTEGER)
 BEGIN SELECT RAISE(ABORT,'ctfood_money_integer'); END;
CREATE TRIGGER IF NOT EXISTS trg_alloc_amount_int BEFORE INSERT ON payment_allocations
 WHEN NEW.amount<=0 OR NEW.amount<>CAST(NEW.amount AS INTEGER)
 BEGIN SELECT RAISE(ABORT,'ctfood_money_integer'); END;
-- Giai đoạn này chỉ nhận cọc và thanh toán; hoàn tiền/chuyển cọc (E04) làm sau.
CREATE TRIGGER IF NOT EXISTS trg_payments_type BEFORE INSERT ON payments
 WHEN NEW.payment_type NOT IN ('DEPOSIT','PAYMENT') OR NEW.method NOT IN ('BANK','CASH') OR NEW.status<>'ACTIVE'
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_payment'); END;
-- Phiếu đã hủy thì khóa; hủy bắt buộc lý do; không sửa số tiền phiếu (sai thì hủy và lập phiếu mới).
CREATE TRIGGER IF NOT EXISTS trg_payments_locked BEFORE UPDATE ON payments
 WHEN OLD.status='VOID'
 BEGIN SELECT RAISE(ABORT,'ctfood_payment_locked'); END;
CREATE TRIGGER IF NOT EXISTS trg_payments_void_reason BEFORE UPDATE OF status ON payments
 WHEN NEW.status='VOID' AND trim(coalesce(NEW.void_reason,''))=''
 BEGIN SELECT RAISE(ABORT,'ctfood_void_reason_required'); END;
CREATE TRIGGER IF NOT EXISTS trg_payments_amount_fixed BEFORE UPDATE OF amount,customer_id ON payments
 WHEN NEW.amount<>OLD.amount OR NEW.customer_id<>OLD.customer_id
 BEGIN SELECT RAISE(ABORT,'ctfood_payment_locked'); END;
-- Phân bổ: chỉ vào phiếu còn hiệu lực, đúng khách hàng, đơn chưa hủy; tổng phân bổ không vượt số tiền phiếu.
CREATE TRIGGER IF NOT EXISTS trg_alloc_rules BEFORE INSERT ON payment_allocations
 WHEN (SELECT status FROM payments WHERE id=NEW.payment_id)<>'ACTIVE'
   OR (SELECT customer_id FROM orders WHERE id=NEW.order_id)<>(SELECT customer_id FROM payments WHERE id=NEW.payment_id)
   OR (SELECT status FROM orders WHERE id=NEW.order_id)='CANCELLED'
 BEGIN SELECT RAISE(ABORT,'ctfood_invalid_allocation'); END;
CREATE TRIGGER IF NOT EXISTS trg_alloc_total AFTER INSERT ON payment_allocations
 WHEN (SELECT COALESCE(SUM(amount),0) FROM payment_allocations WHERE payment_id=NEW.payment_id)>(SELECT amount FROM payments WHERE id=NEW.payment_id)
 BEGIN SELECT RAISE(ABORT,'ctfood_allocation_exceeds_payment'); END;
