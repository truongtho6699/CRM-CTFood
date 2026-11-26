import React from 'react';
import {AlertTriangle,CheckCircle2,Info} from 'lucide-react';
// Thành phần giao diện dùng chung giữa các phân hệ.
export const toText=x=>String(x??'');
export function Status({value}){
 const v=toText(value)||'Chưa xác định';
 const kind=/ngừng|INACTIVE|không phù hợp|hủy|đã khóa/i.test(v)?'bad':/đang giao dịch|ACTIVE|chuyển đổi|hoàn|đang hoạt động|thành công/i.test(v)?'good':'neutral';
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
