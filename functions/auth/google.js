// Đăng nhập Google: Cloudflare Access bảo vệ đường dẫn này, worker đổi JWT của Access thành phiên CRM.
import worker from '../../worker/src/index.js';
export async function onRequestGet(context){
 return worker.fetch(context.request,context.env,context);
}
