import test from 'node:test';
import assert from 'node:assert/strict';
import {readCsv,mapTemplate} from '../src/importExcelParser.js';
import {createDatabase} from './helpers/d1.mjs';

test('CT FOOD CSV source headers map to partner fields',()=>{
 const csv='STT,Sale phụ trách,Mã khách hàng,Tên khách,MST,Email,Địa chỉ,Tên người liên hệ,SĐT người liên hệ,Công nợ\n1,HỒNG,KH0001,Công ty A,01001,a@example.com,Hà Nội,Anh Trọng,0961221985,15 ngày';
 const rows=mapTemplate(readCsv(csv),'customers');
 assert.equal(rows.length,1);
 assert.equal(rows[0].legacy_code,'KH0001');
 assert.equal(rows[0].credit_days,'15 ngày');
 assert.equal(rows[0].contact_phone,'0961221985');
});
test('CT FOOD product and container CSV samples map correctly',()=>{
 const product=mapTemplate(readCsv('STT,Mã hàng,Tên hàng hóa,Đơn vị,Hình thức,Khối lượng quy đổi\n1,HH0018,Chân gà,kg,thùng carton,15kg'),'products');
 assert.equal(product[0].conversion_kg,'15kg');
 const container=mapTemplate(readCsv('STT,Mã Công trình (số cont),Tên hàng\n1,MEDU9856808,Chân gà'),'containers');
 assert.equal(container[0].id,'MEDU9856808');
});
test('import migration creates append-only batch table',()=>{
 const db=createDatabase();
 try{
  const table=db.prepare("SELECT name FROM sqlite_master WHERE name='import_batches'").get();
  assert.equal(table.name,'import_batches');
 }finally{db.close()}
});
