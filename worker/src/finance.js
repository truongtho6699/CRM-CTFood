// FIN-01 — Phiếu thu, phân bổ vào đơn, công nợ (giả định tạm, chờ Kế toán/BGĐ chốt E01–E03, C06).
// KPI-01 — Báo cáo doanh số/sản lượng từ số kg thực giao đã được Kế toán xác nhận (giả định G01).
// Mọi số tiền là số nguyên (đồng). Công nợ = giá trị giao đã xác nhận (kg × giá chưa VAT) − tiền đã phân bổ.
import {response,bad,fail,trimText,readJson,likeFolded,foldText} from './http.js';

export const PAYMENT_TYPE={DEPOSIT:'Đặt cọc',PAYMENT:'Thanh toán'};
export const METHOD={BANK:'Chuyển khoản',CASH:'Tiền mặt'};
const READ=['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN'];
const WRITE=['ADMIN','ACCOUNTING'];
const CONFLICT='Phiếu thu vừa được người khác cập nhật hoặc đã hủy. Vui lòng tải lại.';
const isSales=u=>u.role==='SALES';
const DAY=86400000;

function money(v,label,min=1){
 const n=typeof v==='string'&&v.trim()!==''?Number(v):v;
 if(!Number.isInteger(n)||n<min||n>1e13)throw fail(label+' phải là số nguyên (đồng) từ '+min.toLocaleString('vi-VN')+' trở lên');
 return n;
}
function isoDate(v,label){
 const s=trimText(v,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z')))throw fail(label+' không hợp lệ (YYYY-MM-DD)');
 return s;
}
export function todayVN(){return new Date(Date.now()+7*3600*1000).toISOString().slice(0,10)}
export function addDays(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*DAY).toISOString().slice(0,10)}
function dbError(e){
 const msg=String(e?.message||'');
 if(/ctfood_allocation_exceeds_payment/.test(msg))return bad('Tổng tiền phân bổ vượt số tiền của phiếu thu',400);
 if(/ctfood_invalid_allocation/.test(msg))return bad('Chỉ phân bổ vào đơn chưa hủy của đúng khách hàng trên phiếu thu còn hiệu lực',400);
 if(/ctfood_payment_locked/.test(msg))return bad(CONFLICT,409);
 if(/ctfood_void_reason_required/.test(msg))return bad('Hủy phiếu thu phải ghi lý do',400);
 if(/ctfood_money_integer/.test(msg))return bad('Số tiền phải là số nguyên dương (đồng)',400);
 if(/UNIQUE/.test(msg))return bad('Mỗi đơn chỉ phân bổ một lần trong một phiếu thu',400);
 if(/FOREIGN KEY|CHECK|ctfood_/i.test(msg))return bad('Dữ liệu phiếu thu không hợp lệ',400);
 console.error('D1 finance save failed',e?.name);
 return bad('Không lưu được phiếu thu. Vui lòng thử lại.',500);
}

