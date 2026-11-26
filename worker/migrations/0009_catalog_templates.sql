-- 0009: Các trường danh mục theo template nguồn CT FOOD, mở rộng không phá bảng hiện hữu.
-- Google Sheets: Mã khách hàng - NCC, Mã hàng hóa, Mã công trình.
ALTER TABLE customers ADD COLUMN legacy_code TEXT;
ALTER TABLE customers ADD COLUMN partner_type TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK(partner_type IN ('CUSTOMER','SUPPLIER','BOTH'));
ALTER TABLE customers ADD COLUMN contact_name TEXT;
ALTER TABLE customers ADD COLUMN contact_phone TEXT;
ALTER TABLE customers ADD COLUMN source_sales_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_legacy_code ON customers(legacy_code) WHERE legacy_code IS NOT NULL AND legacy_code <> '';

ALTER TABLE products ADD COLUMN legacy_code TEXT;
ALTER TABLE products ADD COLUMN packaging_type TEXT;
ALTER TABLE products ADD COLUMN conversion_kg REAL CHECK(conversion_kg IS NULL OR conversion_kg > 0);
ALTER TABLE products ADD COLUMN conversion_note TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_legacy_code ON products(legacy_code) WHERE legacy_code IS NOT NULL AND legacy_code <> '';

ALTER TABLE containers ADD COLUMN source_product_name TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_partner_type ON customers(partner_type);
