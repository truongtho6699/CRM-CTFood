-- CT FOOD CRM V0.1: cấu trúc chuẩn hóa tối thiểu. Chưa chạy trên dữ liệu thực.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_users (
 email TEXT PRIMARY KEY, full_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS')), active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS customers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, tax_code TEXT, phone TEXT, email TEXT, address TEXT,
 region TEXT, owner_email TEXT, credit_limit REAL NOT NULL DEFAULT 0, credit_days INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(owner_email) REFERENCES app_users(email)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tax ON customers(tax_code) WHERE tax_code IS NOT NULL AND tax_code <> '';
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, origin TEXT, brand TEXT, unit TEXT NOT NULL DEFAULT 'kg', active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS containers (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), import_lot TEXT, supplier TEXT, arrival_date TEXT,
 quantity_kg REAL NOT NULL DEFAULT 0, remaining_kg REAL NOT NULL DEFAULT 0, cost_per_kg REAL,
 status TEXT NOT NULL DEFAULT 'PLANNED', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), sales_email TEXT NOT NULL REFERENCES app_users(email),
 order_type TEXT NOT NULL CHECK(order_type IN ('OFFER','IN_STOCK')), status TEXT NOT NULL DEFAULT 'DRAFT',
 expected_date TEXT, delivery_address TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales ON orders(sales_email);
CREATE TABLE IF NOT EXISTS order_lines (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id),
 contracted_kg REAL NOT NULL CHECK(contracted_kg > 0), unit_price_ex_vat REAL NOT NULL CHECK(unit_price_ex_vat >= 0),
 discount_per_kg REAL NOT NULL DEFAULT 0, vat_rate REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS deliveries (
 id TEXT PRIMARY KEY, order_line_id TEXT NOT NULL REFERENCES order_lines(id), container_id TEXT REFERENCES containers(id),
 delivered_kg REAL NOT NULL CHECK(delivered_kg > 0), delivery_date TEXT NOT NULL, vehicle_plate TEXT,
 status TEXT NOT NULL DEFAULT 'PENDING', verified_by TEXT, verified_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deliveries_line ON deliveries(order_line_id);
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), amount REAL NOT NULL CHECK(amount > 0),
 payment_date TEXT NOT NULL, payment_type TEXT NOT NULL CHECK(payment_type IN ('DEPOSIT','PAYMENT','REFUND')),
 reference TEXT, created_by TEXT NOT NULL REFERENCES app_users(email), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payment_allocations (
 id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id), order_id TEXT NOT NULL REFERENCES orders(id),
 amount REAL NOT NULL CHECK(amount > 0), UNIQUE(payment_id,order_id)
);
CREATE TABLE IF NOT EXISTS activities (
 id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id), title TEXT NOT NULL, due_date TEXT,
 owner_email TEXT NOT NULL REFERENCES app_users(email), status TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY, actor_email TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
 before_json TEXT, after_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
