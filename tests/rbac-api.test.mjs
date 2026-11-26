// Kiểm thử phân quyền, che giấu dữ liệu tài chính, chuẩn hóa trạng thái và khóa lạc quan
// với JWT RS256 thật (khóa sinh tại chỗ) và D1 giả lập chạy migrations thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const ORIGIN='https://crm-ctfood.pages.dev';
const TEAM='ctfood-test.cloudflareaccess.com';
const AUD='test-audience';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const {privateKey:foreignKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});

const USERS=[
 ['admin@ct.test','Admin','ADMIN',1],
 ['acct@ct.test','Kế toán','ACCOUNTING',1],
 ['salea@ct.test','Sales A','SALES',1],
 ['saleb@ct.test','Sales B','SALES',1],
 ['logi@ct.test','Kho','LOGISTICS',1],
 ['off@ct.test','Đã nghỉ','SALES',0],
];

function setup(){
 const db=createDatabase();
 const ins=db.prepare('INSERT INTO app_users(email,full_name,role,active) VALUES(?,?,?,?)');
 for(const u of USERS)ins.run(...u);
 const c=db.prepare("INSERT INTO customers(id,name,tax_code,phone,owner_email,credit_limit,credit_days,status,updated_at) VALUES(?,?,?,?,?,?,?,?,'2026-01-01T00:00:00.000Z')");
 c.run('KH-A','Khách của A','0100000001','0901111111','salea@ct.test',500000000,30,'ACTIVE');
 c.run('KH-B','Khách của B','0200000002','0902222222','saleb@ct.test',300000000,15,'ACTIVE');
 c.run('KH-X','Giảm 100% đặc biệt','0300000003','0903333333','saleb@ct.test',0,0,'PROSPECT');
 db.prepare("INSERT INTO products(id,name,category,unit) VALUES('SP1','Nạc vai','Thịt heo','kg')").run();
 db.prepare("INSERT INTO containers(id,product_id,quantity_kg,remaining_kg,cost_per_kg) VALUES('CONT1','SP1',28000,15000,61000)").run();
 db.prepare("INSERT INTO leads(id,name,contact,owner_email,stage,updated_at) VALUES('L-A','Lead A','0904','salea@ct.test','NEW','2026-01-01T00:00:00.000Z')").run();
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}

async function token(email,{key=privateKey,aud=AUD,exp='5m',iss='https://'+TEAM}={}){
 return new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(key);
}
async function call(env,email,path,{method='GET',body,jwt,origin=ORIGIN}={}){
 const headers={'Cf-Access-Jwt-Assertion':jwt??await token(email)};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=origin}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,json:await res.json()};
}
const auditCount=db=>db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n;

// ---------- Xác thực ----------
test('JWT ký bằng khóa lạ, sai audience, sai issuer hoặc hết hạn đều bị từ chối 401',async()=>{
 const {env}=setup();
 for(const jwt of [
  await token('admin@ct.test',{key:foreignKey}),
  await token('admin@ct.test',{aud:'other-app'}),
  await token('admin@ct.test',{iss:'https://evil.cloudflareaccess.com'}),
  await token('admin@ct.test',{exp:Math.floor(Date.now()/1000)-60}),
 ]){
  const r=await call(env,null,'/api/me',{jwt});
  assert.equal(r.status,401);
  assert.equal(r.json.ok,false);
 }
});

test('tài khoản ngừng hoạt động hoặc chưa có trong app_users bị từ chối 403',async()=>{
 const {env}=setup();
 assert.equal((await call(env,'off@ct.test','/api/customers')).status,403);
 assert.equal((await call(env,'stranger@gmail.com','/api/customers')).status,403);
});

test('email trong JWT được so khớp không phân biệt hoa thường',async()=>{
 const {env}=setup();
 const r=await call(env,'SaleA@CT.test','/api/me');
 assert.equal(r.status,200);
 assert.equal(r.json.user.role,'SALES');
});

// ---------- Phạm vi dữ liệu của Sales ----------
test('Sales A chỉ thấy khách hàng của mình, không thấy khách của Sales B',async()=>{
 const {env}=setup();
 const r=await call(env,'salea@ct.test','/api/customers');
 assert.equal(r.status,200);
 assert.deepEqual(r.json.data.map(x=>x.id),['KH-A']);
 const s=await call(env,'salea@ct.test','/api/customers?q=Khách');
 assert.deepEqual(s.json.data.map(x=>x.id),['KH-A']);
});

