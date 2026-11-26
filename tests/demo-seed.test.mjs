// Dữ liệu mẫu phải nạp được trên schema thật, chạy lại không trùng, và xoá sạch mà không đụng dữ liệu thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDatabase} from './helpers/d1.mjs';

const seed=readFileSync(new URL('../worker/seeds/demo_seed.sql',import.meta.url),'utf8');
const cleanup=readFileSync(new URL('../worker/seeds/demo_cleanup.sql',import.meta.url),'utf8');
const count=(db,sql)=>db.prepare(sql).get().n;

function prodLike(){
 const db=createDatabase();
 db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('truongtho53@gmail.com','Admin','ADMIN')").run();
 // Một bản ghi "thật" để chắc chắn cleanup không xoá nhầm.
 db.prepare("INSERT INTO customers(id,name,owner_email,status) VALUES('real-uuid-1','Khách thật','truongtho53@gmail.com','ACTIVE')").run();
 db.prepare("INSERT INTO products(id,name) VALUES('real-sp-1','SP thật')").run();
 return db;
}

test('seed nạp đủ dữ liệu mẫu, đúng mã trạng thái, chạy lại không bị trùng',()=>{
 const db=prodLike();
 try{
  db.exec(seed);db.exec(seed);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM customers WHERE id LIKE 'DEMO-%'"),12);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM leads WHERE id LIKE 'DEMO-%'"),8);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM products WHERE id LIKE 'DEMO-%'"),10);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM activities WHERE id LIKE 'DEMO-%'"),3);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM orders WHERE id LIKE 'DEMO-%'"),5);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM order_lines WHERE id LIKE 'DEMO-%'"),7);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM orders WHERE id LIKE 'DEMO-%' AND status='PENDING'"),3);
  assert.equal(db.prepare("SELECT status_note FROM orders WHERE id='DEMO-DH04'").get().status_note,'Khách hoãn mua sang quý sau');
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM deliveries WHERE id LIKE 'DEMO-%'"),3);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM deliveries WHERE id LIKE 'DEMO-%' AND status='VERIFIED'"),2);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM payments WHERE id LIKE 'DEMO-%'"),3);
  assert.equal(count(db,"SELECT SUM(amount) AS n FROM payment_allocations WHERE id LIKE 'DEMO-%'"),300000000);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM customers WHERE id LIKE 'DEMO-%' AND name NOT LIKE '[DEMO]%'"),0);
  // Tài khoản mẫu không bao giờ được phép đăng nhập.
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM app_users WHERE email LIKE '%@demo.ctfood.invalid' AND active<>0"),0);
 }finally{db.close()}
});

test('cleanup xoá sạch dữ liệu mẫu (kể cả nhật ký sửa) và giữ nguyên dữ liệu thật',()=>{
 const db=prodLike();
 try{
  db.exec(seed);
  db.exec("INSERT INTO orders(id,code,customer_id,sales_email,order_type,status,updated_at) SELECT 'uuid-order','DH2611-0001','DEMO-KH02',owner_email,'IN_STOCK','PENDING','x' FROM customers WHERE id='DEMO-KH02'");
  db.exec("INSERT INTO order_lines(id,order_id,product_id,contracted_kg,unit_price_ex_vat) VALUES('uuid-line','uuid-order','DEMO-SP01',10,1000)");
  db.exec("INSERT INTO deliveries(id,order_line_id,delivered_kg,delivery_date,status) VALUES('uuid-ticket','uuid-line',10,'2026-12-01','VERIFIED')");
  db.exec("UPDATE orders SET status='SUCCESS' WHERE id='uuid-order'");
  db.prepare("INSERT INTO audit_log(id,actor_email,action,entity,entity_id) VALUES('a1','truongtho53@gmail.com','UPDATE','customers','DEMO-KH01')").run();
  db.prepare("INSERT INTO audit_log(id,actor_email,action,entity,entity_id) VALUES('a2','truongtho53@gmail.com','UPDATE','customers','real-uuid-1')").run();
  // Bản ghi UAT tạo trên giao diện (mã UUID, tên bắt đầu [DEMO]) và một khách thật có chữ [DEMO] ở giữa tên.
  db.exec("INSERT INTO customers(id,name,owner_email,status) SELECT 'uuid-uat','[DEMO] UAT KH 001',email,'PROSPECT' FROM app_users WHERE role='ADMIN'");
  db.exec("INSERT INTO audit_log(id,actor_email,action,entity,entity_id) SELECT 'a3',email,'CREATE','customers','uuid-uat' FROM app_users WHERE role='ADMIN'");
  db.exec("INSERT INTO customers(id,name,owner_email,status) SELECT 'uuid-real2','Khách có chữ [DEMO] ở giữa',email,'ACTIVE' FROM app_users WHERE role='ADMIN'");
  db.exec(cleanup);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM customers WHERE id='uuid-uat'"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM audit_log WHERE id='a3'"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM customers WHERE id='uuid-real2'"),1);
  // Đơn tạo trên giao diện cho khách DEMO (mã UUID) cũng phải được dọn, kể cả đơn đã chốt.
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM orders"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM order_lines"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM deliveries"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM payments"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM payment_allocations"),0);
  for(const t of ['customers','leads','products','activities'])assert.equal(count(db,`SELECT COUNT(*) AS n FROM ${t} WHERE id LIKE 'DEMO-%'`),0,t);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM app_users WHERE email LIKE '%@demo.ctfood.invalid'"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM audit_log WHERE entity_id LIKE 'DEMO-%'"),0);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM customers WHERE id='real-uuid-1'"),1);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM products WHERE id='real-sp-1'"),1);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM audit_log WHERE id='a2'"),1);
  assert.equal(count(db,"SELECT COUNT(*) AS n FROM app_users"),1);
 }finally{db.close()}
});
