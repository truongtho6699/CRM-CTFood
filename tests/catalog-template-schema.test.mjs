import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from './helpers/d1.mjs';
test('CT FOOD template columns exist with independent legacy business codes',()=>{
 const db=createDatabase();
 try{
  const columns=table=>db.prepare('PRAGMA table_info('+table+')').all().map(x=>x.name);
  for(const col of ['legacy_code','partner_type','contact_name','contact_phone','source_sales_name'])assert.ok(columns('customers').includes(col),col);
  for(const col of ['legacy_code','packaging_type','conversion_kg','conversion_note'])assert.ok(columns('products').includes(col),col);
  assert.ok(columns('containers').includes('source_product_name'));
  db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('admin@ct.test','Admin','ADMIN')").run();
  const add=db.prepare('INSERT INTO customers(id,name,owner_email,legacy_code,partner_type,contact_name,credit_days) VALUES(?,?,?,?,?,?,?)');
  add.run('UUID1','CT FOOD test','admin@ct.test','KH0001','SUPPLIER','Anh Trọng',15);
  assert.throws(()=>add.run('UUID2','CT FOOD duplicate','admin@ct.test','KH0001','CUSTOMER','X',0),/UNIQUE/i);
  db.prepare("INSERT INTO products(id,name,legacy_code,unit,packaging_type,conversion_kg,conversion_note) VALUES('SKU-1','Chân gà','HH0018','kg','thùng carton',15,NULL)").run();
  assert.throws(()=>db.prepare("INSERT INTO products(id,name,unit,conversion_kg) VALUES('SKU-2','Sai','kg',-15)").run(),/CHECK/i);
  db.prepare("INSERT INTO products(id,name,unit,conversion_note) VALUES('SKU-2','Mỡ lưng','kg','Mã cân')").run();
  assert.equal(db.prepare("SELECT conversion_kg FROM products WHERE id='SKU-2'").get().conversion_kg,null);
 }finally{db.close()}
});
