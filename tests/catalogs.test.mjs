import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const ORIGIN='https://crm-ctfood.pages.dev';
const TEAM='ctfood-catalog-test.cloudflareaccess.com';
const AUD='ctfood-test-catalog';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});
async function call(env,email,path,method='GET',body){
 const jwt=await new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
 const headers={'Cf-Access-Jwt-Assertion':jwt};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=ORIGIN}
 const response=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:response.status,json:await response.json()};
}
function setup(){
 const db=createDatabase();
 for(const row of [['admin@ct.test','Quản trị','ADMIN'],['sale@ct.test','Nhân viên','SALES'],['warehouse@ct.test','Kho','LOGISTICS']]){
  db.prepare('INSERT INTO app_users(email,full_name,role) VALUES(?,?,?)').run(...row);
 }
 db.prepare("INSERT INTO products(id,name,unit) VALUES('HH0018','Chân gà','kg')").run();
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}
test('admin creates container code from CT FOOD template; quantity is zero; audit is recorded',async()=>{
 const {db,env}=setup();
 const r=await call(env,'admin@ct.test','/api/containers','POST',{id:'MEDU9856808',product_id:'HH0018',quantity_kg:9999,cost_per_kg:100});
 assert.equal(r.status,201,JSON.stringify(r.json));
 const row=db.prepare('SELECT * FROM containers WHERE id=?').get('MEDU9856808');
 assert.equal(row.product_id,'HH0018');assert.equal(row.quantity_kg,0);assert.equal(row.remaining_kg,0);assert.equal(row.cost_per_kg,null);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity='containers'").get().n,1);
});
test('duplicate codes are rejected and cannot be recorded twice',async()=>{
 const {db,env}=setup();
 const p={id:'MEDU9856808',product_id:'HH0018'};
 assert.equal((await call(env,'admin@ct.test','/api/containers','POST',p)).status,201);
 assert.equal((await call(env,'admin@ct.test','/api/containers','POST',p)).status,409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM containers').get().n,1);
});
test('unknown product, invalid container identifier and unauthorized write are blocked',async()=>{
 const {db,env}=setup();
 assert.equal((await call(env,'admin@ct.test','/api/containers','POST',{id:'MEDU9856808',product_id:'UNKNOWN'})).status,400);
 assert.equal((await call(env,'admin@ct.test','/api/containers','POST',{id:'??',product_id:'HH0018'})).status,400);
 assert.equal((await call(env,'sale@ct.test','/api/containers','POST',{id:'MEDU9856808',product_id:'HH0018'})).status,403);
 assert.equal((await call(env,'warehouse@ct.test','/api/containers','POST',{id:'MEDU9856808',product_id:'HH0018'})).status,403);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM containers').get().n,0);
});
test('all authorized roles can list container catalog but cost is hidden for sales',async()=>{
 const {db,env}=setup();
 db.prepare("INSERT INTO containers(id,product_id,quantity_kg,remaining_kg,cost_per_kg) VALUES('MEDU9856808','HH0018',2000,1500,61000)").run();
 const a=await call(env,'admin@ct.test','/api/containers?q=MEDU');
 const s=await call(env,'sale@ct.test','/api/containers?q=MEDU');
 assert.equal(a.status,200);assert.equal(s.status,200);
 assert.equal(a.json.data.length,1);assert.equal(s.json.data.length,1);
 assert.equal(a.json.data[0].cost_per_kg,61000);
 assert.ok(!('cost_per_kg' in s.json.data[0]));
});
