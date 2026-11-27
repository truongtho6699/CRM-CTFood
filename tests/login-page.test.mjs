import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/login.js';

const get=(q='')=>onRequestGet({request:new Request('https://crm-ctfood.pages.dev/login'+q)});

test('trang đăng nhập có form tên đăng nhập/mật khẩu và nút Google, không có JavaScript',async()=>{
 const response=get();
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/<html lang="vi">/);
 assert.match(html,/<h1>Đăng nhập<\/h1>/);
 assert.match(html,/<form method="post" action="\/api\/auth\/login"/);
 assert.match(html,/name="username" autocomplete="username"/);
 assert.match(html,/name="password" type="password" autocomplete="current-password"/);
 assert.match(html,/href="\/auth\/google"/);
 assert.doesNotMatch(html,/<script\b/i);
 assert.doesNotMatch(html,/class="alert"/);
});

test('thông báo lỗi chỉ lấy từ danh sách mã cố định (không phản chiếu nội dung trên URL)',async()=>{
 assert.match(await get('?e=bad').text(),/Tên đăng nhập hoặc mật khẩu không đúng/);
 assert.match(await get('?e=locked').text(),/tạm khóa 15 phút/);
 assert.match(await get('?e=google_denied').text(),/chưa được cấp quyền/);
 const evil=await get('?e=%3Cscript%3Ealert(1)%3C/script%3E').text();
 assert.doesNotMatch(evil,/<script/i);
 assert.doesNotMatch(evil,/class="alert"/);
 assert.doesNotMatch(await get('?e=toString').text(),/class="alert"/);
});

test('trang công khai giữ các header bảo mật; form chỉ gửi về chính trang',()=>{
 const response=get();
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 const csp=response.headers.get('content-security-policy')||'';
 assert.match(csp,/default-src 'none'/);
 assert.match(csp,/form-action 'self'/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('referrer-policy'),'same-origin','cần Origin thật cho kiểm tra CSRF');
});
