import {createRemoteJWKSet,jwtVerify} from 'jose';
import {response,bad,trimText,readJson,fail,likeFolded} from './http.js';
import {handleOrders} from './orders.js';
import {handleDeliveries} from './deliveries.js';
import {handleFinance} from './finance.js';
import {handleWorkspace} from './workspace.js';

function assertConfig(env){if(!env.DB||!env.CF_ACCESS_TEAM_DOMAIN||!env.CF_ACCESS_AUD)throw new Error('API chưa được cấu hình D1 / Cloudflare Access')}
// Cache JWKS per issuer across requests in the same isolate (jose handles key rotation/cooldown).
const jwksCache=new Map();
function remoteKeys(issuer){
 let jwks=jwksCache.get(issuer);
 if(!jwks){jwks=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));jwksCache.set(issuer,jwks)}
 return jwks;
}
async function identity(request,env,getKeys){
 const jwt=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!jwt)throw Object.assign(new Error('Yêu cầu đăng nhập qua Cloudflare Access'),{status:401});
 const host=String(env.CF_ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//,'').replace(/\/$/,'');
 if(!/^([a-z\d-]+\.)+cloudflareaccess\.com$/i.test(host))throw new Error('Cloudflare Access team domain không hợp lệ');
 const issuer='https://'+host;
 let payload;
 try{({payload}=await jwtVerify(jwt,getKeys(issuer),{issuer,audience:env.CF_ACCESS_AUD,algorithms:['RS256']}))}
 catch{throw Object.assign(new Error('Phiên Cloudflare Access không hợp lệ hoặc đã hết hạn'),{status:401})}
 const email=typeof payload.email==='string'?payload.email.toLowerCase():null;
 if(!email)throw Object.assign(new Error('Cloudflare Access JWT thiếu email'),{status:401});
 const user=await env.DB.prepare('SELECT email,full_name,role,active FROM app_users WHERE email=?').bind(email).first();
 if(!user||!user.active)throw Object.assign(new Error('Tài khoản chưa được cấp quyền truy cập CRM'),{status:403});
 return user;
}
function financeUser(user){return ['ADMIN','BOD','ACCOUNTING'].includes(user.role)}
function salesFilter(user){return user.role==='SALES'}
const access={
 customers:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'],
 products:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'],
 orders:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'],
 order_lines:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'],
 deliveries:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'],
 containers:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'],
 payments:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN'],
 activities:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN'],
 leads:['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN'],
};
// Mã chuẩn lưu trong D1; giao diện hiển thị nhãn tiếng Việt. API nhận cả mã lẫn nhãn.
export const CUSTOMER_STATUS={ACTIVE:'Đang giao dịch',PROSPECT:'Tiềm năng',INACTIVE:'Ngừng giao dịch'};
export const LEAD_STAGE={NEW:'Mới',CONTACTING:'Đang liên hệ',QUOTED:'Đã báo giá',CONVERTED:'Chuyển đổi',REJECTED:'Không phù hợp'};
function toCode(map,value,fallback,label){
 const v=trimText(value,50);
 if(!v)return fallback;
 if(Object.hasOwn(map,v.toUpperCase()))return v.toUpperCase();
 const hit=Object.entries(map).find(([,text])=>text.toLowerCase()===v.toLowerCase());
 if(hit)return hit[0];
 throw Object.assign(new Error(label+' không hợp lệ'),{status:400});
}
const financeColumns=new Set(['cost_per_kg','cost_amount','margin','gross_profit']);
async function listEntity(env,user,entity,params){
 if(!access[entity]||!access[entity].includes(user.role))return bad('Không có quyền truy cập phân hệ',403);
 const limit=Math.max(1,Math.min(100,Number(params.get('limit'))||40));
 const offset=Math.max(0,Math.min(10000,Number(params.get('offset'))||0));
 let sql='',bind=[];
 if(entity==='customers'){
  sql=financeUser(user) ? 'SELECT id,name,tax_code,phone,email,address,region,owner_email,credit_limit,credit_days,status,created_at,updated_at FROM customers' : 'SELECT id,name,tax_code,phone,email,address,region,owner_email,status,created_at,updated_at FROM customers';
  if(salesFilter(user)){sql+=' WHERE owner_email=?';bind.push(user.email)}
 }else if(entity==='products')sql='SELECT id,name,category,origin,brand,unit,active,updated_at FROM products';
 else if(entity==='orders'){
  sql='SELECT id,customer_id,sales_email,order_type,status,expected_date,delivery_address,note,created_at FROM orders';
  if(salesFilter(user)){sql+=' WHERE sales_email=?';bind.push(user.email)}
 }else if(entity==='order_lines'){
  sql='SELECT l.id,l.order_id,l.product_id,l.contracted_kg,l.unit_price_ex_vat,l.discount_per_kg,l.vat_rate FROM order_lines l JOIN orders o ON o.id=l.order_id';
  if(salesFilter(user)){sql+=' WHERE o.sales_email=?';bind.push(user.email)}
 }else if(entity==='deliveries'){
  sql='SELECT d.id,d.order_line_id,d.container_id,d.delivered_kg,d.delivery_date,d.vehicle_plate,d.status,d.verified_at FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id JOIN orders o ON o.id=l.order_id';
  if(salesFilter(user)){sql+=' WHERE o.sales_email=?';bind.push(user.email)}
 }else if(entity==='containers'){
  // SALES chỉ nhìn mã container, sản phẩm và tồn; không bao giờ có giá vốn trong response.
  sql=financeUser(user)
    ?'SELECT id,product_id,import_lot,supplier,arrival_date,quantity_kg,remaining_kg,cost_per_kg,status,created_at FROM containers'
    :'SELECT id,product_id,arrival_date,quantity_kg,remaining_kg,status,created_at FROM containers';
 }else if(entity==='payments'){
  sql='SELECT p.id,p.customer_id,p.amount,p.payment_date,p.payment_type,p.reference,p.created_at FROM payments p';
  if(salesFilter(user)){sql+=' WHERE EXISTS(SELECT 1 FROM customers c WHERE c.id=p.customer_id AND c.owner_email=?)';bind.push(user.email)}
 }else if(entity==='leads'){
  sql='SELECT id,name,contact,owner_email,stage,created_at,updated_at FROM leads';
  if(salesFilter(user)){sql+=' WHERE owner_email=?';bind.push(user.email)}
 }else if(entity==='activities'){
  sql='SELECT id,customer_id,title,due_date,owner_email,status FROM activities';
  if(salesFilter(user)){sql+=' WHERE owner_email=?';bind.push(user.email)}
 }
 if(!sql)return bad('Không hỗ trợ tài nguyên',404);
 const hasWhere=/\bWHERE\b/i.test(sql);
 const q=params.get('q')?.trim();
 if(q&&['customers','products','leads'].includes(entity)){
  // Tìm trên search_key (đã bỏ dấu, viết thường — migration 0008): "suon", "SƯỜN", "Sườn" đều khớp. Escape "%"/"_".
  sql+=(hasWhere?' AND ':' WHERE ')+"search_key LIKE ? ESCAPE '\\'";
  bind.push(likeFolded(q.slice(0,80)));
 }
 if(q&&entity==='containers'){
  sql+=(hasWhere?' AND ':' WHERE ')+'(id LIKE ? OR product_id LIKE ?)';
  const term='%'+q.slice(0,80).replace(/[\\%_]/g,'\\$&')+'%';
  bind.push(term,term);
 }
 let order=(entity==='order_lines'?'l.id':entity==='deliveries'?'d.id':entity==='payments'?'p.id':'id')+' DESC';
 if(entity==='customers'){
  // Bước 3 UI/UX: lọc theo trạng thái, khu vực, Sales phụ trách; sắp xếp mới nhất hoặc theo tên (không dấu).
  const add=(cond,val)=>{sql+=(/\bWHERE\b/i.test(sql)?' AND ':' WHERE ')+cond;bind.push(val)};
  const st=trimText(params.get('status')||'',20).toUpperCase();
  if(st){if(!['ACTIVE','PROSPECT','INACTIVE'].includes(st))return bad('Trạng thái lọc không hợp lệ',400);add('status=?',st)}
  const region=trimText(params.get('region')||'',100);
  if(region)add('region=?',region);
  const owner=trimText(params.get('owner')||'',254).toLowerCase();
  if(owner&&!salesFilter(user))add('owner_email=?',owner);
  order=params.get('sort')==='name'?'search_key ASC,id ASC':'created_at DESC,id DESC';
 }
 sql+=' ORDER BY '+order+' LIMIT ? OFFSET ?';
 bind.push(limit+1,offset);
 const {results}=await env.DB.prepare(sql).bind(...bind).all();
 const items=(results||[]);
 return response({ok:true,data:items.slice(0,limit),pagination:{limit,offset,hasMore:items.length>limit}});
}

