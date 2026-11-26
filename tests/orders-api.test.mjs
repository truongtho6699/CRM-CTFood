// ORDER-01: đơn hàng nhiều dòng — phạm vi Sales, kiểm tra dữ liệu, mã đơn, khóa lạc quan, chuyển trạng thái, audit.
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
 for(const [e,r] of [['admin@ct.test','ADMIN'],['salea@ct.test','SALES'],['saleb@ct.test','SALES'],['tpkd@ct.test','SALES_MANAGER'],['sadmin@ct.test','SALES_ADMIN'],['kt@ct.test','ACCOUNTING'],['kho@ct.test','LOGISTICS'],['bod@ct.test','BOD']])u.run(e,e.split('@')[0],r,1);
 const c=db.prepare("INSERT INTO customers(id,name,owner_email,status) VALUES(?,?,?,?)");
 c.run('KH-A','Khách A','salea@ct.test','ACTIVE');c.run('KH-B','Khách B','saleb@ct.test','ACTIVE');c.run('KH-OFF','Khách nghỉ','salea@ct.test','INACTIVE');
 const p=db.prepare("INSERT INTO products(id,name,unit,active) VALUES(?,?,'kg',?)");
 p.run('SP1','Nạc vai',1);p.run('SP2','Móng giò',1);p.run('SP-OLD','Ngừng bán',0);
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}
const token=email=>new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
async function call(env,email,path,{method='GET',body}={}){
 const headers={'Cf-Access-Jwt-Assertion':await token(email)};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=ORIGIN}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,json:await res.json()};
}
const order=(extra={})=>({customer_id:'KH-A',order_type:'IN_STOCK',expected_date:'2026-12-05',delivery_address:'Kho khách',deposit_expected:200000000,container_count:1,
 lines:[{product_id:'SP1',contracted_kg:27000,unit_price_ex_vat:73500,commission_per_kg:500},{product_id:'SP2',contracted_kg:1000.5,unit_price_ex_vat:46000}],...extra});
const audits=(db,id)=>db.prepare("SELECT action FROM audit_log WHERE entity='orders' AND entity_id=? ORDER BY rowid").all(id).map(r=>r.action);

test('Sales tạo đơn cho khách của mình: mã đơn tự sinh, Chờ giao, tổng kg và thành tiền đúng, có audit',async()=>{
 const {db,env}=setup();
 const r=await call(env,'salea@ct.test','/api/orders',{method:'POST',body:order()});
 assert.equal(r.status,201,JSON.stringify(r.json));
 assert.match(r.json.data.code,/^DH\d{4}-0001$/);
 const d=await call(env,'salea@ct.test','/api/orders/'+r.json.data.id);
 assert.equal(d.json.data.status,'PENDING');
 assert.equal(d.json.data.sales_email,'salea@ct.test');
 assert.equal(d.json.data.lines.length,2);
 assert.equal(d.json.data.total_kg,28000.5);
 assert.equal(d.json.data.total_amount,27000*73500+1000.5*46000);
 assert.equal(d.json.data.lines[0].commission_per_kg,500);
 assert.deepEqual(audits(db,r.json.data.id),['CREATE']);
 const r2=await call(env,'salea@ct.test','/api/orders',{method:'POST',body:order()});
 assert.match(r2.json.data.code,/-0002$/);
});

test('Sales không tạo/xem/sửa đơn của khách người khác; danh sách chỉ có đơn của mình',async()=>{
 const {env}=setup();
 assert.equal((await call(env,'salea@ct.test','/api/orders',{method:'POST',body:order({customer_id:'KH-B'})})).status,403);
 const b=await call(env,'saleb@ct.test','/api/orders',{method:'POST',body:order({customer_id:'KH-B'})});
 const a=await call(env,'salea@ct.test','/api/orders',{method:'POST',body:order()});
 assert.equal((await call(env,'salea@ct.test','/api/orders/'+b.json.data.id)).status,404);
 assert.equal((await call(env,'salea@ct.test','/api/orders/'+b.json.data.id,{method:'PATCH',body:{...order({customer_id:'KH-B'}),expected_updated_at:b.json.data.updated_at}})).status,404);
 assert.deepEqual((await call(env,'salea@ct.test','/api/orders')).json.data.map(o=>o.id),[a.json.data.id]);
 assert.equal((await call(env,'tpkd@ct.test','/api/orders')).json.data.length,2);
});

test('TPKD/Sale Admin tạo đơn thì đơn thuộc Sales phụ trách khách hàng',async()=>{
 const {env}=setup();
 const r=await call(env,'tpkd@ct.test','/api/orders',{method:'POST',body:order({customer_id:'KH-B'})});
 assert.equal(r.status,201);
 assert.equal((await call(env,'saleb@ct.test','/api/orders/'+r.json.data.id)).json.data.sales_email,'saleb@ct.test');
});

