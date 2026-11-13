import React from 'react';
import {ShieldCheck,RefreshCcw,LogIn} from 'lucide-react';
import './auth.css';

/**
 * Cloudflare Access protects the app before React loads.
 * This is a recovery screen if an already-delivered page cannot authenticate its API.
 */
const googleReady=import.meta.env.VITE_GOOGLE_OAUTH_ENABLED==='true';
const LOGOUT='/cdn-cgi/access/logout?returnTo='+encodeURIComponent('https://crm-ctfood.pages.dev/');
export function LoginPanel({error='',loading=false,onRetry}){
 return <main className="ct-auth-screen"><section className="ct-auth-card">
   <div className="ct-auth-brand"><span className="ct-auth-brand-logo">CT</span><div><strong>CT FOOD</strong><small>CRM MANAGEMENT</small></div></div>
   <h1>{loading?'Đang xác minh tài khoản':'Xác thực đăng nhập'}</h1>
   <p className="ct-auth-desc">{loading?'Hệ thống đang kiểm tra quyền truy cập và cơ sở dữ liệu D1.':'Cloudflare Access bảo vệ CT FOOD CRM. Để đăng nhập bằng Google, vui lòng xác thực tại màn hình Cloudflare Access.'}</p>
   {error&&<p className="ct-auth-error" role="alert">Không xác thực được API: {error}</p>}
   <div className="ct-auth-actions">
    <button className="ct-auth-access" disabled={loading} type="button" onClick={onRetry}><RefreshCcw size={17}/>{loading?'Đang kiểm tra...':'Thử kết nối lại'}</button>
    {googleReady&&<a className="ct-auth-google" href={LOGOUT}><LogIn size={18}/> Đổi tài khoản / Đăng nhập Google</a>}
   </div>
   {googleReady&&<div className="ct-auth-hint">Nút đổi tài khoản sẽ kết thúc phiên Cloudflare Access hiện tại, sau đó đưa bạn đến màn hình chọn Google hoặc phương thức dự phòng.</div>}
   <p className="ct-auth-trust"><ShieldCheck size={15}/> Chỉ tài khoản được cấp quyền trong Cloudflare Access và D1 mới được truy cập.</p>
 </section></main>;
}
