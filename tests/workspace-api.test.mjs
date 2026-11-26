// Bước 2 UI/UX: "Việc cần làm", chi tiết khách hàng, lịch chăm sóc — đúng phạm vi theo vai trò.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const ORIGIN='https://crm-ctfood.pages.dev';
const TEAM='ctfood-test.cloudflareaccess.com';
const AUD='test-audience';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});

function setup(){
 const db=createDatabase();
 const u=db.prepare('INSERT INTO app_users(email,full_name,role,active) VALUES(?,?,?,?)');
 for(const [e,r] of [['admin@ct.test','ADMIN'],['salea@ct.test','SALES'],['saleb@ct.test','SALES'],['kt@ct.test','ACCOUNTING'],['kho@ct.test','LOGISTICS'],['tpkd@ct.test','SALES_MANAGER']])u.run(e,e.split('@')[0]+' name',r,1);
 db.exec(`INSERT INTO customers(id,name,owner_email,status,credit_limit,credit_days) VALUES('KH-A','Khách A','salea@ct.test','ACTIVE',900000000,30),('KH-B','Khách B','saleb@ct.test','ACTIVE',0,15);
 INSERT INTO products(id,name,unit) VALUES('SP1','Nạc vai','kg');
 INSERT INTO orders(id,code,customer_id,sales_email,order_type,status,expected_date,updated_at) VALUES
  ('O-A1','DH-A1','KH-A','salea@ct.test','IN_STOCK','PENDING','2026-01-05','v'),('O-A2','DH-A2','KH-A','salea@ct.test','IN_STOCK','PENDING',NULL,'v'),('O-B1','DH-B1','KH-B','saleb@ct.test','IN_STOCK','PENDING','2026-01-06','v');
 INSERT INTO order_lines(id,order_id,product_id,contracted_kg,unit_price_ex_vat) VALUES('L1','O-A1','SP1',1000,50000),('L2','O-A2','SP1',10,1000),('L3','O-B1','SP1',200,40000);
 INSERT INTO deliveries(id,order_line_id,delivered_kg,delivery_date,status) VALUES('D1','L1',1000,'2025-12-01','VERIFIED'),('D2','L3',100,'2026-01-02','PENDING');
 INSERT INTO payments(id,customer_id,amount,payment_date,payment_type,method,status,created_by,updated_at) VALUES('P1','KH-A',60000000,'2025-12-05','PAYMENT','BANK','ACTIVE','kt@ct.test','v');
 INSERT INTO payment_allocations(id,payment_id,order_id,amount) VALUES('PA1','P1','O-A1',10000000);
 INSERT INTO activities(id,customer_id,title,due_date,owner_email,status) VALUES('AC1','KH-A','Gọi lại','2025-12-01','salea@ct.test','PENDING'),('AC2','KH-B','Gửi báo giá','2025-12-01','saleb@ct.test','PENDING'),('AC3','KH-A','Sau này','2099-01-01','salea@ct.test','PENDING');
 INSERT INTO leads(id,name,owner_email,stage) VALUES('LD1','Lead','salea@ct.test','NEW'),('LD2','Lead2','saleb@ct.test','REJECTED');`);
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}
const token=email=>new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
async function call(env,email,path,{method='GET',body}={}){
 const headers={'Cf-Access-Jwt-Assertion':await token(email)};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=ORIGIN}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,json:await res.json()};
}

test('Việc cần làm của Sales chỉ gồm việc của mình',async()=>{
 const {env}=setup();
 const b=(await call(env,'salea@ct.test','/api/worklist')).json.data.blocks;
 assert.deepEqual(b.orders.items.map(o=>o.code),['DH-A1','DH-A2'],'đơn có ngày giao trước, đơn chưa có ngày sau');
 assert.equal(b.orders.due_soon,1);
 assert.equal(b.tickets,undefined,'Sales không có hàng chờ phiếu cân');
 assert.equal(b.overdue.count,1);
 assert.equal(b.overdue.amount,40000000);
 assert.equal(b.credits,undefined,'tiền chưa phân bổ là việc của Kế toán');
 assert.deepEqual(b.activities.items.map(a=>a.id),['AC1'],'chỉ việc đến hạn của mình');
 assert.equal(b.leads.count,1);
});

