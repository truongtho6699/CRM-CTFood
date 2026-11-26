// Tổng quan "Việc cần làm" theo vai trò (bước 2 UI/UX): mở app là biết hôm nay cần xử lý gì.
import React,{useEffect,useState} from 'react';
import {RefreshCcw,ArrowRight,CheckCircle2,AlertTriangle} from 'lucide-react';
import {Notice,jsonFetch} from './ui.jsx';

const vnd=n=>Math.round(Number(n)||0).toLocaleString('vi-VN');
const kg=n=>(Number(n)||0).toLocaleString('vi-VN',{maximumFractionDigits:1});
const day=v=>v?new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit'}).format(new Date(v+'T00:00:00')):'chưa hẹn ngày';
// Thứ tự thẻ theo việc chính của từng vai trò.
const ORDER={
 SALES:['activities','orders','overdue','revenue','leads'],
 ACCOUNTING:['tickets','credits','overdue','revenue','orders'],
 SALES_ADMIN:['orders','tickets','overdue','activities','revenue'],
 LOGISTICS:['orders','tickets'],
 SALES_MANAGER:['revenue','overdue','orders','activities','tickets','leads'],
 BOD:['revenue','overdue','orders','tickets','activities'],
 ADMIN:['revenue','overdue','tickets','orders','credits','activities'],
};

function Card({title,count,unit,note,tone,empty,items,link,onNavigate}){
 return <section className={'ct-task '+(count>0?tone||'':'clear')}>
  <header><h3>{title}</h3>{link&&<button className="ct-link" onClick={()=>onNavigate(link[0])}>{link[1]} <ArrowRight size={15}/></button>}</header>
  <div className="ct-task-count">{count>0?<><strong>{count}</strong> <span>{unit}</span></>:<span className="ct-task-clear"><CheckCircle2 size={18}/> {empty}</span>}</div>
  {note&&count>0&&<p className="ct-task-note">{note}</p>}
  {items?.length>0&&<ul>{items.map(([key,main,side])=><li key={key}><span>{main}</span><span>{side}</span></li>)}</ul>}
 </section>;
}

