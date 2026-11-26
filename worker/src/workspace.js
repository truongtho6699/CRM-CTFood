// Bước 2 UI/UX — dữ liệu cho "Việc cần làm", trang chi tiết khách hàng và lịch chăm sóc khách hàng (B04).
// Chỉ đọc lại dữ liệu đã có; mọi phạm vi theo vai trò giống các API khác (Sales chỉ thấy của mình, Kho không thấy tài chính).
import {response,bad,fail,trimText,readJson} from './http.js';
import {receivableRows,customerCredit,todayVN,addDays} from './finance.js';

const FINANCE_VIEW=['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN']; // xem công nợ, phiếu thu, doanh thu
const CREDIT_COLUMNS=['ADMIN','BOD','ACCOUNTING'];                                  // xem hạn mức tín dụng
const ACTIVITY_ROLES=['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN'];
const ACTIVITY_WRITE=['ADMIN','BOD','SALES_MANAGER','SALES','SALES_ADMIN'];
const isSales=u=>u.role==='SALES';
const take=(rows,n=5)=>(rows||[]).slice(0,n);

// ---------- Việc cần làm ----------
async function worklist(env,user){
 const today=todayVN();
 const out={today,role:user.role,blocks:{}};
 const ownOrder=isSales(user)?' AND o.sales_email=?':'';
 const ob=isSales(user)?[user.email]:[];

 // Đơn chờ giao, ưu tiên ngày giao sớm nhất (đơn chưa có ngày để cuối).
 const {results:pending}=await env.DB.prepare(`SELECT o.id,o.code,o.expected_date,c.name AS customer_name,
  (SELECT COUNT(*) FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id WHERE l.order_id=o.id AND d.status='PENDING') AS pending_tickets
  FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.status='PENDING'${ownOrder}
  ORDER BY o.expected_date IS NULL,o.expected_date,o.created_at`).bind(...ob).all();
 const soon=addDays(today,3);
 out.blocks.orders={count:pending.length,due_soon:pending.filter(o=>o.expected_date&&o.expected_date<=soon).length,items:take(pending)};

 // Phiếu cân chờ Kế toán xác nhận.
 if(['ADMIN','ACCOUNTING','SALES_ADMIN','LOGISTICS','SALES_MANAGER','BOD'].includes(user.role)){
  const {results}=await env.DB.prepare(`SELECT d.id,d.delivered_kg,d.delivery_date,o.code AS order_code,c.name AS customer_name,p.name AS product_name
   FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id JOIN orders o ON o.id=l.order_id JOIN customers c ON c.id=o.customer_id JOIN products p ON p.id=l.product_id
   WHERE d.status='PENDING' ORDER BY d.delivery_date,d.created_at`).all();
  out.blocks.tickets={count:results.length,items:take(results)};
 }

 if(FINANCE_VIEW.includes(user.role)){
  // Công nợ quá hạn.
  const recv=await receivableRows(env,user);
  const overdue=recv.filter(r=>r.overdue_days>0).sort((a,b)=>b.overdue_days-a.overdue_days);
  out.blocks.overdue={count:overdue.length,amount:overdue.reduce((s,r)=>s+r.balance,0),
   open_amount:recv.reduce((s,r)=>s+Math.max(r.balance,0),0),items:take(overdue).map(r=>({order_id:r.order_id,code:r.code,customer_name:r.customer_name,balance:r.balance,overdue_days:r.overdue_days}))};
  // Tiền khách trả chưa phân bổ vào đơn (việc của Kế toán).
  if(['ADMIN','ACCOUNTING'].includes(user.role)){
   const credits=await customerCredit(env,user);
   out.blocks.credits={count:credits.length,amount:credits.reduce((s,c)=>s+c.unallocated,0),items:take(credits)};
  }
  // Doanh thu đã giao xác nhận: tháng này so với tháng trước (cùng phạm vi).
  const m=today.slice(0,7);
  const prev=new Date(Date.parse(m+'-01T00:00:00Z')-86400000).toISOString().slice(0,7);
  const {results:rev}=await env.DB.prepare(`SELECT substr(d.delivery_date,1,7) AS month,SUM(d.delivered_kg) AS kg,SUM(d.delivered_kg*l.unit_price_ex_vat) AS revenue
   FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id JOIN orders o ON o.id=l.order_id
   WHERE d.status='VERIFIED' AND o.status<>'CANCELLED' AND d.delivery_date>=? AND d.delivery_date<=?${ownOrder} GROUP BY month`).bind(prev+'-01',m+'-31',...ob).all();
  const pick=k=>{const r=rev.find(x=>x.month===k);return {month:k,kg:Math.round((r?.kg||0)*1000)/1000,revenue:Math.round(r?.revenue||0)}};
  out.blocks.revenue={current:pick(m),previous:pick(prev)};
 }

 // Việc chăm sóc khách đến hạn (hôm nay hoặc đã trễ) và khách tiềm năng đang mở.
 if(ACTIVITY_ROLES.includes(user.role)){
  const own=isSales(user)?' AND a.owner_email=?':'';
  const {results:acts}=await env.DB.prepare(`SELECT a.id,a.title,a.due_date,a.customer_id,c.name AS customer_name FROM activities a LEFT JOIN customers c ON c.id=a.customer_id
   WHERE a.status='PENDING' AND a.due_date IS NOT NULL AND a.due_date<=?${own} ORDER BY a.due_date`).bind(today,...ob).all();
  out.blocks.activities={count:acts.length,items:take(acts)};
  const {results:leads}=await env.DB.prepare(`SELECT COUNT(*) AS n FROM leads WHERE stage IN ('NEW','CONTACTING','QUOTED')${isSales(user)?' AND owner_email=?':''}`).bind(...ob).all();
  out.blocks.leads={count:leads[0]?.n||0};
 }
 return response({ok:true,data:out});
}

