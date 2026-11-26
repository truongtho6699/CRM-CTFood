// LOG-01 — Giao hàng & phiếu cân (thử nghiệm theo tab "Lưu đồ"; Kế toán xác nhận số kg thực giao).
import React,{useEffect,useState} from 'react';
import {Plus,RefreshCcw,Search,AlertTriangle,Database,ChevronLeft,ChevronRight,CheckCircle2,Ban,Pencil,X} from 'lucide-react';
import {Status,Notice,jsonFetch} from './ui.jsx';

export const DELIVERY_STATUS={PENDING:'Chờ xác nhận',VERIFIED:'Đã xác nhận',CANCELLED:'Đã hủy'};
export const ENTRY=['ADMIN','SALES_ADMIN','LOGISTICS','ACCOUNTING'];
export const VERIFY=['ADMIN','ACCOUNTING'];
const PAGE=25;
export const kg=n=>(Number(n)||0).toLocaleString('vi-VN',{maximumFractionDigits:3});
const day=v=>v?new Intl.DateTimeFormat('vi-VN').format(new Date(v+'T00:00:00')):'—';
const today=()=>{const d=new Date(Date.now()+7*3600*1000);return d.toISOString().slice(0,10)};

// Form nhập / sửa phiếu cân (dạng khối, dùng được bên trong hộp thoại chi tiết đơn).
function TicketForm({lines,initial,onCancel,onSaved}){
 const [f,setF]=useState(initial?{order_line_id:initial.order_line_id,delivered_kg:initial.delivered_kg,delivery_date:initial.delivery_date,vehicle_plate:initial.vehicle_plate||'',container_no:initial.container_no||'',weigh_ticket_no:initial.weigh_ticket_no||'',note:initial.note||''}
  :{order_line_id:lines.length===1?lines[0].id:'',delivered_kg:'',delivery_date:today(),vehicle_plate:'',container_no:'',weigh_ticket_no:'',note:''});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const set=(k,v)=>setF(o=>({...o,[k]:v}));
 const submit=async e=>{
  e.preventDefault();setBusy(true);setError('');
  try{
   const body={...f,delivered_kg:Number(f.delivered_kg)};
   if(initial)await jsonFetch('/api/deliveries/'+initial.id,{method:'PATCH',body:JSON.stringify({...body,expected_updated_at:initial.updated_at})});
   else await jsonFetch('/api/deliveries',{method:'POST',body:JSON.stringify(body)});
   onSaved(initial?'Đã cập nhật phiếu cân.':'Đã thêm phiếu cân, chờ Kế toán xác nhận.');
  }catch(ex){setError(ex.message);setBusy(false)}
 };
 return <form className="ct-ticket-form" onSubmit={submit}>
  <div className="ct-lines-head"><strong>{initial?'Sửa phiếu cân':'Thêm phiếu cân'}</strong><button type="button" className="ct-icon-button" onClick={onCancel} disabled={busy} aria-label="Đóng form phiếu"><X size={18}/></button></div>
  <div className="formgrid ct-formgrid">
   <label>Dòng hàng<span className="ct-required"> *</span><select required disabled={busy||Boolean(initial)} value={f.order_line_id} onChange={e=>set('order_line_id',e.target.value)}><option value="">Chọn...</option>{lines.map(l=><option key={l.id} value={l.id}>{l.product_name} — đặt {kg(l.contracted_kg)} kg</option>)}</select></label>
   <label>KL cân thực tế (kg)<span className="ct-required"> *</span><input type="number" required min="0.001" step="0.001" disabled={busy} value={f.delivered_kg} onChange={e=>set('delivered_kg',e.target.value)}/></label>
   <label>Ngày giao<span className="ct-required"> *</span><input type="date" required disabled={busy} value={f.delivery_date} onChange={e=>set('delivery_date',e.target.value)}/></label>
   <label>Số phiếu cân<input maxLength={40} disabled={busy} value={f.weigh_ticket_no} onChange={e=>set('weigh_ticket_no',e.target.value)}/></label>
   <label>Số container<input maxLength={20} disabled={busy} value={f.container_no} onChange={e=>set('container_no',e.target.value)} placeholder="VD: SZLU9458358"/></label>
   <label>Biển số xe<input maxLength={20} disabled={busy} value={f.vehicle_plate} onChange={e=>set('vehicle_plate',e.target.value)}/></label>
  </div>
  <label className="ct-full-field">Ghi chú<input maxLength={300} disabled={busy} value={f.note} onChange={e=>set('note',e.target.value)}/></label>
  {error&&<Notice type="error">{error}</Notice>}
  <div className="ct-modal-actions" style={{marginTop:12}}><button type="button" className="ct-btn secondary" disabled={busy} onClick={onCancel}>Thôi</button><button type="submit" className="ct-btn primary" disabled={busy}>{busy?'Đang lưu...':'Lưu phiếu'}</button></div>
 </form>;
}

