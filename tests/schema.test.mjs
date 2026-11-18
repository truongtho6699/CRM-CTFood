import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

function freshDatabase(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../worker/migrations/0001_init.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../worker/migrations/0002_leads.sql',import.meta.url),'utf8'));
 return db;
}

test('migrations 0001 and 0002 initialize exactly the required 12 CRM tables',()=>{
 const db=freshDatabase();
 try{
  const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x=>x.name);
  for(const table of ['app_users','customers','products','containers','orders','order_lines','deliveries','payments','payment_allocations','activities','audit_log','leads']){
   assert.ok(names.includes(table),'Missing table: '+table);
  }
  assert.equal(names.length,12);
 }finally{db.close()}
});

test('customer tax code is unique, preventing duplicate business accounts',()=>{
 const db=freshDatabase();
 try{
  db.prepare('INSERT INTO app_users(email,full_name,role) VALUES(?,?,?)').run('admin@example.invalid','Test Admin','ADMIN');
  const insert=db.prepare('INSERT INTO customers(id,name,tax_code,owner_email) VALUES(?,?,?,?)');
  insert.run('UAT-KH1','Test customer 1','0100000001','admin@example.invalid');
  assert.throws(()=>insert.run('UAT-KH2','Test customer 2','0100000001','admin@example.invalid'),/UNIQUE/i);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,1);
 }finally{db.close()}
});

test('foreign keys reject a customer with an unknown owner',()=>{
 const db=freshDatabase();
 try{
  assert.throws(()=>db.prepare('INSERT INTO customers(id,name,owner_email) VALUES(?,?,?)').run('UAT-KH1','Test','nobody@example.invalid'),/FOREIGN KEY/i);
 }finally{db.close()}
});

test('order lines reject invalid negative quantities and prices',()=>{
 const db=freshDatabase();
 try{
  db.prepare('INSERT INTO app_users(email,full_name,role) VALUES(?,?,?)').run('admin@example.invalid','Test Admin','ADMIN');
  db.prepare('INSERT INTO customers(id,name,owner_email) VALUES(?,?,?)').run('KH1','UAT Test','admin@example.invalid');
  db.prepare('INSERT INTO products(id,name,unit) VALUES(?,?,?)').run('SP1','UAT Product','kg');
  db.prepare('INSERT INTO orders(id,customer_id,sales_email,order_type) VALUES(?,?,?,?)').run('DH1','KH1','admin@example.invalid','IN_STOCK');
  const insert=db.prepare('INSERT INTO order_lines(id,order_id,product_id,contracted_kg,unit_price_ex_vat) VALUES(?,?,?,?,?)');
  assert.throws(()=>insert.run('DL1','DH1','SP1',0,10000),/CHECK/i);
  assert.throws(()=>insert.run('DL2','DH1','SP1',100,-1),/CHECK/i);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_lines').get().n,0);
 }finally{db.close()}
});
