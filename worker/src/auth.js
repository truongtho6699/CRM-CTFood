// Đăng nhập bằng tên đăng nhập + mật khẩu và phiên đăng nhập riêng của CRM (migration 0011).
// Google vẫn đi qua Cloudflare Access: /auth/google đổi JWT của Access thành phiên CRM.
import {response,bad,trimText,readJson} from './http.js';

export const COOKIE='__Host-ctcrm_sid';
const SESSION_HOURS=12;
const MAX_FAILS=5,LOCK_MINUTES=15;
const IP_WINDOW_MINUTES=15,IP_MAX_FAILS=20;
const ITERATIONS=100000; // giới hạn tối đa của PBKDF2 trên Cloudflare Workers
export const USERNAME_RE=/^[a-z0-9._-]{3,32}$/;

const enc=new TextEncoder();
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
const nowIso=()=>new Date().toISOString();
const plusMinutes=m=>new Date(Date.now()+m*60000).toISOString();

async function pbkdf2(password,salt,iterations){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
}
export async function hashPassword(password){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password,salt,ITERATIONS))}`;
}
const DUMMY='pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
export async function verifyPassword(password,stored){
 const [alg,it,salt,hash]=String(stored||DUMMY).split('$');
 if(alg!=='pbkdf2-sha256')return false;
 const got=await pbkdf2(password,unb64(salt),Number(it)),want=unb64(hash);
 let diff=got.length^want.length;
 for(let i=0;i<got.length;i++)diff|=got[i]^(want[i]??0);
 return diff===0&&Boolean(stored);
}
export function passwordProblem(password,username){
 if(typeof password!=='string'||password.length<10)return 'Mật khẩu phải có ít nhất 10 ký tự';
 if(password.length>128)return 'Mật khẩu dài tối đa 128 ký tự';
 if(!/[a-zA-Z]/.test(password)||!/\d/.test(password))return 'Mật khẩu phải có cả chữ và số';
 if(username&&password.toLowerCase().includes(username.toLowerCase()))return 'Mật khẩu không được chứa tên đăng nhập';
 return null;
}

async function sha256(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
function readCookie(request,name){
 for(const part of (request.headers.get('Cookie')||'').split(';')){
  const i=part.indexOf('=');
  if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim();
 }
 return null;
}
const ip=request=>request.headers.get('CF-Connecting-IP')||'';
const setCookie=(token,maxAge)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export async function createSession(env,email,method,request){
 const token=b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g,c=>({'+':'-','/':'_','=':''}[c]));
 const now=nowIso();
 await env.DB.batch([
  env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(now),
  env.DB.prepare('INSERT INTO auth_sessions(token_hash,email,method,created_at,expires_at,ip,user_agent) VALUES(?,?,?,?,?,?,?)')
   .bind(await sha256(token),email,method,now,plusMinutes(SESSION_HOURS*60),ip(request),trimText(request.headers.get('User-Agent')||'',200)),
 ]);
 return setCookie(token,SESSION_HOURS*3600);
}

// Người dùng của phiên CRM (cookie), hoặc null nếu không có/hết hạn/tài khoản ngừng.
export async function sessionUser(request,env){
 const token=readCookie(request,COOKIE);
 if(!token||!/^[A-Za-z0-9_-]{20,100}$/.test(token))return null;
 const row=await env.DB.prepare(`SELECT u.email,u.full_name,u.role,u.active,u.username,u.must_change_password,(u.password_hash IS NOT NULL) AS has_password,s.method,s.token_hash
  FROM auth_sessions s JOIN app_users u ON u.email=s.email WHERE s.token_hash=? AND s.expires_at>? AND u.active=1`).bind(await sha256(token),nowIso()).first();
 if(!row)return null;
 const {token_hash,method,...user}=row;
 return {...user,auth_method:method,session_hash:token_hash};
}

const event=(env,kind,{username=null,email=null,request})=>env.DB.prepare('INSERT INTO auth_events(id,at,kind,username,email,ip) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),nowIso(),kind,username,email,request?ip(request):null);

function sameOrigin(request){
 const origin=request.headers.get('Origin');
 return Boolean(origin)&&origin===new URL(request.url).origin;
}
const LOGIN_ERRORS={
 bad:'Tên đăng nhập hoặc mật khẩu không đúng',
 locked:'Tài khoản tạm khóa '+LOCK_MINUTES+' phút do nhập sai nhiều lần. Liên hệ quản trị viên nếu cần mở sớm.',
 throttled:'Có quá nhiều lần đăng nhập sai từ mạng này. Vui lòng thử lại sau '+IP_WINDOW_MINUTES+' phút.',
};

async function login(env,request){
 const isForm=/^application\/x-www-form-urlencoded/i.test(request.headers.get('Content-Type')||'');
 const reply=(code,status,cookie,mustChange)=>{
  if(isForm){
   const headers={Location:code?'/login?e='+code:(mustChange?'/#/password':'/'),'Cache-Control':'no-store'};
   if(cookie)headers['Set-Cookie']=cookie;
   return new Response(null,{status:303,headers});
  }
  const res=code?bad(LOGIN_ERRORS[code],status):response({ok:true,must_change_password:Boolean(mustChange)});
  if(cookie)res.headers.append('Set-Cookie',cookie);
  return res;
 };
 if(!sameOrigin(request))return bad('Nguồn yêu cầu không hợp lệ',403);
 let username,password;
 if(isForm){
  const raw=await request.text();
  if(raw.length>2000)return bad('Dữ liệu quá lớn',413);
  const f=new URLSearchParams(raw);username=f.get('username');password=f.get('password');
 }else{
  const p=await readJson(request);username=p.username;password=p.password;
 }
 username=trimText(username,64).toLowerCase();
 if(typeof password!=='string'||password.length>128)password='';
 const since=plusMinutes(-IP_WINDOW_MINUTES);
 const fails=await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_events WHERE ip=? AND kind='LOGIN_FAIL' AND at>?").bind(ip(request),since).first();
 if((fails?.n||0)>=IP_MAX_FAILS)return reply('throttled',429);
 const user=USERNAME_RE.test(username)?await env.DB.prepare('SELECT email,username,active,password_hash,failed_logins,locked_until,must_change_password FROM app_users WHERE username=?').bind(username).first():null;
 // Luôn băm để thời gian phản hồi không lộ tên đăng nhập có tồn tại hay không.
 const ok=await verifyPassword(password,user?.password_hash);
 const now=nowIso();
 if(user&&user.locked_until&&user.locked_until>now){
  await event(env,'LOGIN_FAIL',{username,email:user.email,request}).run();
  return reply('locked',423);
 }
 if(!user||!user.active||!user.password_hash||!ok){
  const stmts=[event(env,'LOGIN_FAIL',{username,email:user?.email??null,request})];
  if(user&&user.password_hash){
   const n=(user.failed_logins||0)+1;
   stmts.push(n>=MAX_FAILS
    ?env.DB.prepare('UPDATE app_users SET failed_logins=0,locked_until=? WHERE email=?').bind(plusMinutes(LOCK_MINUTES),user.email)
    :env.DB.prepare('UPDATE app_users SET failed_logins=? WHERE email=?').bind(n,user.email));
   if(n>=MAX_FAILS)stmts.push(event(env,'LOCKED',{username,email:user.email,request}));
  }
  await env.DB.batch(stmts);
  return reply('bad',401);
 }
 await env.DB.batch([
  env.DB.prepare('UPDATE app_users SET failed_logins=0,locked_until=NULL WHERE email=?').bind(user.email),
  event(env,'LOGIN_OK',{username,email:user.email,request}),
 ]);
 return reply(null,200,await createSession(env,user.email,'PASSWORD',request),user.must_change_password);
}

async function logout(env,request){
 if(!sameOrigin(request))return bad('Nguồn yêu cầu không hợp lệ',403);
 const user=await sessionUser(request,env);
 if(user)await env.DB.batch([
  env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(user.session_hash),
  event(env,'LOGOUT',{username:user.username,email:user.email,request}),
 ]);
 // Không có phiên CRM (đang dùng JWT Access) hoặc phiên Google: cần thoát cả Cloudflare Access.
 const res=response({ok:true,google:user?.auth_method!=='PASSWORD'});
 res.headers.append('Set-Cookie',setCookie('',0));
 return res;
}

// Người dùng tự đổi mật khẩu. Ai chưa có mật khẩu (đang dùng Google) thì đặt mới không cần mật khẩu cũ.
async function changePassword(env,request,user){
 const p=await readJson(request);
 const row=await env.DB.prepare('SELECT email,username,password_hash FROM app_users WHERE email=?').bind(user.email).first();
 if(!row?.username)return bad('Quản trị viên chưa đặt tên đăng nhập cho tài khoản của bạn',409);
 if(row.password_hash&&!(await verifyPassword(String(p.current_password??'').slice(0,128),row.password_hash)))return bad('Mật khẩu hiện tại không đúng',400);
 const problem=passwordProblem(p.new_password,row.username);
 if(problem)return bad(problem,400);
 if(row.password_hash&&await verifyPassword(p.new_password,row.password_hash))return bad('Mật khẩu mới phải khác mật khẩu hiện tại',400);
 const now=nowIso();
 await env.DB.batch([
  env.DB.prepare('UPDATE app_users SET password_hash=?,password_changed_at=?,must_change_password=0,failed_logins=0,locked_until=NULL WHERE email=?').bind(await hashPassword(p.new_password),now,user.email),
  // Đăng xuất mọi thiết bị khác; giữ phiên hiện tại.
  env.DB.prepare('DELETE FROM auth_sessions WHERE email=? AND token_hash<>?').bind(user.email,user.session_hash||''),
  event(env,'PASSWORD_CHANGED',{username:row.username,email:user.email,request}),
 ]);
 return response({ok:true});
}

// Quản trị viên đặt tên đăng nhập và/hoặc mật khẩu tạm cho một tài khoản. Người dùng phải đổi ở lần đăng nhập đầu.
export async function adminSetLogin(env,request,admin,email){
 if(admin.role!=='ADMIN')return bad('Chỉ quản trị hệ thống được đặt mật khẩu',403);
 const p=await readJson(request);
 const target=await env.DB.prepare('SELECT email,username FROM app_users WHERE email=?').bind(email).first();
 if(!target)return bad('Không tìm thấy tài khoản',404);
 const username=p.username===undefined?target.username:trimText(p.username,64).toLowerCase();
 if(!username||!USERNAME_RE.test(username))return bad('Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang',400);
 const stmts=[];
 if(username!==target.username){
  const taken=await env.DB.prepare('SELECT 1 FROM app_users WHERE username=? AND email<>?').bind(username,email).first();
  if(taken)return bad('Tên đăng nhập này đã có người dùng',409);
  stmts.push(env.DB.prepare('UPDATE app_users SET username=? WHERE email=?').bind(username,email));
 }
 if(p.password!==undefined&&p.password!==null&&p.password!==''){
  const problem=passwordProblem(p.password,username);
  if(problem)return bad(problem,400);
  stmts.push(
   env.DB.prepare('UPDATE app_users SET password_hash=?,password_changed_at=?,must_change_password=1,failed_logins=0,locked_until=NULL WHERE email=?').bind(await hashPassword(p.password),nowIso(),email),
   env.DB.prepare("DELETE FROM auth_sessions WHERE email=? AND method='PASSWORD'").bind(email),
   event(env,'PASSWORD_RESET',{username,email,request}),
  );
 }else if(p.unlock===true){
  stmts.push(env.DB.prepare('UPDATE app_users SET failed_logins=0,locked_until=NULL WHERE email=?').bind(email));
 }
 if(p.remove_password===true){
  stmts.push(env.DB.prepare('UPDATE app_users SET password_hash=NULL,must_change_password=0 WHERE email=?').bind(email),
   env.DB.prepare("DELETE FROM auth_sessions WHERE email=? AND method='PASSWORD'").bind(email));
 }
 if(!stmts.length)return response({ok:true,data:{email,username}});
 stmts.push(env.DB.prepare('INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json) VALUES(?,?,?,?,?,?,?)')
  .bind(crypto.randomUUID(),admin.email,'SET_LOGIN','app_users',email,JSON.stringify({username:target.username}),JSON.stringify({username,password_reset:Boolean(p.password),unlock:p.unlock===true,remove_password:p.remove_password===true})));
 try{await env.DB.batch(stmts)}
 catch(e){if(/UNIQUE|username/i.test(String(e?.message||'')))return bad('Tên đăng nhập không hợp lệ hoặc đã có người dùng',409);throw e}
 return response({ok:true,data:{email,username}});
}

// Các đường dẫn đăng nhập chạy TRƯỚC khi xác định người dùng.
export async function handlePublicAuth(env,request,url){
 if(url.pathname==='/api/auth/login')return request.method==='POST'?await login(env,request):bad('Phương thức không hỗ trợ',405);
 if(url.pathname==='/api/auth/logout')return request.method==='POST'?await logout(env,request):bad('Phương thức không hỗ trợ',405);
 return null;
}
export async function handleUserAuth(env,request,url,user){
 if(url.pathname==='/api/auth/password'){
  if(request.method!=='POST')return bad('Phương thức không hỗ trợ',405);
  return await changePassword(env,request,user);
 }
 return null;
}
// Bắt buộc đổi mật khẩu tạm trước khi dùng các chức năng khác.
export function mustChangeBlocks(user,url){
 return user.auth_method==='PASSWORD'&&user.must_change_password&&!['/api/me','/api/auth/password'].includes(url.pathname);
}
// Sau khi Cloudflare Access xác thực Google tại /auth/google: tạo phiên CRM rồi về trang chủ.
export async function googleToSession(env,request,user){
 await event(env,'GOOGLE_OK',{email:user.email,request}).run();
 return new Response(null,{status:302,headers:{Location:'/','Cache-Control':'no-store','Set-Cookie':await createSession(env,user.email,'GOOGLE',request)}});
}