// Nút thao tác trên một phiếu: Xác nhận (Kế toán), Sửa, Hủy có lý do.
function TicketActions({t,user,onEdit,onDone,onError}){
 const [cancel,setCancel]=useState(false);
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 if(t.status!=='PENDING')return <span className="ct-muted">{t.status==='VERIFIED'?'bởi '+(t.verified_by||'—'):(t.status_note||'')}</span>;
 const go=async(status)=>{
  setBusy(true);
  try{await jsonFetch('/api/deliveries/'+t.id+'/status',{method:'POST',body:JSON.stringify({status,note,expected_updated_at:t.updated_at})});onDone(status==='VERIFIED'?'Đã xác nhận phiếu cân.':'Đã hủy phiếu cân.')}
  catch(e){onError(e.message)}finally{setBusy(false)}
 };
 if(cancel)return <span className="ct-inline-cancel"><input autoFocus placeholder="Lý do hủy phiếu" value={note} maxLength={300} onChange={e=>setNote(e.target.value)} disabled={busy} aria-label="Lý do hủy phiếu"/><button className="ct-text-button danger" disabled={busy||!note.trim()} onClick={()=>go('CANCELLED')}>Hủy phiếu</button><button className="ct-text-button" disabled={busy} onClick={()=>{setCancel(false);setNote('')}}>Thôi</button></span>;
 return <span className="ct-row-actions">
  {VERIFY.includes(user.role)&&<button className="ct-text-button" disabled={busy} onClick={()=>go('VERIFIED')}><CheckCircle2 size={14}/> Xác nhận</button>}
  {ENTRY.includes(user.role)&&onEdit&&<button className="ct-text-button" disabled={busy} onClick={()=>onEdit(t)}><Pencil size={14}/> Sửa</button>}
  {ENTRY.includes(user.role)&&<button className="ct-text-button" disabled={busy} onClick={()=>setCancel(true)}><Ban size={14}/> Hủy</button>}
 </span>;
}

// Khu phiếu cân trong chi tiết đơn hàng.
export function OrderDeliveries({order,user,onChanged}){
 const [rows,setRows]=useState([]);
 const [form,setForm]=useState(undefined);
 const [msg,setMsg]=useState({type:'',text:''});
 const load=async()=>{try{setRows((await jsonFetch('/api/deliveries?limit=100&order_id='+order.id)).data)}catch(e){setMsg({type:'error',text:e.message})}};
 useEffect(()=>{load()},[order.id,order.updated_at]);
 const done=text=>{setForm(undefined);setMsg({type:'success',text});load();onChanged()};
 const canAdd=order.status==='PENDING'&&ENTRY.includes(user.role);
 return <div className="ct-deliveries">
  <div className="ct-lines-head"><strong>Giao hàng & phiếu cân</strong>{canAdd&&form===undefined&&<button type="button" className="ct-text-button" onClick={()=>setForm(null)}><Plus size={15}/> Thêm phiếu cân</button>}</div>
  {msg.text&&<Notice type={msg.type}>{msg.text}</Notice>}
  {form!==undefined&&<TicketForm lines={order.lines} initial={form} onCancel={()=>setForm(undefined)} onSaved={done}/>}
  {rows.length===0?<p className="ct-muted">Chưa có phiếu cân.{canAdd?' Sale Admin, Kho hoặc Kế toán thêm phiếu sau mỗi lần giao.':''}</p>
   :<div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Ngày giao</th><th>Sản phẩm</th><th className="ct-num">KL cân (kg)</th><th>Số phiếu</th><th>Container</th><th>Xe</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>{rows.map(t=><tr key={t.id}><td data-label="Ngày giao">{day(t.delivery_date)}</td><td data-label="Sản phẩm">{t.product_name}</td><td data-label="KL cân" className="ct-num">{kg(t.delivered_kg)}</td><td data-label="Số phiếu">{t.weigh_ticket_no||'—'}</td><td data-label="Container"><span className="ct-id">{t.container_no||'—'}</span></td><td data-label="Xe">{t.vehicle_plate||'—'}</td><td data-label="Trạng thái"><Status value={DELIVERY_STATUS[t.status]}/></td>
     <td data-label="Thao tác"><TicketActions t={t} user={user} onEdit={x=>setForm(x)} onDone={done} onError={text=>{setMsg({type:'error',text});load()}}/></td></tr>)}</tbody></table></div>}
 </div>;
}

