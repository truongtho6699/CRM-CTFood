import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});
const origin='https://crm-ctfood.pages.dev';
const team='test-legacy.cloudflareaccess.com';
const aud='legacy-catalog';
const auth=async()=>new SignJWT({email:'admin@ct.test'}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+team).setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);
test('search on production-like D1 without migration 0008 still works and escapes SQL wildcards',async()=>{
 const db=createDatabase({upTo:'0007_payments_receivables.sql'});
 try{
  db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('admin@ct.test','Admin','ADMIN')").run();
  db.prepare("INSERT INTO customers(id,name,owner_email,phone) VALUES('KH1','Khách hàng 1','admin@ct.test','0901000001')").run();
  db.prepare("INSERT INTO customers(id,name,owner_email,phone) VALUES('KH2','Khách hàng %','admin@ct.test','0901000002')").run();
  db.prepare("INSERT INTO products(id,name,unit) VALUES('HH0018','Chân gà','kg')").run();
  const env={DB:d1(db),CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud};
  const call=async route=>{
   const res=await worker.fetch(new Request(origin+route,{headers:{'Cf-Access-Jwt-Assertion':await auth()}}),env);
   return {status:res.status,json:await res.json()};
  };
  const clients=await call('/api/customers?q=0901000001');
  assert.equal(clients.status,200,JSON.stringify(clients.json));
  assert.deepEqual(clients.json.data.map(x=>x.id),['KH1']);
  const product=await call('/api/products?q=HH0018');
  assert.equal(product.status,200);
  assert.deepEqual(product.json.data.map(x=>x.id),['HH0018']);
  const escaped=await call('/api/customers?q=%25');
  assert.deepEqual(escaped.json.data.map(x=>x.id),['KH2']);
 }finally{db.close()}
});