test('Kế toán và Kho chỉ xem, không tạo hay sửa đơn',async()=>{
 const {env}=setup();
 const r=await call(env,'admin@ct.test','/api/orders',{method:'POST',body:order()});
 for(const e of ['kt@ct.test','kho@ct.test']){
  assert.equal((await call(env,e,'/api/orders')).json.data.length,1);
  assert.equal((await call(env,e,'/api/orders',{method:'POST',body:order()})).status,403);
  assert.equal((await call(env,e,'/api/orders/'+r.json.data.id,{method:'PATCH',body:{...order(),expected_updated_at:r.json.data.updated_at}})).status,403);
 }
});

test('dữ liệu không hợp lệ bị từ chối',async()=>{
 const {db,env}=setup();
 const cases=[
  order({lines:[]}),
  order({order_type:'KHAC'}),
  order({customer_id:'KH-OFF'}),
  order({customer_id:'KHONG-CO'}),
  order({lines:[{product_id:'SP-OLD',contracted_kg:10,unit_price_ex_vat:1000}]}),
  order({lines:[{product_id:'SP1',contracted_kg:0,unit_price_ex_vat:1000}]}),
  order({lines:[{product_id:'SP1',contracted_kg:10,unit_price_ex_vat:1000.5}]}),
  order({lines:[{product_id:'SP1',contracted_kg:10,unit_price_ex_vat:1000,commission_per_kg:2000}]}),
  order({expected_date:'26/12/2026'}),
  order({deposit_expected:-1}),
 ];
 for(const body of cases){
  const r=await call(env,'admin@ct.test','/api/orders',{method:'POST',body});
  assert.equal(r.status,400,JSON.stringify(body)+' → '+JSON.stringify(r.json));
 }
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_lines').get().n,0);
});

test('sửa đơn thay toàn bộ dòng hàng; phiên bản cũ bị 409 và không mất dòng hàng',async()=>{
 const {db,env}=setup();
 const c=await call(env,'salea@ct.test','/api/orders',{method:'POST',body:order()});
 const id=c.json.data.id,v0=c.json.data.updated_at;
 const u=await call(env,'salea@ct.test','/api/orders/'+id,{method:'PATCH',body:{...order({lines:[{product_id:'SP2',contracted_kg:500,unit_price_ex_vat:47000}]}),expected_updated_at:v0}});
 assert.equal(u.status,200,JSON.stringify(u.json));
 const stale=await call(env,'tpkd@ct.test','/api/orders/'+id,{method:'PATCH',body:{...order(),expected_updated_at:v0}});
 assert.equal(stale.status,409);
 const lines=db.prepare('SELECT product_id,contracted_kg FROM order_lines WHERE order_id=?').all(id);
 assert.deepEqual(lines.map(l=>[l.product_id,l.contracted_kg]),[['SP2',500]]);
 assert.deepEqual(audits(db,id),['CREATE','UPDATE']);
 assert.equal((await call(env,'salea@ct.test','/api/orders/'+id,{method:'PATCH',body:order()})).status,428);
});

test('chuyển trạng thái: Sale Admin xác nhận thành công, TPKD hủy có lý do; đơn đã chốt không sửa được',async()=>{
 const {db,env}=setup();
 const a=await call(env,'salea@ct.test','/api/orders',{method:'POST',body:order()});
 const b=await call(env,'salea@ct.test','/api/orders',{method:'POST',body:order()});
 // Sales không tự chốt; TPKD không xác nhận giao; Sale Admin không hủy.
 assert.equal((await call(env,'salea@ct.test','/api/orders/'+a.json.data.id+'/status',{method:'POST',body:{status:'SUCCESS',expected_updated_at:a.json.data.updated_at}})).status,403);
 assert.equal((await call(env,'tpkd@ct.test','/api/orders/'+a.json.data.id+'/status',{method:'POST',body:{status:'SUCCESS',expected_updated_at:a.json.data.updated_at}})).status,403);
 assert.equal((await call(env,'sadmin@ct.test','/api/orders/'+b.json.data.id+'/status',{method:'POST',body:{status:'CANCELLED',note:'x',expected_updated_at:b.json.data.updated_at}})).status,403);
 // Hủy thiếu lý do.
 assert.equal((await call(env,'tpkd@ct.test','/api/orders/'+b.json.data.id+'/status',{method:'POST',body:{status:'CANCELLED',note:'  ',expected_updated_at:b.json.data.updated_at}})).status,400);
 // LOG-01: chưa có phiếu cân được Kế toán xác nhận thì chưa "Thành công".
 assert.equal((await call(env,'sadmin@ct.test','/api/orders/'+a.json.data.id+'/status',{method:'POST',body:{status:'SUCCESS',expected_updated_at:a.json.data.updated_at}})).status,409);
 const lineId=db.prepare('SELECT id FROM order_lines WHERE order_id=? LIMIT 1').get(a.json.data.id).id;
 const t=await call(env,'sadmin@ct.test','/api/deliveries',{method:'POST',body:{order_line_id:lineId,delivered_kg:26950,delivery_date:'2026-12-05'}});
 assert.equal((await call(env,'kt@ct.test','/api/deliveries/'+t.json.data.id+'/status',{method:'POST',body:{status:'VERIFIED',expected_updated_at:t.json.data.updated_at}})).status,200);
 const ok=await call(env,'sadmin@ct.test','/api/orders/'+a.json.data.id+'/status',{method:'POST',body:{status:'SUCCESS',expected_updated_at:a.json.data.updated_at}});
 assert.equal(ok.status,200);
 const cancel=await call(env,'tpkd@ct.test','/api/orders/'+b.json.data.id+'/status',{method:'POST',body:{status:'CANCELLED',note:'Khách đổi kế hoạch',expected_updated_at:b.json.data.updated_at}});
 assert.equal(cancel.status,200);
 const row=db.prepare('SELECT status,status_note,status_by FROM orders WHERE id=?').get(b.json.data.id);
 assert.deepEqual({...row},{status:'CANCELLED',status_note:'Khách đổi kế hoạch',status_by:'tpkd@ct.test'});
 assert.deepEqual(audits(db,b.json.data.id),['CREATE','CANCEL']);
 // Đơn đã chốt: không sửa, không đổi trạng thái lại.
 assert.equal((await call(env,'admin@ct.test','/api/orders/'+a.json.data.id,{method:'PATCH',body:{...order(),expected_updated_at:ok.json.data.updated_at}})).status,409);
 assert.equal((await call(env,'admin@ct.test','/api/orders/'+a.json.data.id+'/status',{method:'POST',body:{status:'CANCELLED',note:'x',expected_updated_at:ok.json.data.updated_at}})).status,409);
 // Lọc theo trạng thái.
 assert.deepEqual((await call(env,'admin@ct.test','/api/orders?status=SUCCESS')).json.data.map(o=>o.id),[a.json.data.id]);
});

