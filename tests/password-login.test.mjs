// Đăng nhập bằng tên đăng nhập + mật khẩu, phiên CRM, khóa khi sai nhiều lần, đổi/đặt mật khẩu (migration 0011).
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {hashPassword,verifyPassword,COOKIE} from '../worker/src/auth.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const ORIGIN='https://crm-ctfood.pages.dev';
const TEAM='ctfood-test.cloudflareaccess.com';
const AUD='test-audience';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});
const jwt=email=>new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);

async function setup(){
 const db=createDatabase();
 const hash=await hashPassword('Matkhau2026');
 db.prepare("INSERT INTO app_users(email,full_name,role,username,password_hash) VALUES('admin@ct.test','Admin','ADMIN','admin',NULL),('an@ct.test','An','SALES','nv.an',?),('off@ct.test','Off','SALES','nv.off',?)").run(hash,hash);
 db.prepare("UPDATE app_users SET active=0 WHERE email='off@ct.test'").run();
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}
async function req(env,path,{method='GET',body,cookie,origin=ORIGIN,form,ip='1.1.1.1',access}={}){
 const headers={'CF-Connecting-IP':ip};
 if(origin&&method!=='GET')headers.Origin=origin;
 if(cookie)headers.Cookie=cookie;
 if(access)headers['Cf-Access-Jwt-Assertion']=await jwt(access);
 let payload;
 if(form){headers['Content-Type']='application/x-www-form-urlencoded';payload=new URLSearchParams(form).toString()}
 else if(body!==undefined){headers['Content-Type']='application/json';payload=JSON.stringify(body)}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:payload,redirect:'manual'}),env);
 const text=await res.text();
 let json=null;try{json=JSON.parse(text)}catch{}
 const set=res.headers.get('Set-Cookie')||'';
 return {status:res.status,json,location:res.headers.get('Location'),setCookie:set,cookie:set.split(';')[0]};
}
const login=(env,username,password,opt={})=>req(env,'/api/auth/login',{method:'POST',body:{username,password},...opt});

test('băm mật khẩu: có salt, xác minh đúng/sai',async()=>{
 const a=await hashPassword('Matkhau2026'),b=await hashPassword('Matkhau2026');
 assert.notEqual(a,b);
 assert.match(a,/^pbkdf2-sha256\$100000\$/);
 assert.equal(await verifyPassword('Matkhau2026',a),true);
 assert.equal(await verifyPassword('matkhau2026',a),false);
 assert.equal(await verifyPassword('x',null),false);
});

test('đăng nhập đúng tạo phiên HttpOnly; dùng phiên gọi API; đăng xuất thì phiên hết hiệu lực',async()=>{
 const {env,db}=await setup();
 const r=await login(env,'NV.An','Matkhau2026');
 assert.equal(r.status,200);
 assert.match(r.setCookie,new RegExp('^'+COOKIE.replace(/[$]/g,'\\$')+'=[A-Za-z0-9_-]{40,}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200$'));
 const token=r.cookie.split('=')[1];
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM auth_sessions WHERE token_hash=?').get(token).n,0,'không lưu mã phiên gốc');
 const me=await req(env,'/api/me',{cookie:r.cookie});
 assert.equal(me.status,200);
 assert.equal(me.json.user.email,'an@ct.test');
 assert.equal(me.json.user.auth_method,'PASSWORD');
 assert.ok(!('session_hash' in me.json.user));
 assert.equal((await req(env,'/api/customers',{cookie:r.cookie})).status,200);
 assert.equal((await req(env,'/api/users',{cookie:r.cookie})).status,403,'Sales không vào quản lý người dùng');
 const out=await req(env,'/api/auth/logout',{method:'POST',cookie:r.cookie});
 assert.equal(out.status,200);
 assert.match(out.setCookie,/Max-Age=0/);
 assert.equal((await req(env,'/api/me',{cookie:r.cookie})).status,401);
});

test('sai mật khẩu, tên không tồn tại, tài khoản ngừng: cùng một thông báo',async()=>{
 const {env}=await setup();
 for(const [u,p] of [['nv.an','sai-mat-khau1'],['khongco','Matkhau2026'],['nv.off','Matkhau2026'],['admin','Matkhau2026'],["' OR 1=1 --",'x']]){
  const r=await login(env,u,p);
  assert.equal(r.status,401,u);
  assert.equal(r.json.error,'Tên đăng nhập hoặc mật khẩu không đúng');
  assert.equal(r.setCookie,'');
 }
});

