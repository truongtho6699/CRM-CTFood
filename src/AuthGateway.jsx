import React,{useState} from 'react';
import {ShieldCheck,RefreshCcw,LogIn,Eye,EyeOff,LockKeyhole,Mail,ArrowLeft,Info} from 'lucide-react';
import './auth.css';

/**
 * Cloudflare Access protects the host before the React app is served.
 * This screen is a fallback for API session issues, NOT an alternative login server.
 * Username/password sign-in MUST stay disabled until independently reviewed
 * backend authentication, password hashing, sessions and lockout exist.
 */
const googleConfigured=import.meta.env.VITE_GOOGLE_OAUTH_ENABLED==='true';
const REAUTH='https://crm-ctfood.pages.dev/cdn-cgi/access/logout?returnTo='+encodeURIComponent('https://crm-ctfood.pages.dev/');
export function LoginPanel({error='',loading=false,onRetry}){
 const [method,setMethod]=useState('google');
 const [visible,setVisible]=useState(false);
 return <main className="ct-auth-screen">
  <div className="ct-login-layout">
   <aside className="ct-login-side">
    <div className="ct-login-side-brand"><span className="ct-auth-brand-logo">CT</span><div><strong>CT FOOD</strong><small>HỆ THỐNG QUẢN TRỊ KHÁCH HÀNG</small></div></div>
    <div className="ct-login-side-copy"><span className="ct-login-eyebrow">CT FOOD · CRM</span><h2>Quản lý kinh doanh tập trung, rõ ràng và an toàn.</h2><p>Dữ liệu khách hàng và sản phẩm được quản lý tập trung trên Cloudflare D1, với phân quyền truy cập theo tài khoản.</p></div>
    <div className="ct-login-side-foot"><ShieldCheck size={18}/> Xác thực và phân quyền nhiều lớp</div>
   </aside>
   <section className="ct-auth-card" aria-label="Đăng nhập CT FOOD CRM">
    <div className="ct-login-mobile-brand"><span className="ct-auth-brand-logo">CT</span><strong>CT FOOD CRM</strong></div>
    <div className="ct-login-eyebrow">CHÀO MỪNG TRỞ LẠI</div>
    <h1>{loading?'Đang xác minh tài khoản':'Đăng nhập'}</h1>
    <p className="ct-auth-desc">Chọn phương thức để truy cập hệ thống quản trị CT FOOD.</p>
    <div className="ct-login-tabs" role="tablist" aria-label="Phương thức đăng nhập">
     <button type="button" role="tab" aria-selected={method==='google'} className={method==='google'?'active':''} onClick={()=>setMethod('google')}>Tài khoản Google</button>
     <button type="button" role="tab" aria-selected={method==='password'} className={method==='password'?'active':''} onClick={()=>setMethod('password')}>Tên đăng nhập / mật khẩu</button>
    </div>
    {method==='google'?<div role="tabpanel" className="ct-login-panel">
     <p className="ct-auth-label">Đăng nhập bằng tài khoản đã được cấp quyền</p>
     <a className="ct-auth-google ct-auth-google-action" href={REAUTH}><span className="ct-google-logo" aria-hidden="true">G</span> Tiếp tục với Google qua Access</a>
     <p className="ct-login-helper">{googleConfigured?'Bạn sẽ được chuyển tới Cloudflare Access để chọn Google và xác minh tài khoản.':'Lựa chọn Google cần được kích hoạt trong cấu hình Cloudflare Access.'}</p>
     <div className="ct-login-security"><ShieldCheck size={17}/> Quyền truy cập được kiểm tra lại tại Cloudflare Access và D1.</div>
    </div>:<div role="tabpanel" className="ct-login-panel">
     <div className="ct-login-unavailable"><LockKeyhole size={18}/><div><strong>Chưa kích hoạt đăng nhập bằng mật khẩu</strong><span>Đang chuẩn bị xác thực riêng; chưa lưu hoặc xử lý mật khẩu người dùng.</span></div></div>
     <label className="ct-login-field"><span>Tên đăng nhập hoặc email</span><div><Mail size={18}/><input disabled autoComplete="username" placeholder="Nhập tên đăng nhập" aria-label="Tên đăng nhập (chưa kích hoạt)"/></div></label>
     <label className="ct-login-field"><span>Mật khẩu</span><div><LockKeyhole size={18}/><input disabled autoComplete="current-password" type={visible?'text':'password'} placeholder="Nhập mật khẩu" aria-label="Mật khẩu (chưa kích hoạt)"/><button type="button" onClick={()=>setVisible(v=>!v)} className="ct-login-eye" aria-label={visible?'Ẩn mật khẩu':'Hiện mật khẩu'}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
     <button type="button" className="ct-auth-access" disabled>Đăng nhập bằng mật khẩu</button>
     <button type="button" className="ct-login-switch" onClick={()=>setMethod('google')}><ArrowLeft size={16}/> Sử dụng Google để đăng nhập</button>
    </div>}
    {loading&&<div className="ct-login-message"><RefreshCcw size={16}/> Đang kiểm tra phiên truy cập…</div>}
    {error&&<div role="alert" className="ct-auth-error"><Info size={16}/> Không xác thực được API: {error}</div>}
    <button type="button" onClick={onRetry} disabled={loading} className="ct-login-retry"><RefreshCcw size={16}/> {loading?'Đang xác minh':'Thử xác thực lại phiên hiện tại'}</button>
    <div className="ct-login-footer">Chỉ tài khoản được quản trị viên CT FOOD cho phép mới có quyền truy cập.</div>
   </section>
  </div>
 </main>;
}
