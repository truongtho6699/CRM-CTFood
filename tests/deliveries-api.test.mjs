// LOG-01: phiếu cân — ai nhập, ai xác nhận, giao nhiều lần, khóa phiếu, ảnh hưởng tới trạng thái đơn.
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

async function setup(){
 const db=createDatabase();
 const u=db.prepare('INSERT INTO app_users(email,full_name,role,active) VALUES(?,?,?,?)');
 for(const [e,r] of [['admin@ct.test','ADMIN'],['salea@ct.test','SALES'],['saleb@ct.test','SALES'],['tpkd@ct.test','SALES_MANAGER'],['sadmin@ct.test','SALES_ADMIN'],['kt@ct.test','ACCOUNTING'],['kho@ct.test','LOGISTICS']])u.run(e,e.split('@')[0],r,1);
 db.prepare("INSERT INTO customers(id,name,owner_email,status) VALUES('KH-A','Khách A','salea@ct.test','ACTIVE'),('KH-B','Khách B','saleb@ct.test','ACTIVE')").run();
 db.prepare("INSERT INTO products(id,name,unit,active) VALUES('SP1','Nạc vai','kg',1),('SP2','Móng','kg',1)").run();
 const env={DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD};
 const mk=async(customer,email)=>{
  const r=await call(env,email,'/api/orders',{method:'POST',body:{customer_id:customer,order_type:'IN_STOCK',lines:[{product_id:'SP1',contracted_kg:27000,unit_price_ex_vat:73500},{product_id:'SP2',contracted_kg:1000,unit_price_ex_vat:46000}]}});
  const lines=db.prepare('SELECT id FROM order_lines WHERE order_id=? ORDER BY rowid').all(r.json.data.id).map(x=>x.id);
  return {id:r.json.data.id,lines};
 };
 return {db,env,a:await mk('KH-A','salea@ct.test'),b:await mk('KH-B','saleb@ct.test')};
}
const token=email=>new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
async function call(env,email,path,{method='GET',body}={}){
 const headers={'Cf-Access-Jwt-Assertion':await token(email)};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=ORIGIN}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,json:await res.json()};
}
const ticket=(line,kgv=13000,extra={})=>({order_line_id:line,delivered_kg:kgv,delivery_date:'2026-12-01',vehicle_plate:'29C-123.45',container_no:'sZlu9458358',weigh_ticket_no:'PC-001',...extra});
const verify=(env,email,t)=>call(env,email,'/api/deliveries/'+t.id+'/status',{method:'POST',body:{status:'VERIFIED',expected_updated_at:t.updated_at}});

test('Sale Admin / Kho / Kế toán nhập phiếu; Sales, TPKD không nhập được',async()=>{
 const {env,a}=await setup();
 for(const e of ['sadmin@ct.test','kho@ct.test','kt@ct.test','admin@ct.test'])assert.equal((await call(env,e,'/api/deliveries',{method:'POST',body:ticket(a.lines[0],1000)})).status,201,e);
 for(const e of ['salea@ct.test','tpkd@ct.test'])assert.equal((await call(env,e,'/api/deliveries',{method:'POST',body:ticket(a.lines[0],1000)})).status,403,e);
});

