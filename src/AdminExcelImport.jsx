import React,{useEffect,useMemo,useState} from 'react';
import {Upload,FileSpreadsheet,ShieldCheck,RefreshCcw,AlertTriangle,CheckCircle2,History,Download} from 'lucide-react';
import {jsonFetch,Notice} from './ui.jsx';
import {readXlsx,readCsv,mapTemplate,HEADERS} from './importExcelParser.js';
const OPTIONS=[{value:'customers',label:'Khách hàng / NCC'},{value:'products',label:'Hàng hóa'},{value:'containers',label:'Container / Lô hàng'}];
const SLICE=12;
function chunks(items){const out=[];for(let i=0;i<items.length;i+=SLICE)out.push(items.slice(i,i+SLICE));return out}
export function AdminExcelImport(){
 const [entity,setEntity]=useState('customers');
 const [filename,setFilename]=useState('');
 const [records,setRecords]=useState([]);
 const [statuses,setStatuses]=useState([]);
 const [history,setHistory]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState('');
 const [approved,setApproved]=useState(false);
 const [partnerType,setPartnerType]=useState('CUSTOMER');
 const clear=()=>{setRecords([]);setStatuses([]);setFilename('');setError('');setResult('');setApproved(false)};
 const refreshHistory=()=>jsonFetch('/api/imports/history').then(x=>setHistory(x.data||[])).catch(e=>setError(e.message));
 useEffect(()=>{refreshHistory()},[]);
 const onFile=async file=>{
  clear();if(!file)return;
  if(file.size>3*1024*1024){setError('File vượt 3 MB. Hãy chia thành các file nhỏ hơn.');return}
  setBusy(true);
  try{
   const sheets=/\.csv$/i.test(file.name)?readCsv(await file.text()):/\.xlsx$/i.test(file.name)?await readXlsx(file):null;
   if(!sheets)throw Error('Chỉ hỗ trợ .xlsx hoặc .csv UTF-8');
   const items=mapTemplate(sheets,entity);
   if(items.length===0)throw Error('Không có dòng dữ liệu để nhập');
   if(items.length>1000)throw Error('Tối đa 1.000 dòng mỗi lần. Hãy chia file.');
   setFilename(file.name);setRecords(items);setResult('Đã đọc '+items.length+' dòng. Hãy bấm Kiểm tra D1.');
  }catch(e){setError(e.message||'Không đọc được file')}finally{setBusy(false)}
 };
 const checked=async()=>{
  setError('');setResult('');setApproved(false);
  if(!records.length)return;
  setBusy(true);
  try{
   const mapped=records.map(r=>entity==='customers'?{...r,partner_type:partnerType}:r);
   const keys=new Set(),dup=new Set();
   mapped.forEach(r=>{const key=String(entity==='containers'?r.id:r.legacy_code).toUpperCase();if(keys.has(key))dup.add(key);keys.add(key)});
   const data=[];
   for(const group of chunks(mapped)){
    const res=await jsonFetch('/api/imports/preview',{method:'POST',body:JSON.stringify({entity,rows:group})});
    data.push(...(res.data||[]));
   }
   const statusesOut=data.map((d,i)=>({
    ...d,index:i+1,
    status:dup.has(String(entity==='containers'?mapped[i].id:mapped[i].legacy_code).toUpperCase())?'invalid':d.status,
    reason:dup.has(String(entity==='containers'?mapped[i].id:mapped[i].legacy_code).toUpperCase())?'Trùng mã giữa các dòng trong file':d.reason
   }));
   setStatuses(statusesOut);
   const invalid=statusesOut.filter(r=>r.status!=='ready').length;
   setResult('Kiểm tra '+statusesOut.length+' dòng: '+(statusesOut.length-invalid)+' hợp lệ, '+invalid+' lỗi/trùng.');
  }catch(e){setError(e.message||'Không kiểm tra được D1');setStatuses([])}finally{setBusy(false)}
 };
 const confirm=async()=>{
  if(!approved||statuses.length!==records.length||statuses.some(x=>x.status!=='ready'))return;
  setBusy(true);setError('');setResult('');
  let created=0,completed=0;
  try{
   const mapped=records.map(r=>entity==='customers'?{...r,partner_type:partnerType}:r);
   for(const group of chunks(mapped)){
    const response=await jsonFetch('/api/imports/commit',{method:'POST',body:JSON.stringify({entity,filename,rows:group,confirm:'IMPORT'})});
    created+=response.data?.created||0;completed++;
    setResult('Đã lưu '+created+'/'+records.length+' dòng trên D1.');
   }
   setResult('Hoàn tất: '+created+' dòng đã nhập vào D1. Không ghi đè dữ liệu có sẵn.');
   setApproved(false);setRecords([]);setStatuses([]);
   await refreshHistory();
  }catch(e){
   setError('Đã lưu '+created+' dòng trong '+completed+' đợt thành công. Đợt tiếp theo lỗi: '+e.message+'. Xem lịch sử, tải lại file để kiểm tra các dòng chưa nhập.');
   setApproved(false);setStatuses([]);
   await refreshHistory();
  }finally{setBusy(false)}
 };
 const valid=statuses.length===records.length&&statuses.every(x=>x.status==='ready');
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><h2>Nhập dữ liệu Excel</h2><p>Quản trị hệ thống · Chỉ ADMIN được kiểm tra và xác nhận ghi D1.</p></div><span className="ct-tag good"><ShieldCheck size={14}/> ADMIN</span></div>
  <Notice>File chỉ được đọc trong trình duyệt. Hệ thống kiểm tra trùng mã và yêu cầu xác nhận trước khi ghi. Không tự cập nhật giá vốn, tồn kho hoặc đơn hàng.</Notice>
  <div className="ct-import-grid">
   <div className="ct-import-panel">
    <h3><FileSpreadsheet size={19}/> 1. Chọn dữ liệu nguồn</h3>
    <label className="ct-import-field">Danh mục
     <select disabled={busy} value={entity} onChange={e=>{setEntity(e.target.value);clear()}}>{OPTIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>
    </label>
    {entity==='customers'&&<label className="ct-import-field">Loại đối tác cho toàn bộ file
     <select disabled={busy} value={partnerType} onChange={e=>{setPartnerType(e.target.value);setStatuses([]);setApproved(false)}}><option value="CUSTOMER">Khách hàng</option><option value="SUPPLIER">Nhà cung cấp</option><option value="BOTH">Khách hàng & Nhà cung cấp</option></select>
    </label>}
    <label className="ct-import-field">Chọn file Excel hoặc CSV
     <input type="file" disabled={busy} accept=".xlsx,.csv" onChange={e=>onFile(e.target.files?.[0])}/>
    </label>
    <small>Các cột bắt buộc: {HEADERS[entity].join(' · ')}. Định dạng MST, mã khách và SĐT dưới dạng Text trong Excel để giữ số 0 đầu.</small>
    {filename&&<p className="ct-import-filename"><FileSpreadsheet size={16}/>{filename} — {records.length} dòng</p>}
    <div className="ct-import-actions"><button className="ct-btn primary" type="button" disabled={busy||!records.length} onClick={checked}><ShieldCheck size={17}/> {busy?'Đang kiểm tra...':'2. Kiểm tra D1'}</button><button className="ct-btn secondary" type="button" disabled={busy} onClick={clear}>Xóa file</button></div>
   </div>
   <div className="ct-import-panel">
    <h3><ShieldCheck size={19}/> 3. Xác nhận nhập</h3>
    {statuses.length>0?<><p>{statuses.filter(s=>s.status==='ready').length} hợp lệ / {statuses.length} dòng</p>
     <label className="ct-import-check"><input type="checkbox" checked={approved} disabled={busy||!valid} onChange={e=>setApproved(e.target.checked)}/> Tôi đã kiểm tra dữ liệu và đồng ý nhập các dòng mới vào D1</label>
     <button className="ct-btn primary" disabled={busy||!valid||!approved} onClick={confirm}><Upload size={17}/> {busy?'Đang lưu...':'Xác nhận nhập chính thức'}</button>
    </>:<p className="ct-muted">Kiểm tra dữ liệu trước khi mở chức năng xác nhận.</p>}
    {result&&<Notice type="success">{result}</Notice>}
    {error&&<Notice type="error">{error}</Notice>}
   </div>
  </div>
  {statuses.length>0&&<div className="ct-import-panel"><h3>Kết quả kiểm tra từng dòng</h3><div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Dòng Excel</th><th>Mã nguồn</th><th>Tên đối tượng</th><th>Kết quả</th></tr></thead><tbody>{statuses.map((r,i)=><tr key={i}><td>{records[i]?._row||i+2}</td><td>{records[i]?.legacy_code||records[i]?.id||'—'}</td><td>{records[i]?.name||records[i]?.source_product_name||'—'}</td><td>{r.status==='ready'?<span className="ct-import-ok"><CheckCircle2 size={15}/> Hợp lệ</span>:<span className="ct-import-bad"><AlertTriangle size={15}/>{r.reason}</span>}</td></tr>)}</tbody></table></div></div>}
  <div className="ct-import-panel"><div className="ct-section-head"><h3><History size={19}/> Lịch sử nhập dữ liệu</h3><button className="ct-btn secondary" onClick={refreshHistory} disabled={busy}><RefreshCcw size={16}/> Làm mới</button></div>
   {history.length?<div className="ct-tablebox"><table className="ct-data-table"><thead><tr><th>Ngày giờ</th><th>Tệp</th><th>Danh mục</th><th>Đã thêm</th><th>Người nhập</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{h.created_at}</td><td>{h.filename}</td><td>{OPTIONS.find(o=>o.value===h.entity)?.label||h.entity}</td><td>{h.created_rows}</td><td>{h.actor_email}</td></tr>)}</tbody></table></div>:<p className="ct-muted">Chưa có lịch sử nhập.</p>}
  </div>
 </section>;
}
