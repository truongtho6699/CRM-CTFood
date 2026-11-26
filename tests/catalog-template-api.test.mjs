import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});
const team='catalog-sec-test.cloudflareaccess.com',aud='catalog-sec';
function setup(){
 const db=createDatabase();
 db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('admin@ct.test','Admin','ADMIN')").run();
 db.prepare("INSERT INTO app_users(email,full_name,role) VALUES('sale@ct.test','Sales','SALES')").run();
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud}};
}
async function api(env,email,path,method='GET',body){
 const token=await new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+team).setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);
 const req=new Request('https://crm-ctfood.pages.dev'+path,{method,headers:{'Cf-Access-Jwt-Assertion':token,...(body?{'Content-Type':'application/json',Origin:'https://crm-ctfood.pages.dev'}:{})},body:body?JSON.stringify(body):undefined});
 const res=await worker.fetch(req,env);return {status:res.status,json:await res.json()};
}
test('customer template fields persist; PATCH without fields never erases them',async()=>{
 const {db,env}=setup();
 const created=await api(env,'admin@ct.test','/api/customers','POST',{name:'Đối tác A',legacy_code:'KH0001',partner_type:'SUPPLIER',email:'a@ct.test',contact_name:'Anh Trọng',contact_phone:'0961221985',source_sales_name:'HỒNG',credit_days:15});
 assert.equal(created.status,201,JSON.stringify(created.json));
 const old=db.prepare('SELECT * FROM customers WHERE id=?').get(created.json.data.id);
 const changed=await api(env,'admin@ct.test','/api/customers/'+created.json.data.id,'PATCH',{name:'Đối tác A cập nhật',expected_updated_at:old.updated_at});
 assert.equal(changed.status,200,JSON.stringify(changed.json));
 const after=db.prepare('SELECT * FROM customers WHERE id=?').get(old.id);
 assert.equal(after.legacy_code,'KH0001');assert.equal(after.contact_name,'Anh Trọng');assert.equal(after.credit_days,15);
 assert.equal(after.partner_type,'SUPPLIER');
});
test('Sales cannot change credit term even when submitting a forged value',async()=>{
 const {db,env}=setup();
 const row=db.prepare("INSERT INTO customers(id,name,owner_email,credit_days) VALUES('K1','Đối tác B','sale@ct.test',30)").run();
 const before=db.prepare("SELECT updated_at FROM customers WHERE id='K1'").get();
 const res=await api(env,'sale@ct.test','/api/customers/K1','PATCH',{name:'Đối tác B',credit_days:365,expected_updated_at:before.updated_at});
 assert.equal(res.status,200,JSON.stringify(res.json));
 assert.equal(db.prepare("SELECT credit_days FROM customers WHERE id='K1'").get().credit_days,30);
});
