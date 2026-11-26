import React,{useEffect,useRef,useState} from 'react';
import {Boxes,Package,Users,Plus,RefreshCcw,Search,AlertTriangle,CheckCircle2,X,ChevronLeft,ChevronRight,ShieldCheck,Info} from 'lucide-react';
import {Notice,jsonFetch} from './ui.jsx';
const LIMIT=25;
const MANAGERS=['ADMIN','BOD','SALES_MANAGER','SALES_ADMIN'];
export function CatalogHome({onNavigate}){
 const items=[
  {id:'customers',title:'Khách hàng / Nhà cung cấp',desc:'Thông tin đối tác, mã số thuế, người phụ trách',icon:Users},
  {id:'products',title:'Hàng hóa',desc:'Mã hàng, tên hàng, đơn vị và xuất xứ',icon:Package},
  {id:'containers',title:'Container / Lô hàng',desc:'Mã container và liên kết danh mục hàng hóa',icon:Boxes}
 ];
 return <section className="ct-workspace"><div className="ct-section-head"><div><h2>Quản lý danh mục</h2><p>Ba danh mục nền theo mẫu dữ liệu CT FOOD. Chọn danh mục để xem, tìm kiếm hoặc cập nhật.</p></div></div>
  <div className="ct-catalog-grid">{items.map(item=>{const Icon=item.icon;return <button className="ct-catalog-card" type="button" key={item.id} onClick={()=>onNavigate(item.id)}><span className="ct-catalog-icon"><Icon size={23}/></span><strong>{item.title}</strong><small>{item.desc}</small><span className="ct-catalog-go">Mở danh mục →</span></button>})}</div>
  <Notice>Nhập dữ liệu cũ từ Excel/Google Sheets sẽ triển khai theo quy trình kiểm tra trùng và phê duyệt riêng; chưa tải dữ liệu lịch sử lên D1.</Notice>
 </section>;
}
export function ContainerCatalog({user}){
 const canWrite=MANAGERS.includes(user.role);
 const [rows,setRows]=useState([]);
 const [products,setProducts]=useState([]);
 const [query,setQuery]=useState('');
 const [term,setTerm]=useState('');
 const [page,setPage]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [note,setNote]=useState('');
 const [showForm,setShowForm]=useState(false);
 const [form,setForm]=useState({id:'',product_id:''});
 const [saving,setSaving]=useState(false);
 const req=useRef(0);
 const [rev,setRev]=useState(0);
 const reload=()=>setRev(x=>x+1);
 useEffect(()=>{const t=setTimeout(()=>{setTerm(query.trim());setPage(0)},300);return()=>clearTimeout(t)},[query]);
 useEffect(()=>{
  const current=++req.current;let ignore=false;
  setLoading(true);setError('');
  jsonFetch('/api/containers?limit='+LIMIT+'&offset='+(page*LIMIT)+'&q='+encodeURIComponent(term)).then(r=>{
   if(!ignore&&current===req.current){setRows(r.data||[]);setHasMore(Boolean(r.pagination?.hasMore))}
  }).catch(e=>{if(!ignore&&current===req.current){setRows([]);setError(e.message)}}).finally(()=>{if(!ignore&&current===req.current)setLoading(false)});
  return()=>{ignore=true};
 },[page,term,rev]);
 const open=async()=>{
  setNote('');setError('');setForm({id:'',product_id:''});
  try{
   const data=await jsonFetch('/api/products?limit=100');
   setProducts(data.data||[]);
   setShowForm(true);
  }catch(e){setError('Không tải được danh mục sản phẩm: '+e.message)}
 };
 const save=async e=>{
  e.preventDefault();if(saving)return;
  setSaving(true);setError('');setNote('');
  try{
   const data=await jsonFetch('/api/containers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
   if(!data.persisted)throw Error('D1 chưa xác nhận ghi dữ liệu');
   setShowForm(false);setNote('Đã tạo mã container và ghi nhật ký D1. Chưa ghi nhận số lượng/giá vốn.');
   setPage(0);reload();
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 return <section className="ct-workspace">
  <div className="ct-section-head"><div><h2>Container / Lô hàng</h2><p>Danh mục mã container theo mẫu nguồn “Mã công trình (số cont)”. Liên kết với mã hàng hóa D1.</p></div>
   <div className="ct-actions"><button type="button" className="ct-btn secondary" onClick={reload} disabled={loading}><RefreshCcw size={17}/> Làm mới</button>{canWrite&&<button type="button" className="ct-btn primary" onClick={open}><Plus size={17}/> Thêm container</button>}</div></div>
  <Notice>Chỉ quản lý mã container và sản phẩm liên kết. Số lượng, tồn kho, giá vốn và phiếu cân chỉ được cập nhật qua nghiệp vụ kho sau nghiệm thu.</Notice>
  {note&&<Notice type="success">{note}</Notice>}
  {error&&<Notice type="error">{error}</Notice>}
  <label className="ct-search" style={{marginBottom:18}}><Search size={18}/><input aria-label="Tìm mã container hoặc mã sản phẩm" placeholder="Tìm mã container, mã hàng..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
  {loading?<div className="ct-loading" role="status">Đang tải danh mục...</div>
   :rows.length===0?<div className="ct-empty"><Boxes size={30}/><strong>Chưa có mã container</strong><p>Hãy thêm container hoặc thay đổi từ khóa tìm kiếm.</p></div>
   :<><div className="ct-tablebox"><table className="ct-data-table ct-compact"><thead><tr><th>Mã container</th><th>Mã hàng liên kết</th><th>Trạng thái</th><th>Khối lượng (kg)</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}><td data-label="Mã container" className="c-title">{row.id}</td><td data-label="Mã hàng" className="c-sub">{row.product_id}</td><td data-label="Trạng thái">{row.status==='PLANNED'?'Đã khai báo':row.status||'—'}</td><td data-label="Khối lượng">{Number(row.quantity_kg||0).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>
    <div className="ct-pagination"><span>Dòng {page*LIMIT+1}–{page*LIMIT+rows.length}</span><div><button type="button" className="ct-btn secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/> Trước</button><button type="button" className="ct-btn secondary" disabled={!hasMore} onClick={()=>setPage(p=>p+1)}>Sau <ChevronRight size={16}/></button></div></div></>}
  {showForm&&<div className="backdrop ct-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setShowForm(false)}}>
   <section className="modal ct-modal" role="dialog" aria-modal="true" aria-labelledby="ct-cont-title"><div className="ct-modal-title"><h2 id="ct-cont-title">Thêm container</h2><button className="ct-icon-button" aria-label="Đóng" type="button" disabled={saving} onClick={()=>setShowForm(false)}><X size={20}/></button></div>
    <form onSubmit={save} className="ct-catalog-form"><label>Mã container <span className="ct-required">*</span><input required minLength={4} maxLength={64} value={form.id} placeholder="Ví dụ: MEDU9856808" onChange={e=>setForm(v=>({...v,id:e.target.value.toUpperCase()}))}/></label>
     <label>Hàng hóa liên kết <span className="ct-required">*</span><select required value={form.product_id} onChange={e=>setForm(v=>({...v,product_id:e.target.value}))}><option value="">Chọn hàng hóa đã có trong CRM</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}</select></label>
     {products.length>=100&&<Notice>Đang hiển thị 100 sản phẩm đầu tiên; cần bổ sung tìm kiếm sản phẩm khi danh mục lớn hơn.</Notice>}
     {error&&<Notice type="error">{error}</Notice>}
     <div className="ct-modal-actions"><button type="button" className="ct-btn secondary" disabled={saving} onClick={()=>setShowForm(false)}>Hủy</button><button className="ct-btn primary" type="submit" disabled={saving||!form.product_id}>{saving?'Đang lưu...':'Lưu vào D1'}</button></div>
    </form>
   </section></div>}
 </section>;
}