// ---------- Công nợ theo đơn ----------
export async function receivableRows(env,user,{customerId,salesEmail}={}){
 const where=["o.status<>'CANCELLED'"],bind=[];
 if(isSales(user)){where.push('o.sales_email=?');bind.push(user.email)}
 if(customerId){where.push('o.customer_id=?');bind.push(customerId)}
 if(salesEmail){where.push('o.sales_email=?');bind.push(salesEmail)}
 const sql=`SELECT o.id,o.code,o.status,o.customer_id,c.name AS customer_name,o.sales_email,u.full_name AS sales_name,c.credit_days,
  (SELECT COALESCE(SUM(d.delivered_kg*l.unit_price_ex_vat),0) FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id WHERE l.order_id=o.id AND d.status='VERIFIED') AS delivered_value,
  (SELECT MAX(d.delivery_date) FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id WHERE l.order_id=o.id AND d.status='VERIFIED') AS last_delivery,
  (SELECT COALESCE(SUM(a.amount),0) FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.order_id=o.id AND p.status='ACTIVE') AS paid
  FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN app_users u ON u.email=o.sales_email WHERE `+where.join(' AND ');
 const {results}=await env.DB.prepare(sql).bind(...bind).all();
 const today=todayVN();
 return (results||[]).map(r=>{
  const delivered=Math.round(r.delivered_value||0),paid=r.paid||0,balance=delivered-paid;
  const due=r.last_delivery?addDays(r.last_delivery,Number(r.credit_days)||0):null;
  const overdue=balance>0&&due&&today>due?Math.round((Date.parse(today)-Date.parse(due))/DAY):0;
  return {order_id:r.id,code:r.code,order_status:r.status,customer_id:r.customer_id,customer_name:r.customer_name,sales_email:r.sales_email,sales_name:r.sales_name,
   delivered_value:delivered,paid,balance,last_delivery:r.last_delivery,due_date:balance>0?due:null,overdue_days:overdue};
 }).filter(r=>r.delivered_value>0||r.paid>0);
}
export async function customerCredit(env,user,customerId){
 const where=["p.status='ACTIVE'"],bind=[];
 if(isSales(user)){where.push('c.owner_email=?');bind.push(user.email)}
 if(customerId){where.push('p.customer_id=?');bind.push(customerId)}
 const {results}=await env.DB.prepare(`SELECT p.customer_id,c.name AS customer_name,SUM(p.amount) AS received,
  SUM((SELECT COALESCE(SUM(a.amount),0) FROM payment_allocations a WHERE a.payment_id=p.id)) AS allocated
  FROM payments p JOIN customers c ON c.id=p.customer_id WHERE ${where.join(' AND ')} GROUP BY p.customer_id`).bind(...bind).all();
 return (results||[]).map(r=>({customer_id:r.customer_id,customer_name:r.customer_name,received:r.received,allocated:r.allocated,unallocated:r.received-r.allocated})).filter(r=>r.unallocated>0);
}
function summarize(rows,credits){
 const t={delivered_value:0,paid:0,balance:0,overdue_balance:0,overdue_orders:0,unallocated:0};
 for(const r of rows){t.delivered_value+=r.delivered_value;t.paid+=r.paid;t.balance+=r.balance;if(r.overdue_days>0){t.overdue_balance+=r.balance;t.overdue_orders++}}
 for(const c of credits)t.unallocated+=c.unallocated;
 return t;
}
async function listReceivables(env,user,params){
 const customerId=trimText(params.get('customer_id'),100)||undefined;
 let rows=await receivableRows(env,user,{customerId});
 const credits=await customerCredit(env,user,customerId);
 const totals=summarize(rows,credits);
 if(params.get('open')==='1')rows=rows.filter(r=>r.balance!==0);
 if(params.get('overdue')==='1')rows=rows.filter(r=>r.overdue_days>0);
 const q=foldText(trimText(params.get('q'),80));
 if(q)rows=rows.filter(r=>foldText(r.code+' '+r.customer_name).includes(q));
 rows.sort((a,b)=>b.overdue_days-a.overdue_days||b.balance-a.balance);
 return response({ok:true,data:rows,credits,totals,as_of:todayVN()});
}

// ---------- Phiếu thu ----------
const SELECT_PAYMENT=`SELECT p.id,p.customer_id,c.name AS customer_name,p.amount,p.payment_date,p.payment_type,p.method,p.reference,p.note,p.status,
 p.void_reason,p.voided_by,p.voided_at,p.created_by,p.created_at,p.updated_at,
 (SELECT COALESCE(SUM(a.amount),0) FROM payment_allocations a WHERE a.payment_id=p.id) AS allocated
 FROM payments p JOIN customers c ON c.id=p.customer_id`;
