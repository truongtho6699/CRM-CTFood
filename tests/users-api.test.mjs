// ADM-01: Quản lý người dùng — chỉ ADMIN, chống tự khóa, luôn còn ít nhất một ADMIN, khóa lạc quan, audit.
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
 const ins=db.prepare('INSERT INTO app_users(email,full_name,role,active) VALUES(?,?,?,?)');
 ins.run('admin@ct.test','Admin','ADMIN',1);
 ins.run('admin2@ct.test','Admin 2','ADMIN',1);
 ins.run('sale@ct.test','Sales','SALES',1);
 ins.run('bod@ct.test','BGĐ','BOD',1);
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}
const token=email=>new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
async function call(env,email,path,{method='GET',body}={}){
 const headers={'Cf-Access-Jwt-Assertion':await token(email)};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=ORIGIN}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,json:await res.json()};
}
const version=(db,email)=>db.prepare('SELECT updated_at FROM app_users WHERE email=?').get(email).updated_at;
const enc=encodeURIComponent;

test('chỉ ADMIN được xem và ghi danh sách người dùng',async()=>{
 const {env}=setup();
 const ok=await call(env,'admin@ct.test','/api/users');
 assert.equal(ok.status,200);
 assert.equal(ok.json.data.length,4);
 assert.ok(ok.json.data.every(u=>u.updated_at));
 for(const email of ['sale@ct.test','bod@ct.test']){
  assert.equal((await call(env,email,'/api/users')).status,403);
  assert.equal((await call(env,email,'/api/users',{method:'POST',body:{email:'x@ct.test',full_name:'X',role:'ADMIN',active:true}})).status,403);
 }
});

test('ADMIN tạo tài khoản: email chuẩn hóa chữ thường, ghi audit, người mới đăng nhập được',async()=>{
 const {db,env}=setup();
 const r=await call(env,'admin@ct.test','/api/users',{method:'POST',body:{email:'  New.Sale@CT.test ',full_name:'Sales mới',role:'sales',active:true}});
 assert.equal(r.status,201);
 assert.equal(r.json.data.email,'new.sale@ct.test');
 assert.equal(r.json.data.role,'SALES');
 const a=db.prepare("SELECT actor_email,action FROM audit_log WHERE entity='app_users' AND entity_id='new.sale@ct.test'").all();
 assert.deepEqual(a.map(x=>[x.actor_email,x.action]),[['admin@ct.test','CREATE']]);
 const me=await call(env,'new.sale@ct.test','/api/me');
 assert.equal(me.status,200);
 assert.equal(me.json.user.role,'SALES');
});

test('dữ liệu không hợp lệ bị từ chối: email sai, vai trò lạ, thiếu họ tên, active sai kiểu, email trùng',async()=>{
 const {env}=setup();
 const bad=[
  [{email:'khong-phai-email',full_name:'A',role:'SALES',active:true},400],
  [{email:'a@ct.test',full_name:'A',role:'SUPERUSER',active:true},400],
  [{email:'a@ct.test',full_name:'  ',role:'SALES',active:true},400],
  [{email:'a@ct.test',full_name:'A',role:'SALES',active:'yes'},400],
  [{email:'SALE@ct.test',full_name:'Trùng',role:'SALES',active:true},409],
 ];
 for(const [body,status] of bad){
  const r=await call(env,'admin@ct.test','/api/users',{method:'POST',body});
  assert.equal(r.status,status,JSON.stringify(body));
 }
});

test('khóa tài khoản Sales → Sales đó bị chặn ngay ở mọi API',async()=>{
 const {env,db}=setup();
 const r=await call(env,'admin@ct.test','/api/users/'+enc('sale@ct.test'),{method:'PATCH',body:{full_name:'Sales',role:'SALES',active:false,expected_updated_at:version(db,'sale@ct.test')}});
 assert.equal(r.status,200);
 assert.equal((await call(env,'sale@ct.test','/api/customers')).status,403);
});

test('ADMIN không thể tự hạ quyền hoặc tự khóa mình',async()=>{
 const {env,db}=setup();
 for(const body of [{full_name:'Admin',role:'SALES',active:true},{full_name:'Admin',role:'ADMIN',active:false}]){
  const r=await call(env,'admin@ct.test','/api/users/'+enc('admin@ct.test'),{method:'PATCH',body:{...body,expected_updated_at:version(db,'admin@ct.test')}});
  assert.equal(r.status,400);
 }
 assert.equal(db.prepare("SELECT role FROM app_users WHERE email='admin@ct.test'").get().role,'ADMIN');
 // Được đổi họ tên của chính mình.
 const rename=await call(env,'admin@ct.test','/api/users/'+enc('admin@ct.test'),{method:'PATCH',body:{full_name:'Admin đổi tên',role:'ADMIN',active:true,expected_updated_at:version(db,'admin@ct.test')}});
 assert.equal(rename.status,200);
});

test('ADMIN hạ quyền hoặc khóa được ADMIN khác, hệ thống vẫn còn ADMIN đang hoạt động',async()=>{
 const {env,db}=setup();
 const r=await call(env,'admin@ct.test','/api/users/'+enc('admin2@ct.test'),{method:'PATCH',body:{full_name:'Admin 2',role:'BOD',active:false,expected_updated_at:version(db,'admin2@ct.test')}});
 assert.equal(r.status,200);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM app_users WHERE role='ADMIN' AND active=1").get().n,1);
 assert.equal((await call(env,'admin2@ct.test','/api/me')).status,403);
});

test('hai quản trị cùng sửa một tài khoản: người lưu sau nhận 409, không ghi đè, không ghi audit',async()=>{
 const {env,db}=setup();
 const v0=version(db,'sale@ct.test');
 const first=await call(env,'admin@ct.test','/api/users/'+enc('sale@ct.test'),{method:'PATCH',body:{full_name:'Sales A',role:'SALES_MANAGER',active:true,expected_updated_at:v0}});
 assert.equal(first.status,200);
 const n=db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity='app_users'").get().n;
 const stale=await call(env,'admin2@ct.test','/api/users/'+enc('sale@ct.test'),{method:'PATCH',body:{full_name:'Sales B',role:'LOGISTICS',active:true,expected_updated_at:v0}});
 assert.equal(stale.status,409);
 assert.equal(db.prepare("SELECT role FROM app_users WHERE email='sale@ct.test'").get().role,'SALES_MANAGER');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity='app_users'").get().n,n);
 assert.equal((await call(env,'admin@ct.test','/api/users/'+enc('sale@ct.test'),{method:'PATCH',body:{full_name:'X',role:'SALES',active:true}})).status,428);
 assert.equal((await call(env,'admin@ct.test','/api/users/'+enc('nobody@ct.test'),{method:'PATCH',body:{full_name:'X',role:'SALES',active:true,expected_updated_at:'x'}})).status,404);
});

test('migration 0004: email chữ hoa bị chặn ở DB, bản ghi seed không có updated_at vẫn được gán phiên bản',()=>{
 const {db}=setup();
 assert.throws(()=>db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('Upper@ct.test','U','SALES')").run(),/ctfood_invalid_email_case/);
 db.prepare("INSERT INTO app_users(email,full_name,role,active) VALUES('seed@demo.ctfood.invalid','Seed','SALES',0)").run();
 assert.ok(version(db,'seed@demo.ctfood.invalid'));
});