test('Sales A không sửa được khách hàng của Sales B',async()=>{
 const {db,env}=setup();
 const before=auditCount(db);
 const r=await call(env,'salea@ct.test','/api/customers/KH-B',{method:'PATCH',body:{name:'Chiếm khách',expected_updated_at:'2026-01-01T00:00:00.000Z'}});
 assert.equal(r.status,403);
 assert.equal(db.prepare("SELECT name FROM customers WHERE id='KH-B'").get().name,'Khách của B');
 assert.equal(auditCount(db),before);
});

test('tổng quan /api/summary của Sales chỉ đếm khách của mình',async()=>{
 const {env}=setup();
 assert.equal((await call(env,'saleb@ct.test','/api/summary')).json.data.customers,2);
 assert.equal((await call(env,'admin@ct.test','/api/summary')).json.data.customers,3);
});

// ---------- Che dữ liệu tài chính ----------
test('Sales và Kho không nhận hạn mức tín dụng; Kế toán thì có',async()=>{
 const {env}=setup();
 for(const email of ['salea@ct.test','logi@ct.test']){
  const r=await call(env,email,'/api/customers');
  for(const row of r.json.data){assert.ok(!('credit_limit' in row));assert.ok(!('credit_days' in row))}
 }
 const a=await call(env,'acct@ct.test','/api/customers');
 assert.ok(a.json.data.every(row=>'credit_limit' in row));
});

test('giá vốn container không bao giờ xuất hiện trong phản hồi cho Sales',async()=>{
 const {env}=setup();
 const r=await call(env,'salea@ct.test','/api/containers');
 assert.equal(r.status,200);
 assert.ok(r.json.data.length>0);
 assert.doesNotMatch(JSON.stringify(r.json),/cost_per_kg|61000|supplier|import_lot/);
 const a=await call(env,'acct@ct.test','/api/containers');
 assert.equal(a.json.data[0].cost_per_kg,61000);
});

test('Kho (LOGISTICS) không đọc được phiếu thu và khách tiềm năng',async()=>{
 const {env}=setup();
 assert.equal((await call(env,'logi@ct.test','/api/payments')).status,403);
 assert.equal((await call(env,'logi@ct.test','/api/leads')).status,403);
 assert.equal((await call(env,'logi@ct.test','/api/summary')).json.data.leads,null);
});

// ---------- Quyền ghi ----------
test('Sales không tạo được sản phẩm; Kế toán và Kho không ghi được danh mục',async()=>{
 const {db,env}=setup();
 const before=db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
 assert.equal((await call(env,'salea@ct.test','/api/products',{method:'POST',body:{name:'SP lậu'}})).status,403);
 assert.equal((await call(env,'acct@ct.test','/api/customers',{method:'POST',body:{name:'KH'}})).status,403);
 assert.equal((await call(env,'logi@ct.test','/api/leads',{method:'POST',body:{name:'Lead'}})).status,403);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n,before);
});

test('khách do Sales tạo luôn gắn người phụ trách là chính Sales đó (không nhận owner từ client)',async()=>{
 const {db,env}=setup();
 const r=await call(env,'salea@ct.test','/api/customers',{method:'POST',body:{name:'KH mới',owner_email:'saleb@ct.test'}});
 assert.equal(r.status,201);
 assert.equal(db.prepare('SELECT owner_email FROM customers WHERE id=?').get(r.json.data.id).owner_email,'salea@ct.test');
});

test('yêu cầu ghi từ Origin khác bị chặn',async()=>{
 const {env}=setup();
 const r=await call(env,'admin@ct.test','/api/customers',{method:'POST',body:{name:'X'},origin:'https://evil.example'});
 assert.equal(r.status,403);
});

// ---------- Chuẩn hóa trạng thái ----------
test('nhãn tiếng Việt được lưu thành mã chuẩn; trả về đúng mã',async()=>{
 const {db,env}=setup();
 const c=await call(env,'admin@ct.test','/api/customers',{method:'POST',body:{name:'KH nhãn',status:'Tiềm năng'}});
 assert.equal(c.status,201);
 assert.equal(db.prepare('SELECT status FROM customers WHERE id=?').get(c.json.data.id).status,'PROSPECT');
 const l=await call(env,'salea@ct.test','/api/leads',{method:'POST',body:{name:'Lead nhãn',stage:'Đã báo giá'}});
 assert.equal(db.prepare('SELECT stage FROM leads WHERE id=?').get(l.json.data.id).stage,'QUOTED');
 const d=await call(env,'salea@ct.test','/api/leads',{method:'POST',body:{name:'Lead mặc định'}});
 assert.equal(db.prepare('SELECT stage FROM leads WHERE id=?').get(d.json.data.id).stage,'NEW');
});

