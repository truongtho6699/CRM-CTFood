import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';

const env={
 DB:{},
 CF_ACCESS_TEAM_DOMAIN:'test-access.cloudflareaccess.com',
 CF_ACCESS_AUD:'test-audience'
};

async function call(path,method='GET'){
 return worker.fetch(new Request('https://crm-ctfood.pages.dev'+path,{method,headers:method==='POST'?{'Content-Type':'application/json','Origin':'https://crm-ctfood.pages.dev'}:{},body:method==='POST'?JSON.stringify({name:'UAT TEST'}):undefined}),env);
}

test('unauthenticated users cannot read their CRM account',async()=>{
 const response=await call('/api/me');
 assert.equal(response.status,401);
 const json=await response.json();
 assert.equal(json.ok,false);
});

test('unauthenticated users cannot read CRM customer data',async()=>{
 const response=await call('/api/customers');
 assert.equal(response.status,401);
});

test('unauthenticated users cannot write data to D1',async()=>{
 const response=await call('/api/customers','POST');
 assert.equal(response.status,401);
});

test('cross-origin preflight is not enabled',async()=>{
 const response=await call('/api/customers','OPTIONS');
 assert.equal(response.status,405);
});

test('unknown API paths do not leak data',async()=>{
 const response=await call('/unknown-path');
 assert.equal(response.status,404);
});
