-- Xoá toàn bộ dữ liệu mẫu tạo bởi demo_seed.sql (id 'DEMO-%', tài khoản @demo.ctfood.invalid).
-- Chạy:  npx wrangler d1 execute ctfood-crm --remote --file=seeds/demo_cleanup.sql
-- Không đụng tới bản ghi thật. Lưu ý: khách hàng/lead bạn TỰ TẠO trên giao diện (mã UUID) không bị xoá bởi file này.
-- Thứ tự xoá theo khoá ngoại: bảng con trước, bảng cha sau.

DELETE FROM activities WHERE id LIKE 'DEMO-%' OR customer_id LIKE 'DEMO-%' OR owner_email LIKE '%@demo.ctfood.invalid';
DELETE FROM leads WHERE id LIKE 'DEMO-%' OR owner_email LIKE '%@demo.ctfood.invalid';
DELETE FROM customers WHERE id LIKE 'DEMO-%' OR owner_email LIKE '%@demo.ctfood.invalid';
DELETE FROM products WHERE id LIKE 'DEMO-%';
DELETE FROM audit_log WHERE entity_id LIKE 'DEMO-%' OR actor_email LIKE '%@demo.ctfood.invalid';
DELETE FROM app_users WHERE email LIKE '%@demo.ctfood.invalid';
