import React,{useEffect,useId,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LayoutDashboard,Users,UserPlus,Package,ShoppingCart,Truck,Wallet,ChartColumn,Settings,Search,Plus,Download,RefreshCcw,Menu,X,AlertTriangle,Lock,Database,CheckCircle2,ChevronLeft,ChevronRight,LogOut,ArrowRight,Clock3,ShieldCheck,Info} from 'lucide-react';
import './crm-v04.css';
import {LoginPanel} from './AuthGateway.jsx';
import {SCHEMAS} from './data.js';

const LIVE=['customers','leads','products'];
const LOCKED=[
 {id:'orders',name:'Đơn hàng',icon:ShoppingCart,description:'Chưa nghiệm thu quy trình tạo đơn, nhiều dòng hàng và phê duyệt'},
 {id:'deliveries',name:'Giao hàng & phiếu cân',icon:Truck,description:'Chưa nghiệm thu dữ liệu cân thực tế và xác nhận giao'},
 {id:'payments',name:'Thu tiền & công nợ',icon:Wallet,description:'Chưa nghiệm thu phân bổ thanh toán và công nợ'},
 {id:'kpi',name:'Báo cáo & KPI',icon:ChartColumn,description:'Chưa tích hợp KPI đang vận hành; không sử dụng số liệu mẫu'},
];
const NAV=[
 {id:'dashboard',name:'Tổng quan',icon:LayoutDashboard},
 {id:'customers',name:'Khách hàng',icon:Users},
 {id:'leads',name:'Khách tiềm năng',icon:UserPlus},
 {id:'products',name:'Sản phẩm',icon:Package},
];
const ROLE_WRITE=new Set(['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN']);
const PAGE_SIZE=25;
const getRoute=()=>{
 const page=(window.location.hash||'#/dashboard').replace(/^#\/?/,'').split('?')[0];
 return [...NAV,...LOCKED].some(x=>x.id===page)?page:'dashboard';
};
const toText=x=>String(x??'');
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
function Status({value}){
 const v=toText(value)||'Chưa xác định';
 const kind=/ngừng|không phù hợp|hủy/i.test(v)?'bad':/đang giao dịch|chuyển đổi|hoàn/i.test(v)?'good':'neutral';
 return <span className={'ct-tag '+kind}><span className="ct-tag-dot"/>{v}</span>;
}
function Notice({type='info',children}){
 return <div className={'ct-notice '+type} role={type==='error'?'alert':'status'}>{type==='error'?<AlertTriangle size={18}/>:type==='success'?<CheckCircle2 size={18}/>:<Info size={18}/>}<span>{children}</span></div>;
}
function Modal({entity,initial,onCancel,onSave}){
 const schema=SCHEMAS[entity];
 const [form,setForm]=useState(initial?{...initial}:{});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const heading=useId();
 const closeRef=useRef(null);
 const editing=Boolean(initial);
 useEffect(()=>{
  closeRef.current?.focus();
  const onKey=e=>{if(e.key==='Escape'&&!busy)onCancel()};
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[onCancel,busy]);
 const fields=schema.fields.filter(([key])=>key!=='owner');
 const submit=async e=>{
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');
  try{await onSave(form,initial)}catch(ex){setError(ex.message||'Không lưu được dữ liệu. Vui lòng thử lại.');setBusy(false)}
 };
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel()}}>
  <section className="modal ct-modal" role="dialog" aria-modal="true" aria-labelledby={heading}>
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
  const res=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.ok||!data.persisted)throw Error(data.error||'Máy chủ chưa xác nhận lưu dữ liệu D1');
  setEditing(undefined);setFlash(old?'Đã cập nhật bản ghi trên D1.':'Đã thêm bản ghi vào D1.');
  setPage(0);reload();onSaved();
 };
 const cols=schema.columns.filter(([key])=>key!=='owner');
 const cell=(row,key)=>{
  if(key==='tax')return toText(row.tax_code||row.tax)||'—';
  if(key==='group')return toText(row.category||row.group)||'—';
  if(key==='status'||key==='stage')return <Status value={row[key]}/>;
  if(key==='id')return <span className="ct-id">{toText(row.id).slice(0,8)}</span>;
  return toText(row[key])||'—';
 };
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">DANH MỤC · CLOUDFLARE D1</div><h2>{schema.title}</h2><p>Dữ liệu tập trung, phân quyền theo tài khoản. Không sử dụng bản ghi mẫu.</p></div>
   <div className="ct-actions"><button className="ct-btn secondary" disabled={loading} onClick={reload}><RefreshCcw size={17}/> Làm mới</button><button className="ct-btn secondary" disabled={loading||rows.length===0} onClick={()=>safeCSV(rows,entity)} title="Chỉ xuất trang dữ liệu đang hiển thị"><Download size={17}/> Xuất trang</button>{canWrite&&<button className="ct-btn primary" onClick={()=>setEditing(null)}><Plus size={17}/> Tạo mới</button>}</div>
  </div>
  {flash&&<Notice type="success">{flash}</Notice>}
  <div className="ct-toolbar"><label className="ct-search"><Search size={18}/><span className="sr-only">Tìm kiếm {schema.title.toLowerCase()}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={'Tìm theo tên '+schema.title.toLowerCase()+'...'} aria-label={'Tìm kiếm '+schema.title}/></label><span className="ct-toolbar-counter">Trang {page+1} · Tối đa {PAGE_SIZE} dòng</span></div>
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
function Dashboard({summary,loading,error,onRetry,onNavigate,updatedAt}){
 const cards=[
  {name:'Khách hàng',value:summary?.customers,icon:Users,to:'customers',detail:'Bản ghi khách hàng từ D1'},
  {name:'Khách tiềm năng',value:summary?.leads,icon:UserPlus,to:'leads',detail:'Khách cần tiếp cận từ D1'},
  {name:'Sản phẩm',value:summary?.products,icon:Package,to:'products',detail:'Danh mục sản phẩm từ D1'}
 ];
 return <div className="ct-dashboard">
  <div className="ct-dashboard-title"><div><div className="ct-overline">TỔNG QUAN DỮ LIỆU THẬT</div><h2>Hoạt động CT FOOD</h2><p>Chỉ tổng hợp các danh mục đã kết nối và được xác thực trên Cloudflare D1.</p></div><button className="ct-btn secondary" onClick={onRetry}><RefreshCcw size={17}/> Làm mới</button></div>
  {error&&<Notice type="error">Không thể xác nhận số liệu D1: {error}. Không hiển thị dữ liệu cũ như dữ liệu mới.</Notice>}
  <div className="ct-kpis">{cards.map(({name,value,icon:Icon,to,detail})=><button type="button" className="ct-kpi" key={to} onClick={()=>onNavigate(to)}>
   <div className="ct-kpi-top"><span>{name}</span><span className="ct-kpi-icon"><Icon size={20}/></span></div>
   <div className="ct-kpi-value">{loading?'…':error?'—':Number(value??0).toLocaleString('vi-VN')}</div><div className="ct-kpi-detail">{detail} <ArrowRight size={15}/></div>
  </button>)}</div>
  <div className="ct-dashboard-grid"><section className="ct-panel"><div className="ct-panel-title"><div><h3>Tình trạng dữ liệu</h3><p>Thông tin hệ thống thực, không dùng số liệu minh họa</p></div><ShieldCheck size={22}/></div>
   <div className="ct-status-list"><div><span>Đăng nhập</span><Status value="Đang hoạt động"/></div><div><span>Khách hàng · Khách tiềm năng · Sản phẩm</span><Status value={error?'Cần kiểm tra':'Đang giao dịch'}/></div><div><span>Nguồn tổng hợp</span><strong>Cloudflare D1</strong></div><div><span>Cập nhật gần nhất</span><strong>{updatedAt?new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium'}).format(updatedAt):'Chưa có'}</strong></div></div>
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
 const current=[...NAV,...LOCKED].find(x=>x.id===route)||NAV[0];
 const Icon=current.icon;
 return <div className="ct-shell">
  <aside className={'ct-sidebar '+(drawer?'open':'')} aria-label="Điều hướng chính">
   <div className="ct-brand"><span className="ct-logo">CT</span><div><strong>CT FOOD</strong><small>CRM MANAGEMENT</small></div><button className="ct-icon-button ct-mobile-close" onClick={()=>setDrawer(false)} aria-label="Đóng menu"><X size={19}/></button></div>
   <nav className="ct-nav"><div className="ct-nav-label">DỮ LIỆU ĐÃ KẾT NỐI</div>{NAV.map(item=>{const ItemIcon=item.icon;return <button key={item.id} className={'ct-nav-item '+(route===item.id?'active':'')} onClick={()=>changePage(item.id)} aria-current={route===item.id?'page':undefined}><ItemIcon size={19}/><span>{item.name}</span>{item.id==='dashboard'&&<span className="ct-nav-arrow">●</span>}</button>})}
    <div className="ct-nav-label ct-nav-label-next">CHƯA NGHIỆM THU</div>{LOCKED.map(item=>{const ItemIcon=item.icon;return <button key={item.id} className={'ct-nav-item pending '+(route===item.id?'active':'')} onClick={()=>changePage(item.id)}><ItemIcon size={19}/><span>{item.name}</span><Lock size={14}/></button>})}</nav>
   <div className="ct-sidebar-footer"><span className="ct-online-dot"/> CT FOOD V0.4 · D1</div>
  </aside>
  {drawer&&<button className="ct-drawer-overlay" aria-label="Đóng menu" onClick={()=>setDrawer(false)}/>}
  <div className="ct-main">
   <header className="ct-header"><div className="ct-header-left"><button className="ct-icon-button ct-menu-button" onClick={()=>setDrawer(true)} aria-label="Mở menu"><Menu size={22}/></button><div className="ct-breadcrumb"><small>CT FOOD / {current.name}</small><h1><Icon size={20}/>{current.name}</h1></div></div><div className="ct-header-right"><span className="ct-connected"><span/> D1 ĐANG KẾT NỐI</span><div className="ct-user"><strong>{auth.user.full_name||'Người dùng CRM'}</strong><small>{auth.user.role}</small></div><a className="ct-logout" href="/cdn-cgi/access/logout" title="Đăng xuất Cloudflare Access" aria-label="Đăng xuất"><LogOut size={19}/></a></div></header>
   <main className="ct-content"><div className="ct-live-info"><ShieldCheck size={16}/><span>Dữ liệu danh mục từ D1 · Đăng nhập: {auth.user.email} · Đơn hàng, giao nhận và công nợ chưa mở ghi thực tế</span></div>
    {route==='dashboard'?<Dashboard summary={summary} loading={stats.loading} error={stats.error} onRetry={loadSummary} onNavigate={changePage} updatedAt={updatedAt}/>
     :LIVE.includes(route)?<MasterList key={route} entity={route} role={auth.user.role} onSaved={loadSummary}/>
     :<Pending page={route}/>}
    <footer className="ct-footer">CT FOOD CRM V0.4 · Dữ liệu D1 có xác thực · Chưa nghiệm thu các phân hệ tài chính</footer>
   </main>
  </div>
 </div>;
}
createRoot(document.getElementById('root')).render(<CRMApp/>);
