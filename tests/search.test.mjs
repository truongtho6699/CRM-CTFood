// Bước 3 UI/UX: tìm kiếm không phân biệt hoa/thường và có dấu/không dấu (migration 0008, cột search_key).
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,applyMigration,d1} from './helpers/d1.mjs';

const ORIGIN='https://crm-ctfood.pages.dev';
const TEAM='ctfood-test.cloudflareaccess.com';
const AUD='test-audience';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});
const token=email=>new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
async function call(env,path,{method='GET',body}={}){
 const headers={'Cf-Access-Jwt-Assertion':await token('admin@ct.test')};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=ORIGIN}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,json:await res.json()};
}
function setup(){
 const db=createDatabase();
 db.exec(`INSERT INTO app_users(email,full_name,role) VALUES('admin@ct.test','Admin','ADMIN');
 INSERT INTO customers(id,name,phone,owner_email,status) VALUES('K1','Nhà hàng Hương Việt','0901234567','admin@ct.test','ACTIVE'),('K2','Công ty Đại Việt','0907654321','admin@ct.test','ACTIVE');
 INSERT INTO products(id,name,category,origin) VALUES('P1','Sườn non heo','Thịt heo','Canada'),('P2','Đùi gà góc tư','Thịt gà','Mỹ');
 INSERT INTO leads(id,name,contact,owner_email,stage) VALUES('L1','Quán Bia Hơi Phố Cổ','0911','admin@ct.test','NEW');`);
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}
const ids=async(env,path)=>(await call(env,path)).json.data.map(x=>x.id);

test('gõ không dấu, viết hoa hay viết thường đều tìm ra',async()=>{
 const {env}=setup();
 for(const q of ['suon','SƯỜN','Sườn','sườn non','SUON NON'])assert.deepEqual(await ids(env,'/api/products?q='+encodeURIComponent(q)),['P1'],q);
 for(const q of ['huong viet','HƯƠNG VIỆT','nha hang'])assert.deepEqual(await ids(env,'/api/customers?q='+encodeURIComponent(q)),['K1'],q);
 assert.deepEqual(await ids(env,'/api/customers?q=dai viet'),['K2'],'đ → d');
 assert.deepEqual(await ids(env,'/api/customers?q=0907654'),['K2'],'theo số điện thoại');
 assert.deepEqual(await ids(env,'/api/products?q=ga'),['P2'],'theo nhóm hàng không dấu');
 assert.deepEqual(await ids(env,'/api/leads?q=bia hoi'),['L1']);
});

test('sửa tên qua API thì khóa tìm kiếm cập nhật theo',async()=>{
 const {env,db}=setup();
 const v=db.prepare("SELECT updated_at FROM customers WHERE id='K1'").get().updated_at;
 assert.equal((await call(env,'/api/customers/K1',{method:'PATCH',body:{name:'Nhà hàng Sông Hồng',status:'ACTIVE',expected_updated_at:v}})).status,200);
 assert.deepEqual(await ids(env,'/api/customers?q=song hong'),['K1']);
 assert.deepEqual(await ids(env,'/api/customers?q=huong viet'),[]);
});

test('tìm đơn hàng, phiếu thu theo tên khách không dấu',async()=>{
 const {env}=setup();
 const o=await call(env,'/api/orders',{method:'POST',body:{customer_id:'K1',order_type:'IN_STOCK',lines:[{product_id:'P1',contracted_kg:10,unit_price_ex_vat:1000}]}});
 assert.equal(o.status,201);
 assert.deepEqual(await ids(env,'/api/orders?q=huong'),[o.json.data.id]);
 assert.deepEqual(await ids(env,'/api/orders?q='+o.json.data.code.toLowerCase()),[o.json.data.id],'mã đơn viết thường');
});

test('migration 0008 điền khóa tìm kiếm cho dữ liệu có sẵn',()=>{
 const db=createDatabase({upTo:'0007_payments_receivables.sql'});
 db.exec("INSERT INTO app_users(email,full_name,role) VALUES('a@ct.test','A','ADMIN'); INSERT INTO customers(id,name,owner_email) VALUES('K','Chuỗi Lẩu NƯỚNG Phố','a@ct.test'); INSERT INTO products(id,name) VALUES('P','Bắp bò Ấn Độ');");
 applyMigration(db,'0008_search_keys.sql');
 assert.equal(db.prepare("SELECT search_key FROM customers WHERE id='K'").get().search_key,'chuoi lau nuong pho  ');
 assert.equal(db.prepare("SELECT search_key FROM products WHERE id='P'").get().search_key,'bap bo an do  ');
});

test('lọc khách hàng theo trạng thái, khu vực, Sales; sắp theo tên; bộ lọc theo phạm vi',async()=>{
 const {db,env}=setup();
 db.exec(`INSERT INTO app_users(email,full_name,role) VALUES('sa@ct.test','Sales A','SALES');
 UPDATE customers SET region='Hà Nội',status='PROSPECT' WHERE id='K1'; UPDATE customers SET region='Hồ Chí Minh',owner_email='sa@ct.test' WHERE id='K2';
 INSERT INTO customers(id,name,owner_email,status,region) VALUES('K3','An Khang','sa@ct.test','INACTIVE','Hà Nội');`);
 assert.deepEqual(await ids(env,'/api/customers?status=PROSPECT'),['K1']);
 assert.deepEqual((await ids(env,'/api/customers?region='+encodeURIComponent('Hà Nội'))).sort(),['K1','K3']);
 assert.deepEqual((await ids(env,'/api/customers?owner=sa@ct.test')).sort(),['K2','K3']);
 assert.deepEqual(await ids(env,'/api/customers?sort=name'),['K3','K2','K1'],'An Khang, Công ty Đại Việt, Nhà hàng...');
 assert.equal((await call(env,'/api/customers?status=VIP')).status,400);
 const f=(await call(env,'/api/customers/facets')).json.data;
 assert.deepEqual(f.regions.map(r=>[r.region,r.n]),[['Hà Nội',2],['Hồ Chí Minh',1]]);
 assert.deepEqual(f.owners.map(o=>o.email).sort(),['admin@ct.test','sa@ct.test']);
});