test('sai 5 lần thì khóa 15 phút, kể cả mật khẩu đúng; Admin mở khóa được',async()=>{
 const {env,db}=await setup();
 for(let i=0;i<5;i++)assert.equal((await login(env,'nv.an','sai-mat-khau1')).status,401);
 const locked=await login(env,'nv.an','Matkhau2026');
 assert.equal(locked.status,423);
 assert.equal(locked.setCookie,'');
 assert.ok(db.prepare("SELECT locked_until FROM app_users WHERE email='an@ct.test'").get().locked_until);
 const admin=(await req(env,'/auth/google',{access:'admin@ct.test'})).cookie;
 assert.equal((await req(env,'/api/users/an%40ct.test/login',{method:'POST',cookie:admin,body:{unlock:true}})).status,200);
 assert.equal((await login(env,'nv.an','Matkhau2026')).status,200);
});

test('chặn dò mật khẩu theo IP sau 20 lần sai trong 15 phút',async()=>{
 const {env}=await setup();
 for(let i=0;i<20;i++)await login(env,'khongco'+i,'x',{ip:'9.9.9.9'});
 assert.equal((await login(env,'nv.an','Matkhau2026',{ip:'9.9.9.9'})).status,429);
 assert.equal((await login(env,'nv.an','Matkhau2026',{ip:'8.8.8.8'})).status,200);
});

test('form đăng nhập trên trang /login: chuyển hướng 303',async()=>{
 const {env}=await setup();
 const ok=await req(env,'/api/auth/login',{method:'POST',form:{username:'nv.an',password:'Matkhau2026'}});
 assert.equal(ok.status,303);assert.equal(ok.location,'/');assert.ok(ok.cookie);
 const bad=await req(env,'/api/auth/login',{method:'POST',form:{username:'nv.an',password:'sai'}});
 assert.equal(bad.status,303);assert.equal(bad.location,'/login?e=bad');assert.equal(bad.setCookie,'');
});

test('chống CSRF: đăng nhập và mọi yêu cầu ghi phải cùng Origin',async()=>{
 const {env}=await setup();
 assert.equal((await login(env,'nv.an','Matkhau2026',{origin:'https://evil.example'})).status,403);
 assert.equal((await login(env,'nv.an','Matkhau2026',{origin:null})).status,403);
 const c=(await login(env,'nv.an','Matkhau2026')).cookie;
 assert.equal((await req(env,'/api/customers',{method:'POST',cookie:c,origin:'https://evil.example',body:{name:'X'}})).status,403);
 assert.equal((await req(env,'/api/auth/logout',{method:'POST',cookie:c,origin:'https://evil.example'})).status,403);
 assert.equal((await req(env,'/api/customers',{method:'DELETE',cookie:c,origin:'https://evil.example'})).status,403,'lớp chặn chung cho mọi yêu cầu ghi');
});

