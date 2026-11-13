import {createRemoteJWKSet,jwtVerify} from 'jose';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
function bad(message,status=400){return response({ok:false,error:message},status)}
function assertConfig(env){if(!env.DB||!env.CF_ACCESS_TEAM_DOMAIN||!env.CF_ACCESS_AUD)throw new Error('API chưa được cấu hình D1 / Cloudflare Access')}
async function identity(request,env){
 const jwt=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!jwt)throw Object.assign(new Error('Yêu cầu đăng nhập qua Cloudflare Access'),{status:401});
 const host=String(env.CF_ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//,'').replace(/\/$/,'');
 if(!/^([a-z\d-]+\.)+cloudflareaccess\.com$/i.test(host))throw new Error('Cloudflare Access team domain không hợp lệ');
 const issuer='https://'+host;
 const JWKS=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));
 const {payload}=await jwtVerify(jwt,JWKS,{issuer,audience:env.CF_ACCESS_AUD,algorithms:['RS256']});
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
const financeColumns=new Set(['cost_per_kg','cost_amount','margin','gross_profit']);
async function listEntity(env,user,entity,params){
 if(!access[entity]||!access[entity].includes(user.role))return bad('Không có quyền truy cập phân hệ',403);
 const limit=Math.max(1,Math.min(100,Number(params.get('limit'))||40));
 const offset=Math.max(0,Math.min(10000,Number(params.get('offset'))||0));
 let sql='',bind=[];
 if(entity==='customers'){
  sql='SELECT id,name,tax_code,phone,email,address,region,owner_email,credit_limit,credit_days,status,created_at FROM customers';
  if(salesFilter(user)){sql+=' WHERE owner_email=?';bind.push(user.email)}
 }else if(entity==='products')sql='SELECT id,name,category,origin,brand,unit,active FROM products';
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
    ?'SELECT id,product_id,import_lot,supplier,arrival_date,quantity_kg,remaining_kg,cost_per_kg,status FROM containers'
    :'SELECT id,product_id,arrival_date,quantity_kg,remaining_kg,status FROM containers';
 }else if(entity==='payments'){
  sql='SELECT p.id,p.customer_id,p.amount,p.payment_date,p.payment_type,p.reference,p.created_at FROM payments p';
  if(salesFilter(user)){sql+=' WHERE EXISTS(SELECT 1 FROM customers c WHERE c.id=p.customer_id AND c.owner_email=?)';bind.push(user.email)}
 }else if(entity==='leads'){
  sql='SELECT id,name,contact,owner_email,stage,created_at FROM leads';
  if(salesFilter(user)){sql+=' WHERE owner_email=?';bind.push(user.email)}
 }else if(entity==='activities'){
  sql='SELECT id,customer_id,title,due_date,owner_email,status FROM activities';
  if(salesFilter(user)){sql+=' WHERE owner_email=?';bind.push(user.email)}
 }
 if(!sql)return bad('Không hỗ trợ tài nguyên',404);
 const hasWhere=/\bWHERE\b/i.test(sql);
 const q=params.get('q')?.trim();
 if(q&&['customers','products','leads'].includes(entity)){
  const filter=entity==='leads'?'(name LIKE ? OR contact LIKE ?)':entity==='products'?'(name LIKE ? OR category LIKE ?)':'(name LIKE ? OR id LIKE ?)';
  sql+=(hasWhere?' AND ':' WHERE ')+filter;
  bind.push('%'+q.slice(0,80)+'%','%'+q.slice(0,80)+'%');
 }
 sql+=' ORDER BY '+(entity==='order_lines'?'l.id':entity==='deliveries'?'d.id':entity==='payments'?'p.id':'id')+' DESC LIMIT ? OFFSET ?';
 bind.push(limit,offset);
 const {results}=await env.DB.prepare(sql).bind(...bind).all();
 return response({ok:true,data:results||[],pagination:{limit,offset,hasMore:(results||[]).length===limit}});
}

