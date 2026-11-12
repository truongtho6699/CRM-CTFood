import React from 'react';
import './auth.css';

/**
 * The identity provider is configured in Cloudflare Zero Trust, never in frontend code.
 * Google OAuth is not enabled until the Cloudflare Google IdP is tested and approved.
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
   <button type="button" className="ct-auth-google" disabled={!googleConfigured} onClick={accessLogin} title={googleConfigured?'Đăng nhập qua Cloudflare Access bằng Google':'Chưa hoàn tất tích hợp Google OAuth'}>
     <GoogleMark/> Đăng nhập bằng Google
   </button>
   {!googleConfigured && <div className="ct-auth-hint">Google OAuth đang chờ cấu hình trên Cloudflare Access. Nút sẽ hoạt động sau khi thiết lập thông tin OAuth của Google.</div>}
   <button type="button" className="ct-auth-access" onClick={accessLogin}>Đăng nhập qua Cloudflare Access</button>
   {error&&<p className="ct-auth-error">Chưa xác thực được phiên đăng nhập: {error}. Không có dữ liệu nào được ghi khi chưa đăng nhập.</p>}
   <small>Không tạo tài khoản tự động. Chỉ quản trị viên cấp quyền và kích hoạt người dùng trong D1.</small>
  </section>
 </div>;
}
