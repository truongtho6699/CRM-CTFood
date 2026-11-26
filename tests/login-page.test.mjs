import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/login.js';

test('public sign-in serves a self-contained Vietnamese page without loading private CRM assets',async()=>{
 const response=onRequestGet();
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/<html lang="vi">/);
 assert.match(html,/<h1>Đăng nhập<\/h1>/);
 assert.match(html,/Tên đăng nhập hoặc email/);
 assert.match(html,/Tiếp tục với Google/);
 assert.match(html,/https:\/\/crm-ctfood\.pages\.dev\//);
 assert.doesNotMatch(html,/<script\b|<form\b|\/api\//i);
 assert.doesNotMatch(html,/type=["']password["'][^>]*\s(?!disabled)(?:required|autofocus)\b/i);
});

test('user-password fields remain disabled until a real backend authenticator is approved',async()=>{
 const html=await onRequestGet().text();
 assert.match(html,/<input[^>]*autocomplete="username"[^>]*disabled/);
 assert.match(html,/<input[^>]*autocomplete="current-password"[^>]*disabled/);
 assert.match(html,/<button[^>]*class="btn password"[^>]*disabled/);
});

test('public sign-in uses restrictive security headers',()=>{
 const response=onRequestGet();
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.match(response.headers.get('content-security-policy')||'',/default-src 'none'/);
 assert.match(response.headers.get('content-security-policy')||'',/form-action 'none'/);
 assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});
