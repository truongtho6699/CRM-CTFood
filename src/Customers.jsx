// Chi tiết khách hàng (bước 2 UI/UX): một chỗ để xem đơn hàng, công nợ, phiếu thu và lịch chăm sóc của khách,
// và tạo đơn / lập phiếu thu / thêm việc chăm sóc ngay tại đó.
import React,{useEffect,useId,useState} from 'react';
import {X,Plus,Pencil,ShoppingCart,Wallet,CheckCircle2,Phone,MapPin} from 'lucide-react';
import {Status,Notice,jsonFetch} from './ui.jsx';
import {OrderForm,OrderDetail} from './Orders.jsx';
import {PaymentForm} from './Finance.jsx';

const ORDER_STATUS={PENDING:'Chờ giao',SUCCESS:'Thành công',CANCELLED:'Hủy'};
const PAY_TYPE={DEPOSIT:'Đặt cọc',PAYMENT:'Thanh toán'};
const ORDER_WRITE=['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN','SALES'];
const PAY_WRITE=['ADMIN','ACCOUNTING'];
const ACT_WRITE=['ADMIN','BOD','SALES_MANAGER','SALES','SALES_ADMIN'];
const vnd=n=>Math.round(Number(n)||0).toLocaleString('vi-VN');
const kg=n=>(Number(n)||0).toLocaleString('vi-VN',{maximumFractionDigits:3});
const day=v=>v?new Intl.DateTimeFormat('vi-VN').format(new Date(v.length===10?v+'T00:00:00':v.replace(' ','T')+(v.includes('Z')||v.includes('T')?'':'Z'))):'—';
const tomorrow=()=>new Date(Date.now()+31*3600*1000).toISOString().slice(0,10);

