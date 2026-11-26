import {response,bad,trimText,readJson,fail} from './http.js';
const TYPES=['customers','products','containers'],LIMIT=30;
const val=(x,max=220)=>trimText(x==null?'':String(x),max);
const required=(v,n)=>{if(!v)throw fail('Thiếu '+n,400);return v};
function normalize(type,raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fail('Dòng không hợp lệ',400);
 if(type==='customers'){
  const legacy_code=required(val(raw.legacy_code,60),'mã khách hàng/NCC'),name=required(val(raw.name),'tên khách hàng/NCC');
  const tax_code=val(raw.tax_code,35)||null,partner_type=val(raw.partner_type||'CUSTOMER',12).toUpperCase(),email=val(raw.email,254);
  if(!['CUSTOMER','SUPPLIER','BOTH'].includes(partner_type))throw fail('Loại đối tác không hợp lệ',400);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Email không hợp lệ',400);
  const days=val(raw.credit_days,20).replace(/\s*ngày$/i,''),credit_days=days===''?0:Number(days);
  if(!Number.isInteger(credit_days)||credit_days<0||credit_days>3650)throw fail('Công nợ phải là số ngày 0–3650',400);
  return {legacy_code,name,tax_code,partner_type,email,credit_days,address:val(raw.address,300),contact_name:val(raw.contact_name,120),contact_phone:val(raw.contact_phone,40),source_sales_name:val(raw.source_sales_name,120)};
 }
 if(type==='products'){
  const legacy_code=required(val(raw.legacy_code,60),'mã hàng'),name=required(val(raw.name),'tên hàng');
  let conversion_kg=null,conversion_note=val(raw.conversion_note,150);
  const rawKg=val(raw.conversion_kg,50);
  if(rawKg){
   if(rawKg.toLowerCase().includes('mã cân'))conversion_note=rawKg;
   else{
    conversion_kg=Number(rawKg.toLowerCase().replace(/\s*kg$/,'').replace(',','.').trim());
    if(!Number.isFinite(conversion_kg)||conversion_kg<=0||conversion_kg>1000000000)throw fail('Khối lượng quy đổi không hợp lệ',400);
   }
  }
  return {legacy_code,name,unit:val(raw.unit,25)||'kg',packaging_type:val(raw.packaging_type,100),conversion_kg,conversion_note};
 }
 const id=required(val(raw.id,64).toUpperCase(),'mã container');
 if(!/^[A-Z0-9][A-Z0-9_-]{3,63}$/.test(id))throw fail('Mã container sai định dạng',400);
 return {id,source_product_name:required(val(raw.source_product_name),'tên hàng container'),product_id:val(raw.product_id,100)};
}
async function examine(env,type,rows){
 const statuses=[],seen=new Set();
 for(let i=0;i<rows.length;i++){
  let row,reason='',status='ready';
  try{
   row=normalize(type,rows[i]);
   const key=(type==='containers'?row.id:row.legacy_code).toUpperCase();
   if(seen.has(key))throw fail('Trùng mã trong file',409);
   seen.add(key);
   const query=type==='containers'?'SELECT id FROM containers WHERE id=?':'SELECT id FROM '+type+' WHERE legacy_code=?';
   const existing=await env.DB.prepare(query).bind(type==='containers'?row.id:row.legacy_code).first();
   if(existing)throw fail('Mã đã có trong hệ thống',409);
   if(type==='customers'&&row.tax_code){
    const dup=await env.DB.prepare('SELECT id FROM customers WHERE tax_code=?').bind(row.tax_code).first();
    if(dup)throw fail('Mã số thuế đã tồn tại',409);
   }
   if(type==='containers'){
    let matches;
    if(row.product_id)matches=(await env.DB.prepare('SELECT id FROM products WHERE (id=? OR legacy_code=?) AND active=1 LIMIT 2').bind(row.product_id,row.product_id).all()).results;
    else matches=(await env.DB.prepare('SELECT id FROM products WHERE lower(trim(name))=lower(?) AND active=1 LIMIT 2').bind(row.source_product_name).all()).results;
    if(matches.length!==1)throw fail(matches.length?'Nhiều hàng hóa trùng':'Không khớp hàng hóa: nhập hàng trước hoặc điền mã hàng',400);
    row.product_id=matches[0].id;
   }
  }catch(e){status='invalid';reason=e.message||'Dữ liệu không hợp lệ'}
  statuses.push({index:i+1,status,reason,data:row||null});
 }
 return statuses;
}
export async function handleImports(env,user,request,url){
 if(!url.pathname.startsWith('/api/imports'))return null;
 if(user.role!=='ADMIN')return bad('Chỉ ADMIN được nhập Excel',403);
 if(request.method==='GET'&&url.pathname==='/api/imports/history'){
  const {results}=await env.DB.prepare('SELECT id,entity,filename,actor_email,total_rows,created_rows,created_at FROM import_batches ORDER BY created_at DESC,id DESC LIMIT 40').all();
  return response({ok:true,data:results||[]});
 }
 if(request.method!=='POST'||!['/api/imports/preview','/api/imports/commit'].includes(url.pathname))return bad('Không tìm thấy chức năng nhập',404);
 const body=await readJson(request),type=val(body.entity,20),rows=body.rows;
 if(!TYPES.includes(type))return bad('Danh mục không hợp lệ',400);
 if(!Array.isArray(rows)||rows.length<1||rows.length>LIMIT)return bad('Mỗi đợt từ 1 đến 30 dòng',400);
 const statuses=await examine(env,type,rows),ready=statuses.filter(x=>x.status==='ready');
 if(url.pathname.endsWith('/preview'))return response({ok:true,data:statuses,ready:ready.length,invalid:statuses.length-ready.length});
 if(ready.length!==statuses.length)return response({ok:false,error:'Có lỗi/trùng; hãy kiểm tra lại trước khi nhập',data:statuses},409);
 if(body.confirm!=='IMPORT')return bad('Thiếu xác nhận nhập',400);
 const filename=val(body.filename||'Excel import',180),batchId=crypto.randomUUID(),statements=[];
 for(const item of ready){
  const r=item.data,id=type==='containers'?r.id:crypto.randomUUID();
  if(type==='customers')statements.push(env.DB.prepare("INSERT INTO customers(id,legacy_code,name,tax_code,partner_type,email,credit_days,address,contact_name,contact_phone,source_sales_name,owner_email,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE')").bind(id,r.legacy_code,r.name,r.tax_code,r.partner_type,r.email,r.credit_days,r.address,r.contact_name,r.contact_phone,r.source_sales_name,user.email));
  if(type==='products')statements.push(env.DB.prepare("INSERT INTO products(id,legacy_code,name,unit,packaging_type,conversion_kg,conversion_note) VALUES(?,?,?,?,?,?,?)").bind(id,r.legacy_code,r.name,r.unit,r.packaging_type,r.conversion_kg,r.conversion_note));
  if(type==='containers')statements.push(env.DB.prepare("INSERT INTO containers(id,product_id,source_product_name,quantity_kg,remaining_kg,status) VALUES(?,?,?,0,0,'PLANNED')").bind(id,r.product_id,r.source_product_name));
  statements.push(env.DB.prepare("INSERT INTO audit_log(id,actor_email,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),user.email,'IMPORT_CREATE',type,id,JSON.stringify({batch_id:batchId,filename,source_row:Number.isInteger(rows[item.index-1]?._row)&&rows[item.index-1]._row>1?rows[item.index-1]._row:item.index,record:r})));
 }
 statements.push(env.DB.prepare('INSERT INTO import_batches(id,entity,filename,actor_email,total_rows,created_rows) VALUES(?,?,?,?,?,?)').bind(batchId,type,filename,rows.length,ready.length));
 try{
  await env.DB.batch(statements);
  return response({ok:true,persisted:true,data:{batch_id:batchId,created:ready.length}});
 }catch(e){
  if(/UNIQUE|PRIMARY KEY|FOREIGN KEY/i.test(String(e?.message||'')))return bad('Có dữ liệu trùng hoặc liên kết vừa thay đổi; hãy kiểm tra lại',409);
  console.error('Import failed',e?.name||'Error');
  return bad('Không nhập được đợt này; dữ liệu của đợt được hoàn tác',500);
 }
}
