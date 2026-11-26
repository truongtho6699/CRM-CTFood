-- Xoá toàn bộ dữ liệu mẫu tạo bởi demo_seed.sql (id 'DEMO-%', tài khoản @demo.ctfood.invalid).
-- Chạy:  npx wrangler d1 execute ctfood-crm --remote --file=seeds/demo_cleanup.sql
-- Cũng xoá bản ghi tạo trên giao diện có tên bắt đầu bằng '[DEMO]' (dùng khi chạy UAT). Không đụng tới bản ghi thật.
-- Thứ tự xoá theo khoá ngoại: bảng con trước, bảng cha sau.

DELETE FROM audit_log WHERE entity_id IN (
 SELECT id FROM customers WHERE substr(name,1,6)='[DEMO]'
 UNION SELECT id FROM leads WHERE substr(name,1,6)='[DEMO]'
 UNION SELECT id FROM products WHERE substr(name,1,6)='[DEMO]');
-- Đơn hàng của khách DEMO / khách [DEMO] (kể cả đơn tạo trên giao diện): xoá nhật ký, dòng hàng, rồi đơn.
DELETE FROM audit_log WHERE entity='orders' AND entity_id IN (SELECT id FROM orders WHERE id LIKE 'DEMO-%' OR customer_id LIKE 'DEMO-%'
 OR customer_id IN (SELECT id FROM customers WHERE substr(name,1,6)='[DEMO]'));
DELETE FROM order_lines WHERE order_id IN (SELECT id FROM orders WHERE id LIKE 'DEMO-%' OR customer_id LIKE 'DEMO-%'
 OR customer_id IN (SELECT id FROM customers WHERE substr(name,1,6)='[DEMO]'));
DELETE FROM orders WHERE id LIKE 'DEMO-%' OR customer_id LIKE 'DEMO-%'
 OR customer_id IN (SELECT id FROM customers WHERE substr(name,1,6)='[DEMO]');
DELETE FROM activities WHERE id LIKE 'DEMO-%' OR customer_id LIKE 'DEMO-%' OR owner_email LIKE '%@demo.ctfood.invalid'
 OR customer_id IN (SELECT id FROM customers WHERE substr(name,1,6)='[DEMO]');
DELETE FROM leads WHERE id LIKE 'DEMO-%' OR owner_email LIKE '%@demo.ctfood.invalid' OR substr(name,1,6)='[DEMO]';
DELETE FROM customers WHERE id LIKE 'DEMO-%' OR owner_email LIKE '%@demo.ctfood.invalid' OR substr(name,1,6)='[DEMO]';
DELETE FROM products WHERE id LIKE 'DEMO-%' OR substr(name,1,6)='[DEMO]';
DELETE FROM audit_log WHERE entity_id LIKE 'DEMO-%' OR actor_email LIKE '%@demo.ctfood.invalid';
DELETE FROM app_users WHERE email LIKE '%@demo.ctfood.invalid';
