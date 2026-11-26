import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/login.js';

test('public CT FOOD login shows two concise sign-in options',async()=>{
 const response=onRequestGet();
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/<html lang="vi">/);
 assert.match(html,/<h1>Đăng nhập<\/h1>/);
 assert.match(html,/Tên đăng nhập/);
 assert.match(html,/Mật khẩu/);
 assert.match(html,/Tiếp tục với Google/);
 assert.match(html,/https:\/\/crm-ctfood\.pages\.dev\//);
 assert.doesNotMatch(html,/<script\b|<form\b|\/api\//i);
});

test('password controls cannot submit credentials before secure backend exists',async()=>{
 const html=await onRequestGet().text();
 assert.match(html,/<input[^>]*autocomplete="username"[^>]*disabled/);
 assert.match(html,/<input[^>]*autocomplete="current-password"[^>]*disabled/);
 assert.match(html,/<button[^>]*class="btn password"[^>]*disabled/);
 assert.match(html,/User\/Password chưa kích hoạt/);
});

test('public page retains restrictive security headers',()=>{
 const response=onRequestGet();
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.match(response.headers.get('content-security-policy')||'',/default-src 'none'/);
 assert.match(response.headers.get('content-security-policy')||'',/form-action 'none'/);
 assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});