// ---------- Chi tiết khách hàng ----------
async function customerOverview(env,user,id){
 const cols='id,name,tax_code,phone,email,address,region,owner_email,status,created_at,updated_at'+(CREDIT_COLUMNS.includes(user.role)?',credit_limit,credit_days':'');
 const c=await env.DB.prepare(`SELECT ${cols},(SELECT full_name FROM app_users WHERE email=customers.owner_email) AS owner_name FROM customers WHERE id=?`).bind(id).first();
 if(!c||(isSales(user)&&c.owner_email!==user.email))return bad('Không tìm thấy khách hàng',404);
 const {results:orders}=await env.DB.prepare(`SELECT o.id,o.code,o.status,o.order_type,o.expected_date,o.created_at,
  COALESCE(SUM(l.contracted_kg),0) AS total_kg,COALESCE(SUM(l.contracted_kg*l.unit_price_ex_vat),0) AS total_amount,
  (SELECT COALESCE(SUM(d.delivered_kg),0) FROM deliveries d JOIN order_lines x ON x.id=d.order_line_id WHERE x.order_id=o.id AND d.status='VERIFIED') AS delivered_kg,
  (SELECT COALESCE(SUM(d.delivered_kg*x.unit_price_ex_vat),0) FROM deliveries d JOIN order_lines x ON x.id=d.order_line_id WHERE x.order_id=o.id AND d.status='VERIFIED') AS delivered_value${user.role==='LOGISTICS'?'':`,
  (SELECT COALESCE(SUM(a.amount),0) FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.order_id=o.id AND p.status='ACTIVE') AS paid`}
  FROM orders o LEFT JOIN order_lines l ON l.order_id=o.id WHERE o.customer_id=?${isSales(user)?' AND o.sales_email=?':''}
  GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50`).bind(id,...(isSales(user)?[user.email]:[])).all();
 const data={customer:c,orders};
 if(FINANCE_VIEW.includes(user.role)){
  const recv=await receivableRows(env,user,{customerId:id});
  const credit=(await customerCredit(env,user,id))[0];
  data.receivables={rows:recv,balance:recv.reduce((s,r)=>s+r.balance,0),overdue:recv.filter(r=>r.overdue_days>0).reduce((s,r)=>s+r.balance,0),unallocated:credit?.unallocated||0};
  const {results:payments}=await env.DB.prepare(`SELECT id,amount,payment_date,payment_type,method,reference,status,
   (SELECT COALESCE(SUM(amount),0) FROM payment_allocations a WHERE a.payment_id=p.id) AS allocated FROM payments p WHERE customer_id=? ORDER BY payment_date DESC LIMIT 50`).bind(id).all();
  data.payments=payments;
 }
 if(ACTIVITY_ROLES.includes(user.role)){
  const {results}=await env.DB.prepare(`SELECT a.id,a.title,a.due_date,a.status,a.owner_email,u.full_name AS owner_name FROM activities a LEFT JOIN app_users u ON u.email=a.owner_email
   WHERE a.customer_id=? ORDER BY a.status='DONE',a.due_date DESC LIMIT 50`).bind(id).all();
  data.activities=results;
 }
 return response({ok:true,data});
}