export function WorkDashboard({user,summary,onNavigate}){
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);setError('');try{setData((await jsonFetch('/api/worklist')).data)}catch(e){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 const first=(user.full_name||'').split(' ').filter(Boolean).pop()||'';
 const b=data?.blocks||{};
 const cards={
  orders:b.orders&&<Card key="orders" title="Đơn chờ giao" count={b.orders.count} unit="đơn" tone={b.orders.due_soon?'warn':''} empty="Không có đơn chờ giao."
   note={b.orders.due_soon?b.orders.due_soon+' đơn đến hạn giao trong 3 ngày tới.':''} link={['orders','Mở đơn hàng']} onNavigate={onNavigate}
   items={b.orders.items.map(o=>[o.id,o.code+', '+o.customer_name,day(o.expected_date)+(o.pending_tickets?', '+o.pending_tickets+' phiếu chờ':'')])}/>,
  tickets:b.tickets&&<Card key="tickets" title="Phiếu cân chờ Kế toán xác nhận" count={b.tickets.count} unit="phiếu" tone="warn" empty="Không có phiếu chờ."
   link={['deliveries','Mở phiếu cân']} onNavigate={onNavigate} items={b.tickets.items.map(t=>[t.id,t.order_code+', '+t.product_name,kg(t.delivered_kg)+' kg'])}/>,
  overdue:b.overdue&&<Card key="overdue" title="Công nợ quá hạn" count={b.overdue.count} unit={'đơn, '+vnd(b.overdue.amount)+' đ'} tone="bad" empty="Không có khoản quá hạn."
   note={'Tổng còn phải thu '+vnd(b.overdue.open_amount)+' đ.'} link={['payments','Mở công nợ']} onNavigate={onNavigate}
   items={b.overdue.items.map(r=>[r.order_id,r.code+', '+r.customer_name,vnd(r.balance)+' đ, trễ '+r.overdue_days+' ngày'])}/>,
  credits:b.credits&&<Card key="credits" title="Tiền khách trả chưa phân bổ" count={b.credits.count} unit={'khách, '+vnd(b.credits.amount)+' đ'} tone="warn" empty="Đã phân bổ hết."
   link={['payments','Mở phiếu thu']} onNavigate={onNavigate} items={b.credits.items.map(c=>[c.customer_id,c.customer_name,vnd(c.unallocated)+' đ'])}/>,
  activities:b.activities&&<Card key="activities" title="Việc chăm sóc đến hạn" count={b.activities.count} unit="việc" tone="warn" empty="Không có việc đến hạn hôm nay."
   link={['customers','Mở khách hàng']} onNavigate={onNavigate} items={b.activities.items.map(a=>[a.id,a.title,(a.customer_name||'')+', '+day(a.due_date)])}/>,
  revenue:b.revenue&&(()=>{const c=b.revenue.current,p=b.revenue.previous;const diff=p.revenue?Math.round((c.revenue-p.revenue)/p.revenue*100):null;
   return <section key="revenue" className="ct-task">
    <header><h3>Doanh thu đã giao tháng này</h3><button className="ct-link" onClick={()=>onNavigate('kpi')}>Mở báo cáo <ArrowRight size={15}/></button></header>
    <div className="ct-task-count"><strong>{vnd(c.revenue)}</strong> <span>đ, chưa VAT</span></div>
    <p className="ct-task-note">{kg(c.kg)} kg đã được Kế toán xác nhận. {diff===null?'Tháng trước chưa có doanh thu.':'Tháng trước '+vnd(p.revenue)+' đ ('+(diff>=0?'tăng ':'giảm ')+Math.abs(diff)+'%).'}</p>
   </section>})(),
  leads:b.leads&&<Card key="leads" title="Khách tiềm năng đang theo" count={b.leads.count} unit="khách" empty="Chưa có khách tiềm năng đang theo." link={['leads','Mở khách tiềm năng']} onNavigate={onNavigate}/>,
 };
 const order=ORDER[user.role]||Object.keys(cards);
 return <div className="ct-dashboard">
  <div className="ct-dashboard-title"><div><h2>Chào {first||'bạn'}</h2><p>Việc cần xử lý hôm nay, {new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())}.</p></div>
   <button className="ct-btn secondary" disabled={loading} onClick={load}><RefreshCcw size={17}/> Làm mới</button></div>
  {error&&<Notice type="error">Không tải được việc cần làm: {error}. {data?'Số liệu phía dưới là lần tải trước.':'Vui lòng thử lại.'} <button type="button" className="ct-text-button" onClick={load} disabled={loading}>Thử lại</button></Notice>}
  {loading&&!data?<div className="ct-loading" role="status" aria-live="polite"><span>Đang tải công việc theo vai trò...</span>{[0,1,2].map(i=><div className="ct-skeleton" key={i}/>)}</div>
   :error&&!data?<div className="ct-empty"><AlertTriangle size={30}/><strong>Không tải được công việc</strong><p>Kiểm tra kết nối và thử lại. Hệ thống chưa xác nhận không có công việc.</p><button type="button" className="ct-btn secondary" onClick={load}>Tải lại dữ liệu</button></div>
   :<div className="ct-task-grid" aria-live="polite">{order.map(k=>cards[k]).filter(Boolean)}</div>}
  {summary&&<div className="ct-quick-links">
   {[['customers','Khách hàng',summary.customers],['leads','Khách tiềm năng',summary.leads],['products','Sản phẩm',summary.products]].filter(x=>x[2]!==null&&x[2]!==undefined)
    .map(([id,name,n])=><button key={id} onClick={()=>onNavigate(id)}><strong>{Number(n).toLocaleString('vi-VN')}</strong> {name.toLowerCase()}</button>)}
  </div>}
 </div>;
}
