import React,{useEffect,useId,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,Info} from 'lucide-react';
// Thành phần giao diện dùng chung giữa các phân hệ.
export const toText=x=>String(x??'');
export function Status({value}){
 const v=toText(value)||'Chưa xác định';
 const kind=/ngừng|INACTIVE|không phù hợp|hủy|đã khóa|quá hạn/i.test(v)?'bad':/đang giao dịch|ACTIVE|chuyển đổi|hoàn|đang hoạt động|thành công|^đã xác nhận|đã thu đủ|trong hạn|hiệu lực|trả trước/i.test(v)?'good':'neutral';
 return <span className={'ct-tag '+kind}><span className="ct-tag-dot"/>{v}</span>;
}
export function Notice({type='info',children}){
 return <div className={'ct-notice '+type} role={type==='error'?'alert':'status'}>{type==='error'?<AlertTriangle size={18}/>:type==='success'?<CheckCircle2 size={18}/>:<Info size={18}/>}<span>{children}</span></div>;
}
export async function jsonFetch(path,options={}){
 const res=await fetch(path,{credentials:'same-origin',...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok||!data.ok)throw Object.assign(Error(data.error||'Lỗi máy chủ (HTTP '+res.status+')'),{status:res.status});
 return data;
}
// Ghi chú "thử nghiệm" gọn một dòng; bấm để xem các quy tắc tạm thời.
export function TrialNote({children}){
 return <details className="ct-trial"><summary>Thử nghiệm: quy tắc đang tạm thời, chờ BGĐ và Kế toán duyệt</summary><p>{children}</p></details>;
}

// Ô chọn có gõ để tìm (thay cho <select> khi danh sách có thể dài: khách hàng, sản phẩm).
// search(q) trả về Promise<[{id,label,sub}]>; tìm trên máy chủ nên không giới hạn 100 mục đầu.
export function Combobox({value,label,onChange,search,placeholder='Gõ để tìm...',disabled,ariaLabel,invalid}){
 const [text,setText]=useState(label||'');
 const [items,setItems]=useState([]);
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(-1);
 const [loading,setLoading]=useState(false);
 const box=useRef(null);
 const listId=useId();
 const seq=useRef(0);
 const input=useRef(null);
 const [pos,setPos]=useState(null);
 useEffect(()=>{setText(label||'')},[label]);
 useEffect(()=>{
  if(!open)return;
  const place=()=>{const r=input.current?.getBoundingClientRect();if(!r)return;const below=window.innerHeight-r.bottom;const up=below<220&&r.top>below;
   setPos({left:r.left,width:Math.max(r.width,240),...(up?{bottom:window.innerHeight-r.top+4}:{top:r.bottom+4}),maxHeight:Math.max(140,Math.min(260,(up?r.top:below)-12))})};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)};
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const n=++seq.current;setLoading(true);
  const t=setTimeout(()=>{search(text===label?'':text.trim()).then(r=>{if(n===seq.current){setItems(r);setActive(r.length?0:-1)}}).catch(()=>{if(n===seq.current)setItems([])}).finally(()=>{if(n===seq.current)setLoading(false)})},200);
  return()=>clearTimeout(t);
 },[text,open]);
 useEffect(()=>{if(!open)return;const close=e=>{if(!box.current?.contains(e.target)){setOpen(false);setText(label||'')}};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[open,label]);
 const pick=it=>{onChange(it.id,it);setText(it.label);setOpen(false)};
 const onKey=e=>{
  if(e.key==='ArrowDown'){e.preventDefault();if(!open)setOpen(true);else setActive(a=>Math.min(a+1,items.length-1))}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0))}
  else if(e.key==='Enter'&&open){e.preventDefault();if(items[active])pick(items[active])}
  else if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);setText(label||'')}
 };
 return <div className="ct-combo" ref={box}>
 <input ref={input} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-label={ariaLabel} aria-invalid={invalid||undefined}
   aria-activedescendant={open&&active>=0?listId+'-'+active:undefined} disabled={disabled} value={text} placeholder={placeholder} autoComplete="off"
   onFocus={()=>setOpen(true)} onChange={e=>{setText(e.target.value);setOpen(true);if(value)onChange('',null)}} onKeyDown={onKey}/>
  {open&&pos&&<ul className="ct-combo-list" role="listbox" id={listId} style={pos}>
   {loading&&!items.length?<li className="ct-combo-empty">Đang tìm...</li>
    :!items.length?<li className="ct-combo-empty">Không tìm thấy. Thử từ khóa khác.</li>
    :items.map((it,i)=><li key={it.id} id={listId+'-'+i} role="option" aria-selected={it.id===value} className={i===active?'active':''} onMouseDown={e=>{e.preventDefault();pick(it)}} onMouseEnter={()=>setActive(i)}>
      <span>{it.label}</span>{it.sub&&<small>{it.sub}</small>}</li>)}
  </ul>}
 </div>;
}
// Nguồn tìm kiếm dùng chung.
export const searchCustomers=async q=>(await jsonFetch('/api/customers?limit=20&q='+encodeURIComponent(q))).data
 .filter(c=>c.status!=='INACTIVE').map(c=>({id:c.id,label:c.name,sub:[c.phone,c.region].filter(Boolean).join(', ')}));