test('trạng thái không hợp lệ bị từ chối ở API và ở cơ sở dữ liệu',async()=>{
 const {db,env}=setup();
 const r=await call(env,'admin@ct.test','/api/customers',{method:'POST',body:{name:'KH',status:'VIP siêu cấp'}});
 assert.equal(r.status,400);
 assert.throws(()=>db.prepare("INSERT INTO customers(id,name,owner_email,status) VALUES('Z','Z','admin@ct.test','Đang giao dịch')").run(),/ctfood_invalid_customer_status/);
 assert.throws(()=>db.prepare("UPDATE leads SET stage='Mới' WHERE id='L-A'").run(),/ctfood_invalid_lead_stage/);
});

// ---------- Khóa lạc quan ----------
test('sửa với phiên bản cũ trả 409, không ghi đè và không ghi nhật ký',async()=>{
 const {db,env}=setup();
 const first=await call(env,'admin@ct.test','/api/customers/KH-A',{method:'PATCH',body:{name:'Bản sửa 1',expected_updated_at:'2026-01-01T00:00:00.000Z'}});
 assert.equal(first.status,200);
 const afterFirst=auditCount(db);
 const stale=await call(env,'admin@ct.test','/api/customers/KH-A',{method:'PATCH',body:{name:'Bản sửa 2 (cũ)',expected_updated_at:'2026-01-01T00:00:00.000Z'}});
 assert.equal(stale.status,409);
 assert.equal(db.prepare("SELECT name FROM customers WHERE id='KH-A'").get().name,'Bản sửa 1');
 assert.equal(auditCount(db),afterFirst);
 const fresh=await call(env,'admin@ct.test','/api/customers/KH-A',{method:'PATCH',body:{name:'Bản sửa 2',expected_updated_at:first.json.data.updated_at}});
 assert.equal(fresh.status,200);
 assert.equal(auditCount(db),afterFirst+1);
});

test('PATCH thiếu expected_updated_at bị từ chối 428',async()=>{
 const {env}=setup();
 const r=await call(env,'admin@ct.test','/api/leads/L-A',{method:'PATCH',body:{name:'Lead A2'}});
 assert.equal(r.status,428);
});

test('tạo mới + sửa sản phẩm đều ghi đúng một dòng audit_log',async()=>{
 const {db,env}=setup();
 const before=auditCount(db);
 const c=await call(env,'admin@ct.test','/api/products',{method:'POST',body:{name:'Móng giò',group:'Thịt heo'}});
 assert.equal(c.status,201);
 const list=await call(env,'admin@ct.test','/api/products?q=Móng');
 const row=list.json.data[0];
 assert.ok(row.updated_at);
 const u=await call(env,'admin@ct.test','/api/products/'+row.id,{method:'PATCH',body:{name:'Móng giò sau',group:'Thịt heo',expected_updated_at:row.updated_at}});
 assert.equal(u.status,200);
 assert.equal(auditCount(db),before+2);
});

// ---------- Lỗi và tìm kiếm ----------
test('trùng mã số thuế trả 409 với thông báo rõ ràng',async()=>{
 const {env}=setup();
 const r=await call(env,'admin@ct.test','/api/customers',{method:'POST',body:{name:'Trùng',tax:'0100000001'}});
 assert.equal(r.status,409);
 assert.match(r.json.error,/Mã số thuế đã tồn tại/);
});

test('tìm khách theo số điện thoại và mã số thuế',async()=>{
 const {env}=setup();
 assert.deepEqual((await call(env,'admin@ct.test','/api/customers?q=0902222')).json.data.map(x=>x.id),['KH-B']);
 assert.deepEqual((await call(env,'admin@ct.test','/api/customers?q=0100000001')).json.data.map(x=>x.id),['KH-A']);
});

test('ký tự % và _ trong ô tìm kiếm được hiểu theo nghĩa đen',async()=>{
 const {env}=setup();
 assert.deepEqual((await call(env,'admin@ct.test','/api/customers?q=%25')).json.data.map(x=>x.id),['KH-X']);
 assert.equal((await call(env,'admin@ct.test','/api/customers?q=_')).json.data.length,0);
});
