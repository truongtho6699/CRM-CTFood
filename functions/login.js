/**
 * Trang đăng nhập công khai: tên đăng nhập + mật khẩu (form gửi thẳng tới /api/auth/login, không dùng JavaScript)
 * hoặc Google (/auth/google, do Cloudflare Access bảo vệ). Trang này không đọc cookie hay dữ liệu CRM.
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
.card{background:#fff;width:min(390px,100%);border:1px solid #dfebe8;border-radius:20px;box-shadow:0 22px 70px #113f3519;padding:29px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:27px}
.mark{display:grid;place-items:center;background:#087a66;color:white;border-radius:12px;width:48px;height:48px;font-size:18px;font-weight:800}
.brand strong{font-size:19px;display:block}.brand small{color:#5c7b7d;font-size:11px;letter-spacing:.2px}
h1{margin:0 0 23px;font-size:25px;line-height:1.25}
.btn{width:100%;min-height:48px;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px;text-decoration:none;font:inherit;font-size:14px;font-weight:700}
.field{display:block;font-size:12px;font-weight:650;color:#294c59;margin-bottom:12px}
.field input{display:block;width:100%;height:46px;margin-top:6px;padding:10px 12px;font:inherit;font-size:15px;background:#fff;border:1px solid #cbdadf;border-radius:9px;color:#173443}
.field input:focus{outline:3px solid #1689b6;outline-offset:1px;border-color:#1689b6}
.primary{background:#087a66;color:#fff;border:1px solid #087a66;cursor:pointer;margin-top:6px}.primary:hover{background:#06604f}
.alert{background:#fff0ee;color:#9a3832;border-radius:9px;padding:10px 12px;font-size:13px;line-height:1.45;margin:0 0 16px}
.short-note{font-size:12px;color:#5c7176;margin:16px 0 0;text-align:center}
.divider{display:flex;align-items:center;gap:11px;margin:14px 0;color:#6e858b;font-size:12px}
.divider:before,.divider:after{content:"";flex:1;border-top:1px solid #e0e9eb}
.google{background:#fff;border:1px solid #cbdadf;color:#183945}
.google:hover{background:#f2f8f7;border-color:#8fbbb0}
.google svg{width:20px;height:20px;flex-shrink:0}
.footer{margin-top:27px;border-top:1px solid #e8efee;padding-top:17px;display:flex;gap:7px;align-items:flex-start;color:#527075;font-size:11px;line-height:1.5}
.footer svg{flex-shrink:0}
a:focus-visible,button:focus-visible{outline:3px solid #1689b6;outline-offset:3px}
@media(max-width:480px){.card{padding:26px 21px}h1{font-size:23px}}
</style>
</head>
<body>
<main class="card">
 <div class="brand"><span class="mark" aria-hidden="true">CT</span><div><strong>CT FOOD CRM</strong><small>Hệ thống quản lý khách hàng</small></div></div>
 <h1>Đăng nhập</h1>
 <!--ERROR-->
 <form method="post" action="/api/auth/login" autocomplete="on">
  <label class="field">Tên đăng nhập<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="32" autofocus></label>
  <label class="field">Mật khẩu<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
  <button class="btn primary" type="submit">Đăng nhập</button>
 </form>
 <div class="divider">hoặc</div>
 <a class="btn google" href="/auth/google" rel="nofollow">
<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.86 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.38 14.38 0 0 1 9.75 24c0-1.59.27-3.12.76-4.59l-7.98-6.2A23.95 23.95 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
 Tiếp tục với Google
 </a>
 <p class="short-note">Quên mật khẩu? Liên hệ quản trị viên CT FOOD để được cấp mật khẩu tạm.</p>
 <div class="footer"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#087a66" stroke-width="2" aria-hidden="true"><path d="m12 22 7-4V6l-7-4-7 4v12z"/><path d="m9 12 2 2 4-4"/></svg>Chỉ dành cho tài khoản được cấp quyền.</div>
</main>
</body>
</html>`;
const ERRORS={
 bad:'Tên đăng nhập hoặc mật khẩu không đúng.',
 locked:'Tài khoản tạm khóa 15 phút do nhập sai nhiều lần. Liên hệ quản trị viên nếu cần mở sớm.',
 throttled:'Có quá nhiều lần đăng nhập sai từ mạng này. Vui lòng thử lại sau 15 phút.',
 google_denied:'Tài khoản Google này chưa được cấp quyền dùng CRM. Liên hệ quản trị viên.',
 google_failed:'Chưa đăng nhập Google được. Vui lòng thử lại.',
};
export function onRequestGet({request}){
 const code=new URL(request.url).searchParams.get('e');
 const msg=Object.hasOwn(ERRORS,code||'')?ERRORS[code]:'';
 return new Response(html.replace('<!--ERROR-->',msg?'<p class="alert" role="alert">'+msg+'</p>':''),{status:200,headers:{
  'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  // same-origin (không phải no-referrer) để trình duyệt gửi Origin thật khi gửi form; máy chủ dùng Origin chống CSRF.
  'Referrer-Policy':'same-origin',
  'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
 }});
}