const writable=new Set(['customers','products','leads']);
function trimText(x,max=255){return typeof x==='string'?x.trim().slice(0,max):''}
function validated(entity,payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(new Error('Dữ liệu không hợp lệ'),{status:400});
 const name=trimText(payload.name,220);
 if(!name)throw Object.assign(new Error('Tên không được trống'),{status:400});
 if(entity==='customers')return {name,phone:trimText(payload.phone,40),tax_code:trimText(payload.tax??payload.tax_code,35)||null,region:trimText(payload.region,100),status:trimText(payload.status,40)||'ACTIVE',address:trimText(payload.address,300)};
 if(entity==='products')return {name,category:trimText(payload.group??payload.category,100),origin:trimText(payload.origin,100),unit:trimText(payload.unit,25)||'kg'};
 if(entity==='leads')return {name,contact:trimText(payload.contact,100),stage:trimText(payload.stage,50)||'Mới'};
 throw Object.assign(new Error('Phân hệ chưa hỗ trợ lưu D1'),{status:405});
}
async function saveEntity(env,user,entity,request,method,id){
 if(!writable.has(entity))return bad('Chức năng lưu D1 của phân hệ này chưa nghiệm thu',405);
 if(!['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN'].includes(user.role) && !(user.role==='SALES' && entity!=='products'))return bad('Không được phép cập nhật',403);
 const origin=request.headers.get('Origin');
 if(!origin||origin!==new URL(request.url).origin)return bad('Nguồn yêu cầu không hợp lệ',403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return bad('Yêu cầu Content-Type: application/json',415);
 const raw=await request.text();
 if(raw.length>15000)return bad('Dữ liệu quá lớn',413);
 let payload;try{payload=JSON.parse(raw)}catch{return bad('JSON không hợp lệ',400)}
 const v=validated(entity,payload);
 const entityId=method==='POST'?crypto.randomUUID():id;
 if(!entityId||entityId.length>100)return bad('Mã bản ghi không hợp lệ',400);
 let old=null;
 if(method==='PATCH'){
  old=await env.DB.prepare('SELECT * FROM '+entity+' WHERE id=?').bind(entityId).first();
  if(!old)return bad('Không tìm thấy bản ghi',404);
  if(user.role==='SALES' && old.owner_email!==user.email)return bad('Không có quyền sửa bản ghi này',403);
 }
 const now=new Date().toISOString();
 let stmt;
 if(entity==='customers'){
  const owner=method==='PATCH'?old.owner_email:user.email;
  stmt=method==='POST'
   ?env.DB.prepare('INSERT INTO customers(id,name,tax_code,phone,region,address,owner_email,status) VALUES(?,?,?,?,?,?,?,?)').bind(entityId,v.name,v.tax_code,v.phone,v.region,v.address,owner,v.status)
   :env.DB.prepare('UPDATE customers SET name=?,tax_code=?,phone=?,region=?,address=?,status=?,updated_at=? WHERE id=?').bind(v.name,v.tax_code,v.phone,v.region,v.address,v.status,now,entityId);
 }else if(entity==='products'){
  stmt=method==='POST'
   ?env.DB.prepare('INSERT INTO products(id,name,category,origin,unit) VALUES(?,?,?,?,?)').bind(entityId,v.name,v.category,v.origin,v.unit)
   :env.DB.prepare('UPDATE products SET name=?,category=?,origin=?,unit=? WHERE id=?').bind(v.name,v.category,v.origin,v.unit,entityId);
 }else if(entity==='leads'){
  const owner=method==='PATCH'?old.owner_email:user.email;
  stmt=method==='POST'
   ?env.DB.prepare('INSERT INTO leads(id,name,contact,owner_email,stage) VALUES(?,?,?,?,?)').bind(entityId,v.name,v.contact,owner,v.stage)
   :env.DB.prepare('UPDATE leads SET name=?,contact=?,stage=?,updated_at=? WHERE id=?').bind(v.name,v.contact,v.stage,now,entityId);
 }
 const audit=env.DB.prepare('INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.email,method==='POST'?'CREATE':'UPDATE',entity,entityId,old?JSON.stringify(old):null,JSON.stringify(v));
 try{
  await env.DB.batch([stmt,audit]);
  return response({ok:true,data:{id:entityId,...v},persisted:true},method==='POST'?201:200);
 }catch(e){
  console.error('D1 save failed',e?.name);
  return bad('Không lưu được dữ liệu. Kiểm tra trùng mã số thuế và quyền truy cập.',409);
 }
}
export default{
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health'&&request.method==='GET')return response({ok:true,service:'ctfood-crm-api',mode:'preproduction'});
  if(!url.pathname.startsWith('/api/'))return bad('Không tìm thấy đường dẫn',404);
  if(request.method==='OPTIONS')return bad('CORS không cho phép',405);
  try{
   assertConfig(env);
   const user=await identity(request,env);
   if(request.method==='GET'&&url.pathname==='/api/me')return response({ok:true,user});
   if(request.method==='GET'&&url.pathname==='/api/summary'){
    const mine=user.role==='SALES';
    const counts=await env.DB.batch([
     (mine?env.DB.prepare('SELECT COUNT(*) AS n FROM customers WHERE owner_email=?').bind(user.email):env.DB.prepare('SELECT COUNT(*) AS n FROM customers')),
     (mine?env.DB.prepare('SELECT COUNT(*) AS n FROM leads WHERE owner_email=?').bind(user.email):env.DB.prepare('SELECT COUNT(*) AS n FROM leads')),
     env.DB.prepare('SELECT COUNT(*) AS n FROM products')
    ]);
    return response({ok:true,data:{customers:counts[0]?.results?.[0]?.n||0,leads:counts[1]?.results?.[0]?.n||0,products:counts[2]?.results?.[0]?.n||0},source:'D1'});
   }

   const match=url.pathname.match(/^\/api\/([a-z_]+)(?:\/([a-zA-Z0-9_-]+))?$/);
   if(!match)return bad('Không tìm thấy API',404);
   const entity=match[1],id=match[2];
   if(request.method==='GET'&&!id)return await listEntity(env,user,entity,url.searchParams);
   if((request.method==='POST'&&!id)||(request.method==='PATCH'&&id))return await saveEntity(env,user,entity,request,request.method,id);
   return bad('Phương thức không hỗ trợ',405);
  }catch(error){
   const status=Number(error?.status)||500;
   if(status===500)console.error('CRM API error',error?.name||'Error');
   return bad(status===500?'Lỗi cấu hình hoặc máy chủ':error.message,status);
  }
 }
};