test('chỉ Kế toán (và ADMIN) xác nhận số kg thực giao; phiếu đã xác nhận bị khóa',async()=>{
 const {db,env,a}=await setup();
 const t=(await call(env,'kho@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0])})).json.data;
 for(const e of ['kho@ct.test','sadmin@ct.test','tpkd@ct.test'])assert.equal((await verify(env,e,t)).status,403,e);
 const v=await verify(env,'kt@ct.test',t);
 assert.equal(v.status,200);
 const row=db.prepare('SELECT status,verified_by,container_no FROM deliveries WHERE id=?').get(t.id);
 assert.deepEqual({...row},{status:'VERIFIED',verified_by:'kt@ct.test',container_no:'SZLU9458358'});
 assert.equal((await call(env,'kho@ct.test','/api/deliveries/'+t.id,{method:'PATCH',body:{...ticket(a.lines[0],1),expected_updated_at:v.json.data.updated_at}})).status,409);
 assert.throws(()=>db.prepare("UPDATE deliveries SET delivered_kg=1 WHERE id=?").run(t.id),/ctfood_delivery_locked/);
 const acts=db.prepare("SELECT action FROM audit_log WHERE entity='deliveries' AND entity_id=? ORDER BY rowid").all(t.id).map(r=>r.action);
 assert.deepEqual(acts,['CREATE','VERIFY']);
});

test('giao nhiều lần từ nhiều container: chi tiết đơn cộng đúng kg đã xác nhận và kg chờ xác nhận',async()=>{
 const {env,a}=await setup();
 const t1=(await call(env,'sadmin@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0],13000,{container_no:'CONT-1'})})).json.data;
 await call(env,'sadmin@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0],13950.5,{container_no:'CONT-2'})});
 await verify(env,'kt@ct.test',t1);
 const d=(await call(env,'salea@ct.test','/api/orders/'+a.id)).json.data;
 assert.equal(d.lines[0].verified_kg,13000);
 assert.equal(d.lines[0].pending_kg,13950.5);
 assert.equal(d.delivered_kg,13000);
 assert.equal(d.pending_tickets,1);
});

test('Sales chỉ xem phiếu cân thuộc đơn của mình',async()=>{
 const {env,a,b}=await setup();
 await call(env,'sadmin@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0])});
 const tb=(await call(env,'sadmin@ct.test','/api/deliveries',{method:'POST',body:ticket(b.lines[0])})).json.data;
 assert.equal((await call(env,'salea@ct.test','/api/deliveries')).json.data.length,1);
 assert.equal((await call(env,'salea@ct.test','/api/deliveries/'+tb.id)).status,404);
 assert.equal((await call(env,'kt@ct.test','/api/deliveries?status=PENDING')).json.data.length,2);
});

test('dữ liệu phiếu không hợp lệ bị từ chối',async()=>{
 const {db,env,a}=await setup();
 for(const body of [ticket(a.lines[0],0),ticket(a.lines[0],-5),ticket(a.lines[0],13000,{delivery_date:'01/12/2026'}),ticket('khong-co'),{...ticket(a.lines[0]),delivered_kg:'abc'}]){
  assert.equal((await call(env,'kho@ct.test','/api/deliveries',{method:'POST',body})).status,400,JSON.stringify(body));
 }
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM deliveries').get().n,0);
});

test('hủy phiếu bắt buộc lý do; phiếu đã hủy không tính vào kg',async()=>{
 const {env,a}=await setup();
 const t=(await call(env,'kho@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0])})).json.data;
 assert.equal((await call(env,'kho@ct.test','/api/deliveries/'+t.id+'/status',{method:'POST',body:{status:'CANCELLED',note:' ',expected_updated_at:t.updated_at}})).status,400);
 assert.equal((await call(env,'kho@ct.test','/api/deliveries/'+t.id+'/status',{method:'POST',body:{status:'CANCELLED',note:'Cân nhầm xe',expected_updated_at:t.updated_at}})).status,200);
 const d=(await call(env,'admin@ct.test','/api/orders/'+a.id)).json.data;
 assert.equal(d.lines[0].pending_kg,0);
 assert.equal(d.delivered_kg,0);
});

test('quy tắc đơn: không sửa dòng khi đã có phiếu; Thành công cần phiếu đã xác nhận và không còn phiếu chờ; không hủy đơn khi còn phiếu hiệu lực',async()=>{
 const {db,env,a}=await setup();
 const ver=()=>db.prepare('SELECT updated_at FROM orders WHERE id=?').get(a.id).updated_at;
 const t1=(await call(env,'kho@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0])})).json.data;
 assert.equal((await call(env,'admin@ct.test','/api/orders/'+a.id,{method:'PATCH',body:{order_type:'IN_STOCK',lines:[{product_id:'SP1',contracted_kg:1,unit_price_ex_vat:1}],expected_updated_at:ver()}})).status,409);
 assert.equal((await call(env,'tpkd@ct.test','/api/orders/'+a.id+'/status',{method:'POST',body:{status:'CANCELLED',note:'x',expected_updated_at:ver()}})).status,409);
 await verify(env,'kt@ct.test',t1);
 const t2=(await call(env,'kho@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[1],990)})).json.data;
 const blocked=await call(env,'sadmin@ct.test','/api/orders/'+a.id+'/status',{method:'POST',body:{status:'SUCCESS',expected_updated_at:ver()}});
 assert.equal(blocked.status,409);
 assert.match(blocked.json.error,/chờ Kế toán xác nhận/);
 await verify(env,'kt@ct.test',t2);
 assert.equal((await call(env,'sadmin@ct.test','/api/orders/'+a.id+'/status',{method:'POST',body:{status:'SUCCESS',expected_updated_at:ver()}})).status,200);
 // Đơn đã chốt: không thêm phiếu được nữa (API + trigger).
 assert.equal((await call(env,'kho@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0],5)})).status,409);
 assert.throws(()=>db.prepare("INSERT INTO deliveries(id,order_line_id,delivered_kg,delivery_date,status) VALUES('x',?,1,'2026-12-01','PENDING')").run(a.lines[0]),/ctfood_order_locked/);
});

test('hai người cùng sửa một phiếu: người lưu sau bị 409',async()=>{
 const {env,a}=await setup();
 const t=(await call(env,'kho@ct.test','/api/deliveries',{method:'POST',body:ticket(a.lines[0])})).json.data;
 assert.equal((await call(env,'kho@ct.test','/api/deliveries/'+t.id,{method:'PATCH',body:{...ticket(a.lines[0],13100),expected_updated_at:t.updated_at}})).status,200);
 assert.equal((await call(env,'sadmin@ct.test','/api/deliveries/'+t.id,{method:'PATCH',body:{...ticket(a.lines[0],13200),expected_updated_at:t.updated_at}})).status,409);
 assert.equal((await verify(env,'kt@ct.test',t)).status,409);
});