function Activities({customer,rows,user,onChanged}){
 const [title,setTitle]=useState('');
 const [due,setDue]=useState(tomorrow());
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const canWrite=ACT_WRITE.includes(user.role);
 const run=async fn=>{setBusy(true);setError('');try{await fn();onChanged()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const add=e=>{e.preventDefault();if(!title.trim())return;run(async()=>{await jsonFetch('/api/activities',{method:'POST',body:JSON.stringify({customer_id:customer.id,title,due_date:due})});setTitle('')})};
 const today=new Date(Date.now()+7*3600*1000).toISOString().slice(0,10);
 return <div>
  {canWrite&&<form className="ct-activity-form" onSubmit={add}>
   <input aria-label="Việc cần làm với khách" placeholder="Ví dụ: Gọi báo giá sườn non tháng 12" maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/>
   <input type="date" aria-label="Ngày thực hiện" value={due} onChange={e=>setDue(e.target.value)} disabled={busy} required/>
   <button className="ct-btn primary" disabled={busy||!title.trim()}><Plus size={16}/> Thêm việc</button>
  </form>}
  {error&&<Notice type="error">{error}</Notice>}
  {rows.length===0?<p className="ct-muted">Chưa có việc chăm sóc nào với khách này.</p>
   :<ul className="ct-activity-list">{rows.map(a=>{const late=a.status==='PENDING'&&a.due_date&&a.due_date<today;return <li key={a.id} className={a.status==='DONE'?'done':''}>
    <div><strong>{a.title}</strong><small>{day(a.due_date)}{late?', trễ hạn':''} — {a.owner_name||a.owner_email}</small></div>
    {a.status==='DONE'?<Status value="Hoàn thành"/>:canWrite?<button className="ct-text-button" disabled={busy} onClick={()=>run(()=>jsonFetch('/api/activities/'+a.id+'/done',{method:'POST',body:'{}'}))}><CheckCircle2 size={14}/> Đánh dấu xong</button>:<Status value={late?'Quá hạn':'Chưa làm'}/>}
   </li>})}</ul>}
 </div>;
}

export function CustomerDetail({id,user,statusLabel,onClose,onEdit,onChanged}){
 const heading=useId();
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [tab,setTab]=useState('orders');
 const [child,setChild]=useState(null); // {kind:'order'|'newOrder'|'editOrder'|'payment', ...}
 const [flash,setFlash]=useState('');
 const load=async()=>{try{setData((await jsonFetch('/api/customers/'+encodeURIComponent(id)+'/overview')).data)}catch(e){setError(e.message)}};
 useEffect(()=>{load()},[id]);
 useEffect(()=>{if(child)return;const f=e=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',f);return()=>document.removeEventListener('keydown',f)},[child,onClose]);
 const changed=msg=>{setChild(null);if(msg)setFlash(msg);load();onChanged?.()};
 const c=data?.customer;
 const pending=data?.orders.filter(o=>o.status==='PENDING').length||0;
 const r=data?.receivables;
 const tabs=[['orders','Đơn hàng ('+(data?.orders.length||0)+')'],...(r?[['money','Công nợ & phiếu thu']]:[]),...(data?.activities?[['care','Chăm sóc ('+data.activities.filter(a=>a.status!=='DONE').length+')']]:[])];
 return <div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!child)onClose()}}>
  <section className="modal ct-modal ct-modal-wide ct-customer" role="dialog" aria-modal="true" aria-labelledby={heading}>
   <div className="ct-modal-title"><div><h2 id={heading}>{c?c.name:'Đang tải...'}</h2>{c&&<div className="ct-customer-meta"><Status value={statusLabel(c.status)}/>{c.phone&&<span><Phone size={14}/> <a href={'tel:'+c.phone}>{c.phone}</a></span>}{c.region&&<span><MapPin size={14}/> {c.region}</span>}<span>Phụ trách: {c.owner_name||c.owner_email||'—'}</span></div>}</div>
    <button className="ct-icon-button" type="button" onClick={onClose} aria-label="Đóng"><X size={20}/></button></div>
   {error&&<Notice type="error">{error}</Notice>}
   {flash&&<Notice type="success">{flash}</Notice>}
   {data&&<>
    <div className="ct-actions ct-customer-actions">
     {ORDER_WRITE.includes(user.role)&&c.status!=='INACTIVE'&&<button className="ct-btn primary" onClick={()=>setChild({kind:'newOrder'})}><ShoppingCart size={17}/> Tạo đơn</button>}
     {PAY_WRITE.includes(user.role)&&<button className="ct-btn secondary" onClick={()=>setChild({kind:'payment'})}><Wallet size={17}/> Lập phiếu thu</button>}
     {onEdit&&<button className="ct-btn secondary" onClick={()=>onEdit(c)}><Pencil size={17}/> Sửa thông tin</button>}
    </div>
    <div className="ct-stat-row">
     <div><span>Đơn chờ giao</span><strong>{pending}</strong></div>
     {r&&<><div><span>Còn phải thu</span><strong>{vnd(Math.max(r.balance,0))} đ</strong></div>
      <div className={r.overdue>0?'bad':''}><span>Quá hạn</span><strong>{vnd(r.overdue)} đ</strong></div>
      <div><span>Tiền chưa phân bổ</span><strong>{vnd(r.unallocated)} đ</strong></div></>}
     {'credit_limit' in c&&<div><span>Hạn mức / số ngày nợ</span><strong>{vnd(c.credit_limit)} đ / {c.credit_days} ngày</strong></div>}
    </div>
    <dl className="ct-facts">{[['Mã số thuế',c.tax_code],['Email',c.email],['Địa chỉ',c.address]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'—'}</dd></div>)}</dl>
    <div className="ct-segment" role="tablist" aria-label="Thông tin khách hàng">{tabs.map(([k,v])=><button key={k} role="tab" aria-selected={tab===k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{v}</button>)}</div>
    <div className="ct-tabpanel">
     {tab==='orders'&&(data.orders.length===0?<p className="ct-muted">Khách chưa có đơn hàng.</p>
      :<ul className="ct-item-list">{data.orders.map(o=><li key={o.id}><button onClick={()=>setChild({kind:'order',id:o.id})}>
        <span className="ct-item-main"><strong>{o.code}</strong><small>{o.order_type==='OFFER'?'Offer':'Hàng sẵn kho'}, giao dự kiến {day(o.expected_date)}</small></span>
        <span className="ct-item-side"><strong>{vnd(o.total_amount)} đ</strong><small>Đã giao {kg(o.delivered_kg)} / {kg(o.total_kg)} kg</small></span>
        <Status value={ORDER_STATUS[o.status]}/></button></li>)}</ul>)}
     {tab==='money'&&r&&<>
      {r.rows.length===0?<p className="ct-muted">Chưa phát sinh công nợ (chưa có phiếu cân được xác nhận hoặc chưa thu tiền).</p>
       :<ul className="ct-item-list">{r.rows.map(x=><li key={x.order_id}><div className="ct-item-row">
         <span className="ct-item-main"><strong>{x.code}</strong><small>Hạn thanh toán {day(x.due_date)}</small></span>
         <span className="ct-item-side"><strong>{vnd(x.balance)} đ</strong><small>Đã giao {vnd(x.delivered_value)}, đã thu {vnd(x.paid)}</small></span>
         <Status value={x.balance<=0?(x.balance<0?'Trả trước':'Đã thu đủ'):x.overdue_days>0?'Quá hạn '+x.overdue_days+' ngày':'Trong hạn'}/></div></li>)}</ul>}
      <h4 className="ct-subhead">Phiếu thu</h4>
      {data.payments.length===0?<p className="ct-muted">Chưa có phiếu thu.</p>
       :<ul className="ct-item-list">{data.payments.map(p=><li key={p.id}><div className="ct-item-row">
         <span className="ct-item-main"><strong>{PAY_TYPE[p.payment_type]} {p.reference?'('+p.reference+')':''}</strong><small>{day(p.payment_date)}</small></span>
         <span className="ct-item-side"><strong>{vnd(p.amount)} đ</strong><small>Đã phân bổ {vnd(p.allocated)}</small></span>
         <Status value={p.status==='VOID'?'Đã hủy':'Hiệu lực'}/></div></li>)}</ul>}
     </>}
     {tab==='care'&&<Activities customer={c} rows={data.activities} user={user} onChanged={load}/>}
    </div>
   </>}
  </section>
  {child?.kind==='order'&&<OrderDetail id={child.id} user={user} onClose={()=>setChild(null)} onEdit={o=>setChild({kind:'editOrder',order:o})} onChanged={()=>{load();onChanged?.()}}/>}
  {child?.kind==='newOrder'&&<OrderForm presetCustomer={{id:c.id,name:c.name}} onCancel={()=>setChild(null)} onSaved={d=>changed('Đã tạo đơn '+d.code+'.')}/>}
  {child?.kind==='editOrder'&&<OrderForm initial={child.order} onCancel={()=>setChild(null)} onSaved={d=>changed('Đã lưu đơn '+d.code+'.')}/>}
  {child?.kind==='payment'&&<PaymentForm presetCustomer={{id:c.id,name:c.name}} onCancel={()=>setChild(null)} onSaved={()=>changed('Đã lập phiếu thu.')}/>}
 </div>;
}