const writable=new Set(['customers','products','leads']);
function validated(entity,payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(new Error('Dữ liệu không hợp lệ'),{status:400});
 const name=trimText(payload.name,220);
 if(!name)throw Object.assign(new Error('Tên không được trống'),{status:400});
 if(entity==='customers')return {name,phone:trimText(payload.phone,40),tax_code:trimText(payload.tax??payload.tax_code,35)||null,region:trimText(payload.region,100),status:toCode(CUSTOMER_STATUS,payload.status,'ACTIVE','Trạng thái khách hàng'),address:trimText(payload.address,300)};
 if(entity==='products')return {name,category:trimText(payload.group??payload.category,100),origin:trimText(payload.origin,100),unit:trimText(payload.unit,25)||'kg'};
 if(entity==='leads')return {name,contact:trimText(payload.contact,100),stage:toCode(LEAD_STAGE,payload.stage,'NEW','Giai đoạn khách tiềm năng')};
 throw Object.assign(new Error('Phân hệ chưa hỗ trợ lưu D1'),{status:405});
}
// Container danh mục: nhập mã container theo template, gắn sản phẩm có thật.
// Không ghi số lượng/giá vốn từ file cũ khi chưa có phiếu nhập và đối chiếu kho.
async function createCatalogContainer(env,user,request){
 if(!['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN'].includes(user.role))return bad('Không có quyền tạo container',403);
 const payload=await readJson(request);
 const id=trimText(payload.id,64).toUpperCase();
 const product_id=trimText(payload.product_id,100);
 if(!/^[A-Z0-9][A-Z0-9_-]{3,63}$/.test(id))return bad('Mã container phải có 4-64 ký tự chữ in hoa, số, gạch nối hoặc gạch dưới.',400);
 if(!product_id)return bad('Phải chọn sản phẩm có trong danh mục',400);
 const product=await env.DB.prepare('SELECT id FROM products WHERE id=? AND active=1').bind(product_id).first();
 if(!product)return bad('Sản phẩm chưa tồn tại hoặc không hoạt động',400);
 const exists=await env.DB.prepare('SELECT id FROM containers WHERE id=?').bind(id).first();
 if(exists)return bad('Mã container đã tồn tại',409);
 const stmt=env.DB.prepare("INSERT INTO containers(id,product_id,quantity_kg,remaining_kg,status) VALUES(?,?,0,0,'PLANNED')").bind(id,product_id);
 const audit=env.DB.prepare("INSERT INTO audit_log(id,actor_email,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),user.email,'CREATE','containers',id,JSON.stringify({id,product_id,status:'PLANNED'}));
 try{
  await env.DB.batch([stmt,audit]);
  return response({ok:true,persisted:true,data:{id,product_id,status:'PLANNED'}},201);
 }catch(e){
  if(/UNIQUE|PRIMARY KEY/i.test(String(e?.message||'')))return bad('Mã container đã tồn tại',409);
  console.error('Create container failure',e?.name||'Error');
  return bad('Không tạo được container',500);
 }
}
async function saveEntity(env,user,entity,request,method,id){
 if(!writable.has(entity))return bad('Chức năng lưu D1 của phân hệ này chưa nghiệm thu',405);
 if(!['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN'].includes(user.role) && !(user.role==='SALES' && entity!=='products'))return bad('Không được phép cập nhật',403);
 const payload=await readJson(request);
 const v=validated(entity,payload);
 const entityId=method==='POST'?crypto.randomUUID():id;
 if(!entityId||entityId.length>100)return bad('Mã bản ghi không hợp lệ',400);
 let old=null,expected=null;
 if(method==='PATCH'){
  // Khóa lạc quan: client phải gửi updated_at của bản ghi đang sửa để không ghi đè thay đổi của người khác.
  expected=typeof payload.expected_updated_at==='string'?payload.expected_updated_at:null;
  if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại trang rồi sửa lại.',428);
  old=await env.DB.prepare('SELECT * FROM '+entity+' WHERE id=?').bind(entityId).first();
  if(!old)return bad('Không tìm thấy bản ghi',404);
  if(user.role==='SALES' && old.owner_email!==user.email)return bad('Không có quyền sửa bản ghi này',403);
  if(old.updated_at!==expected)return bad('Bản ghi vừa được người khác cập nhật. Vui lòng tải lại để xem dữ liệu mới trước khi sửa.',409);
 }
 const now=new Date().toISOString();
 let stmt;
 if(entity==='customers'){
  const owner=method==='PATCH'?old.owner_email:user.email;
  stmt=method==='POST'
   ?env.DB.prepare('INSERT INTO customers(id,name,tax_code,phone,region,address,owner_email,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(entityId,v.name,v.tax_code,v.phone,v.region,v.address,owner,v.status,now)
   :env.DB.prepare('UPDATE customers SET name=?,tax_code=?,phone=?,region=?,address=?,status=?,updated_at=? WHERE id=? AND updated_at=?').bind(v.name,v.tax_code,v.phone,v.region,v.address,v.status,now,entityId,expected);
 }else if(entity==='products'){
  stmt=method==='POST'
   ?env.DB.prepare('INSERT INTO products(id,name,category,origin,unit,updated_at) VALUES(?,?,?,?,?,?)').bind(entityId,v.name,v.category,v.origin,v.unit,now)
   :env.DB.prepare('UPDATE products SET name=?,category=?,origin=?,unit=?,updated_at=? WHERE id=? AND updated_at=?').bind(v.name,v.category,v.origin,v.unit,now,entityId,expected);
 }else if(entity==='leads'){
  const owner=method==='PATCH'?old.owner_email:user.email;
  stmt=method==='POST'
   ?env.DB.prepare('INSERT INTO leads(id,name,contact,owner_email,stage,updated_at) VALUES(?,?,?,?,?,?)').bind(entityId,v.name,v.contact,owner,v.stage,now)
   :env.DB.prepare('UPDATE leads SET name=?,contact=?,stage=?,updated_at=? WHERE id=? AND updated_at=?').bind(v.name,v.contact,v.stage,now,entityId,expected);
 }
 // Nhật ký chỉ được ghi khi lệnh UPDATE thực sự áp dụng (bản ghi mang đúng mốc updated_at mới của lần lưu này).
 const audit=env.DB.prepare('INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM '+entity+' WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),user.email,method==='POST'?'CREATE':'UPDATE',entity,entityId,old?JSON.stringify(old):null,JSON.stringify(v),entityId,now);
 try{
  const results=await env.DB.batch([stmt,audit]);
  if(method==='PATCH'&&!(results?.[0]?.meta?.changes>0))return bad('Bản ghi vừa được người khác cập nhật. Vui lòng tải lại để xem dữ liệu mới trước khi sửa.',409);
  return response({ok:true,data:{id:entityId,...v,updated_at:now},persisted:true},method==='POST'?201:200);
 }catch(e){
  const msg=String(e?.message||'');
  if(/UNIQUE/i.test(msg))return bad('Mã số thuế đã tồn tại ở một khách hàng khác.',409);
  if(/CHECK|ctfood_invalid/i.test(msg))return bad('Dữ liệu không đúng định dạng cho phép.',400);
  console.error('D1 save failed',e?.name);
  return bad('Không lưu được dữ liệu. Vui lòng thử lại hoặc báo quản trị viên.',500);
 }
}
// ---------- ADM-01: Quản lý người dùng (chỉ ADMIN) ----------
export const ROLES={ADMIN:'Quản trị hệ thống',BOD:'Ban Giám đốc',ACCOUNTING:'Kế toán',SALES_MANAGER:'Trưởng phòng kinh doanh',SALES:'Nhân viên kinh doanh',SALES_ADMIN:'Sale Admin',LOGISTICS:'Kho / Logistics'};
const EMAIL_RE=/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const CONFLICT='Tài khoản vừa được quản trị viên khác cập nhật. Vui lòng tải lại để xem dữ liệu mới trước khi sửa.';
function requireAdmin(user){if(user.role!=='ADMIN')throw Object.assign(new Error('Chỉ quản trị hệ thống được quản lý người dùng'),{status:403})}
async function listUsers(env,user){
 requireAdmin(user);
 const {results}=await env.DB.prepare('SELECT email,full_name,role,active,created_at,updated_at FROM app_users ORDER BY active DESC,role,email').all();
 return response({ok:true,data:results||[]});
}
function validatedUser(payload){
 const full_name=trimText(payload.full_name,120);
 if(!full_name)throw Object.assign(new Error('Họ tên không được trống'),{status:400});
 const role=trimText(payload.role,30).toUpperCase();
 if(!Object.hasOwn(ROLES,role))throw Object.assign(new Error('Vai trò không hợp lệ'),{status:400});
 const a=payload.active;
 if(![true,false,1,0].includes(a))throw Object.assign(new Error('Trạng thái hoạt động không hợp lệ'),{status:400});
 return {full_name,role,active:a===true||a===1?1:0};
}
async function saveUser(env,user,request,method,emailParam){
 requireAdmin(user);
 const payload=await readJson(request);
 const v=validatedUser(payload);
 const now=new Date().toISOString();
 let email,old=null,stmt;
 if(method==='POST'){
  email=trimText(payload.email,254).toLowerCase();
  if(!EMAIL_RE.test(email))return bad('Email không hợp lệ',400);
  stmt=env.DB.prepare('INSERT INTO app_users(email,full_name,role,active,updated_at) VALUES(?,?,?,?,?)').bind(email,v.full_name,v.role,v.active,now);
 }else{
  try{email=decodeURIComponent(emailParam||'').toLowerCase()}catch{return bad('Email không hợp lệ',400)}
  const expected=typeof payload.expected_updated_at==='string'?payload.expected_updated_at:null;
  if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại trang rồi sửa lại.',428);
  old=await env.DB.prepare('SELECT email,full_name,role,active,updated_at FROM app_users WHERE email=?').bind(email).first();
  if(!old)return bad('Không tìm thấy tài khoản',404);
  if(old.updated_at!==expected)return bad(CONFLICT,409);
  const losesAdmin=old.role==='ADMIN'&&old.active&&(v.role!=='ADMIN'||!v.active);
  if(email===user.email&&losesAdmin)return bad('Không thể tự hạ quyền hoặc tự khóa tài khoản quản trị đang đăng nhập',400);
  if(losesAdmin){
   const left=await env.DB.prepare("SELECT COUNT(*) AS n FROM app_users WHERE role='ADMIN' AND active=1 AND email<>?").bind(email).first();
   if(!(left?.n>0))return bad('Hệ thống phải còn ít nhất một quản trị viên đang hoạt động',400);
  }
  stmt=env.DB.prepare('UPDATE app_users SET full_name=?,role=?,active=?,updated_at=? WHERE email=? AND updated_at=?').bind(v.full_name,v.role,v.active,now,email,expected);
 }
 const audit=env.DB.prepare('INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_users WHERE email=? AND updated_at=?)').bind(crypto.randomUUID(),user.email,method==='POST'?'CREATE':'UPDATE','app_users',email,old?JSON.stringify(old):null,JSON.stringify({email,...v}),email,now);
 try{
  const results=await env.DB.batch([stmt,audit]);
  if(method==='PATCH'&&!(results?.[0]?.meta?.changes>0))return bad(CONFLICT,409);
  return response({ok:true,data:{email,...v,updated_at:now},persisted:true},method==='POST'?201:200);
 }catch(e){
  if(/UNIQUE|PRIMARY KEY/i.test(String(e?.message||'')))return bad('Email này đã có trong hệ thống',409);
  console.error('D1 user save failed',e?.name);
  return bad('Không lưu được tài khoản. Vui lòng thử lại.',500);
 }
}

// createWorker cho phép kiểm thử truyền bộ khóa cục bộ; bản triển khai luôn dùng JWKS thật của Cloudflare Access.
export function createWorker({getKeys=remoteKeys}={}){return{
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health'&&request.method==='GET')return response({ok:true,service:'ctfood-crm-api',mode:'preproduction'});
  if(!url.pathname.startsWith('/api/'))return bad('Không tìm thấy đường dẫn',404);
  if(request.method==='OPTIONS')return bad('CORS không cho phép',405);
  try{
   assertConfig(env);
   const user=await identity(request,env,getKeys);
   if(request.method==='GET'&&url.pathname==='/api/me')return response({ok:true,user});
   if(request.method==='GET'&&url.pathname==='/api/summary'){
    const mine=user.role==='SALES';
    const canLeads=access.leads.includes(user.role);
    const queries=[
      mine?env.DB.prepare('SELECT COUNT(*) AS n FROM customers WHERE owner_email=?').bind(user.email):env.DB.prepare('SELECT COUNT(*) AS n FROM customers'),
      canLeads?(mine?env.DB.prepare('SELECT COUNT(*) AS n FROM leads WHERE owner_email=?').bind(user.email):env.DB.prepare('SELECT COUNT(*) AS n FROM leads')):env.DB.prepare('SELECT NULL AS n'),
      env.DB.prepare('SELECT COUNT(*) AS n FROM products')
    ];
    const counts=await env.DB.batch(queries);
    return response({ok:true,data:{customers:counts[0]?.results?.[0]?.n??0,leads:canLeads?(counts[1]?.results?.[0]?.n??0):null,products:counts[2]?.results?.[0]?.n??0},source:'D1'});
   }

   const workspace=await handleWorkspace(env,user,request,url);
   if(workspace)return workspace;
   const orders=await handleOrders(env,user,request,url);
   if(orders)return orders;
   const deliveries=await handleDeliveries(env,user,request,url);
   if(deliveries)return deliveries;
   const finance=await handleFinance(env,user,request,url);
   if(finance)return finance;
   const um=url.pathname.match(/^\/api\/users(?:\/([^/]+))?$/);
   if(um){
    if(request.method==='GET'&&!um[1])return await listUsers(env,user);
    if((request.method==='POST'&&!um[1])||(request.method==='PATCH'&&um[1]))return await saveUser(env,user,request,request.method,um[1]);
    return bad('Phương thức không hỗ trợ',405);
   }
   const match=url.pathname.match(/^\/api\/([a-z_]+)(?:\/([a-zA-Z0-9_-]+))?$/);
   if(!match)return bad('Không tìm thấy API',404);
   const entity=match[1],id=match[2];
   if(request.method==='GET'&&!id)return await listEntity(env,user,entity,url.searchParams);
   if(request.method==='POST'&&entity==='containers'&&!id)return await createCatalogContainer(env,user,request);
   if((request.method==='POST'&&!id)||(request.method==='PATCH'&&id))return await saveEntity(env,user,entity,request,request.method,id);
   return bad('Phương thức không hỗ trợ',405);
  }catch(error){
   const status=Number(error?.status)||500;
   if(status===500)console.error('CRM API error',error?.name||'Error');
   return bad(status===500?'Lỗi cấu hình hoặc máy chủ':error.message,status);
  }
 }
}}
export default createWorker();