async function loadPayment(env,user,id){
 const p=await env.DB.prepare(SELECT_PAYMENT+' WHERE p.id=?').bind(id).first();
 if(!p)return null;
 if(isSales(user)){const c=await env.DB.prepare('SELECT owner_email FROM customers WHERE id=?').bind(p.customer_id).first();if(c?.owner_email!==user.email)return null}
 return p;
}
async function listPayments(env,user,params){
 const where=[],bind=[];
 if(isSales(user)){where.push('c.owner_email=?');bind.push(user.email)}
 const cid=trimText(params.get('customer_id'),100);
 if(cid){where.push('p.customer_id=?');bind.push(cid)}
 const st=trimText(params.get('status'),10).toUpperCase();
 if(st){if(!['ACTIVE','VOID'].includes(st))return bad('Trạng thái lọc không hợp lệ',400);where.push('p.status=?');bind.push(st)}
 const q=trimText(params.get('q'),80);
 if(q){where.push("(c.search_key LIKE ? ESCAPE '\\' OR lower(p.reference) LIKE ? ESCAPE '\\')");bind.push(likeFolded(q),likeFolded(q))}
 const limit=Math.max(1,Math.min(100,Number(params.get('limit'))||25));
 const offset=Math.max(0,Math.min(10000,Number(params.get('offset'))||0));
 const {results}=await env.DB.prepare(SELECT_PAYMENT+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY p.payment_date DESC,p.created_at DESC LIMIT ? OFFSET ?').bind(...bind,limit+1,offset).all();
 const items=results||[];
 return response({ok:true,data:items.slice(0,limit),pagination:{limit,offset,hasMore:items.length>limit}});
}
async function getPayment(env,user,id){
 const p=await loadPayment(env,user,id);
 if(!p)return bad('Không tìm thấy phiếu thu',404);
 const {results}=await env.DB.prepare('SELECT a.order_id,o.code,o.status AS order_status,a.amount,a.created_by,a.created_at FROM payment_allocations a JOIN orders o ON o.id=a.order_id WHERE a.payment_id=? ORDER BY o.code').bind(id).all();
 return response({ok:true,data:{...p,allocations:results||[]}});
}
function validateAllocations(list,amount){
 if(list===undefined||list===null)return [];
 if(!Array.isArray(list)||list.length>100)throw fail('Danh sách phân bổ không hợp lệ');
 const seen=new Set();let sum=0;
 const out=list.map((a,i)=>{
  const order_id=trimText(a?.order_id,100);
  if(!order_id)throw fail('Phân bổ dòng '+(i+1)+': chưa chọn đơn');
  if(seen.has(order_id))throw fail('Mỗi đơn chỉ phân bổ một lần trong một phiếu thu');
  seen.add(order_id);
  const amt=money(a.amount,'Phân bổ dòng '+(i+1));sum+=amt;
  return {order_id,amount:amt};
 });
 if(sum>amount)throw fail('Tổng tiền phân bổ ('+sum.toLocaleString('vi-VN')+' đ) vượt số tiền phiếu thu');
 return out;
}
async function checkOrders(env,customerId,allocs){
 if(!allocs.length)return;
 const ids=allocs.map(a=>a.order_id);
 const {results}=await env.DB.prepare('SELECT id,customer_id,status FROM orders WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();
 const ok=new Set((results||[]).filter(o=>o.customer_id===customerId&&o.status!=='CANCELLED').map(o=>o.id));
 const badIds=ids.filter(id=>!ok.has(id));
 if(badIds.length)throw fail('Chỉ phân bổ vào đơn chưa hủy của đúng khách hàng');
}
function audit(env,user,action,id,before,after,now){
 return env.DB.prepare('INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM payments WHERE id=? AND updated_at=?)')
  .bind(crypto.randomUUID(),user.email,action,'payments',id,before?JSON.stringify(before):null,JSON.stringify(after),id,now);
}
async function createPayment(env,user,request){
 if(!WRITE.includes(user.role))return bad('Chỉ Kế toán được lập phiếu thu',403);
 const p=await readJson(request);
 const customer_id=trimText(p.customer_id,100);
 const customer=customer_id?await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(customer_id).first():null;
 if(!customer)return bad('Chưa chọn khách hàng hoặc khách hàng không tồn tại',400);
 const payment_type=trimText(p.payment_type,20).toUpperCase();
 if(!Object.hasOwn(PAYMENT_TYPE,payment_type))return bad('Loại thu phải là Đặt cọc hoặc Thanh toán',400);
 const method=trimText(p.method||'BANK',10).toUpperCase();
 if(!Object.hasOwn(METHOD,method))return bad('Hình thức thu không hợp lệ',400);
 const amount=money(p.amount,'Số tiền');
 const payment_date=isoDate(p.payment_date,'Ngày thu');
 const allocs=validateAllocations(p.allocations,amount);
 await checkOrders(env,customer_id,allocs);
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const v={customer_id,payment_type,method,amount,payment_date,reference:trimText(p.reference,60)||null,note:trimText(p.note,300)||null};
 try{
  await env.DB.batch([
   env.DB.prepare("INSERT INTO payments(id,customer_id,amount,payment_date,payment_type,method,reference,note,status,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,'ACTIVE',?,?)")
    .bind(id,customer_id,amount,payment_date,payment_type,method,v.reference,v.note,user.email,now),
   ...allocs.map(a=>env.DB.prepare('INSERT INTO payment_allocations(id,payment_id,order_id,amount,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,a.order_id,a.amount,user.email,now)),
   audit(env,user,'CREATE',id,null,{...v,allocations:allocs},now),
  ]);
  return response({ok:true,data:{id,status:'ACTIVE',updated_at:now},persisted:true},201);
 }catch(e){return dbError(e)}
}
async function setAllocations(env,user,request,id){
 if(!WRITE.includes(user.role))return bad('Chỉ Kế toán được phân bổ tiền',403);
 const p=await readJson(request);
 const expected=typeof p.expected_updated_at==='string'?p.expected_updated_at:null;
 if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại.',428);
 const old=await loadPayment(env,user,id);
 if(!old)return bad('Không tìm thấy phiếu thu',404);
 if(old.status!=='ACTIVE'||old.updated_at!==expected)return bad(CONFLICT,409);
 const allocs=validateAllocations(p.allocations,old.amount);
 await checkOrders(env,old.customer_id,allocs);
 const now=new Date().toISOString();
 const guard="EXISTS(SELECT 1 FROM payments WHERE id=? AND updated_at=? AND status='ACTIVE')";
 const before=(await env.DB.prepare('SELECT order_id,amount FROM payment_allocations WHERE payment_id=?').bind(id).all()).results;
 const stmts=[
  env.DB.prepare('DELETE FROM payment_allocations WHERE payment_id=? AND '+guard).bind(id,id,expected),
  ...allocs.map(a=>env.DB.prepare('INSERT INTO payment_allocations(id,payment_id,order_id,amount,created_by,created_at) SELECT ?,?,?,?,?,? WHERE '+guard).bind(crypto.randomUUID(),id,a.order_id,a.amount,user.email,now,id,expected)),
  env.DB.prepare("UPDATE payments SET updated_at=? WHERE id=? AND updated_at=? AND status='ACTIVE'").bind(now,id,expected),
  audit(env,user,'ALLOCATE',id,{allocations:before},{allocations:allocs},now),
 ];
 try{
  const r=await env.DB.batch(stmts);
  if(!(r?.[stmts.length-2]?.meta?.changes>0))return bad(CONFLICT,409);
  return response({ok:true,data:{id,updated_at:now},persisted:true});
 }catch(e){return dbError(e)}
}
async function voidPayment(env,user,request,id){
 if(!WRITE.includes(user.role))return bad('Chỉ Kế toán được hủy phiếu thu',403);
 const p=await readJson(request);
 const note=trimText(p.note,300);
 if(!note)return bad('Hủy phiếu thu phải ghi lý do',400);
 const expected=typeof p.expected_updated_at==='string'?p.expected_updated_at:null;
 if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại.',428);
 const old=await loadPayment(env,user,id);
 if(!old)return bad('Không tìm thấy phiếu thu',404);
 if(old.status!=='ACTIVE'||old.updated_at!==expected)return bad(CONFLICT,409);
 const now=new Date().toISOString();
 try{
  const r=await env.DB.batch([
   env.DB.prepare("UPDATE payments SET status='VOID',void_reason=?,voided_by=?,voided_at=?,updated_at=? WHERE id=? AND updated_at=? AND status='ACTIVE'").bind(note,user.email,now,now,id,expected),
   audit(env,user,'VOID',id,{status:'ACTIVE'},{status:'VOID',note},now),
  ]);
  if(!(r?.[0]?.meta?.changes>0))return bad(CONFLICT,409);
  return response({ok:true,data:{id,status:'VOID',updated_at:now},persisted:true});
 }catch(e){return dbError(e)}
}

// ---------- KPI-01: báo cáo doanh số / sản lượng ----------
function monthIn(v,fallback){const s=trimText(v,7);return /^\d{4}-(0[1-9]|1[0-2])$/.test(s)?s:fallback}
async function salesReport(env,user,params){
 const cur=todayVN().slice(0,7);
 let from=monthIn(params.get('from'),cur),to=monthIn(params.get('to'),cur);
 if(from>to)[from,to]=[to,from];
 const where=["d.status='VERIFIED'","o.status<>'CANCELLED'","d.delivery_date>=?","d.delivery_date<=?"],bind=[from+'-01',to+'-31'];
 if(isSales(user)){where.push('o.sales_email=?');bind.push(user.email)}
 const {results}=await env.DB.prepare(`SELECT o.sales_email,u.full_name AS sales_name,substr(d.delivery_date,1,7) AS month,p.id AS product_id,p.name AS product_name,
  c.id AS customer_id,c.name AS customer_name,o.id AS order_id,SUM(d.delivered_kg) AS kg,SUM(d.delivered_kg*l.unit_price_ex_vat) AS revenue,SUM(d.delivered_kg*l.commission_per_kg) AS commission
  FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id JOIN orders o ON o.id=l.order_id JOIN customers c ON c.id=o.customer_id
  JOIN products p ON p.id=l.product_id LEFT JOIN app_users u ON u.email=o.sales_email
  WHERE ${where.join(' AND ')} GROUP BY o.sales_email,month,p.id,c.id,o.id`).bind(...bind).all();
 const group=(key,label)=>{const m=new Map();for(const r of results||[]){const k=r[key];const g=m.get(k)||{key:k,label:r[label]??k,kg:0,revenue:0,commission:0,orders:new Set()};g.kg+=r.kg;g.revenue+=r.revenue;g.commission+=r.commission;g.orders.add(r.order_id);m.set(k,g)}
  return [...m.values()].map(g=>({key:g.key,label:g.label,kg:Math.round(g.kg*1000)/1000,revenue:Math.round(g.revenue),commission:Math.round(g.commission),orders:g.orders.size})).sort((a,b)=>b.revenue-a.revenue)};
 const by_sales=group('sales_email','sales_name');
 const totals=by_sales.reduce((t,g)=>({kg:Math.round((t.kg+g.kg)*1000)/1000,revenue:t.revenue+g.revenue,commission:t.commission+g.commission}),{kg:0,revenue:0,commission:0});
 totals.orders=new Set((results||[]).map(r=>r.order_id)).size;
 // Công nợ theo Sales tại thời điểm xem (KPI AR-OD-01: tỷ lệ công nợ quá hạn).
 const recv=await receivableRows(env,user);
 const ar=new Map();
 for(const r of recv){const g=ar.get(r.sales_email)||{key:r.sales_email,label:r.sales_name||r.sales_email,balance:0,overdue:0};g.balance+=Math.max(r.balance,0);if(r.overdue_days>0)g.overdue+=r.balance;ar.set(r.sales_email,g)}
 const receivables=[...ar.values()].filter(g=>g.balance>0).map(g=>({...g,overdue_ratio:g.balance?Math.round(g.overdue/g.balance*1000)/10:0})).sort((a,b)=>b.overdue-a.overdue);
 return response({ok:true,data:{from,to,totals,by_sales,by_month:group('month','month').sort((a,b)=>a.key.localeCompare(b.key)),by_product:group('product_id','product_name'),by_customer:group('customer_id','customer_name').slice(0,10),receivables},
  basis:'Số kg giao đã được Kế toán xác nhận × giá chưa VAT, theo ngày giao trên phiếu cân. Chưa trừ trả hàng, chưa có giá vốn/lợi nhuận.'});
}

export async function handleFinance(env,user,request,url){
 const path=url.pathname,method=request.method;
 if(!/^\/api\/(payments|receivables|reports)(\/|$)/.test(path))return null;
 if(!READ.includes(user.role))return bad('Không có quyền truy cập phân hệ',403);
 if(path==='/api/receivables'&&method==='GET')return listReceivables(env,user,url.searchParams);
 if(path==='/api/reports/sales'&&method==='GET')return salesReport(env,user,url.searchParams);
 const m=path.match(/^\/api\/payments(?:\/([a-zA-Z0-9-]{1,100}))?(\/allocations|\/void)?$/);
 if(!m)return bad('Không tìm thấy API',404);
 const [,id,sub]=m;
 if(method==='GET'&&!id)return listPayments(env,user,url.searchParams);
 if(method==='GET'&&id&&!sub)return getPayment(env,user,id);
 if(method==='POST'&&!id)return createPayment(env,user,request);
 if(method==='PUT'&&id&&sub==='/allocations')return setAllocations(env,user,request,id);
 if(method==='POST'&&id&&sub==='/void')return voidPayment(env,user,request,id);
 return bad('Phương thức không hỗ trợ',405);
}
