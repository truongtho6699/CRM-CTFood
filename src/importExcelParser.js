// Minimal .xlsx worksheet reader using browser ZIP deflate; CSV UTF-8 also supported.
// Parsing is local only: file bytes are never uploaded, only confirmed normalized rows.
const decode=u=>new TextDecoder('utf-8').decode(u);
function zipEntries(buffer){
 const bytes=new Uint8Array(buffer),dv=new DataView(buffer),lookup={};
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}
 if(eocd<0)throw Error('Tệp không phải Excel .xlsx hợp lệ');
 const count=dv.getUint16(eocd+10,true),offset=dv.getUint32(eocd+16,true);
 let pos=offset;
 for(let i=0;i<count;i++){
  if(dv.getUint32(pos,true)!==0x02014b50)throw Error('Tệp ZIP không hợp lệ');
  const method=dv.getUint16(pos+10,true),packed=dv.getUint32(pos+20,true);
  const nameLength=dv.getUint16(pos+28,true),extra=dv.getUint16(pos+30,true),comment=dv.getUint16(pos+32,true),local=dv.getUint32(pos+42,true);
  const name=decode(bytes.slice(pos+46,pos+46+nameLength));
  if(dv.getUint32(local,true)!==0x04034b50)throw Error('Tệp Excel bị lỗi');
  const start=local+30+dv.getUint16(local+26,true)+dv.getUint16(local+28,true);
  lookup[name]={data:bytes.slice(start,start+packed),method};
  pos+=46+nameLength+extra+comment;
 }
 return lookup;
}
async function xmlFile(files,path){
 const entry=files[path];if(!entry)return null;
 let stream=new Blob([entry.data]).stream();
 if(entry.method===8){
  try{stream=stream.pipeThrough(new DecompressionStream('deflate-raw'))}
  catch{throw Error('Trình duyệt chưa hỗ trợ giải nén Excel; hãy xuất CSV UTF-8 từ Excel để nhập')}
 }else if(entry.method!==0)throw Error('Kiểu nén Excel chưa được hỗ trợ');
 const output=await new Response(stream).arrayBuffer();
 if(output.byteLength>8*1024*1024)throw Error('Dữ liệu Excel quá lớn');
 const doc=new DOMParser().parseFromString(decode(new Uint8Array(output)),'application/xml');
 if(doc.querySelector('parsererror'))throw Error('Nội dung Excel không hợp lệ');
 return doc;
}
const all=(root,tag)=>[...root.getElementsByTagName(tag)];
const text=n=>n?.textContent||'';
function columnNum(address){
 const letters=(address||'').match(/^[A-Z]+/)?.[0]||'A';
 return [...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
}
export async function readXlsx(file){
 const files=zipEntries(await file.arrayBuffer());
 const sharedDoc=await xmlFile(files,'xl/sharedStrings.xml');
 const shared=sharedDoc?all(sharedDoc,'si').map(n=>all(n,'t').map(text).join('')):[];
 let sheets=Object.keys(files).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a,b)=>Number(a.match(/\d+(?=\.xml)/)[0])-Number(b.match(/\d+(?=\.xml)/)[0]));
 if(!sheets.length)throw Error('Không tìm thấy trang dữ liệu trong Excel');
 const outputs=[];
 for(const name of sheets){
  const doc=await xmlFile(files,name);
  const rows=all(doc,'sheetData').flatMap(parent=>all(parent,'row')).map(row=>{
   const out=[];
   for(const cell of all(row,'c')){
    const idx=columnNum(cell.getAttribute('r'));if(idx>40)continue;
    const type=cell.getAttribute('t');
    const raw=text(all(cell,'v')[0]);
    const inline=all(cell,'is')[0];
    const value=type==='s'?shared[Number(raw)]??'':type==='inlineStr'?all(inline||cell,'t').map(text).join(''):raw;
    out[idx]=value;
   }
   return out.map(v=>v??'');
  }).filter(row=>row.some(v=>String(v).trim()));
  outputs.push({name,rows});
 }
 return outputs;
}
export function readCsv(csv){
 const rows=[];let row=[],field='',quoted=false;
 const input=csv.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){
   if(quoted&&input[i+1]==='"'){field+='"';i++}else quoted=!quoted;
  }else if(c===','&&!quoted){row.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}
  else field+=c;
 }
 if(quoted)throw Error('Dấu ngoặc kép trong CSV chưa đóng');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 return [{name:'CSV',rows}];
}
export const HEADERS={
 customers:['Mã khách hàng','Tên khách','MST','Email','Địa chỉ','Tên người liên hệ','SĐT người liên hệ','Sale phụ trách','Công nợ'],
 products:['Mã hàng','Tên hàng hóa','Đơn vị','Hình thức','Khối lượng quy đổi'],
 containers:['Mã Công trình (số cont)','Tên hàng']
};
const clean=s=>String(s??'').normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ');
export function mapTemplate(sheets,entity){
 const required=HEADERS[entity],rank=sheet=>{
  const header=(sheet.rows[0]||[]).map(clean);
  return required.filter(n=>header.includes(clean(n))).length;
 };
 const best=[...sheets].sort((a,b)=>rank(b)-rank(a))[0];
 const rows=best?.rows||[],headers=(rows[0]||[]).map(clean);
 const missing=required.filter(h=>!headers.includes(clean(h)));
 if(missing.length)throw Error('Thiếu cột trong mẫu '+best.name+': '+missing.join(', '));
 const get=(r,h)=>String(r[headers.indexOf(clean(h))]??'').trim();
 return rows.slice(1).filter(r=>r.some(v=>String(v??'').trim())).map((r,index)=>{
  if(entity==='customers')return {legacy_code:get(r,'Mã khách hàng'),name:get(r,'Tên khách'),tax_code:get(r,'MST'),email:get(r,'Email'),address:get(r,'Địa chỉ'),contact_name:get(r,'Tên người liên hệ'),contact_phone:get(r,'SĐT người liên hệ'),source_sales_name:get(r,'Sale phụ trách'),credit_days:get(r,'Công nợ'),partner_type:'CUSTOMER',_row:index+2};
  if(entity==='products')return {legacy_code:get(r,'Mã hàng'),name:get(r,'Tên hàng hóa'),unit:get(r,'Đơn vị'),packaging_type:get(r,'Hình thức'),conversion_kg:get(r,'Khối lượng quy đổi'),_row:index+2};
  return {id:get(r,'Mã Công trình (số cont)'),source_product_name:get(r,'Tên hàng'),_row:index+2};
 });
}
