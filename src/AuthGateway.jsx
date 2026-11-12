import React from 'react';
import './auth.css';

/**
 * The identity provider is configured in Cloudflare Zero Trust, never in frontend code.
 * Google identity provider is enabled in Cloudflare Access; verification of an interactive Google login is a separate UAT step.
 */
const googleConfigured = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true';

function GoogleMark(){
 return <span className="google-mark" aria-hidden="true">G</span>;
}
export function LoginPanel({error}){
 const accessLogin=()=>{window.location.assign('https://crm-ctfood.pages.dev/');};
 return <div className="ct-auth-screen">
  <section className="ct-auth-card" aria-label="Đăng nhập CT FOOD CRM">
   <div className="ct-auth-brand"><span className="ct-auth-brand-logo">CT</span><div><strong>CT FOOD</strong><small>CRM MANAGEMENT</small></div></div>
   <h1>Đăng nhập hệ thống</h1>
   <p className="ct-auth-desc">Hệ thống dành cho người dùng được CT FOOD cấp quyền. Đăng nhập được bảo vệ bởi Cloudflare Zero Trust.</p>
   <button type="button" className="ct-auth-google" disabled={!googleConfigured} onClick={accessLogin} title={googleConfigured?'Mở Cloudflare Access để chọn Google':'Chưa bật Google trong bản build'}>
     <GoogleMark/> Đăng nhập bằng Google
   </button>
   {!googleConfigured && <div className="ct-auth-hint">Google OAuth chưa được bật trong bản build này. Vẫn có thể đăng nhập qua Cloudflare Access.</div>}
   {googleConfigured&&<div className="ct-auth-hint">Cloudflare Access sẽ hiển thị lựa chọn Google. Nếu phiên đăng nhập Access đang mở, hãy kiểm tra trạng thái quyền truy cập.</div>}
   <button type="button" className="ct-auth-access" onClick={accessLogin}>Đăng nhập qua Cloudflare Access</button>
   {error&&<p className="ct-auth-error">Chưa xác thực được phiên đăng nhập: {error}. Không có dữ liệu nào được ghi khi chưa đăng nhập.</p>}
   <small>Không tạo tài khoản tự động. Chỉ quản trị viên cấp quyền và kích hoạt người dùng trong D1.</small>
  </section>
 </div>;
}