export const searchProducts=async q=>(await jsonFetch('/api/products?limit=20&q='+encodeURIComponent(q))).data
 .filter(p=>p.active!==0).map(p=>({id:p.id,label:p.name,sub:[p.category,p.origin].filter(Boolean).join(', ')}));

// Tiến trình một đơn: Đặt → Giao (kg đã xác nhận / kg đặt) → Thu (tiền đã phân bổ / giá trị đã giao).
const shortMoney=n=>{n=Math.round(Number(n)||0);const a=Math.abs(n);return a>=1e9?(n/1e9).toLocaleString('vi-VN',{maximumFractionDigits:2})+' tỷ':a>=1e6?(n/1e6).toLocaleString('vi-VN',{maximumFractionDigits:1})+' tr':n.toLocaleString('vi-VN')};
const kgFmt=n=>(Number(n)||0).toLocaleString('vi-VN',{maximumFractionDigits:1});
export function orderProgress(o){
 const total=Number(o.total_kg)||0,del=Number(o.delivered_kg)||0,val=Number(o.delivered_value)||0,paid=o.paid===undefined?null:Number(o.paid)||0;
 const giao=total?Math.round(del/total*100):0;
 const thu=paid===null?null:val?Math.round(paid/val*100):null;
 return {giao,thu,del,total,val,paid,cancelled:o.status==='CANCELLED',pending:Number(o.pending_tickets)||0};
}
export function OrderProgress({order}){
 const p=orderProgress(order);
 const w=x=>Math.max(0,Math.min(100,x||0))+'%';
 const step=(cls,title,detail)=><div className={'ct-step '+cls}><span className="ct-step-dot" aria-hidden="true"/><div><strong>{title}</strong><small>{detail}</small></div></div>;
 return <div className={'ct-progress'+(p.cancelled?' cancelled':'')} aria-label="Tiến trình đơn hàng">
  {step('done','Đặt',kgFmt(p.total)+' kg, '+shortMoney(order.total_amount)+' đ')}
  <div className="ct-step-bar" aria-hidden="true"><i style={{width:w(p.giao)}}/></div>
  {step(p.giao>=100?'done':p.giao>0?'part':'',p.giao>100?'Giao '+p.giao+'% (thừa)':'Giao '+p.giao+'%',kgFmt(p.del)+' / '+kgFmt(p.total)+' kg'+(p.pending?', '+p.pending+' phiếu chờ xác nhận':''))}
  {p.paid!==null&&<><div className="ct-step-bar" aria-hidden="true"><i style={{width:w(p.thu)}}/></div>
   {step(p.thu>=100?'done':p.paid>0?'part':'',p.thu===null?(p.paid>0?'Đã cọc':'Thu'):'Thu '+p.thu+'%',p.val?shortMoney(p.paid)+' / '+shortMoney(p.val)+' đ đã giao':p.paid>0?shortMoney(p.paid)+' đ trước khi giao':'Chưa giao, chưa thu')}</>}
 </div>;
}
export function MiniProgress({order}){
 const p=orderProgress(order);
 if(p.cancelled)return <span className="ct-muted">Đã hủy</span>;
 const bar=(label,v,hint)=><span className="ct-mini" title={hint}><span className="ct-mini-track"><i style={{width:Math.max(0,Math.min(100,v||0))+'%'}}/></span>{label}</span>;
 return <span className="ct-minis">{bar('Giao '+p.giao+'%',p.giao,kgFmt(p.del)+' / '+kgFmt(p.total)+' kg')}{p.paid!==null&&bar(p.thu===null?(p.paid>0?'Đã cọc':'Thu 0%'):'Thu '+p.thu+'%',p.thu??0,shortMoney(p.paid)+' đ đã thu')}</span>;
}