// Trang danh sách phiếu cân — hàng chờ để Kế toán xác nhận.
export function DeliveriesPage({user}){
 const [rows,setRows]=useState([]);
 const [status,setStatus]=useState(VERIFY.includes(user.role)?'PENDING':'');
 const [search,setSearch]=useState('');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [msg,setMsg]=useState({type:'',text:''});
 const [seq,setSeq]=useState(0);
 useEffect(()=>{const t=setTimeout(()=>{setPage(0);setQuery(search.trim())},300);return()=>clearTimeout(t)},[search]);
 useEffect(()=>{let live=true;setLoading(true);setError('');
  jsonFetch('/api/deliveries?limit='+PAGE+'&offset='+page*PAGE+'&status='+status+'&q='+encodeURIComponent(query))
   .then(r=>{if(live){setRows(r.data);setHasMore(r.pagination.hasMore)}}).catch(e=>{if(live){setRows([]);setError(e.message)}}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false}},[status,query,page,seq]);
 const reload=()=>setSeq(x=>x+1);
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">GIAO NHẬN · THỬ NGHIỆM</div><h2>Giao hàng & phiếu cân</h2><p>Mỗi lần giao là một phiếu cân gắn với dòng hàng của đơn. Số kg đã được Kế toán xác nhận là số lượng thực tế giao.</p></div>
   <div className="ct-actions"><button className="ct-btn secondary" disabled={loading} onClick={reload}><RefreshCcw size={17}/> Làm mới</button></div></div>
  <Notice>Thêm phiếu cân trong <strong>Đơn hàng → Xem → Thêm phiếu cân</strong>. Phân hệ thử nghiệm: quy tắc giao nhiều lần, người nhập/xác nhận và xử lý chênh lệch đang theo giả định tạm, chờ BGĐ chốt (D01, D03, D04).</Notice>
  {msg.text&&<Notice type={msg.type}>{msg.text}</Notice>}
  <div className="ct-toolbar ct-toolbar-wrap">
   <div className="ct-segment" role="tablist" aria-label="Lọc trạng thái phiếu">{[['','Tất cả'],...Object.entries(DELIVERY_STATUS)].map(([k,v])=><button key={k} role="tab" aria-selected={status===k} className={status===k?'active':''} onClick={()=>{setStatus(k);setPage(0)}}>{v}</button>)}</div>
   <label className="ct-search"><Search size={18}/><span className="sr-only">Tìm phiếu cân</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã đơn, khách hàng, số phiếu, container..." aria-label="Tìm phiếu cân"/></label>
  </div>
  {error?<div className="ct-empty"><AlertTriangle size={30}/><strong>Không thể tải phiếu cân</strong><p>{error}</p><button className="ct-btn secondary" onClick={reload}>Thử lại</button></div>
   :loading?<div className="ct-loading" role="status" aria-live="polite">{[0,1,2].map(i=><div className="ct-skeleton" key={i}/>)}</div>
   :rows.length===0?<div className="ct-empty"><Database size={32}/><strong>{status==='PENDING'?'Không có phiếu chờ xác nhận':'Không có phiếu cân phù hợp'}</strong></div>
   :<><div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Ngày giao</th><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th className="ct-num">KL cân (kg)</th><th className="ct-num">KL đặt dòng (kg)</th><th>Số phiếu</th><th>Container</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>{rows.map(t=><tr key={t.id}><td data-label="Ngày giao">{day(t.delivery_date)}</td><td data-label="Mã đơn"><span className="ct-id">{t.order_code}</span></td><td data-label="Khách hàng">{t.customer_name}</td><td data-label="Sản phẩm">{t.product_name}</td>
     <td data-label="KL cân" className="ct-num">{kg(t.delivered_kg)}</td><td data-label="KL đặt" className="ct-num">{kg(t.contracted_kg)}</td><td data-label="Số phiếu">{t.weigh_ticket_no||'—'}</td><td data-label="Container"><span className="ct-id">{t.container_no||'—'}</span></td><td data-label="Trạng thái"><Status value={DELIVERY_STATUS[t.status]}/></td>
     <td data-label="Thao tác"><TicketActions t={t} user={user} onDone={text=>{setMsg({type:'success',text});reload()}} onError={text=>{setMsg({type:'error',text});reload()}}/></td></tr>)}</tbody></table></div>
    <div className="ct-pagination"><span>Hiển thị {page*PAGE+1}–{page*PAGE+rows.length}{hasMore?' · còn dữ liệu':' · hết danh sách'}</span><div><button className="ct-btn secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/> Trước</button><button className="ct-btn secondary" disabled={!hasMore} onClick={()=>setPage(p=>p+1)}>Sau <ChevronRight size={17}/></button></div></div></>}
 </section>;
}
