// LOG-01 — Giao hàng & phiếu cân (giả định tạm theo tab "Lưu đồ", chờ BGĐ chốt D01, D03, D04).
// Sale Admin / Kho / Kế toán nhập phiếu; Kế toán xác nhận số kg thực giao (Lưu đồ mục 14 — căn cứ KPI sau này).
import {response,bad,fail,trimText,readJson,likeFolded} from './http.js';

export const DELIVERY_STATUS={PENDING:'Chờ xác nhận',VERIFIED:'Đã xác nhận',CANCELLED:'Đã hủy'};
const READ=['ADMIN','BOD','ACCOUNTING','SALES_MANAGER','SALES','SALES_ADMIN','LOGISTICS'];
const ENTRY=['ADMIN','SALES_ADMIN','LOGISTICS','ACCOUNTING'];
const VERIFY=['ADMIN','ACCOUNTING'];
const CONFLICT='Phiếu cân vừa được người khác cập nhật hoặc đã chốt. Vui lòng tải lại.';

const SELECT=`SELECT d.id,d.order_line_id,l.order_id,o.code AS order_code,o.status AS order_status,c.name AS customer_name,o.sales_email,
 p.name AS product_name,l.contracted_kg,d.delivered_kg,d.delivery_date,d.vehicle_plate,d.container_no,d.weigh_ticket_no,d.note,
 d.status,d.status_note,d.verified_by,d.verified_at,d.created_by,d.created_at,d.updated_at
 FROM deliveries d JOIN order_lines l ON l.id=d.order_line_id JOIN orders o ON o.id=l.order_id
 JOIN customers c ON c.id=o.customer_id JOIN products p ON p.id=l.product_id`;

