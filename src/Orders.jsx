// ORDER-01 — Phân hệ Đơn hàng (thử nghiệm; quy tắc tạm theo docs/PROJECT_STATUS.md mục 8).
import React,{useEffect,useId,useState} from 'react';
import {Plus,RefreshCcw,Search,X,Trash2,AlertTriangle,Database,ChevronLeft,ChevronRight,CheckCircle2,Ban,Pencil} from 'lucide-react';
import {Status,Notice,jsonFetch,TrialNote,Combobox,searchCustomers,searchProducts} from './ui.jsx';
import {OrderDeliveries} from './Deliveries.jsx';

const STATUS={PENDING:'Chờ giao',SUCCESS:'Thành công',CANCELLED:'Hủy'};
const TYPE={OFFER:'Offer (hàng đặt mua)',IN_STOCK:'Hàng sẵn kho'};
const WRITE=['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN','SALES'];
const CAN_SUCCESS=['ADMIN','SALES_ADMIN'];
const CAN_CANCEL=['ADMIN','BOD','SALES_MANAGER'];
const PAGE=25;
const vnd=n=>Math.round(Number(n)||0).toLocaleString('vi-VN');
const kg=n=>(Number(n)||0).toLocaleString('vi-VN',{maximumFractionDigits:3});
const day=v=>v?new Intl.DateTimeFormat('vi-VN').format(new Date(v.length===10?v+'T00:00:00':v)):'—';
const stamp=v=>{if(!v)return '—';const d=new Date(v.includes('T')?v:v.replace(' ','T')+'Z');return isNaN(d)?v:new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(d)};

function useEsc(onClose,busy){useEffect(()=>{const f=e=>{if(e.key==='Escape'&&!busy)onClose()};document.addEventListener('keydown',f);return()=>document.removeEventListener('keydown',f)},[onClose,busy])}

