// Regression guards for the UI/UX V0.4 navigation and status improvements.
// These are static source assertions; interactive keyboard/mobile UAT remains separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('catalog and administration navigation default collapsed outside a deep link',()=>{
 const app=read('src/CRMApp.jsx');
 assert.match(app,/useState\(\(\)=>CATALOG_NAV\.some\(item=>item\.id===getRoute\(\)\)\)/);
 assert.match(app,/useState\(\(\)=>ADMIN_NAV\.some\(item=>item\.id===getRoute\(\)\)\)/);
 assert.match(app,/onClick=\{\(\)=>setCatalogOpen\(v=>!v\)\}/);
 assert.match(app,/onClick=\{\(\)=>setAdminOpen\(v=>!v\)\}/);
 assert.doesNotMatch(app,/setCatalogOpen\(v=>!v\);changePage\('catalogs'\)/);
});
test('deep links automatically reveal the active submenu and include parent breadcrumbs',()=>{
 const app=read('src/CRMApp.jsx');
 assert.match(app,/if\(CATALOG_NAV\.some\(item=>item\.id===next\)\)setCatalogOpen\(true\)/);
 assert.match(app,/if\(ADMIN_NAV\.some\(item=>item\.id===next\)\)setAdminOpen\(true\)/);
 assert.match(app,/aria-controls="ct-catalog-submenu"/);
 assert.match(app,/aria-controls="ct-admin-submenu"/);
 assert.match(app,/Quản lý danh mục \/ /);
 assert.match(app,/Quản trị hệ thống \/ /);
});
test('loading and API errors have explicit retry or status instead of silent empty state',()=>{
 const app=read('src/CRMApp.jsx');
 const dashboard=read('src/WorkDashboard.jsx');
 const catalogs=read('src/Catalogs.jsx');
 assert.match(app,/facetsError/);
 assert.match(app,/Không tải được số liệu tổng quan/);
 assert.match(dashboard,/error&&!data/);
 assert.match(dashboard,/Không tải được công việc/);
 assert.match(catalogs,/Thử tải lại/);
});
test('mobile, focus and reduced motion affordances are present',()=>{
 const css=read('src/crm-v04.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/ct-nav-parent:focus-visible/);
 assert.match(css,/max-width:390px/);
});
