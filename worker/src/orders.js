// ORDER-01 — Đơn hàng nhiều dòng (giả định tạm theo tab "Lưu đồ", chờ BGĐ chốt C01–C05).
// Không ghi tiền thật, không tính KPI: chỉ quản lý đơn, dòng hàng và trạng thái.
import {response,bad,fail,trimText,readJson} from './http.js';

export const ORDER_STATUS={PENDING:'Chờ giao',SUCCESS:'Thành công',CANCELLED:'Hủy'};
export const ORDER_TYPE={OFFER:'Offer (hàng đặt mua)',IN_STOCK:'Hàng sẵn kho'};
const READ=['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'];
const WRITE=['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN','SALES'];
// Lưu đồ mục IV: Sale Admin xác nhận giao thành công; TPKD xác nhận hủy.
const CAN_SUCCESS=['ADMIN','SALES_ADMIN'];
const CAN_CANCEL=['ADMIN','BOD','SALES_MANAGER'];
const MAX_LINES=50;
const CONFLICT='Đơn hàng vừa được người khác cập nhật hoặc đã chốt. Vui lòng tải lại để xem dữ liệu mới.';

const isSales=user=>user.role==='SALES';
function intIn(v,min,max,label){
 const n=typeof v==='string'&&v.trim()!==''?Number(v):v;
 if(n===undefined||n===null||n==='')return min>0?(()=>{throw fail(label+' không được trống')})():0;
 if(!Number.isInteger(n)||n<min||n>max)throw fail(label+' phải là số nguyên từ '+min.toLocaleString('vi-VN')+' đến '+max.toLocaleString('vi-VN'));
 return n;
}
function kgIn(v,label){
 const n=typeof v==='string'?Number(v.replace(',','.')):v;
 if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>10000000)throw fail(label+' phải lớn hơn 0 và không quá 10.000.000 kg');
 return Math.round(n*1000)/1000;
}
function dateOrNull(v){
 const s=trimText(v,10);
 if(!s)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z')))throw fail('Ngày giao dự kiến không hợp lệ (YYYY-MM-DD)');
 return s;
}
function validateOrder(p){
 const order_type=trimText(p.order_type,20).toUpperCase();
 if(!Object.hasOwn(ORDER_TYPE,order_type))throw fail('Loại đơn phải là Offer hoặc Hàng sẵn kho');
 if(!Array.isArray(p.lines)||p.lines.length<1)throw fail('Đơn hàng phải có ít nhất một dòng hàng');
 if(p.lines.length>MAX_LINES)throw fail('Tối đa '+MAX_LINES+' dòng hàng mỗi đơn');
 const lines=p.lines.map((l,i)=>{
  if(!l||typeof l!=='object')throw fail('Dòng '+(i+1)+' không hợp lệ');
  const product_id=trimText(l.product_id,100);
  if(!product_id)throw fail('Dòng '+(i+1)+': chưa chọn sản phẩm');
  const unit_price_ex_vat=intIn(l.unit_price_ex_vat,0,10000000,'Dòng '+(i+1)+': giá chưa VAT (đ/kg)');
  const commission_per_kg=intIn(l.commission_per_kg??0,0,10000000,'Dòng '+(i+1)+': chiết khấu/hoa hồng (đ/kg)');
  if(commission_per_kg>unit_price_ex_vat)throw fail('Dòng '+(i+1)+': chiết khấu/hoa hồng không được lớn hơn giá bán');
  return {product_id,contracted_kg:kgIn(l.contracted_kg,'Dòng '+(i+1)+': số lượng dự kiến (kg)'),unit_price_ex_vat,commission_per_kg};
 });
 return {
  order_type,lines,
  expected_date:dateOrNull(p.expected_date),
  delivery_address:trimText(p.delivery_address,300),
  note:trimText(p.note,500),
  deposit_expected:intIn(p.deposit_expected??0,0,1e13,'Cọc dự kiến (đ)'),
  container_count:intIn(p.container_count??0,0,1000,'Số container dự kiến'),
 };
}
async function checkProducts(env,lines){
 const ids=[...new Set(lines.map(l=>l.product_id))];
 const {results}=await env.DB.prepare('SELECT id FROM products WHERE active=1 AND id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();
 const found=new Set((results||[]).map(r=>r.id));
 const missing=ids.filter(id=>!found.has(id));
 if(missing.length)throw fail('Sản phẩm không tồn tại hoặc đã ngừng kinh doanh: '+missing.join(', '));
}
// Mã đơn tạm (C01 chưa chốt): DH + yymm (giờ VN) + '-' + số thứ tự 4 chữ số trong tháng.
function codePrefix(now){
 const vn=new Date(now.getTime()+7*3600*1000);
 return 'DH'+String(vn.getUTCFullYear()).slice(2)+String(vn.getUTCMonth()+1).padStart(2,'0');
}
async function nextCode(env,prefix){
 const last=await env.DB.prepare("SELECT code FROM orders WHERE code LIKE ? ORDER BY code DESC LIMIT 1").bind(prefix+'-%').first();
 const n=last?.code?Number(last.code.slice(prefix.length+1))||0:0;
 return prefix+'-'+String(n+1).padStart(4,'0');
}
function lineInsert(env,orderId,l,guard){
 const base='INSERT INTO order_lines(id,order_id,product_id,contracted_kg,unit_price_ex_vat,discount_per_kg,vat_rate,commission_per_kg) ';
 const args=[crypto.randomUUID(),orderId,l.product_id,l.contracted_kg,l.unit_price_ex_vat,0,0,l.commission_per_kg];
 return guard
  ?env.DB.prepare(base+"SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND updated_at=? AND status='PENDING')").bind(...args,orderId,guard)
  :env.DB.prepare(base+'VALUES(?,?,?,?,?,?,?,?)').bind(...args);
}
function auditStmt(env,user,action,id,before,after,now){
 return env.DB.prepare('INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND updated_at=?)')
  .bind(crypto.randomUUID(),user.email,action,'orders',id,before?JSON.stringify(before):null,JSON.stringify(after),id,now);
}
function dbError(e){
 const msg=String(e?.message||'');
 if(/ctfood_order_locked|ctfood_order_status_final/.test(msg))return bad(CONFLICT,409);
 if(/ctfood_cancel_reason_required/.test(msg))return bad('Hủy đơn phải ghi lý do',400);
 if(/FOREIGN KEY|CHECK|ctfood_/i.test(msg))return bad('Dữ liệu đơn hàng không hợp lệ',400);
 console.error('D1 order save failed',e?.name);
 return bad('Không lưu được đơn hàng. Vui lòng thử lại.',500);
}
const SELECT_ORDER=`SELECT o.id,o.code,o.customer_id,c.name AS customer_name,o.sales_email,u.full_name AS sales_name,o.order_type,o.status,
 o.expected_date,o.delivery_address,o.note,o.deposit_expected,o.container_count,o.status_note,o.status_by,o.status_at,o.created_by,o.created_at,o.updated_at,
 COALESCE(SUM(l.contracted_kg),0) AS total_kg,COALESCE(SUM(l.contracted_kg*l.unit_price_ex_vat),0) AS total_amount,COUNT(l.id) AS line_count
 FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN app_users u ON u.email=o.sales_email LEFT JOIN order_lines l ON l.order_id=o.id`;

async function listOrders(env,user,params){
 const where=[],bind=[];
 if(isSales(user)){where.push('o.sales_email=?');bind.push(user.email)}
 const st=trimText(params.get('status'),20).toUpperCase();
 if(st){if(!Object.hasOwn(ORDER_STATUS,st))return bad('Trạng thái lọc không hợp lệ',400);where.push('o.status=?');bind.push(st)}
 const q=trimText(params.get('q'),80);
 if(q){const like='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';where.push("(o.code LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')");bind.push(like,like)}
 const limit=Math.max(1,Math.min(100,Number(params.get('limit'))||25));
 const offset=Math.max(0,Math.min(10000,Number(params.get('offset'))||0));
 const sql=SELECT_ORDER+(where.length?' WHERE '+where.join(' AND '):'')+' GROUP BY o.id ORDER BY o.created_at DESC,o.code DESC LIMIT ? OFFSET ?';
 const {results}=await env.DB.prepare(sql).bind(...bind,limit+1,offset).all();
 const items=results||[];
 return response({ok:true,data:items.slice(0,limit),pagination:{limit,offset,hasMore:items.length>limit}});
}
async function loadOrder(env,user,id){
 const order=await env.DB.prepare(SELECT_ORDER+' WHERE o.id=? GROUP BY o.id').bind(id).first();
 if(!order||(isSales(user)&&order.sales_email!==user.email))return null;
 return order;
}
async function getOrder(env,user,id){
 const order=await loadOrder(env,user,id);
 if(!order)return bad('Không tìm thấy đơn hàng',404);
 const {results}=await env.DB.prepare('SELECT l.id,l.product_id,p.name AS product_name,p.unit,l.contracted_kg,l.unit_price_ex_vat,l.commission_per_kg,l.contracted_kg*l.unit_price_ex_vat AS amount FROM order_lines l JOIN products p ON p.id=l.product_id WHERE l.order_id=? ORDER BY l.rowid').bind(id).all();
 return response({ok:true,data:{...order,lines:results||[]}});
}
async function createOrder(env,user,request){
 if(!WRITE.includes(user.role))return bad('Không được phép tạo đơn hàng',403);
 const p=await readJson(request);
 const v=validateOrder(p);
 const customer_id=trimText(p.customer_id,100);
 const customer=customer_id?await env.DB.prepare('SELECT id,owner_email,status FROM customers WHERE id=?').bind(customer_id).first():null;
 if(!customer)return bad('Chưa chọn khách hàng hoặc khách hàng không tồn tại',400);
 if(isSales(user)&&customer.owner_email!==user.email)return bad('Chỉ tạo đơn cho khách hàng do bạn phụ trách',403);
 if(customer.status==='INACTIVE')return bad('Khách hàng đang ngừng giao dịch',400);
 await checkProducts(env,v.lines);
 // Đơn thuộc Sales phụ trách khách hàng (KPI theo Sales sau này).
 const sales_email=isSales(user)?user.email:(customer.owner_email||user.email);
 const now=new Date().toISOString();
 const id=crypto.randomUUID();
 const prefix=codePrefix(new Date());
 for(let attempt=0;attempt<3;attempt++){
  const code=await nextCode(env,prefix);
  const stmts=[
   env.DB.prepare("INSERT INTO orders(id,code,customer_id,sales_email,order_type,status,expected_date,delivery_address,note,deposit_expected,container_count,created_by,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?,?,?,?,?)")
    .bind(id,code,customer_id,sales_email,v.order_type,v.expected_date,v.delivery_address,v.note,v.deposit_expected,v.container_count,user.email,now),
   ...v.lines.map(l=>lineInsert(env,id,l,null)),
   auditStmt(env,user,'CREATE',id,null,{code,customer_id,sales_email,...v},now),
  ];
  try{
   await env.DB.batch(stmts);
   return response({ok:true,data:{id,code,status:'PENDING',updated_at:now},persisted:true},201);
  }catch(e){
   if(/UNIQUE/i.test(String(e?.message||''))&&attempt<2)continue;
   return dbError(e);
  }
 }
}
async function updateOrder(env,user,request,id){
 if(!WRITE.includes(user.role))return bad('Không được phép sửa đơn hàng',403);
 const p=await readJson(request);
 const expected=typeof p.expected_updated_at==='string'?p.expected_updated_at:null;
 if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại trang rồi sửa lại.',428);
 const old=await loadOrder(env,user,id);
 if(!old)return bad('Không tìm thấy đơn hàng',404);
 if(old.status!=='PENDING')return bad('Chỉ sửa được đơn đang Chờ giao',409);
 if(old.updated_at!==expected)return bad(CONFLICT,409);
 const v=validateOrder(p);
 await checkProducts(env,v.lines);
 const now=new Date().toISOString();
 const guard="EXISTS(SELECT 1 FROM orders WHERE id=? AND updated_at=? AND status='PENDING')";
 const stmts=[
  env.DB.prepare('DELETE FROM order_lines WHERE order_id=? AND '+guard).bind(id,id,expected),
  ...v.lines.map(l=>lineInsert(env,id,l,expected)),
  env.DB.prepare("UPDATE orders SET order_type=?,expected_date=?,delivery_address=?,note=?,deposit_expected=?,container_count=?,updated_at=? WHERE id=? AND updated_at=? AND status='PENDING'")
   .bind(v.order_type,v.expected_date,v.delivery_address,v.note,v.deposit_expected,v.container_count,now,id,expected),
  auditStmt(env,user,'UPDATE',id,old,v,now),
 ];
 try{
  const results=await env.DB.batch(stmts);
  if(!(results?.[stmts.length-2]?.meta?.changes>0))return bad(CONFLICT,409);
  return response({ok:true,data:{id,code:old.code,status:'PENDING',updated_at:now},persisted:true});
 }catch(e){return dbError(e)}
}
async function changeStatus(env,user,request,id){
 const p=await readJson(request);
 const status=trimText(p.status,20).toUpperCase();
 if(status==='SUCCESS'&&!CAN_SUCCESS.includes(user.role))return bad('Chỉ Sale Admin xác nhận giao thành công',403);
 if(status==='CANCELLED'&&!CAN_CANCEL.includes(user.role))return bad('Chỉ Trưởng phòng KD hoặc BGĐ được hủy đơn',403);
 if(!['SUCCESS','CANCELLED'].includes(status))return bad('Trạng thái chuyển không hợp lệ',400);
 const note=trimText(p.note,500);
 if(status==='CANCELLED'&&!note)return bad('Hủy đơn phải ghi lý do',400);
 const expected=typeof p.expected_updated_at==='string'?p.expected_updated_at:null;
 if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại trang.',428);
 const old=await loadOrder(env,user,id);
 if(!old)return bad('Không tìm thấy đơn hàng',404);
 if(old.status!=='PENDING'||old.updated_at!==expected)return bad(CONFLICT,409);
 const now=new Date().toISOString();
 const stmts=[
  env.DB.prepare("UPDATE orders SET status=?,status_note=?,status_by=?,status_at=?,updated_at=? WHERE id=? AND updated_at=? AND status='PENDING'").bind(status,note||null,user.email,now,now,id,expected),
  auditStmt(env,user,status==='CANCELLED'?'CANCEL':'COMPLETE',id,{status:old.status},{status,note},now),
 ];
 try{
  const results=await env.DB.batch(stmts);
  if(!(results?.[0]?.meta?.changes>0))return bad(CONFLICT,409);
  return response({ok:true,data:{id,status,updated_at:now},persisted:true});
 }catch(e){return dbError(e)}
}

// Trả về Response nếu đường dẫn thuộc /api/orders, ngược lại null.
export async function handleOrders(env,user,request,url){
 const m=url.pathname.match(/^\/api\/orders(?:\/([a-zA-Z0-9-]{1,100}))?(\/status)?$/);
 if(!m)return null;
 if(!READ.includes(user.role))return bad('Không có quyền truy cập phân hệ',403);
 const [,id,status]=m;
 const method=request.method;
 if(method==='GET'&&!id)return listOrders(env,user,url.searchParams);
 if(method==='GET'&&id&&!status)return getOrder(env,user,id);
 if(method==='POST'&&!id)return createOrder(env,user,request);
 if(method==='PATCH'&&id&&!status)return updateOrder(env,user,request,id);
 if(method==='POST'&&id&&status)return changeStatus(env,user,request,id);
 return bad('Phương thức không hỗ trợ',405);
}