function validate(p){
 const raw=typeof p.delivered_kg==='string'?Number(p.delivered_kg.replace(',','.')):p.delivered_kg;
 if(typeof raw!=='number'||!Number.isFinite(raw)||raw<=0||raw>10000000)throw fail('Khối lượng cân thực tế phải lớn hơn 0 và không quá 10.000.000 kg');
 const delivery_date=trimText(p.delivery_date,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)||Number.isNaN(Date.parse(delivery_date+'T00:00:00Z')))throw fail('Ngày giao không hợp lệ (YYYY-MM-DD)');
 return {
  delivered_kg:Math.round(raw*1000)/1000,delivery_date,
  vehicle_plate:trimText(p.vehicle_plate,20)||null,
  container_no:trimText(p.container_no,20).toUpperCase()||null,
  weigh_ticket_no:trimText(p.weigh_ticket_no,40)||null,
  note:trimText(p.note,300)||null,
 };
}
function audit(env,user,action,id,before,after,now){
 return env.DB.prepare('INSERT INTO audit_log(id,actor_email,action,entity,entity_id,before_json,after_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM deliveries WHERE id=? AND updated_at=?)')
  .bind(crypto.randomUUID(),user.email,action,'deliveries',id,before?JSON.stringify(before):null,JSON.stringify(after),id,now);
}
function dbError(e){
 const msg=String(e?.message||'');
 if(/ctfood_order_locked/.test(msg))return bad('Đơn hàng không còn ở trạng thái Chờ giao nên không thêm phiếu cân được',409);
 if(/ctfood_delivery_locked/.test(msg))return bad(CONFLICT,409);
 if(/ctfood_cancel_reason_required/.test(msg))return bad('Hủy phiếu phải ghi lý do',400);
 if(/FOREIGN KEY|CHECK|ctfood_/i.test(msg))return bad('Dữ liệu phiếu cân không hợp lệ',400);
 console.error('D1 delivery save failed',e?.name);
 return bad('Không lưu được phiếu cân. Vui lòng thử lại.',500);
}
async function load(env,user,id){
 const row=await env.DB.prepare(SELECT+' WHERE d.id=?').bind(id).first();
 if(!row||(user.role==='SALES'&&row.sales_email!==user.email))return null;
 return row;
}
async function list(env,user,params){
 const where=[],bind=[];
 if(user.role==='SALES'){where.push('o.sales_email=?');bind.push(user.email)}
 const order=trimText(params.get('order_id'),100);
 if(order){where.push('o.id=?');bind.push(order)}
 const st=trimText(params.get('status'),20).toUpperCase();
 if(st){if(!Object.hasOwn(DELIVERY_STATUS,st))return bad('Trạng thái lọc không hợp lệ',400);where.push('d.status=?');bind.push(st)}
 const q=trimText(params.get('q'),80);
 if(q){const like=likeFolded(q);where.push("(lower(o.code) LIKE ? ESCAPE '\\' OR c.search_key LIKE ? ESCAPE '\\' OR lower(d.weigh_ticket_no) LIKE ? ESCAPE '\\' OR lower(d.container_no) LIKE ? ESCAPE '\\')");bind.push(like,like,like,like)}
 const limit=Math.max(1,Math.min(100,Number(params.get('limit'))||25));
 const offset=Math.max(0,Math.min(10000,Number(params.get('offset'))||0));
 const {results}=await env.DB.prepare(SELECT+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY d.delivery_date DESC,d.created_at DESC LIMIT ? OFFSET ?').bind(...bind,limit+1,offset).all();
 const items=results||[];
 return response({ok:true,data:items.slice(0,limit),pagination:{limit,offset,hasMore:items.length>limit}});
}
async function create(env,user,request){
 if(!ENTRY.includes(user.role))return bad('Chỉ Sale Admin, Kho hoặc Kế toán được nhập phiếu cân',403);
 const p=await readJson(request);
 const v=validate(p);
 const lineId=trimText(p.order_line_id,100);
 const line=lineId?await env.DB.prepare('SELECT l.id,o.status FROM order_lines l JOIN orders o ON o.id=l.order_id WHERE l.id=?').bind(lineId).first():null;
 if(!line)return bad('Chưa chọn dòng hàng của đơn hoặc dòng hàng không tồn tại',400);
 if(line.status!=='PENDING')return bad('Đơn hàng không còn ở trạng thái Chờ giao nên không thêm phiếu cân được',409);
 const id=crypto.randomUUID(),now=new Date().toISOString();
 try{
  await env.DB.batch([
   env.DB.prepare("INSERT INTO deliveries(id,order_line_id,delivered_kg,delivery_date,vehicle_plate,container_no,weigh_ticket_no,note,status,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,'PENDING',?,?)")
    .bind(id,lineId,v.delivered_kg,v.delivery_date,v.vehicle_plate,v.container_no,v.weigh_ticket_no,v.note,user.email,now),
   audit(env,user,'CREATE',id,null,{order_line_id:lineId,...v},now),
  ]);
  return response({ok:true,data:{id,status:'PENDING',updated_at:now},persisted:true},201);
 }catch(e){return dbError(e)}
}
async function update(env,user,request,id){
 if(!ENTRY.includes(user.role))return bad('Chỉ Sale Admin, Kho hoặc Kế toán được sửa phiếu cân',403);
 const p=await readJson(request);
 const expected=typeof p.expected_updated_at==='string'?p.expected_updated_at:null;
 if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại.',428);
 const old=await load(env,user,id);
 if(!old)return bad('Không tìm thấy phiếu cân',404);
 if(old.status!=='PENDING'||old.updated_at!==expected)return bad(CONFLICT,409);
 const v=validate(p);
 const now=new Date().toISOString();
 try{
  const r=await env.DB.batch([
   env.DB.prepare("UPDATE deliveries SET delivered_kg=?,delivery_date=?,vehicle_plate=?,container_no=?,weigh_ticket_no=?,note=?,updated_at=? WHERE id=? AND updated_at=? AND status='PENDING'")
    .bind(v.delivered_kg,v.delivery_date,v.vehicle_plate,v.container_no,v.weigh_ticket_no,v.note,now,id,expected),
   audit(env,user,'UPDATE',id,old,v,now),
  ]);
  if(!(r?.[0]?.meta?.changes>0))return bad(CONFLICT,409);
  return response({ok:true,data:{id,status:'PENDING',updated_at:now},persisted:true});
 }catch(e){return dbError(e)}
}
async function setStatus(env,user,request,id){
 const p=await readJson(request);
 const status=trimText(p.status,20).toUpperCase();
 if(!['VERIFIED','CANCELLED'].includes(status))return bad('Trạng thái chuyển không hợp lệ',400);
 if(status==='VERIFIED'&&!VERIFY.includes(user.role))return bad('Chỉ Kế toán xác nhận số lượng thực giao',403);
 if(status==='CANCELLED'&&!ENTRY.includes(user.role))return bad('Không được phép hủy phiếu cân',403);
 const note=trimText(p.note,300);
 if(status==='CANCELLED'&&!note)return bad('Hủy phiếu phải ghi lý do',400);
 const expected=typeof p.expected_updated_at==='string'?p.expected_updated_at:null;
 if(!expected)return bad('Thiếu phiên bản bản ghi (expected_updated_at). Vui lòng tải lại.',428);
 const old=await load(env,user,id);
 if(!old)return bad('Không tìm thấy phiếu cân',404);
 if(old.status!=='PENDING'||old.updated_at!==expected)return bad(CONFLICT,409);
 const now=new Date().toISOString();
 const verified=status==='VERIFIED';
 try{
  const r=await env.DB.batch([
   env.DB.prepare("UPDATE deliveries SET status=?,status_note=?,verified_by=?,verified_at=?,updated_at=? WHERE id=? AND updated_at=? AND status='PENDING'")
    .bind(status,note||null,verified?user.email:null,verified?now:null,now,id,expected),
   audit(env,user,verified?'VERIFY':'CANCEL',id,{status:old.status},{status,note},now),
  ]);
  if(!(r?.[0]?.meta?.changes>0))return bad(CONFLICT,409);
  return response({ok:true,data:{id,status,updated_at:now},persisted:true});
 }catch(e){return dbError(e)}
}

export async function handleDeliveries(env,user,request,url){
 const m=url.pathname.match(/^\/api\/deliveries(?:\/([a-zA-Z0-9-]{1,100}))?(\/status)?$/);
 if(!m)return null;
 if(!READ.includes(user.role))return bad('Không có quyền truy cập phân hệ',403);
 const [,id,status]=m,method=request.method;
 if(method==='GET'&&!id)return list(env,user,url.searchParams);
 if(method==='GET'&&id&&!status){const row=await load(env,user,id);return row?response({ok:true,data:row}):bad('Không tìm thấy phiếu cân',404)}
 if(method==='POST'&&!id)return create(env,user,request);
 if(method==='PATCH'&&id&&!status)return update(env,user,request,id);
 if(method==='POST'&&id&&status)return setStatus(env,user,request,id);
 return bad('Phương thức không hỗ trợ',405);
}
