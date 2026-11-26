// FIN-01 — Thu tiền & công nợ (thử nghiệm). KPI-01 — Báo cáo & KPI (thử nghiệm).
import React,{useEffect,useId,useState} from 'react';
import {Plus,RefreshCcw,Search,X,Trash2,AlertTriangle,Database,ChevronLeft,ChevronRight,Ban,Pencil,Download} from 'lucide-react';
import {Status,Notice,jsonFetch} from './ui.jsx';

const TYPE={DEPOSIT:'Đặt cọc',PAYMENT:'Thanh toán'};
const METHOD={BANK:'Chuyển khoản',CASH:'Tiền mặt'};
const WRITE=['ADMIN','ACCOUNTING'];
const PAGE=25;
const vnd=n=>Math.round(Number(n)||0).toLocaleString('vi-VN');
const kg=n=>(Number(n)||0).toLocaleString('vi-VN',{maximumFractionDigits:3});
const day=v=>v?new Intl.DateTimeFormat('vi-VN').format(new Date(v+'T00:00:00')):'—';
const today=()=>new Date(Date.now()+7*3600*1000).toISOString().slice(0,10);
function useEsc(onClose,busy){useEffect(()=>{const f=e=>{if(e.key==='Escape'&&!busy)onClose()};document.addEventListener('keydown',f);return()=>document.removeEventListener('keydown',f)},[onClose,busy])}
function Cards({items}){return <div className="ct-kpis ct-kpis-5">{items.map(([label,value,detail,tone])=><div className={'ct-kpi ct-kpi-static '+(tone||'')} key={label}><div className="ct-kpi-top"><span>{label}</span></div><div className="ct-kpi-value">{value}</div><div className="ct-kpi-detail">{detail}</div></div>)}</div>}

// Dòng phân bổ: chọn đơn của khách + số tiền.
function AllocationRows({orders,rows,setRows,busy,amount}){
 const sum=rows.reduce((a,r)=>a+(Number(r.amount)||0),0);
 const setRow=(i,k,v)=>setRows(rows.map((r,j)=>j===i?{...r,[k]:v}:r));
 return <>
  <div className="ct-lines-head"><strong>Phân bổ vào đơn hàng</strong><button type="button" className="ct-text-button" disabled={busy||!orders.length} onClick={()=>setRows([...rows,{order_id:'',amount:''}])}><Plus size={15}/> Thêm đơn</button></div>
  {!orders.length?<p className="ct-muted">Khách hàng chưa có đơn nào để phân bổ. Có thể lưu phiếu và phân bổ sau.</p>
   :rows.length===0?<p className="ct-muted">Chưa phân bổ — toàn bộ số tiền sẽ là tiền dư của khách, phân bổ sau được.</p>
   :<div className="ct-tablebox"><table className="ct-data-table ct-lines-table"><thead><tr><th>Đơn hàng</th><th className="ct-num">Còn phải thu (đ)</th><th>Số tiền phân bổ (đ)</th><th/></tr></thead><tbody>
    {rows.map((r,i)=>{const o=orders.find(x=>x.id===r.order_id);return <tr key={i}>
     <td data-label="Đơn"><select required disabled={busy} value={r.order_id} onChange={e=>setRow(i,'order_id',e.target.value)} aria-label={'Đơn dòng '+(i+1)}><option value="">Chọn đơn...</option>{orders.map(x=><option key={x.id} value={x.id} disabled={rows.some((y,j)=>j!==i&&y.order_id===x.id)}>{x.code} — {x.status==='SUCCESS'?'Thành công':'Chờ giao'}</option>)}</select></td>
     <td data-label="Còn phải thu" className="ct-num">{o?vnd(o.balance):'—'}</td>
     <td data-label="Phân bổ"><input type="number" required min="1" step="1" disabled={busy} value={r.amount} onChange={e=>setRow(i,'amount',e.target.value)} aria-label={'Số tiền dòng '+(i+1)}/></td>
     <td><button type="button" className="ct-icon-button" disabled={busy} onClick={()=>setRows(rows.filter((_,j)=>j!==i))} aria-label={'Xóa phân bổ '+(i+1)}><Trash2 size={17}/></button></td></tr>})}
   </tbody><tfoot><tr><td><strong>Tổng phân bổ</strong></td><td/><td className={'ct-num '+(sum>amount?'ct-neg':'')}><strong>{vnd(sum)}</strong>{amount?' / '+vnd(amount):''}</td><td/></tr></tfoot></table></div>}
 </>;
}
async function customerOrders(customerId){
 const [o,r]=await Promise.all([jsonFetch('/api/orders?limit=100'),jsonFetch('/api/receivables?customer_id='+encodeURIComponent(customerId))]);
 const bal=new Map(r.data.map(x=>[x.order_id,x.balance]));
 return o.data.filter(x=>x.customer_id===customerId&&x.status!=='CANCELLED').map(x=>({id:x.id,code:x.code,status:x.status,balance:bal.get(x.id)??0}));
}