export function OrderForm({initial,presetCustomer,onCancel,onSaved}){
 const editing=Boolean(initial);
 const heading=useId();
 const blank={product_id:'',product_name:'',contracted_kg:'',unit_price_ex_vat:'',commission_per_kg:''};
 const [customerName,setCustomerName]=useState(initial?.customer_name||presetCustomer?.name||'');
 const [form,setForm]=useState(initial?{
  customer_id:initial.customer_id,order_type:initial.order_type,expected_date:initial.expected_date||'',delivery_address:initial.delivery_address||'',
  deposit_expected:initial.deposit_expected||'',container_count:initial.container_count||'',note:initial.note||'',
  lines:initial.lines.map(l=>({product_id:l.product_id,product_name:l.product_name,contracted_kg:l.contracted_kg,unit_price_ex_vat:l.unit_price_ex_vat,commission_per_kg:l.commission_per_kg||''}))
 }:{customer_id:presetCustomer?.id||'',order_type:'IN_STOCK',expected_date:'',delivery_address:'',deposit_expected:'',container_count:'',note:'',lines:[{...blank}]});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEsc(onCancel,busy);
 const set=(k,v)=>setForm(f=>({...f,[k]:v}));
 const setLine=(i,k,v)=>setForm(f=>({...f,lines:f.lines.map((l,j)=>j===i?{...l,[k]:v}:l)}));
 const total=form.lines.reduce((a,l)=>({kg:a.kg+(Number(l.contracted_kg)||0),amount:a.amount+(Number(l.contracted_kg)||0)*(Number(l.unit_price_ex_vat)||0)}),{kg:0,amount:0});
 const num=v=>v===''?0:Number(v);
 const submit=async e=>{
  e.preventDefault();if(busy)return;
  if(!form.customer_id){setError('Chưa chọn khách hàng. Gõ tên hoặc số điện thoại rồi chọn trong danh sách.');return}
  const missing=form.lines.findIndex(l=>!l.product_id);
  if(missing>=0){setError('Dòng '+(missing+1)+': chưa chọn sản phẩm trong danh sách.');return}
  setBusy(true);setError('');
  const body={...form,deposit_expected:num(form.deposit_expected),container_count:num(form.container_count),
   lines:form.lines.map(l=>({product_id:l.product_id,contracted_kg:Number(l.contracted_kg),unit_price_ex_vat:num(l.unit_price_ex_vat),commission_per_kg:num(l.commission_per_kg)}))};
  try{
   const r=editing
    ?await jsonFetch('/api/orders/'+initial.id,{method:'PATCH',body:JSON.stringify({...body,expected_updated_at:initial.updated_at})})
    :await jsonFetch('/api/orders',{method:'POST',body:JSON.stringify(body)});
   onSaved(r.data,editing);
  }catch(ex){setError(ex.message);setBusy(false)}
 };
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel()}}>
  <section className="modal ct-modal ct-modal-wide" role="dialog" aria-modal="true" aria-labelledby={heading}>
   <div className="ct-modal-title"><div><h2 id={heading}>{editing?'Sửa đơn '+initial.code:'Tạo đơn hàng'}</h2></div><button className="ct-icon-button" type="button" disabled={busy} onClick={onCancel} aria-label="Đóng biểu mẫu"><X size={20}/></button></div>

   <form onSubmit={submit}>
    <div className="formgrid ct-formgrid">
     <div className="ct-field-label">Khách hàng<span className="ct-required"> *</span>{editing||presetCustomer?<div className="ct-readonly">{customerName}</div>:<Combobox value={form.customer_id} label={customerName} disabled={busy} ariaLabel="Khách hàng" placeholder="Gõ tên hoặc số điện thoại..." search={searchCustomers} onChange={(id,it)=>{set('customer_id',id);setCustomerName(it?.label||'')}}/>}</div>
     <label>Loại đơn<span className="ct-required"> *</span><select required disabled={busy} value={form.order_type} onChange={e=>set('order_type',e.target.value)}>{Object.entries(TYPE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>Thời gian dự kiến giao<input type="date" disabled={busy} value={form.expected_date} onChange={e=>set('expected_date',e.target.value)}/></label>
     <label>Địa điểm giao hàng<input disabled={busy} maxLength={300} value={form.delivery_address} onChange={e=>set('delivery_address',e.target.value)}/></label>
     <label>Cọc dự kiến (đ)<input type="number" min="0" step="1" disabled={busy} value={form.deposit_expected} onChange={e=>set('deposit_expected',e.target.value)}/></label>
     <label>Số container dự kiến<input type="number" min="0" max="1000" step="1" disabled={busy} value={form.container_count} onChange={e=>set('container_count',e.target.value)}/></label>
    </div>
    <label className="ct-full-field">Ghi chú<input disabled={busy} maxLength={500} value={form.note} onChange={e=>set('note',e.target.value)}/></label>
    <div className="ct-lines-head"><strong>Dòng hàng</strong><button type="button" className="ct-text-button" disabled={busy||form.lines.length>=50} onClick={()=>set('lines',[...form.lines,{...blank}])}><Plus size={15}/> Thêm dòng</button></div>
    <div className="ct-tablebox"><table className="ct-data-table ct-lines-table"><thead><tr><th>Sản phẩm *</th><th>KL dự kiến (kg) *</th><th>Giá chưa VAT (đ/kg) *</th><th>CK/Hoa hồng (đ/kg)</th><th>Thành tiền (đ)</th><th/></tr></thead>
     <tbody>{form.lines.map((l,i)=><tr key={i}>
      <td data-label="Sản phẩm"><Combobox value={l.product_id} label={l.product_name} disabled={busy} ariaLabel={'Sản phẩm dòng '+(i+1)} placeholder="Gõ tên sản phẩm..." search={searchProducts} onChange={(id,it)=>setForm(f=>({...f,lines:f.lines.map((x,j)=>j===i?{...x,product_id:id,product_name:it?.label||''}:x)}))}/></td>
      <td data-label="KL dự kiến"><input type="number" required min="0.001" step="0.001" disabled={busy} value={l.contracted_kg} onChange={e=>setLine(i,'contracted_kg',e.target.value)} aria-label={'Khối lượng dòng '+(i+1)}/></td>
      <td data-label="Giá chưa VAT"><input type="number" required min="0" step="1" disabled={busy} value={l.unit_price_ex_vat} onChange={e=>setLine(i,'unit_price_ex_vat',e.target.value)} aria-label={'Giá dòng '+(i+1)}/></td>
      <td data-label="CK/Hoa hồng"><input type="number" min="0" step="1" disabled={busy} value={l.commission_per_kg} onChange={e=>setLine(i,'commission_per_kg',e.target.value)} aria-label={'Hoa hồng dòng '+(i+1)}/></td>
      <td data-label="Thành tiền" className="ct-num">{vnd((Number(l.contracted_kg)||0)*(Number(l.unit_price_ex_vat)||0))}</td>
      <td><button type="button" className="ct-icon-button" disabled={busy||form.lines.length===1} onClick={()=>set('lines',form.lines.filter((_,j)=>j!==i))} aria-label={'Xóa dòng '+(i+1)}><Trash2 size={17}/></button></td>
     </tr>)}</tbody>
     <tfoot><tr><td><strong>Tổng</strong></td><td className="ct-num"><strong>{kg(total.kg)}</strong></td><td/><td/><td className="ct-num"><strong>{vnd(total.amount)}</strong></td><td/></tr></tfoot></table></div>
    <p className="ct-owner-help">Thành tiền = khối lượng dự kiến × giá chưa VAT. Đơn thuộc Sales đang phụ trách khách hàng.</p>
    {error&&<Notice type="error">{error}</Notice>}
    <div className="ct-modal-actions"><button type="button" disabled={busy} className="ct-btn secondary" onClick={onCancel}>Hủy</button><button type="submit" disabled={busy} className="ct-btn primary">{busy?'Đang lưu...':editing?'Lưu thay đổi':'Tạo đơn'}</button></div>
   </form>
  </section>
 </div>;
}

export function OrderDetail({id,user,onClose,onEdit,onChanged}){
 const heading=useId();
 const [order,setOrder]=useState(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [cancelling,setCancelling]=useState(false);
 const [reason,setReason]=useState('');
 useEsc(onClose,busy);
 // Không xóa thông báo lỗi ở đây: sau khi thao tác bị từ chối (409) vẫn tải lại đơn nhưng giữ lời giải thích cho người dùng.
 const load=async()=>{try{setOrder((await jsonFetch('/api/orders/'+id)).data)}catch(e){setError(e.message)}};
 useEffect(()=>{load()},[id]);
 const change=async(status)=>{
  setBusy(true);setError('');
  try{await jsonFetch('/api/orders/'+id+'/status',{method:'POST',body:JSON.stringify({status,note:reason,expected_updated_at:order.updated_at})});setCancelling(false);setReason('');await load();onChanged()}
  catch(e){if(e.status===409)await load();setError(e.message)}
  finally{setBusy(false)}
 };
 const pending=order?.status==='PENDING';
 const canEdit=pending&&!(order?.ticket_count>0)&&WRITE.includes(user.role)&&(user.role!=='SALES'||order?.sales_email===user.email);
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <section className="modal ct-modal ct-modal-wide" role="dialog" aria-modal="true" aria-labelledby={heading}>
   <div className="ct-modal-title"><div><h2 id={heading}>{order?.code||'Đang tải...'}</h2></div><button className="ct-icon-button" type="button" disabled={busy} onClick={onClose} aria-label="Đóng"><X size={20}/></button></div>
   {error&&<Notice type="error">{error}</Notice>}
   {order&&<>
    <div className="ct-detail-grid">
     {[['Khách hàng',order.customer_name],['Trạng thái',<Status value={STATUS[order.status]||order.status}/>],['Loại đơn',TYPE[order.order_type]||order.order_type],['Sales phụ trách',order.sales_name||order.sales_email],
       ['Giao dự kiến',day(order.expected_date)],['Địa điểm giao',order.delivery_address||'—'],['Cọc dự kiến',vnd(order.deposit_expected)+' đ'],['Số container dự kiến',order.container_count||'—'],
       ['Tạo lúc',stamp(order.created_at)],['Ghi chú',order.note||'—']].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}
    </div>
    {order.status!=='PENDING'&&<Notice type={order.status==='CANCELLED'?'error':'success'}>{order.status==='CANCELLED'?'Đã hủy':'Đã xác nhận giao thành công'} bởi {order.status_by} lúc {stamp(order.status_at)}{order.status_note?' — Lý do: '+order.status_note:''}</Notice>}
    <div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Sản phẩm</th><th className="ct-num">KL dự kiến (kg)</th><th className="ct-num">Giá chưa VAT</th><th className="ct-num">CK/HH (đ/kg)</th><th className="ct-num">Thành tiền (đ)</th><th className="ct-num">Đã giao xác nhận (kg)</th><th className="ct-num">Chờ xác nhận (kg)</th><th className="ct-num">Chênh lệch (kg)</th></tr></thead>
     <tbody>{order.lines.map(l=>{const diff=l.verified_kg-l.contracted_kg;return <tr key={l.id}><td data-label="Sản phẩm">{l.product_name}</td><td data-label="KL" className="ct-num">{kg(l.contracted_kg)}</td><td data-label="Giá" className="ct-num">{vnd(l.unit_price_ex_vat)}</td><td data-label="CK/HH" className="ct-num">{vnd(l.commission_per_kg)}</td><td data-label="Thành tiền" className="ct-num">{vnd(l.amount)}</td>
      <td data-label="Đã giao" className="ct-num">{kg(l.verified_kg)}</td><td data-label="Chờ xác nhận" className="ct-num">{l.pending_kg?kg(l.pending_kg):'—'}</td><td data-label="Chênh lệch" className={'ct-num '+(l.verified_kg&&diff!==0?(diff<0?'ct-neg':'ct-pos'):'')}>{l.verified_kg?(diff>0?'+':'')+kg(diff):'—'}</td></tr>})}</tbody>
     <tfoot><tr><td><strong>Tổng</strong></td><td className="ct-num"><strong>{kg(order.total_kg)}</strong></td><td/><td/><td className="ct-num"><strong>{vnd(order.total_amount)}</strong></td><td className="ct-num"><strong>{kg(order.delivered_kg)}</strong></td><td/><td/></tr></tfoot></table></div>
    <OrderDeliveries order={order} user={user} onChanged={()=>{load();onChanged()}}/>
    {cancelling&&<div className="ct-cancel-box"><label>Lý do hủy đơn<span className="ct-required"> *</span><textarea rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy} autoFocus/></label>
     <div className="ct-modal-actions"><button className="ct-btn secondary" disabled={busy} onClick={()=>{setCancelling(false);setReason('')}}>Thôi</button><button className="ct-btn danger" disabled={busy||!reason.trim()} onClick={()=>change('CANCELLED')}><Ban size={17}/> Xác nhận hủy đơn</button></div></div>}
    {!cancelling&&pending&&CAN_SUCCESS.includes(user.role)&&(order.pending_tickets>0||!(order.delivered_kg>0))&&<p className="ct-owner-help">{order.pending_tickets>0?'Còn '+order.pending_tickets+' phiếu cân chờ Kế toán xác nhận — xác nhận xong mới chuyển "Thành công" được.':'Chưa có phiếu cân được Kế toán xác nhận — cần ít nhất một phiếu đã xác nhận để chuyển "Thành công".'}</p>}
    {!cancelling&&pending&&<div className="ct-modal-actions" style={{marginTop:18}}>
     {canEdit&&<button className="ct-btn secondary" disabled={busy} onClick={()=>onEdit(order)}><Pencil size={17}/> Sửa đơn</button>}
     {CAN_CANCEL.includes(user.role)&&<button className="ct-btn secondary" disabled={busy} onClick={()=>setCancelling(true)}><Ban size={17}/> Hủy đơn</button>}
     {CAN_SUCCESS.includes(user.role)&&<button className="ct-btn primary" disabled={busy} onClick={()=>change('SUCCESS')}><CheckCircle2 size={17}/> Xác nhận giao thành công</button>}
    </div>}
   </>}
  </section>
 </div>;
}

export function OrdersPage({user}){
 const [rows,setRows]=useState([]);
 const [status,setStatus]=useState('');
 const [search,setSearch]=useState('');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [flash,setFlash]=useState('');
 const [form,setForm]=useState(undefined);
 const [detail,setDetail]=useState(null);
 const [seq,setSeq]=useState(0);
 const canWrite=WRITE.includes(user.role);
 useEffect(()=>{const t=setTimeout(()=>{setPage(0);setQuery(search.trim())},300);return()=>clearTimeout(t)},[search]);
 useEffect(()=>{let live=true;setLoading(true);setError('');
  jsonFetch('/api/orders?limit='+PAGE+'&offset='+page*PAGE+'&status='+status+'&q='+encodeURIComponent(query))
   .then(r=>{if(live){setRows(r.data);setHasMore(r.pagination.hasMore)}}).catch(e=>{if(live){setRows([]);setError(e.message)}}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false}},[status,query,page,seq]);
 const reload=()=>setSeq(x=>x+1);
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><h2>Đơn hàng</h2><p>Theo dõi đơn từ lúc đặt đến khi giao xong.</p></div>
   <div className="ct-actions"><button className="ct-btn secondary" disabled={loading} onClick={reload}><RefreshCcw size={17}/> Làm mới</button>{canWrite&&<button className="ct-btn primary" onClick={()=>setForm(null)}><Plus size={17}/> Tạo đơn</button>}</div></div>
  <TrialNote>Cách đánh mã đơn, ba trạng thái (Chờ giao, Thành công, Hủy), ai được sửa giá và cách tính VAT đang tạm thời. Đơn chuyển Thành công khi có phiếu cân đã được Kế toán xác nhận.</TrialNote>
  {flash&&<Notice type="success">{flash}</Notice>}
  <div className="ct-toolbar ct-toolbar-wrap">
   <div className="ct-segment" role="tablist" aria-label="Lọc trạng thái">{[['','Tất cả'],...Object.entries(STATUS)].map(([k,v])=><button key={k} role="tab" aria-selected={status===k} className={status===k?'active':''} onClick={()=>{setStatus(k);setPage(0)}}>{v}</button>)}</div>
   <label className="ct-search"><Search size={18}/><span className="sr-only">Tìm đơn hàng</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm theo mã đơn hoặc tên khách..." aria-label="Tìm đơn hàng"/></label>
  </div>
  {error?<div className="ct-empty"><AlertTriangle size={30}/><strong>Không thể tải đơn hàng</strong><p>{error}</p><button className="ct-btn secondary" onClick={reload}>Thử lại</button></div>
   :loading?<div className="ct-loading" role="status" aria-live="polite">{[0,1,2,3].map(i=><div className="ct-skeleton" key={i}/>)}</div>
   :rows.length===0?<div className="ct-empty"><Database size={32}/><strong>{query||status?'Không có đơn phù hợp':'Chưa có đơn hàng'}</strong><p>{canWrite&&!query&&!status?'Bấm "Tạo đơn" để tạo đơn đầu tiên.':''}</p></div>
   :<><div className="ct-tablebox"><table className="ct-data-table ct-compact"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th className="ct-sm-hide">Loại</th><th className="ct-sm-hide">Giao dự kiến</th><th className="ct-num">KL (kg)</th><th className="ct-num">Giá trị chưa VAT (đ)</th><th className="ct-num">Đã giao (kg)</th><th className="ct-sm-hide">Sales</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>{rows.map(o=><tr key={o.id} className="ct-row-link" tabIndex={0} onClick={e=>{if(!e.target.closest('button'))setDetail(o.id)}} onKeyDown={e=>{if(e.key==='Enter'&&e.target===e.currentTarget)setDetail(o.id)}}><td data-label="Mã đơn" className="c-sub"><span className="ct-id">{o.code}</span></td><td data-label="Khách hàng" className="c-title">{o.customer_name}</td><td data-label="Loại" className="ct-sm-hide">{o.order_type==='OFFER'?'Offer':'Sẵn kho'}</td><td data-label="Giao dự kiến" className="ct-sm-hide">{day(o.expected_date)}</td>
     <td data-label="KL (kg)" className="ct-num ct-sm-hide">{kg(o.total_kg)}</td><td data-label="Giá trị" className="ct-num c-value">{vnd(o.total_amount)}</td><td data-label="Đã giao" className="ct-num ct-sm-hide">{o.delivered_kg?kg(o.delivered_kg):'—'}{o.pending_tickets?<span className="ct-pending-dot" title={o.pending_tickets+' phiếu chờ xác nhận'}> •{o.pending_tickets}</span>:''}</td><td data-label="Sales" className="ct-sm-hide">{o.sales_name||o.sales_email}</td><td data-label="Trạng thái" className="c-badge"><Status value={STATUS[o.status]||o.status}/></td>
     <td data-label="Thao tác" className="c-action"><button className="ct-text-button" onClick={()=>setDetail(o.id)}>Xem</button></td></tr>)}</tbody></table></div>
    <div className="ct-pagination"><span>Dòng {page*PAGE+1}–{page*PAGE+rows.length}{hasMore?', còn trang sau':''}</span><div><button className="ct-btn secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/> Trước</button><button className="ct-btn secondary" disabled={!hasMore} onClick={()=>setPage(p=>p+1)}>Sau <ChevronRight size={17}/></button></div></div></>}
  {detail&&form===undefined&&<OrderDetail id={detail} user={user} onClose={()=>setDetail(null)} onEdit={o=>setForm(o)} onChanged={reload}/>}
  {form!==undefined&&<OrderForm initial={form} onCancel={()=>setForm(undefined)} onSaved={(d,edited)=>{setForm(undefined);setFlash((edited?'Đã cập nhật đơn ':'Đã tạo đơn ')+d.code+'.');if(!edited)setDetail(d.id);reload()}}/>}
 </section>;
}
