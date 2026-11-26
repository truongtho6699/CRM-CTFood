/**
 * Isolated, PUBLIC sign-in landing page.
 * No API access, cookies, OAuth tokens or credentials are handled on this page.
 * The protected CRM and /api continue to require Cloudflare Access JWT.
 */
const html=String.raw`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Đăng nhập · CT FOOD CRM</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#173443;background:#f3f8f7}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:radial-gradient(circle at 12% 0%,#d1eee4 0%,transparent 45%),#f4f8f8;padding:18px}
.card{background:#fff;width:min(420px,100%);border:1px solid #dfebe8;border-radius:20px;box-shadow:0 22px 70px #113f3519;padding:32px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:30px}
.mark{display:grid;place-items:center;background:#087a66;color:white;border-radius:12px;width:48px;height:48px;font-size:18px;font-weight:800}
.brand strong{font-size:19px;display:block}.brand small{color:#5c7b7d;font-size:11px;letter-spacing:.7px}
h1{margin:0 0 9px;font-size:25px;line-height:1.25}
.subtitle{color:#526e75;font-size:14px;line-height:1.6;margin:0 0 25px}
.field{display:block;margin:0 0 15px;font-size:13px;font-weight:650}
.field span{display:block;margin-bottom:7px}
.field input{width:100%;height:46px;border:1px solid #d3e0e2;border-radius:9px;padding:11px 13px;font:inherit;color:#49646b;background:#f7fafb}
.field input:disabled{opacity:.75;cursor:not-allowed}
.btn{width:100%;min-height:48px;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px;text-decoration:none;font:inherit;font-size:14px;font-weight:700}
.password{background:#98b2ad;color:#fff;border:1px solid #98b2ad;cursor:not-allowed}
.google{background:#fff;border:1px solid #cbdadf;color:#183945}
.google:hover{background:#f2f8f7;border-color:#8fbbb0}
.google svg{width:20px;height:20px;flex-shrink:0}
.divider{display:flex;align-items:center;gap:14px;color:#68838a;font-size:12px;margin:20px 0}
.divider:before,.divider:after{content:"";height:1px;background:#dce8e8;flex:1}
.note{margin:12px 0 0;color:#7c5b18;background:#fff7e6;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.65}
.footer{margin-top:27px;border-top:1px solid #e8efee;padding-top:17px;display:flex;gap:7px;align-items:flex-start;color:#527075;font-size:11px;line-height:1.5}
.footer svg{flex-shrink:0}
a:focus-visible{outline:3px solid #1689b6;outline-offset:3px}
@media(max-width:480px){.card{padding:26px 21px}h1{font-size:23px}}
</style>
</head>
<body>
<main class="card">
 <div class="brand"><span class="mark" aria-hidden="true">CT</span><div><strong>CT FOOD CRM</strong><small>HỆ THỐNG QUẢN LÝ KHÁCH HÀNG</small></div></div>
 <h1>Đăng nhập</h1>
 <p class="subtitle">Sử dụng tài khoản được CT FOOD cấp quyền để truy cập hệ thống.</p>
 <label class="field"><span>Tên đăng nhập hoặc email</span><input autocomplete="username" type="text" placeholder="Nhập tài khoản" disabled aria-describedby="password-note"></label>
 <label class="field"><span>Mật khẩu</span><input type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" disabled aria-describedby="password-note"></label>
 <button class="btn password" type="button" disabled aria-describedby="password-note">Đăng nhập bằng mật khẩu</button>
 <p class="note" id="password-note"><strong>Chưa kích hoạt:</strong> CT FOOD chưa cấu hình dịch vụ xác thực mật khẩu riêng. Không nhập hoặc gửi mật khẩu tại trang này.</p>
 <div class="divider">Hoặc</div>
 <a class="btn google" href="https://crm-ctfood.pages.dev/" rel="nofollow">
 <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.86 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.38 14.38 0 0 1 9.75 24c0-1.59.27-3.12.76-4.59l-7.98-6.2A23.95 23.95 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
 Tiếp tục với Google
 </a>
 <div class="footer"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#087a66" stroke-width="2"><path d="m12 22 7-4V6l-7-4-7 4v12z"/><path d="m9 12 2 2 4-4"/></svg>Google được xác thực qua Cloudflare Access. Quyền CRM được kiểm tra lại trong D1.</div>
</main>
</body>
</html>`;
export function onRequestGet(){
 return new Response(html,{status:200,headers:{
  'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'public, max-age=120',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
 }});
}