function PaymentForm({onCancel,onSaved}){
 const heading=useId();
 const [customers,setCustomers]=useState([]);
 const [orders,setOrders]=useState([]);
 const [f,setF]=useState({customer_id:'',payment_type:'PAYMENT',method:'BANK',amount:'',payment_date:today(),reference:'',note:''});
 const [rows,setRows]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEsc(onCancel,busy);
 useEffect(()=>{jsonFetch('/api/customers?limit=100').then(r=>setCustomers(r.data)).catch(e=>setError(e.message))},[]);
 useEffect(()=>{setRows([]);setOrders([]);if(f.customer_id)customerOrders(f.customer_id).then(setOrders).catch(e=>setError(e.message))},[f.customer_id]);
 const set=(k,v)=>setF(o=>({...o,[k]:v}));
 const submit=async e=>{
  e.preventDefault();setBusy(true);setError('');
  try{const r=await jsonFetch('/api/payments',{method:'POST',body:JSON.stringify({...f,amount:Number(f.amount),allocations:rows.map(x=>({order_id:x.order_id,amount:Number(x.amount)}))})});onSaved(r.data)}
  catch(ex){setError(ex.message);setBusy(false)}
 };
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel()}}>
  <section className="modal ct-modal ct-modal-wide" role="dialog" aria-modal="true" aria-labelledby={heading}>
   <div className="ct-modal-title"><div><div className="ct-overline">THU TIỀN · THỬ NGHIỆM</div><h2 id={heading}>Lập phiếu thu</h2></div><button className="ct-icon-button" type="button" disabled={busy} onClick={onCancel} aria-label="Đóng biểu mẫu"><X size={20}/></button></div>
   <form onSubmit={submit}>
    <div className="formgrid ct-formgrid">
     <label>Khách hàng<span className="ct-required"> *</span><select required disabled={busy} value={f.customer_id} onChange={e=>set('customer_id',e.target.value)}><option value="">Chọn khách hàng...</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label>Loại thu<span className="ct-required"> *</span><select disabled={busy} value={f.payment_type} onChange={e=>set('payment_type',e.target.value)}>{Object.entries(TYPE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>Số tiền (đ)<span className="ct-required"> *</span><input type="number" required min="1" step="1" disabled={busy} value={f.amount} onChange={e=>set('amount',e.target.value)}/></label>
     <label>Ngày thu<span className="ct-required"> *</span><input type="date" required disabled={busy} value={f.payment_date} onChange={e=>set('payment_date',e.target.value)}/></label>
     <label>Hình thức<select disabled={busy} value={f.method} onChange={e=>set('method',e.target.value)}>{Object.entries(METHOD).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>Số chứng từ / UNC<input maxLength={60} disabled={busy} value={f.reference} onChange={e=>set('reference',e.target.value)}/></label>
    </div>
    <label className="ct-full-field">Ghi chú<input maxLength={300} disabled={busy} value={f.note} onChange={e=>set('note',e.target.value)}/></label>
    {f.customer_id&&<AllocationRows orders={orders} rows={rows} setRows={setRows} busy={busy} amount={Number(f.amount)||0}/>}
    {error&&<Notice type="error">{error}</Notice>}
    <div className="ct-modal-actions" style={{marginTop:14}}><button type="button" disabled={busy} className="ct-btn secondary" onClick={onCancel}>Hủy</button><button type="submit" disabled={busy} className="ct-btn primary">{busy?'Đang lưu...':'Lưu phiếu thu'}</button></div>
   </form>
  </section>
 </div>;
}

function PaymentDetail({id,user,onClose,onChanged}){
 const heading=useId();
 const [p,setP]=useState(null);
 const [orders,setOrders]=useState([]);
 const [rows,setRows]=useState(null);
 const [voiding,setVoiding]=useState(false);
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEsc(onClose,busy);
 const load=async()=>{try{setP((await jsonFetch('/api/payments/'+id)).data)}catch(e){setError(e.message)}};
 useEffect(()=>{load()},[id]);
 const act=async(fn,after)=>{setBusy(true);setError('');try{await fn();after();await load();onChanged()}catch(e){if(e.status===409)await load();setError(e.message)}finally{setBusy(false)}};
 const editAlloc=async()=>{setOrders(await customerOrders(p.customer_id));setRows(p.allocations.map(a=>({order_id:a.order_id,amount:a.amount})))};
 const canWrite=WRITE.includes(user.role)&&p?.status==='ACTIVE';
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <section className="modal ct-modal ct-modal-wide" role="dialog" aria-modal="true" aria-labelledby={heading}>
   <div className="ct-modal-title"><div><div className="ct-overline">PHIẾU THU</div><h2 id={heading}>{p?vnd(p.amount)+' đ — '+p.customer_name:'Đang tải...'}</h2></div><button className="ct-icon-button" type="button" disabled={busy} onClick={onClose} aria-label="Đóng"><X size={20}/></button></div>
   {error&&<Notice type="error">{error}</Notice>}
   {p&&<>
    <div className="ct-detail-grid">{[['Loại thu',TYPE[p.payment_type]],['Trạng thái',<Status value={p.status==='VOID'?'Đã hủy':'Hiệu lực'}/>],['Ngày thu',day(p.payment_date)],['Hình thức',METHOD[p.method]||p.method],['Số chứng từ',p.reference||'—'],['Người lập',p.created_by],['Đã phân bổ',vnd(p.allocated)+' đ'],['Chưa phân bổ',vnd(p.amount-p.allocated)+' đ'],['Ghi chú',p.note||'—']].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
    {p.status==='VOID'&&<Notice type="error">Đã hủy bởi {p.voided_by} — Lý do: {p.void_reason}. Phiếu đã hủy không tính vào số đã thu.</Notice>}
    {rows?<>
      <AllocationRows orders={orders} rows={rows} setRows={setRows} busy={busy} amount={p.amount}/>
      <div className="ct-modal-actions" style={{marginTop:12}}><button className="ct-btn secondary" disabled={busy} onClick={()=>setRows(null)}>Thôi</button><button className="ct-btn primary" disabled={busy} onClick={()=>act(()=>jsonFetch('/api/payments/'+id+'/allocations',{method:'PUT',body:JSON.stringify({allocations:rows.map(x=>({order_id:x.order_id,amount:Number(x.amount)})),expected_updated_at:p.updated_at})}),()=>setRows(null))}>Lưu phân bổ</button></div>
     </>
     :<><div className="ct-lines-head"><strong>Phân bổ vào đơn hàng</strong></div>
      {p.allocations.length===0?<p className="ct-muted">Chưa phân bổ.</p>:<div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Đơn hàng</th><th className="ct-num">Số tiền (đ)</th><th>Người phân bổ</th></tr></thead><tbody>{p.allocations.map(a=><tr key={a.order_id}><td data-label="Đơn"><span className="ct-id">{a.code}</span></td><td data-label="Số tiền" className="ct-num">{vnd(a.amount)}</td><td data-label="Người phân bổ">{a.created_by||'—'}</td></tr>)}</tbody></table></div>}</>}
    {voiding&&<div className="ct-cancel-box"><label>Lý do hủy phiếu thu<span className="ct-required"> *</span><textarea rows={2} maxLength={300} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy} autoFocus/></label>
     <div className="ct-modal-actions"><button className="ct-btn secondary" disabled={busy} onClick={()=>{setVoiding(false);setReason('')}}>Thôi</button><button className="ct-btn danger" disabled={busy||!reason.trim()} onClick={()=>act(()=>jsonFetch('/api/payments/'+id+'/void',{method:'POST',body:JSON.stringify({note:reason,expected_updated_at:p.updated_at})}),()=>setVoiding(false))}><Ban size={17}/> Xác nhận hủy phiếu</button></div></div>}
    {canWrite&&!rows&&!voiding&&<div className="ct-modal-actions" style={{marginTop:18}}><button className="ct-btn secondary" disabled={busy} onClick={()=>setVoiding(true)}><Ban size={17}/> Hủy phiếu</button><button className="ct-btn primary" disabled={busy} onClick={()=>editAlloc().catch(e=>setError(e.message))}><Pencil size={17}/> Sửa phân bổ</button></div>}
   </>}
  </section>
 </div>;
}

export function PaymentsPage({user}){
 const [tab,setTab]=useState('receivables');
 const [recv,setRecv]=useState(null);
 const [filter,setFilter]=useState('open');
 const [rows,setRows]=useState([]);
 const [page,setPage]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [search,setSearch]=useState('');
 const [query,setQuery]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [flash,setFlash]=useState('');
 const [form,setForm]=useState(false);
 const [detail,setDetail]=useState(null);
 const [seq,setSeq]=useState(0);
 const canWrite=WRITE.includes(user.role);
 useEffect(()=>{const t=setTimeout(()=>{setPage(0);setQuery(search.trim())},300);return()=>clearTimeout(t)},[search]);
 useEffect(()=>{let live=true;setLoading(true);setError('');
  const q=tab==='receivables'?'/api/receivables?q='+encodeURIComponent(query)+(filter==='open'?'&open=1':filter==='overdue'?'&overdue=1':''):'/api/payments?limit='+PAGE+'&offset='+page*PAGE+'&q='+encodeURIComponent(query);
  jsonFetch(q).then(r=>{if(!live)return;if(tab==='receivables')setRecv(r);else{setRows(r.data);setHasMore(r.pagination.hasMore)}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false}},[tab,filter,query,page,seq]);
 useEffect(()=>{if(tab==='payments'&&!recv)jsonFetch('/api/receivables').then(setRecv).catch(()=>{})},[tab]);
 const reload=()=>setSeq(x=>x+1);
 const t=recv?.totals;
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">TÀI CHÍNH · THỬ NGHIỆM</div><h2>Thu tiền & công nợ</h2><p>Công nợ = giá trị hàng đã giao được Kế toán xác nhận (kg × giá chưa VAT) − tiền đã phân bổ vào đơn.</p></div>
   <div className="ct-actions"><button className="ct-btn secondary" disabled={loading} onClick={reload}><RefreshCcw size={17}/> Làm mới</button>{canWrite&&<button className="ct-btn primary" onClick={()=>setForm(true)}><Plus size={17}/> Lập phiếu thu</button>}</div></div>
  <Notice>Phân hệ thử nghiệm: <strong>chưa tính VAT, chưa có hoàn cọc/chuyển cọc, chưa đối soát ngân hàng</strong>. Công nợ tính theo giao hàng, hạn thanh toán = ngày giao cuối + số ngày nợ của khách — giả định tạm chờ Kế toán chốt (E01–E03).</Notice>
  {flash&&<Notice type="success">{flash}</Notice>}
  {t&&<Cards items={[['Giá trị đã giao',vnd(t.delivered_value),'đ, chưa VAT'],['Đã thu (phân bổ)',vnd(t.paid),'đ'],['Còn phải thu',vnd(t.balance),'đ',t.balance>0?'warn':''],['Quá hạn',vnd(t.overdue_balance),t.overdue_orders+' đơn',t.overdue_orders?'bad':''],['Tiền chưa phân bổ',vnd(t.unallocated),'đ, khách trả dư/cọc']]}/>}
  <div className="ct-toolbar ct-toolbar-wrap">
   <div className="ct-segment" role="tablist" aria-label="Chọn bảng">{[['receivables','Công nợ theo đơn'],['payments','Phiếu thu']].map(([k,v])=><button key={k} role="tab" aria-selected={tab===k} className={tab===k?'active':''} onClick={()=>{setTab(k);setPage(0)}}>{v}</button>)}</div>
   {tab==='receivables'&&<div className="ct-segment" role="tablist" aria-label="Lọc công nợ">{[['open','Còn số dư'],['overdue','Quá hạn'],['all','Tất cả']].map(([k,v])=><button key={k} role="tab" aria-selected={filter===k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{v}</button>)}</div>}
   <label className="ct-search"><Search size={18}/><span className="sr-only">Tìm</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='receivables'?'Tìm mã đơn hoặc khách hàng...':'Tìm khách hàng hoặc số chứng từ...'} aria-label="Tìm"/></label>
  </div>
  {error?<div className="ct-empty"><AlertTriangle size={30}/><strong>Không thể tải dữ liệu</strong><p>{error}</p><button className="ct-btn secondary" onClick={reload}>Thử lại</button></div>
   :loading?<div className="ct-loading" role="status" aria-live="polite">{[0,1,2].map(i=><div className="ct-skeleton" key={i}/>)}</div>
   :tab==='receivables'?(recv.data.length===0?<div className="ct-empty"><Database size={32}/><strong>Không có công nợ phù hợp</strong></div>
    :<div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sales</th><th className="ct-num">Giá trị đã giao (đ)</th><th className="ct-num">Đã thu (đ)</th><th className="ct-num">Còn lại (đ)</th><th>Hạn thanh toán</th><th>Tình trạng</th></tr></thead>
     <tbody>{recv.data.map(r=><tr key={r.order_id}><td data-label="Mã đơn"><span className="ct-id">{r.code}</span></td><td data-label="Khách hàng">{r.customer_name}</td><td data-label="Sales">{r.sales_name||r.sales_email}</td><td data-label="Đã giao" className="ct-num">{vnd(r.delivered_value)}</td><td data-label="Đã thu" className="ct-num">{vnd(r.paid)}</td>
      <td data-label="Còn lại" className={'ct-num '+(r.balance<0?'ct-pos':'')}><strong>{vnd(r.balance)}</strong></td><td data-label="Hạn TT">{day(r.due_date)}</td>
      <td data-label="Tình trạng">{r.balance<=0?<Status value={r.balance<0?'Trả trước':'Đã thu đủ'}/>:r.overdue_days>0?<Status value={'Quá hạn '+r.overdue_days+' ngày'}/>:<Status value="Trong hạn"/>}</td></tr>)}</tbody></table></div>)
   :rows.length===0?<div className="ct-empty"><Database size={32}/><strong>Chưa có phiếu thu</strong><p>{canWrite?'Bấm "Lập phiếu thu" khi nhận cọc hoặc thanh toán.':''}</p></div>
   :<><div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Ngày thu</th><th>Khách hàng</th><th>Loại</th><th>Hình thức</th><th className="ct-num">Số tiền (đ)</th><th className="ct-num">Đã phân bổ (đ)</th><th>Chứng từ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>{rows.map(p=><tr key={p.id}><td data-label="Ngày thu">{day(p.payment_date)}</td><td data-label="Khách hàng">{p.customer_name}</td><td data-label="Loại">{TYPE[p.payment_type]}</td><td data-label="Hình thức">{METHOD[p.method]||p.method}</td><td data-label="Số tiền" className="ct-num">{vnd(p.amount)}</td><td data-label="Đã phân bổ" className="ct-num">{vnd(p.allocated)}</td><td data-label="Chứng từ">{p.reference||'—'}</td><td data-label="Trạng thái"><Status value={p.status==='VOID'?'Đã hủy':'Hiệu lực'}/></td><td data-label="Thao tác"><button className="ct-text-button" onClick={()=>setDetail(p.id)}>Xem</button></td></tr>)}</tbody></table></div>
    <div className="ct-pagination"><span>Hiển thị {page*PAGE+1}–{page*PAGE+rows.length}{hasMore?' · còn dữ liệu':' · hết danh sách'}</span><div><button className="ct-btn secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/> Trước</button><button className="ct-btn secondary" disabled={!hasMore} onClick={()=>setPage(p=>p+1)}>Sau <ChevronRight size={17}/></button></div></div></>}
  {form&&<PaymentForm onCancel={()=>setForm(false)} onSaved={d=>{setForm(false);setFlash('Đã lập phiếu thu.');setTab('payments');setDetail(d.id);setRecv(null);reload()}}/>}
  {detail&&<PaymentDetail id={detail} user={user} onClose={()=>setDetail(null)} onChanged={()=>{setRecv(null);reload()}}/>}
 </section>;
}

function csv(rows,cols,name){
 const esc=x=>{const s=String(x??'');const safe=/^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s;return '"'+safe.replaceAll('"','""')+'"'};
 const text='﻿'+[cols.map(c=>esc(c[1])).join(','),...rows.map(r=>cols.map(c=>esc(r[c[0]])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function GroupTable({title,rows,label,extra}){
 return <section className="ct-panel"><div className="ct-panel-title"><div><h3>{title}</h3></div></div>
  {rows.length===0?<p className="ct-muted">Không có dữ liệu trong kỳ.</p>:<div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>{label}</th><th className="ct-num">Sản lượng (kg)</th><th className="ct-num">Doanh thu chưa VAT (đ)</th>{extra&&<th className="ct-num">CK/Hoa hồng (đ)</th>}<th className="ct-num">Số đơn</th></tr></thead>
   <tbody>{rows.map(r=><tr key={r.key}><td data-label={label}>{r.label}</td><td data-label="Sản lượng" className="ct-num">{kg(r.kg)}</td><td data-label="Doanh thu" className="ct-num">{vnd(r.revenue)}</td>{extra&&<td data-label="CK/HH" className="ct-num">{vnd(r.commission)}</td>}<td data-label="Số đơn" className="ct-num">{r.orders}</td></tr>)}</tbody></table></div>}
 </section>;
}
export function ReportsPage({user}){
 const now=today().slice(0,7);
 const [from,setFrom]=useState(now.slice(0,4)+'-01');
 const [to,setTo]=useState(now);
 const [data,setData]=useState(null);
 const [basis,setBasis]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [seq,setSeq]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError('');
  jsonFetch('/api/reports/sales?from='+from+'&to='+to).then(r=>{if(live){setData(r.data);setBasis(r.basis)}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false}},[from,to,seq]);
 const t=data?.totals;
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><div className="ct-overline">BÁO CÁO · THỬ NGHIỆM</div><h2>Báo cáo & KPI</h2><p>{user.role==='SALES'?'Số liệu của riêng bạn.':'Toàn công ty, chia theo Sales, tháng, sản phẩm và khách hàng.'}</p></div>
   <div className="ct-actions"><label className="ct-month">Từ tháng<input type="month" value={from} onChange={e=>e.target.value&&setFrom(e.target.value)}/></label><label className="ct-month">Đến tháng<input type="month" value={to} onChange={e=>e.target.value&&setTo(e.target.value)}/></label>
    <button className="ct-btn secondary" disabled={loading} onClick={()=>setSeq(x=>x+1)}><RefreshCcw size={17}/> Làm mới</button>
    <button className="ct-btn secondary" disabled={!data?.by_sales.length} onClick={()=>csv(data.by_sales,[['label','Sales'],['kg','San luong (kg)'],['revenue','Doanh thu chua VAT'],['commission','CK/Hoa hong'],['orders','So don']],'CTFOOD_KPI_'+data.from+'_'+data.to+'.csv')}><Download size={17}/> Xuất CSV</button></div></div>
  <Notice>{basis||'Đang tải...'} Thời điểm ghi nhận doanh số (G01), chỉ tiêu phải giữ (G02) và giá vốn/lợi nhuận (F01–F02) <strong>chờ BGĐ/Kế toán chốt</strong>; số liệu chưa thay thế hệ thống KPI hiện hành.</Notice>
  {error?<div className="ct-empty"><AlertTriangle size={30}/><strong>Không thể tải báo cáo</strong><p>{error}</p></div>
   :loading?<div className="ct-loading" role="status">{[0,1,2].map(i=><div className="ct-skeleton" key={i}/>)}</div>
   :<>
    <Cards items={[['Sản lượng KPI',kg(t.kg),'kg giao đã xác nhận'],['Doanh thu KPI',vnd(t.revenue),'đ, chưa VAT'],['CK / Hoa hồng',vnd(t.commission),'đ theo đơn giá đ/kg'],['Số đơn có giao',t.orders,'đơn'],['Kỳ báo cáo',data.from===data.to?data.from:data.from+' → '+data.to,'theo ngày giao']]}/>
    <div className="ct-report-grid">
     <GroupTable title="Theo Sales" label="Sales" rows={data.by_sales} extra/>
     <GroupTable title="Theo tháng" label="Tháng" rows={data.by_month}/>
     <GroupTable title="Theo sản phẩm" label="Sản phẩm" rows={data.by_product}/>
     <GroupTable title="Top 10 khách hàng" label="Khách hàng" rows={data.by_customer}/>
    </div>
    <section className="ct-panel" style={{marginTop:18}}><div className="ct-panel-title"><div><h3>Công nợ theo Sales (thời điểm hiện tại)</h3><p>Phục vụ chỉ tiêu "Tỷ lệ công nợ quá hạn" (AR-OD-01)</p></div></div>
     {data.receivables.length===0?<p className="ct-muted">Không có công nợ.</p>:<div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Sales</th><th className="ct-num">Còn phải thu (đ)</th><th className="ct-num">Quá hạn (đ)</th><th className="ct-num">Tỷ lệ quá hạn</th></tr></thead>
      <tbody>{data.receivables.map(r=><tr key={r.key}><td data-label="Sales">{r.label}</td><td data-label="Còn phải thu" className="ct-num">{vnd(r.balance)}</td><td data-label="Quá hạn" className={'ct-num '+(r.overdue>0?'ct-neg':'')}>{vnd(r.overdue)}</td><td data-label="Tỷ lệ" className="ct-num">{r.overdue_ratio.toLocaleString('vi-VN')}%</td></tr>)}</tbody></table></div>}
    </section>
   </>}
 </section>;
}
