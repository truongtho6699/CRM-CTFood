// Tiện ích HTTP dùng chung cho API CRM.
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
export function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
export function bad(message,status=400){return response({ok:false,error:message},status)}
export function fail(message,status=400){return Object.assign(new Error(message),{status})}
export function trimText(x,max=255){return typeof x==='string'?x.trim().slice(0,max):''}
// Kiểm tra chung cho mọi yêu cầu ghi: cùng Origin, JSON, kích thước giới hạn.
export async function readJson(request){
 const origin=request.headers.get('Origin');
 if(!origin||origin!==new URL(request.url).origin)throw Object.assign(new Error('Nguồn yêu cầu không hợp lệ'),{status:403});
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))throw Object.assign(new Error('Yêu cầu Content-Type: application/json'),{status:415});
 const raw=await request.text();
 if(raw.length>15000)throw Object.assign(new Error('Dữ liệu quá lớn'),{status:413});
 let payload;try{payload=JSON.parse(raw)}catch{throw Object.assign(new Error('JSON không hợp lệ'),{status:400})}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(new Error('Dữ liệu không hợp lệ'),{status:400});
 return payload;
}
