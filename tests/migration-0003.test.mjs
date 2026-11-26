// Migration 0003 phải chạy an toàn trên D1 đang có dữ liệu cũ (nhãn tiếng Việt, sản phẩm chưa có updated_at).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,applyMigration} from './helpers/d1.mjs';

test('migration 0003 chuẩn hóa dữ liệu cũ, ghi nhật ký giá trị lạ và điền updated_at sản phẩm',()=>{
 const db=createDatabase({upTo:'0002_leads.sql'});
 try{
  db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('a@ct.test','A','ADMIN')").run();
  const c=db.prepare("INSERT INTO customers(id,name,owner_email,status) VALUES(?,?,'a@ct.test',?)");
  c.run('K1','Một','Đang giao dịch');c.run('K2','Hai','Tiềm năng');c.run('K3','Ba','Ngừng giao dịch');c.run('K4','Bốn','ACTIVE');c.run('K5','Năm','Khác lạ');
  const l=db.prepare("INSERT INTO leads(id,name,owner_email,stage) VALUES(?,?,'a@ct.test',?)");
  l.run('L1','Một','Mới');l.run('L2','Hai','Đã báo giá');l.run('L3','Ba','???');
  db.prepare("INSERT INTO products(id,name) VALUES('P1','SP')").run();

  applyMigration(db,'0003_status_codes_versioning.sql');

  const status=Object.fromEntries(db.prepare('SELECT id,status FROM customers').all().map(r=>[r.id,r.status]));
  assert.deepEqual(status,{K1:'ACTIVE',K2:'PROSPECT',K3:'INACTIVE',K4:'ACTIVE',K5:'ACTIVE'});
  const stage=Object.fromEntries(db.prepare('SELECT id,stage FROM leads').all().map(r=>[r.id,r.stage]));
  assert.deepEqual(stage,{L1:'NEW',L2:'QUOTED',L3:'NEW'});
  const logged=db.prepare("SELECT entity_id FROM audit_log WHERE action='NORMALIZE' ORDER BY entity_id").all().map(r=>r.entity_id);
  assert.deepEqual(logged,['K5','L3']);
  assert.match(db.prepare("SELECT updated_at FROM products WHERE id='P1'").get().updated_at,/^\d{4}-\d{2}-\d{2}T/);
  db.prepare("INSERT INTO products(id,name) VALUES('P2','SP2')").run();
  assert.ok(db.prepare("SELECT updated_at FROM products WHERE id='P2'").get().updated_at);
 }finally{db.close()}
});
