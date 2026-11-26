import React,{useEffect,useId,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LayoutDashboard,Users,UserPlus,Package,ShoppingCart,Truck,Wallet,ChartColumn,Settings,Search,Plus,Download,RefreshCcw,Menu,X,AlertTriangle,Lock,Database,CheckCircle2,ChevronLeft,ChevronRight,LogOut,ArrowRight,Clock3,ShieldCheck,Info,UserCog,CircleUser,KeyRound,ExternalLink} from 'lucide-react';
import './crm-v04.css';
import {LoginPanel} from './AuthGateway.jsx';
import {SCHEMAS} from './data.js';
import {Status,Notice,jsonFetch,toText} from './ui.jsx';
import {OrdersPage} from './Orders.jsx';

const LIVE=['customers','leads','products'];
const LOCKED=[
 {id:'deliveries',name:'Giao hàng & phiếu cân',icon:Truck,description:'Chưa nghiệm thu dữ liệu cân thực tế và xác nhận giao'},
 {id:'payments',name:'Thu tiền & công nợ',icon:Wallet,description:'Chưa nghiệm thu phân bổ thanh toán và công nợ'},
 {id:'kpi',name:'Báo cáo & KPI',icon:ChartColumn,description:'Chưa tích hợp KPI đang vận hành; không sử dụng số liệu mẫu'},
];
const NAV=[
 {id:'dashboard',name:'Tổng quan',icon:LayoutDashboard},
 {id:'customers',name:'Khách hàng',icon:Users},
 {id:'leads',name:'Khách tiềm năng',icon:UserPlus},
 {id:'products',name:'Sản phẩm',icon:Package},
 {id:'orders',name:'Đơn hàng',icon:ShoppingCart,badge:'Thử nghiệm'},
];
// Khớp ROLES trong worker/src/index.js.
const ROLE_LABEL={ADMIN:'Quản trị hệ thống',BOD:'Ban Giám đốc',ACCOUNTING:'Kế toán',SALES_MANAGER:'Trưởng phòng kinh doanh',SALES:'Nhân viên kinh doanh',SALES_ADMIN:'Sale Admin',LOGISTICS:'Kho / Logistics'};
const ADMIN_NAV={id:'users',name:'Quản lý tài khoản',icon:UserCog};
const ACCOUNT_NAV=[{id:'profile',name:'Thông tin tài khoản',icon:CircleUser},{id:'password',name:'Đổi mật khẩu',icon:KeyRound}];
// Mô tả quyền theo đúng kiểm soát ở API (worker/src/index.js).
const ROLE_SCOPE={
 ADMIN:['Xem và sửa toàn bộ danh mục','Xem hạn mức tín dụng và giá vốn','Quản lý tài khoản và phân quyền'],
 BOD:['Xem toàn bộ dữ liệu, gồm hạn mức tín dụng và giá vốn','Sửa khách hàng, khách tiềm năng, sản phẩm'],
 ACCOUNTING:['Xem toàn bộ dữ liệu, gồm hạn mức tín dụng và giá vốn','Chỉ xem, không sửa danh mục'],
 SALES_MANAGER:['Xem và sửa khách hàng, khách tiềm năng, sản phẩm của mọi Sales','Không xem hạn mức tín dụng và giá vốn'],
 SALES:['Chỉ xem và sửa khách hàng, khách tiềm năng do mình phụ trách','Xem danh mục sản phẩm, không sửa','Không xem hạn mức tín dụng và giá vốn'],
 SALES_ADMIN:['Xem và sửa khách hàng, khách tiềm năng, sản phẩm','Không xem hạn mức tín dụng và giá vốn'],
 LOGISTICS:['Xem khách hàng, sản phẩm, container (không có giá vốn)','Không xem khách tiềm năng và phiếu thu','Chỉ xem, không sửa danh mục'],
};
const ROLE_WRITE=new Set(['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN']);
const PAGE_SIZE=25;
// Mã chuẩn trong D1 -> nhãn hiển thị (khớp CUSTOMER_STATUS / LEAD_STAGE trong worker).
const STATUS_LABEL={ACTIVE:'Đang giao dịch',PROSPECT:'Tiềm năng',INACTIVE:'Ngừng giao dịch'};
const STAGE_LABEL={NEW:'Mới',CONTACTING:'Đang liên hệ',QUOTED:'Đã báo giá',CONVERTED:'Chuyển đổi',REJECTED:'Không phù hợp'};
const getRoute=()=>{
 const page=(window.location.hash||'#/dashboard').replace(/^#\/?/,'').split('?')[0];
 return [...NAV,...ACCOUNT_NAV,ADMIN_NAV,...LOCKED].some(x=>x.id===page)?page:'dashboard';
};
function safeCSV(data,label){
 if(!data.length)return;
 const keys=Object.keys(data[0]).filter(k=>!['credit_limit','credit_days','cost_per_kg'].includes(k));
 const esc=x=>{
  const raw=toText(x);
  const safe=/^[\s]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replaceAll('"','""')+'"';
 };
 const rows=[keys.map(esc).join(','),...data.map(row=>keys.map(key=>esc(row[key])).join(','))];
 const blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='CTFOOD_'+label+'_'+new Date().toISOString().slice(0,10)+'.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Modal({entity,initial,onCancel,onSave}){
 const schema=SCHEMAS[entity];
 const [form,setForm]=useState(initial?{...initial,tax:initial.tax_code??initial.tax??'',group:initial.category??initial.group??'',status:STATUS_LABEL[initial.status]??initial.status,stage:STAGE_LABEL[initial.stage]??initial.stage}:{});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const heading=useId();
 const closeRef=useRef(null);
 const dialogRef=useRef(null);
 const priorFocus=useRef(null);
 const cancelRef=useRef(onCancel);
 const busyRef=useRef(busy);
 cancelRef.current=onCancel;
 busyRef.current=busy;
 const editing=Boolean(initial);
 useEffect(()=>{
  priorFocus.current=document.activeElement;
  closeRef.current?.focus();
  const onKey=e=>{
   if(e.key==='Escape'&&!busyRef.current){e.preventDefault();cancelRef.current();return}
   if(e.key!=='Tab')return;
   const focusable=[...(dialogRef.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[href]')||[])];
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('keydown',onKey);priorFocus.current?.focus?.()};
 },[]);
 const fields=schema.fields.filter(([key])=>key!=='owner');
 const submit=async e=>{
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');
  try{await onSave(form,initial)}catch(ex){setError(ex.message||'Không lưu được dữ liệu. Vui lòng thử lại.');setBusy(false)}
 };
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel()}}>
  <section ref={dialogRef} className="modal ct-modal" role="dialog" aria-modal="true" aria-labelledby={heading}>
   <div className="ct-modal-title"><div><div className="ct-overline">LƯU VÀO CLOUDFLARE D1</div><h2 id={heading}>{editing?'Cập nhật':'Thêm mới'} {schema.title.toLowerCase()}</h2></div><button className="ct-icon-button" type="button" ref={closeRef} disabled={busy} onClick={onCancel} aria-label="Đóng biểu mẫu"><X size={20}/></button></div>
   <form onSubmit={submit}>
    <div className="formgrid ct-formgrid">{fields.map(([key,label,kind])=>{
     const required=['name'].includes(key);
     const isSelect=kind.startsWith('select:');
     const value=form[key]??'';
     const update=v=>setForm(old=>({...old,[key]:v}));
     return <label key={key}>{label}{required&&<span className="ct-required"> *</span>}
      {isSelect?<select disabled={busy} required={required} value={value} onChange={e=>update(e.target.value)}><option value="">Chọn...</option>{kind.slice(7).split('|').map(v=><option key={v} value={v}>{v}</option>)}</select>
       :<input disabled={busy} required={required} type={kind} maxLength={key==='name'?220:undefined} value={value} onChange={e=>update(e.target.value)} autoComplete="off"/>}
     </label>;
    })}</div>
    <p className="ct-owner-help"><ShieldCheck size={15}/> Người phụ trách được ghi nhận theo tài khoản đăng nhập; không nhập tự do.</p>
    {error&&<Notice type="error">{error}</Notice>}
    <div className="ct-modal-actions"><button type="button" disabled={busy} className="ct-btn secondary" onClick={onCancel}>Hủy</button><button type="submit" disabled={busy} className="ct-btn primary">{busy?'Đang lưu D1...':'Lưu lên D1'}</button></div>
   </form>
  </section>
 </div>;
}
function MasterList({entity,role,onSaved}){
 const schema=SCHEMAS[entity];
 const [rows,setRows]=useState([]);
 const [page,setPage]=useState(0);
 const [search,setSearch]=useState('');
 const [query,setQuery]=useState('');
 const [hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [flash,setFlash]=useState('');
 const [editing,setEditing]=useState(undefined);
 const [sequence,setSequence]=useState(0);
 const canWrite=ROLE_WRITE.has(role)||(role==='SALES'&&entity!=='products');
 const reqId=useRef(0);
 useEffect(()=>{
  const timer=setTimeout(()=>{setPage(0);setQuery(search.trim())},300);
  return()=>clearTimeout(timer);
 },[search]);
 useEffect(()=>{
  const current=++reqId.current;const controller=new AbortController();
  setLoading(true);setError('');
  const url='/api/'+entity+'?limit='+PAGE_SIZE+'&offset='+(page*PAGE_SIZE)+'&q='+encodeURIComponent(query);
  fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'},signal:controller.signal}).then(async res=>{
   const data=await res.json().catch(()=>({}));
   if(!res.ok||!data.ok)throw Error(data.error||'Không tải được dữ liệu (HTTP '+res.status+')');
   if(!Array.isArray(data.data))throw Error('Định dạng dữ liệu không hợp lệ');
   if(current===reqId.current){setRows(data.data);setHasMore(Boolean(data.pagination?.hasMore));}
  }).catch(err=>{if(err.name!=='AbortError'&&current===reqId.current){setRows([]);setError(err.message)}}).finally(()=>{if(current===reqId.current)setLoading(false)});
  return()=>controller.abort();
 },[entity,page,query,sequence]);
 const reload=()=>setSequence(i=>i+1);
 const save=async (payload,old)=>{
  const method=old?'PATCH':'POST',path='/api/'+entity+(old?'/'+encodeURIComponent(old.id):'');
  const body=old?{...payload,expected_updated_at:old.updated_at}:payload;
  const res=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  // 409 do người khác vừa sửa: tải lại danh sách để bảng phía sau hiển thị dữ liệu mới nhất.
  if(res.status===409&&old)reload();
  if(!res.ok||!data.ok||!data.persisted)throw Error(data.error||'Máy chủ chưa xác nhận lưu dữ liệu D1');
  setEditing(undefined);setFlash(old?'Đã cập nhật bản ghi trên D1.':'Đã thêm bản ghi vào D1.');
  setPage(0);reload();onSaved();
 };
 const cols=schema.columns.filter(([key])=>key!=='owner');
 const cell=(row,key)=>{
  if(key==='tax')return toText(row.tax_code||row.tax)||'—';
  if(key==='group')return toText(row.category||row.group)||'—';
  if(key==='status'||key==='stage')return <Status value={(key==='status'?STATUS_LABEL:STAGE_LABEL)[row[key]]||row[key]}/>;
  // UUID dài thì rút gọn (di chuột để xem đủ); mã ngắn như DEMO-KH12 hiển thị nguyên vẹn.
  if(key==='id'){const id=toText(row.id);return <span className="ct-id" title={id}>{id.length>12?id.slice(0,8)+'…':id}</span>}
  return toText(row[key])||'—';
 };
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">DANH MỤC · CLOUDFLARE D1</div><h2>{schema.title}</h2><p>Dữ liệu tập trung, phân quyền theo tài khoản. Không sử dụng bản ghi mẫu.</p></div>
   <div className="ct-actions"><button className="ct-btn secondary" disabled={loading} onClick={reload}><RefreshCcw size={17}/> Làm mới</button><button className="ct-btn secondary" disabled={loading||rows.length===0} onClick={()=>safeCSV(rows,entity)} title="Chỉ xuất trang dữ liệu đang hiển thị"><Download size={17}/> Xuất trang</button>{canWrite&&<button className="ct-btn primary" onClick={()=>setEditing(null)}><Plus size={17}/> Tạo mới</button>}</div>
  </div>
  {flash&&<Notice type="success">{flash}</Notice>}
  <div className="ct-toolbar"><label className="ct-search"><Search size={18}/><span className="sr-only">Tìm kiếm {schema.title.toLowerCase()}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={entity==='customers'?'Tìm theo tên, số điện thoại hoặc mã số thuế...':'Tìm theo tên '+schema.title.toLowerCase()+'...'} aria-label={'Tìm kiếm '+schema.title}/></label><span className="ct-toolbar-counter">Trang {page+1} · Tối đa {PAGE_SIZE} dòng</span></div>
  {error?<div className="ct-empty"><AlertTriangle size={30}/><strong>Không thể tải danh sách</strong><p>{error}</p><button className="ct-btn secondary" onClick={reload}>Thử lại</button></div>
   :loading?<div className="ct-loading" role="status" aria-live="polite">{[0,1,2,3].map(i=><div className="ct-skeleton" key={i}/>)}</div>
   :rows.length===0?<div className="ct-empty"><Database size={32}/><strong>{query?'Không tìm thấy kết quả':'Chưa có dữ liệu'}</strong><p>{query?'Hãy thử từ khóa khác.':'Có thể tạo bản ghi đầu tiên nếu tài khoản được cấp quyền.'}</p></div>
   :<>
    <div className="ct-tablebox"><table className="ct-data-table"><thead><tr>{cols.map(([k,label])=><th scope="col" key={k}>{label}</th>)}{canWrite&&<th scope="col">Thao tác</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{cols.map(([k,label])=><td key={k} data-label={label}>{cell(row,k)}</td>)}{canWrite&&<td data-label="Thao tác"><button className="ct-text-button" onClick={()=>setEditing(row)}>Chỉnh sửa</button></td>}</tr>)}</tbody></table></div>
    <div className="ct-pagination"><span>Hiển thị {page*PAGE_SIZE+1}–{page*PAGE_SIZE+rows.length}{hasMore?' · còn dữ liệu':' · hết danh sách'}</span><div><button className="ct-btn secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)} aria-label="Trang trước"><ChevronLeft size={17}/> Trước</button><button className="ct-btn secondary" disabled={!hasMore} onClick={()=>setPage(p=>p+1)} aria-label="Trang sau">Sau <ChevronRight size={17}/></button></div></div>
   </>}
  {editing!==undefined&&<Modal entity={entity} initial={editing} onCancel={()=>setEditing(undefined)} onSave={save}/>}
 </section>;
}
function UserModal({initial,self,onCancel,onSave}){
 const editing=Boolean(initial);
 const [form,setForm]=useState(initial?{email:initial.email,full_name:initial.full_name,role:initial.role,active:Boolean(initial.active)}:{email:'',full_name:'',role:'SALES',active:true});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const heading=useId();
 const isSelf=editing&&initial.email===self;
 const set=(k,v)=>setForm(old=>({...old,[k]:v}));
 useEffect(()=>{const onKey=e=>{if(e.key==='Escape'&&!busy)onCancel()};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[busy,onCancel]);
 const submit=async e=>{
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{await onSave(form,initial)}catch(ex){setError(ex.message);setBusy(false)}
 };
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel()}}>
  <section className="modal ct-modal" role="dialog" aria-modal="true" aria-labelledby={heading}>
   <div className="ct-modal-title"><div><div className="ct-overline">PHÂN QUYỀN · CLOUDFLARE D1</div><h2 id={heading}>{editing?'Cập nhật tài khoản':'Thêm tài khoản'}</h2></div><button className="ct-icon-button" type="button" disabled={busy} onClick={onCancel} aria-label="Đóng biểu mẫu"><X size={20}/></button></div>
   <form onSubmit={submit}>
    <div className="formgrid ct-formgrid">
     <label>Email Google<span className="ct-required"> *</span><input type="email" required disabled={busy||editing} value={form.email} maxLength={254} autoComplete="off" onChange={e=>set('email',e.target.value)} placeholder="ten@congty.com"/></label>
     <label>Họ tên<span className="ct-required"> *</span><input required disabled={busy} value={form.full_name} maxLength={120} onChange={e=>set('full_name',e.target.value)}/></label>
     <label>Vai trò<span className="ct-required"> *</span><select required disabled={busy||isSelf} value={form.role} onChange={e=>set('role',e.target.value)}>{Object.entries(ROLE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>Trạng thái<select disabled={busy||isSelf} value={form.active?'1':'0'} onChange={e=>set('active',e.target.value==='1')}><option value="1">Đang hoạt động</option><option value="0">Đã khóa</option></select></label>
    </div>
    {isSelf&&<p className="ct-owner-help"><Lock size={15}/> Không thể tự đổi vai trò hoặc tự khóa tài khoản đang đăng nhập.</p>}
    {!editing&&<p className="ct-owner-help"><Info size={15}/> Sau khi lưu, cần thêm email này vào chính sách Cloudflare Access của CRM thì người dùng mới đăng nhập được.</p>}
    {error&&<Notice type="error">{error}</Notice>}
    <div className="ct-modal-actions"><button type="button" disabled={busy} className="ct-btn secondary" onClick={onCancel}>Hủy</button><button type="submit" disabled={busy} className="ct-btn primary">{busy?'Đang lưu...':'Lưu tài khoản'}</button></div>
   </form>
  </section>
 </div>;
}
function UsersAdmin({self}){
 const [rows,setRows]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [flash,setFlash]=useState('');
 const [editing,setEditing]=useState(undefined);
 const [query,setQuery]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try{setRows((await jsonFetch('/api/users')).data)}catch(e){setRows([]);setError(e.message)}
  finally{setLoading(false)}
 };
 useEffect(()=>{load()},[]);
 const save=async(form,old)=>{
  const body={full_name:form.full_name,role:form.role,active:form.active};
  try{
   if(old)await jsonFetch('/api/users/'+encodeURIComponent(old.email),{method:'PATCH',body:JSON.stringify({...body,expected_updated_at:old.updated_at})});
   else await jsonFetch('/api/users',{method:'POST',body:JSON.stringify({...body,email:form.email})});
  }catch(e){if(e.status===409&&old)load();throw e}
  setEditing(undefined);setFlash(old?'Đã cập nhật tài khoản.':'Đã thêm tài khoản. Nhớ thêm email vào chính sách Cloudflare Access.');load();
 };
 const q=query.trim().toLowerCase();
 const shown=q?rows.filter(r=>(r.email+' '+r.full_name+' '+(ROLE_LABEL[r.role]||r.role)).toLowerCase().includes(q)):rows;
 const fmt=v=>{if(!v)return '—';const d=new Date(v.includes('T')?v:v.replace(' ','T')+'Z');return isNaN(d)?v:new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(d)};
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">QUẢN TRỊ · CHỈ ADMIN</div><h2>Quản lý tài khoản</h2><p>Tài khoản được phép dùng CRM và vai trò quyết định dữ liệu mỗi người được xem/sửa.</p></div>
   <div className="ct-actions"><button className="ct-btn secondary" disabled={loading} onClick={load}><RefreshCcw size={17}/> Làm mới</button><button className="ct-btn primary" onClick={()=>setEditing(null)}><Plus size={17}/> Thêm tài khoản</button></div>
  </div>
  <Notice>Đăng nhập cần đủ 2 lớp: email nằm trong chính sách <strong>Cloudflare Access</strong> và tài khoản <strong>đang hoạt động</strong> ở đây. Khóa tài khoản tại đây có hiệu lực ngay với mọi API.</Notice>
  {flash&&<Notice type="success">{flash}</Notice>}
  <div className="ct-toolbar"><label className="ct-search"><Search size={18}/><span className="sr-only">Tìm người dùng</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm theo email, họ tên hoặc vai trò..." aria-label="Tìm người dùng"/></label><span className="ct-toolbar-counter">{rows.filter(r=>r.active).length} đang hoạt động · {rows.length} tài khoản</span></div>
  {error?<div className="ct-empty"><AlertTriangle size={30}/><strong>Không thể tải danh sách</strong><p>{error}</p><button className="ct-btn secondary" onClick={load}>Thử lại</button></div>
   :loading?<div className="ct-loading" role="status" aria-live="polite">{[0,1,2].map(i=><div className="ct-skeleton" key={i}/>)}</div>
   :shown.length===0?<div className="ct-empty"><Database size={32}/><strong>Không tìm thấy tài khoản</strong></div>
   :<div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th scope="col">Email</th><th scope="col">Họ tên</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Cập nhật</th><th scope="col">Thao tác</th></tr></thead>
    <tbody>{shown.map(r=><tr key={r.email}><td data-label="Email">{r.email}{r.email===self&&<span className="ct-you"> (bạn)</span>}</td><td data-label="Họ tên">{r.full_name}</td><td data-label="Vai trò">{ROLE_LABEL[r.role]||r.role}</td><td data-label="Trạng thái"><Status value={r.active?'Đang hoạt động':'Đã khóa'}/></td><td data-label="Cập nhật">{fmt(r.updated_at)}</td><td data-label="Thao tác"><button className="ct-text-button" onClick={()=>setEditing(r)}>Chỉnh sửa</button></td></tr>)}</tbody></table></div>}
  {editing!==undefined&&<UserModal initial={editing} self={self} onCancel={()=>setEditing(undefined)} onSave={save}/>}
 </section>;
}
const LOGOUT_URL='/cdn-cgi/access/logout?returnTo='+encodeURIComponent('https://crm-ctfood.pages.dev/login');
function AccountProfile({user}){
 const rows=[['Họ tên',user.full_name||'—'],['Email đăng nhập',user.email],['Vai trò',ROLE_LABEL[user.role]||user.role],['Trạng thái',<Status value={user.active?'Đang hoạt động':'Đã khóa'}/>],['Phương thức đăng nhập','Google qua Cloudflare Access']];
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">TÀI KHOẢN</div><h2>Thông tin tài khoản</h2><p>Thông tin do quản trị viên cấp trong CRM. Muốn đổi họ tên hoặc vai trò, liên hệ quản trị viên.</p></div>
   <div className="ct-actions"><a className="ct-btn secondary" href={LOGOUT_URL}><LogOut size={17}/> Đăng xuất</a></div></div>
  <div className="ct-dashboard-grid">
   <section className="ct-panel"><div className="ct-panel-title"><div><h3>Hồ sơ</h3><p>Dữ liệu từ bảng tài khoản CRM (D1)</p></div><CircleUser size={22}/></div>
    <div className="ct-status-list">{rows.map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></section>
   <section className="ct-panel"><div className="ct-panel-title"><div><h3>Quyền của bạn</h3><p>Được kiểm soát tại máy chủ, không chỉ ẩn trên giao diện</p></div><ShieldCheck size={22}/></div>
    <div className="ct-next-list">{(ROLE_SCOPE[user.role]||[]).map(t=><div key={t}><CheckCircle2 size={16}/><span>{t}</span></div>)}</div></section>
  </div>
 </section>;
}
function AccountPassword(){
 const link=(href,label)=><a className="ct-btn primary" href={href} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> {label}</a>;
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">TÀI KHOẢN</div><h2>Đổi mật khẩu</h2><p>CT FOOD CRM đăng nhập bằng tài khoản Google, không lưu mật khẩu riêng.</p></div></div>
  <Notice>Mật khẩu của bạn chính là mật khẩu tài khoản Google. Đổi mật khẩu tại trang bảo mật của Google; CRM không bao giờ hỏi hay lưu mật khẩu của bạn.</Notice>
  <div className="ct-dashboard-grid">
   <section className="ct-panel"><div className="ct-panel-title"><div><h3>Đổi mật khẩu Google</h3><p>Mở trang Google trong thẻ mới</p></div><KeyRound size={22}/></div>
    <div className="ct-next-list"><div><span>1</span><span>Bấm nút bên dưới và đăng nhập Google nếu được hỏi.</span></div><div><span>2</span><span>Nhập mật khẩu mới và lưu.</span></div><div><span>3</span><span>Quay lại CRM, bấm Đăng xuất rồi đăng nhập lại bằng mật khẩu mới.</span></div></div>
    <div className="ct-actions" style={{marginTop:16}}>{link('https://myaccount.google.com/signinoptions/password','Đổi mật khẩu Google')}<a className="ct-btn secondary" href={LOGOUT_URL}><LogOut size={17}/> Đăng xuất</a></div></section>
   <section className="ct-panel"><div className="ct-panel-title"><div><h3>Tăng bảo mật</h3><p>Khuyến nghị cho mọi tài khoản dùng CRM</p></div><ShieldCheck size={22}/></div>
    <div className="ct-next-list"><div><CheckCircle2 size={16}/><span>Bật xác minh 2 bước để tránh lộ dữ liệu khách hàng khi mất mật khẩu.</span></div><div><CheckCircle2 size={16}/><span>Không dùng chung tài khoản Google giữa nhiều nhân viên.</span></div></div>
    <div className="ct-actions" style={{marginTop:16}}><a className="ct-btn secondary" href="https://myaccount.google.com/signinoptions/two-step-verification" target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Xác minh 2 bước</a></div></section>
  </div>
 </section>;
}
function Dashboard({summary,loading,error,onRetry,onNavigate,updatedAt}){
 const cards=[
  {name:'Khách hàng',value:summary?.customers,icon:Users,to:'customers',detail:'Bản ghi khách hàng từ D1'},
  {name:'Khách tiềm năng',value:summary?.leads,icon:UserPlus,to:'leads',detail:'Khách cần tiếp cận từ D1'},
  {name:'Sản phẩm',value:summary?.products,icon:Package,to:'products',detail:'Danh mục sản phẩm từ D1'}
 ].filter(card=>card.value!==null);
 return <div className="ct-dashboard">
  <div className="ct-dashboard-title"><div><div className="ct-overline">TỔNG QUAN DỮ LIỆU THẬT</div><h2>Hoạt động CT FOOD</h2><p>Chỉ tổng hợp các danh mục đã kết nối và được xác thực trên Cloudflare D1.</p></div><button className="ct-btn secondary" onClick={onRetry}><RefreshCcw size={17}/> Làm mới</button></div>
  {error&&<Notice type="error">Không thể xác nhận số liệu D1: {error}. Không hiển thị dữ liệu cũ như dữ liệu mới.</Notice>}
  <div className="ct-kpis">{cards.map(({name,value,icon:Icon,to,detail})=><button type="button" className="ct-kpi" key={to} onClick={()=>onNavigate(to)}>
   <div className="ct-kpi-top"><span>{name}</span><span className="ct-kpi-icon"><Icon size={20}/></span></div>
   <div className="ct-kpi-value">{loading?'…':error||summary===null?'—':Number(value??0).toLocaleString('vi-VN')}</div><div className="ct-kpi-detail">{detail} <ArrowRight size={15}/></div>
  </button>)}</div>
  <div className="ct-dashboard-grid"><section className="ct-panel"><div className="ct-panel-title"><div><h3>Tình trạng dữ liệu</h3><p>Thông tin hệ thống thực, không dùng số liệu minh họa</p></div><ShieldCheck size={22}/></div>
   <div className="ct-status-list"><div><span>Đăng nhập</span><Status value="Đang hoạt động"/></div><div><span>Khách hàng · Khách tiềm năng · Sản phẩm</span><Status value={error?'Cần kiểm tra':'Đã kết nối'}/></div><div><span>Nguồn tổng hợp</span><strong>Cloudflare D1</strong></div><div><span>Cập nhật gần nhất</span><strong>{updatedAt?new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium'}).format(updatedAt):'Chưa có'}</strong></div></div>
  </section><section className="ct-panel"><div className="ct-panel-title"><div><h3>Các phân hệ tiếp theo</h3><p>Chưa mở vận hành, chờ kiểm thử nghiệp vụ</p></div><Clock3 size={22}/></div>
   <div className="ct-next-list">{LOCKED.map(item=><div key={item.id}><Lock size={16}/><span>{item.name}</span><span className="ct-next-tag">Chưa nghiệm thu</span></div>)}</div>
  </section></div>
 </div>;
}
function Pending({page}){
 const item=LOCKED.find(x=>x.id===page);
 const Icon=item?.icon||Lock;
 return <section className="ct-workspace ct-pending"><span className="ct-pending-icon"><Icon size={28}/></span><div className="ct-overline">CHƯA PHÁT HÀNH NGHIỆP VỤ</div><h2>{item?.name||'Phân hệ đang xây dựng'}</h2><p>{item?.description||'Chức năng đang hoàn thiện.'}</p><Notice>Không thể ghi dữ liệu thật tại đây. Các quy trình phải được phê duyệt và kiểm thử trước khi sử dụng.</Notice></section>;
}
function CRMApp(){
 const [auth,setAuth]=useState({status:'loading',user:null,error:''});
 const [route,setRoute]=useState(getRoute);
 const [drawer,setDrawer]=useState(false);
 const [summary,setSummary]=useState(null);
 const [updatedAt,setUpdatedAt]=useState(null);
 const [stats,setStats]=useState({loading:false,error:''});
 const changePage=id=>{window.location.hash='/'+id;setRoute(id);setDrawer(false)};
 const loadSummary=async()=>{
  setStats({loading:true,error:''});setSummary(null);
  try{const res=await fetch('/api/summary',{credentials:'same-origin',headers:{Accept:'application/json'}});const json=await res.json().catch(()=>({}));if(!res.ok||!json.ok)throw Error(json.error||'HTTP '+res.status);setSummary(json.data);setUpdatedAt(new Date());setStats({loading:false,error:''});}
  catch(e){setStats({loading:false,error:e.message})}
 };
 const authenticate=async()=>{
  setAuth({status:'loading',user:null,error:''});
  try{
   const res=await fetch('/api/me',{credentials:'same-origin',headers:{Accept:'application/json'}});
   const json=await res.json().catch(()=>({}));
   if(!res.ok||!json.ok||!json.user)throw Error(json.error||'Không xác thực được tài khoản');
   setAuth({status:'online',user:json.user,error:''});
  }catch(e){setAuth({status:'error',user:null,error:e.message})}
 };
 useEffect(()=>{
  const handler=()=>setRoute(getRoute());
  window.addEventListener('hashchange',handler);
  authenticate();
  return()=>window.removeEventListener('hashchange',handler);
 },[]);
 useEffect(()=>{if(auth.status==='online')loadSummary()},[auth.status]);
 if(auth.status!=='online')return <LoginPanel error={auth.error} loading={auth.status==='loading'} onRetry={authenticate}/>;
 const isAdmin=auth.user.role==='ADMIN';
 const permittedNav=NAV.filter(item=>item.id!=='leads'||auth.user.role!=='LOGISTICS');
 const adminNav=isAdmin?[ADMIN_NAV]:[];
 const selectedPage=(route==='leads'&&auth.user.role==='LOGISTICS')||(route==='users'&&!isAdmin)?'dashboard':route;
 const current=[...permittedNav,...ACCOUNT_NAV,...adminNav,...LOCKED].find(x=>x.id===selectedPage)||permittedNav[0];
 const navButton=(item,extra)=>{const ItemIcon=item.icon;return <button key={item.id} className={'ct-nav-item '+(extra||'')+(route===item.id?' active':'')} onClick={()=>changePage(item.id)} aria-current={route===item.id?'page':undefined}><ItemIcon size={19}/><span>{item.name}</span>{extra==='pending'&&<Lock size={14}/>}{item.badge&&<span className="ct-nav-badge">{item.badge}</span>}{item.id==='dashboard'&&<span className="ct-nav-arrow">●</span>}</button>};
 const Icon=current.icon;
 return <div className="ct-shell">
  <aside className={'ct-sidebar '+(drawer?'open':'')} aria-label="Điều hướng chính">
   <div className="ct-brand"><span className="ct-logo">CT</span><div><strong>CT FOOD</strong><small>CRM MANAGEMENT</small></div><button className="ct-icon-button ct-mobile-close" onClick={()=>setDrawer(false)} aria-label="Đóng menu"><X size={19}/></button></div>
   <nav className="ct-nav"><div className="ct-nav-label">DỮ LIỆU ĐÃ KẾT NỐI</div>{permittedNav.map(item=>navButton(item))}
    <div className="ct-nav-label ct-nav-label-next">TÀI KHOẢN</div>{ACCOUNT_NAV.map(item=>navButton(item))}
    {isAdmin&&<><div className="ct-nav-label ct-nav-label-next">QUẢN TRỊ</div>{adminNav.map(item=>navButton(item))}</>}
    <div className="ct-nav-label ct-nav-label-next">CHƯA NGHIỆM THU</div>{LOCKED.map(item=>navButton(item,'pending'))}</nav>
   <div className="ct-sidebar-footer"><span className="ct-online-dot"/> CT FOOD V0.4 · D1</div>
  </aside>
  {drawer&&<button className="ct-drawer-overlay" aria-label="Đóng menu" onClick={()=>setDrawer(false)}/>}
  <div className="ct-main">
   <header className="ct-header"><div className="ct-header-left"><button className="ct-icon-button ct-menu-button" onClick={()=>setDrawer(true)} aria-label="Mở menu"><Menu size={22}/></button><div className="ct-breadcrumb"><small>CT FOOD / {current.name}</small><h1><Icon size={20}/>{current.name}</h1></div></div><div className="ct-header-right"><span className="ct-connected"><span/> D1 ĐANG KẾT NỐI</span><div className="ct-user" role="button" tabIndex={0} title="Thông tin tài khoản" style={{cursor:'pointer'}} onClick={()=>changePage('profile')} onKeyDown={e=>{if(e.key==='Enter')changePage('profile')}}><strong>{auth.user.full_name||'Người dùng CRM'}</strong><small>{ROLE_LABEL[auth.user.role]||auth.user.role}</small></div><a className="ct-logout" href={"/cdn-cgi/access/logout?returnTo="+encodeURIComponent("https://crm-ctfood.pages.dev/login")} title="Đăng xuất Cloudflare Access" aria-label="Đăng xuất"><LogOut size={19}/></a></div></header>
   <main className="ct-content"><div className="ct-live-info"><ShieldCheck size={16}/><span>Dữ liệu danh mục từ D1 · Đăng nhập: {auth.user.email} · Đơn hàng, giao nhận và công nợ chưa mở ghi thực tế</span></div>
    {selectedPage==='dashboard'?<Dashboard summary={summary} loading={stats.loading} error={stats.error} onRetry={loadSummary} onNavigate={changePage} updatedAt={updatedAt}/>
     :selectedPage==='users'?<UsersAdmin self={auth.user.email}/>
     :selectedPage==='orders'?<OrdersPage user={auth.user}/>
     :selectedPage==='profile'?<AccountProfile user={auth.user}/>
     :selectedPage==='password'?<AccountPassword/>
     :LIVE.includes(selectedPage)?<MasterList key={selectedPage} entity={selectedPage} role={auth.user.role} onSaved={loadSummary}/>
     :<Pending page={selectedPage}/>}
    <footer className="ct-footer">CT FOOD CRM V0.4 · Dữ liệu D1 có xác thực · Chưa nghiệm thu các phân hệ tài chính</footer>
   </main>
  </div>
 </div>;
}
createRoot(document.getElementById('root')).render(<CRMApp/>);