test('phiên hết hạn hoặc mã phiên giả không dùng được',async()=>{
 const {env,db}=await setup();
 const c=(await login(env,'nv.an','Matkhau2026')).cookie;
 db.prepare("UPDATE auth_sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
 assert.equal((await req(env,'/api/me',{cookie:c})).status,401);
 assert.equal((await req(env,'/api/me',{cookie:COOKIE+'=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'})).status,401);
});

test('khóa tài khoản thì phiên đang mở mất hiệu lực ngay',async()=>{
 const {env,db}=await setup();
 const c=(await login(env,'nv.an','Matkhau2026')).cookie;
 db.prepare("UPDATE app_users SET active=0 WHERE email='an@ct.test'").run();
 assert.equal((await req(env,'/api/me',{cookie:c})).status,401);
});

test('Admin đặt tên đăng nhập và mật khẩu tạm; người dùng phải đổi trước khi làm việc',async()=>{
 const {env,db}=await setup();
 db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('binh@ct.test','Bình','ACCOUNTING')").run();
 const admin=(await req(env,'/auth/google',{access:'admin@ct.test'})).cookie;
 const set=(body,cookie=admin)=>req(env,'/api/users/binh%40ct.test/login',{method:'POST',cookie,body});
 assert.equal((await set({username:'Kế toán',password:'Tam12345678'})).status,400,'tên có dấu');
 assert.equal((await set({username:'nv.an',password:'Tam12345678'})).status,409,'trùng tên');
 assert.equal((await set({username:'kt.binh',password:'ngan1'})).status,400,'mật khẩu yếu');
 assert.equal((await set({username:'kt.binh',password:'kt.binh12345'})).status,400,'chứa tên đăng nhập');
 const sales=(await login(env,'nv.an','Matkhau2026')).cookie;
 assert.equal((await set({username:'kt.binh',password:'Tam12345678'},sales)).status,403,'Sales không được đặt');
 assert.equal((await set({username:'kt.binh',password:'Tam12345678'})).status,200);
 const list=(await req(env,'/api/users',{cookie:admin})).json.data.find(u=>u.email==='binh@ct.test');
 assert.equal(list.username,'kt.binh');assert.equal(list.has_password,1);assert.equal(list.must_change_password,1);
 assert.ok(!('password_hash' in list));
 const b=await login(env,'kt.binh','Tam12345678');
 assert.equal(b.json.must_change_password,true);
 assert.equal((await req(env,'/api/customers',{cookie:b.cookie})).status,403,'chưa đổi mật khẩu tạm');
 assert.equal((await req(env,'/api/me',{cookie:b.cookie})).json.user.must_change_password,1);
 assert.equal((await req(env,'/api/auth/password',{method:'POST',cookie:b.cookie,body:{current_password:'sai',new_password:'Moi987654321'}})).status,400);
 assert.equal((await req(env,'/api/auth/password',{method:'POST',cookie:b.cookie,body:{current_password:'Tam12345678',new_password:'Tam12345678'}})).status,400,'trùng mật khẩu cũ');
 assert.equal((await req(env,'/api/auth/password',{method:'POST',cookie:b.cookie,body:{current_password:'Tam12345678',new_password:'Moi987654321'}})).status,200);
 assert.equal((await req(env,'/api/customers',{cookie:b.cookie})).status,200);
 assert.equal((await login(env,'kt.binh','Tam12345678')).status,401);
 assert.equal((await login(env,'kt.binh','Moi987654321')).status,200);
 const audit=db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='SET_LOGIN' AND entity_id='binh@ct.test'").get().n;
 assert.equal(audit,1);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE after_json LIKE '%Tam1234%'").get().n,0,'không ghi mật khẩu vào nhật ký');
});

test('đổi mật khẩu đăng xuất các thiết bị khác; Admin đặt lại thì phiên mật khẩu cũ mất',async()=>{
 const {env}=await setup();
 const a=(await login(env,'nv.an','Matkhau2026')).cookie,b=(await login(env,'nv.an','Matkhau2026')).cookie;
 assert.equal((await req(env,'/api/auth/password',{method:'POST',cookie:a,body:{current_password:'Matkhau2026',new_password:'Khac20262027'}})).status,200);
 assert.equal((await req(env,'/api/me',{cookie:a})).status,200);
 assert.equal((await req(env,'/api/me',{cookie:b})).status,401);
 const admin=(await req(env,'/auth/google',{access:'admin@ct.test'})).cookie;
 assert.equal((await req(env,'/api/users/an%40ct.test/login',{method:'POST',cookie:admin,body:{password:'Reset1234567'}})).status,200);
 assert.equal((await req(env,'/api/me',{cookie:a})).status,401);
});

test('Google: /auth/google đổi JWT Access thành phiên CRM; người chưa được cấp quyền bị từ chối',async()=>{
 const {env}=await setup();
 const g=await req(env,'/auth/google',{access:'admin@ct.test'});
 assert.equal(g.status,302);assert.equal(g.location,'/');
 const me=await req(env,'/api/me',{cookie:g.cookie});
 assert.equal(me.json.user.auth_method,'GOOGLE');
 const out=await req(env,'/api/auth/logout',{method:'POST',cookie:g.cookie});
 assert.equal(out.json.google,true);
 const x=await req(env,'/auth/google',{access:'stranger@gmail.com'});
 assert.equal(x.status,302);assert.equal(x.location,'/login?e=google_denied');assert.equal(x.setCookie,'');
 const none=await req(env,'/auth/google');
 assert.equal(none.location,'/login?e=google_failed');
 assert.equal((await req(env,'/api/me')).status,401,'không phiên, không JWT');
});

test('người dùng Google tự đặt mật khẩu khi Admin đã cấp tên đăng nhập',async()=>{
 const {env}=await setup();
 const g=(await req(env,'/auth/google',{access:'admin@ct.test'})).cookie;
 assert.equal((await req(env,'/api/auth/password',{method:'POST',cookie:g,body:{new_password:'Quantri20262026'}})).status,200);
 assert.equal((await login(env,'admin','Quantri20262026')).status,200);
});
