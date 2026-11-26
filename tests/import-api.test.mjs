import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const origin='https://crm-ctfood.pages.dev',team='import-test.cloudflareaccess.com',aud='imports';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});
function setup(){
 const db=createDatabase();
 for(const [email,role] of [['admin@ct.test','ADMIN'],['sale@ct.test','SALES']])db.prepare('INSERT INTO app_users(email,full_name,role) VALUES(?,?,?)').run(email,email,role);
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud}};
}
async function call(env,email,path,method='GET',body){
 const jwt=await new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+team).setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);
 const headers={'Cf-Access-Jwt-Assertion':jwt};
 if(body){headers['Content-Type']='application/json';headers.Origin=origin}
 const response=await worker.fetch(new Request(origin+path,{method,headers,body:body?JSON.stringify(body):undefined}),env);
 return {status:response.status,body:await response.json()};
}
test('ADMIN previews, commits and audits one product import; duplicate is blocked',async()=>{
 const {db,env}=setup();
 const rows=[{legacy_code:'HH0056',name:'Mỡ lưng',unit:'kg',conversion_kg:'Mã cân'}];
 const p=await call(env,'admin@ct.test','/api/imports/preview','POST',{entity:'products',rows});
 assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.ready,1);
 const saved=await call(env,'admin@ct.test','/api/imports/commit','POST',{entity:'products',rows,filename:'hanghoa.xlsx',confirm:'IMPORT'});
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal(db.prepare("SELECT conversion_note FROM products WHERE legacy_code='HH0056'").get().conversion_note,'Mã cân');
 assert.equal(db.prepare("SELECT count(*) n FROM audit_log WHERE action='IMPORT_CREATE'").get().n,1);
 const h=await call(env,'admin@ct.test','/api/imports/history');
 assert.equal(h.body.data[0].created_rows,1);
 const repeat=await call(env,'admin@ct.test','/api/imports/commit','POST',{entity:'products',rows,confirm:'IMPORT'});
 assert.equal(repeat.status,409);
 assert.equal(db.prepare('SELECT count(*) n FROM import_batches').get().n,1);
});
test('Non-admin cannot inspect or commit Excel imports',async()=>{
 const {env}=setup();
 assert.equal((await call(env,'sale@ct.test','/api/imports/history')).status,403);
 assert.equal((await call(env,'sale@ct.test','/api/imports/preview','POST',{entity:'products',rows:[{legacy_code:'HH1',name:'Test'}]})).status,403);
});
