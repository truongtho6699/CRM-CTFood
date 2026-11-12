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
 }else if(entity==='activities'){
  sql='SELECT id,customer_id,title,due_date,owner_email,status FROM activities';
  if(salesFilter(user)){sql+=' WHERE owner_email=?';bind.push(user.email)}
 }
 if(!sql)return bad('Không hỗ trợ tài nguyên',404);
 const hasWhere=/\bWHERE\b/i.test(sql);
 const q=params.get('q')?.trim();
 if(q&&entity==='customers'){
  sql+=(hasWhere?' AND ':' WHERE ')+'(name LIKE ? OR id LIKE ?)';
  bind.push('%'+q.slice(0,80)+'%','%'+q.slice(0,80)+'%');
 }
 sql+=' ORDER BY '+(entity==='order_lines'?'l.id':entity==='deliveries'?'d.id':entity==='payments'?'p.id':'id')+' DESC LIMIT ? OFFSET ?';
 bind.push(limit,offset);
 const {results}=await env.DB.prepare(sql).bind(...bind).all();
 return response({ok:true,data:results||[],pagination:{limit,offset,hasMore:(results||[]).length===limit}});
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
   if(request.method!=='GET')return bad('API V0.1 chỉ đọc: nghiệp vụ ghi dữ liệu chưa nghiệm thu',405);
   if(url.pathname==='/api/me')return response({ok:true,user});
   const match=url.pathname.match(/^\/api\/([a-z_]+)$/);
   if(!match)return bad('Không tìm thấy API',404);
   return await listEntity(env,user,match[1],url.searchParams);
  }catch(error){
   const status=Number(error?.status)||500;
   if(status===500)console.error('CRM API error',error?.name||'Error');
   return bad(status===500?'Lỗi cấu hình hoặc máy chủ':error.message,status);
  }
 }
};