test('cơ sở dữ liệu chặn trạng thái lạ, hủy thiếu lý do, sửa dòng hàng của đơn đã chốt',async()=>{
 const {db,env}=setup();
 const a=await call(env,'admin@ct.test','/api/orders',{method:'POST',body:order()});
 const id=a.json.data.id;
 assert.throws(()=>db.prepare("UPDATE orders SET status='DRAFT' WHERE id=?").run(id),/ctfood_invalid_order_status/);
 assert.throws(()=>db.prepare("UPDATE orders SET status='CANCELLED' WHERE id=?").run(id),/ctfood_cancel_reason_required/);
 db.prepare("UPDATE orders SET status='SUCCESS' WHERE id=?").run(id);
 assert.throws(()=>db.prepare("INSERT INTO order_lines(id,order_id,product_id,contracted_kg,unit_price_ex_vat) VALUES('x',?,'SP1',1,1)").run(id),/ctfood_order_locked/);
 assert.throws(()=>db.prepare("UPDATE orders SET status='PENDING' WHERE id=?").run(id),/ctfood_order_status_final/);
});

test('tìm đơn theo mã hoặc tên khách',async()=>{
 const {env}=setup();
 const a=await call(env,'admin@ct.test','/api/orders',{method:'POST',body:order()});
 await call(env,'admin@ct.test','/api/orders',{method:'POST',body:order({customer_id:'KH-B'})});
 assert.deepEqual((await call(env,'admin@ct.test','/api/orders?q='+a.json.data.code)).json.data.map(o=>o.id),[a.json.data.id]);
 assert.equal((await call(env,'admin@ct.test','/api/orders?q='+encodeURIComponent('Khách B'))).json.data.length,1);
});

test('tiến trình đơn: giá trị đã giao xác nhận và đã thu; Kho không thấy số tiền đã thu',async()=>{
 const {db,env}=setup();
 const a=await call(env,'admin@ct.test','/api/orders',{method:'POST',body:order()});
 const line=db.prepare('SELECT id FROM order_lines WHERE order_id=? ORDER BY rowid LIMIT 1').get(a.json.data.id).id;
 db.prepare("INSERT INTO deliveries(id,order_line_id,delivered_kg,delivery_date,status) VALUES('d1',?,1000,'2026-12-01','VERIFIED')").run(line);
 db.prepare("INSERT INTO payments(id,customer_id,amount,payment_date,payment_type,method,status,created_by,updated_at) VALUES('p1','KH-A',50000000,'2026-12-02','PAYMENT','BANK','ACTIVE','kt@ct.test','v')").run();
 db.prepare("INSERT INTO payment_allocations(id,payment_id,order_id,amount) VALUES('pa1','p1',?,30000000)").run(a.json.data.id);
 const d=(await call(env,'admin@ct.test','/api/orders/'+a.json.data.id)).json.data;
 assert.equal(d.delivered_value,73500000);
 assert.equal(d.paid,30000000);
 const w=(await call(env,'kho@ct.test','/api/orders')).json.data[0];
 assert.ok(!('paid' in w));
 assert.equal(w.delivered_value,73500000);
});