// ---------- Lịch chăm sóc khách hàng ----------
async function createActivity(env,user,request){
 if(!ACTIVITY_WRITE.includes(user.role))return bad('Không được phép tạo việc chăm sóc',403);
 const p=await readJson(request);
 const title=trimText(p.title,200);
 if(!title)throw fail('Nội dung việc không được trống');
 const due=trimText(p.due_date,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(Date.parse(due+'T00:00:00Z')))throw fail('Ngày thực hiện không hợp lệ (YYYY-MM-DD)');
 const cid=trimText(p.customer_id,100);
 const c=cid?await env.DB.prepare('SELECT id,owner_email FROM customers WHERE id=?').bind(cid).first():null;
 if(!c)return bad('Chưa chọn khách hàng hoặc khách hàng không tồn tại',400);
 if(isSales(user)&&c.owner_email!==user.email)return bad('Chỉ tạo việc cho khách hàng do bạn phụ trách',403);
 const id=crypto.randomUUID();
 await env.DB.batch([
  env.DB.prepare("INSERT INTO activities(id,customer_id,title,due_date,owner_email,status) VALUES(?,?,?,?,?,'PENDING')").bind(id,cid,title,due,user.email),
  env.DB.prepare("INSERT INTO audit_log(id,actor_email,action,entity,entity_id,after_json) VALUES(?,?,'CREATE','activities',?,?)").bind(crypto.randomUUID(),user.email,id,JSON.stringify({customer_id:cid,title,due_date:due})),
 ]);
 return response({ok:true,data:{id,status:'PENDING'},persisted:true},201);
}
async function completeActivity(env,user,id){
 if(!ACTIVITY_WRITE.includes(user.role))return bad('Không được phép cập nhật việc chăm sóc',403);
 const a=await env.DB.prepare('SELECT id,owner_email,status FROM activities WHERE id=?').bind(id).first();
 if(!a||(isSales(user)&&a.owner_email!==user.email))return bad('Không tìm thấy việc chăm sóc',404);
 if(a.status==='DONE')return response({ok:true,data:{id,status:'DONE'},persisted:true});
 await env.DB.batch([
  env.DB.prepare("UPDATE activities SET status='DONE' WHERE id=? AND status<>'DONE'").bind(id),
  env.DB.prepare("INSERT INTO audit_log(id,actor_email,action,entity,entity_id,after_json) VALUES(?,?,'COMPLETE','activities',?,?)").bind(crypto.randomUUID(),user.email,id,JSON.stringify({status:'DONE'})),
 ]);
 return response({ok:true,data:{id,status:'DONE'},persisted:true});
}

export async function handleWorkspace(env,user,request,url){
 const path=url.pathname,method=request.method;
 if(path==='/api/worklist'&&method==='GET')return worklist(env,user);
 if(path==='/api/customers/facets'&&method==='GET'){
  // Giá trị cho bộ lọc danh sách khách hàng, trong phạm vi người dùng được xem.
  const own=isSales(user)?' AND owner_email=?':'',b=isSales(user)?[user.email]:[];
  const {results:regions}=await env.DB.prepare(`SELECT region,COUNT(*) AS n FROM customers WHERE region IS NOT NULL AND trim(region)<>''${own} GROUP BY region ORDER BY region`).bind(...b).all();
  const {results:owners}=isSales(user)?{results:[]}:await env.DB.prepare(`SELECT c.owner_email AS email,COALESCE(u.full_name,c.owner_email) AS name,COUNT(*) AS n FROM customers c LEFT JOIN app_users u ON u.email=c.owner_email WHERE c.owner_email IS NOT NULL GROUP BY c.owner_email ORDER BY name`).all();
  return response({ok:true,data:{regions,owners}});
 }
 const ov=path.match(/^\/api\/customers\/([a-zA-Z0-9-]{1,100})\/overview$/);
 if(ov&&method==='GET')return customerOverview(env,user,ov[1]);
 if(path==='/api/activities'&&method==='POST'){if(!ACTIVITY_ROLES.includes(user.role))return bad('Không có quyền truy cập phân hệ',403);return createActivity(env,user,request)}
 const done=path.match(/^\/api\/activities\/([a-zA-Z0-9-]{1,100})\/done$/);
 if(done&&method==='POST'){if(!ACTIVITY_ROLES.includes(user.role))return bad('Không có quyền truy cập phân hệ',403);
  // readJson kiểm tra Origin/Content-Type như mọi yêu cầu ghi khác.
  await readJson(request);return completeActivity(env,user,done[1])}
 return null;
}