test('Việc cần làm của Kế toán có phiếu chờ xác nhận và tiền chưa phân bổ; Kho không thấy tài chính',async()=>{
 const {env}=setup();
 const k=(await call(env,'kt@ct.test','/api/worklist')).json.data.blocks;
 assert.equal(k.tickets.count,1);
 assert.equal(k.credits.amount,50000000);
 assert.equal(k.orders.count,3);
 const w=(await call(env,'kho@ct.test','/api/worklist')).json.data.blocks;
 assert.equal(w.tickets.count,1);
 for(const key of ['overdue','credits','revenue','activities','leads'])assert.equal(w[key],undefined,key);
});

test('chi tiết khách hàng: Sales chỉ xem khách của mình; hạn mức tín dụng chỉ cho vai trò tài chính',async()=>{
 const {env}=setup();
 assert.equal((await call(env,'salea@ct.test','/api/customers/KH-B/overview')).status,404);
 const a=(await call(env,'salea@ct.test','/api/customers/KH-A/overview')).json.data;
 assert.equal(a.customer.owner_name,'salea name');
 assert.ok(!('credit_limit' in a.customer));
 assert.deepEqual(a.orders.map(o=>o.code).sort(),['DH-A1','DH-A2']);
 assert.equal(a.receivables.balance,40000000);
 assert.equal(a.receivables.unallocated,50000000);
 assert.equal(a.payments.length,1);
 assert.equal(a.activities.length,2);
 const k=(await call(env,'kt@ct.test','/api/customers/KH-A/overview')).json.data;
 assert.equal(k.customer.credit_limit,900000000);
 const w=(await call(env,'kho@ct.test','/api/customers/KH-A/overview')).json.data;
 assert.equal(w.receivables,undefined);assert.equal(w.payments,undefined);assert.equal(w.activities,undefined);
});

test('lịch chăm sóc: Sales tạo việc cho khách của mình, đánh dấu xong; không tạo cho khách người khác',async()=>{
 const {db,env}=setup();
 const r=await call(env,'salea@ct.test','/api/activities',{method:'POST',body:{customer_id:'KH-A',title:'Gửi mẫu sườn',due_date:'2026-02-01'}});
 assert.equal(r.status,201);
 assert.equal(db.prepare('SELECT owner_email FROM activities WHERE id=?').get(r.json.data.id).owner_email,'salea@ct.test');
 assert.equal((await call(env,'salea@ct.test','/api/activities',{method:'POST',body:{customer_id:'KH-B',title:'x',due_date:'2026-02-01'}})).status,403);
 assert.equal((await call(env,'salea@ct.test','/api/activities',{method:'POST',body:{customer_id:'KH-A',title:' ',due_date:'2026-02-01'}})).status,400);
 assert.equal((await call(env,'salea@ct.test','/api/activities',{method:'POST',body:{customer_id:'KH-A',title:'x',due_date:'01/02/2026'}})).status,400);
 assert.equal((await call(env,'kt@ct.test','/api/activities',{method:'POST',body:{customer_id:'KH-A',title:'x',due_date:'2026-02-01'}})).status,403);
 assert.equal((await call(env,'saleb@ct.test','/api/activities/AC1/done',{method:'POST',body:{}})).status,404);
 assert.equal((await call(env,'salea@ct.test','/api/activities/AC1/done',{method:'POST',body:{}})).status,200);
 assert.equal(db.prepare("SELECT status FROM activities WHERE id='AC1'").get().status,'DONE');
 assert.deepEqual(db.prepare("SELECT action FROM audit_log WHERE entity='activities' ORDER BY rowid").all().map(x=>x.action),['CREATE','COMPLETE']);
 assert.equal((await call(env,'kho@ct.test','/api/activities',{method:'POST',body:{customer_id:'KH-A',title:'x',due_date:'2026-02-01'}})).status,403);
});
