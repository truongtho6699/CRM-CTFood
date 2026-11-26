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
 useEffect(()=>{setText(label||'')},[label]);
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
  <input role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-label={ariaLabel} aria-invalid={invalid||undefined}
   aria-activedescendant={open&&active>=0?listId+'-'+active:undefined} disabled={disabled} value={text} placeholder={placeholder} autoComplete="off"
   onFocus={()=>setOpen(true)} onChange={e=>{setText(e.target.value);setOpen(true);if(value)onChange('',null)}} onKeyDown={onKey}/>
  {open&&<ul className="ct-combo-list" role="listbox" id={listId}>
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
