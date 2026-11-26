// FIN-01 / KPI-01: phiếu thu, phân bổ, công nợ, tuổi nợ và báo cáo doanh số từ số kg đã xác nhận.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createWorker} from '../worker/src/index.js';
import {createDatabase,d1} from './helpers/d1.mjs';

const ORIGIN='https://crm-ctfood.pages.dev';
const TEAM='ctfood-test.cloudflareaccess.com';
const AUD='test-audience';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const worker=createWorker({getKeys:()=>publicKey});

// Dữ liệu: KH-A (Sales A, hạn nợ 30 ngày), KH-B (Sales B, 15 ngày).
// O-A1: 2 dòng, giao xác nhận 10.000 kg × 70.000 (2026-01-10) + 500 kg × 100.000 (2026-01-12) = 750.000.000 đ; 1 phiếu chờ 999 kg (không tính).
// O-A2: chưa giao. O-B1: giao xác nhận 2.000 kg × 50.000 (2026-02-03) = 100.000.000 đ. O-X: đơn hủy.
function setup(){
 const db=createDatabase();
 const u=db.prepare('INSERT INTO app_users(email,full_name,role,active) VALUES(?,?,?,?)');
 for(const [e,r] of [['admin@ct.test','ADMIN'],['salea@ct.test','SALES'],['saleb@ct.test','SALES'],['tpkd@ct.test','SALES_MANAGER'],['sadmin@ct.test','SALES_ADMIN'],['kt@ct.test','ACCOUNTING'],['kho@ct.test','LOGISTICS'],['bod@ct.test','BOD']])u.run(e,e.split('@')[0]+' name',r,1);
 db.exec(`INSERT INTO customers(id,name,owner_email,status,credit_days) VALUES('KH-A','Khách A','salea@ct.test','ACTIVE',30),('KH-B','Khách B','saleb@ct.test','ACTIVE',15);
 INSERT INTO products(id,name,unit) VALUES('SP1','Nạc vai','kg'),('SP2','Sườn','kg');
 INSERT INTO orders(id,code,customer_id,sales_email,order_type,status,updated_at) VALUES
  ('O-A1','DH2601-0001','KH-A','salea@ct.test','IN_STOCK','PENDING','v'),('O-A2','DH2601-0002','KH-A','salea@ct.test','OFFER','PENDING','v'),
  ('O-B1','DH2602-0001','KH-B','saleb@ct.test','IN_STOCK','PENDING','v'),('O-X','DH2602-0002','KH-A','salea@ct.test','IN_STOCK','PENDING','v');
 INSERT INTO order_lines(id,order_id,product_id,contracted_kg,unit_price_ex_vat,commission_per_kg) VALUES
  ('L1','O-A1','SP1',10000,70000,500),('L2','O-A1','SP2',600,100000,0),('L3','O-A2','SP1',5000,72000,0),('L4','O-B1','SP2',2000,50000,1000),('L5','O-X','SP1',100,1000,0);
 INSERT INTO deliveries(id,order_line_id,delivered_kg,delivery_date,status) VALUES
  ('D1','L1',10000,'2026-01-10','VERIFIED'),('D2','L2',500,'2026-01-12','VERIFIED'),('D3','L2',999,'2026-01-13','PENDING'),('D4','L4',2000,'2026-02-03','VERIFIED'),('D5','L5',100,'2026-02-04','VERIFIED');
 UPDATE orders SET status='CANCELLED',status_note='test' WHERE id='O-X';`);
 return {db,env:{DB:d1(db),CF_ACCESS_TEAM_DOMAIN:TEAM,CF_ACCESS_AUD:AUD}};
}
const token=email=>new SignJWT({email}).setProtectedHeader({alg:'RS256'}).setIssuer('https://'+TEAM).setAudience(AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
async function call(env,email,path,{method='GET',body}={}){
 const headers={'Cf-Access-Jwt-Assertion':await token(email)};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=ORIGIN}
 const res=await worker.fetch(new Request(ORIGIN+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,json:await res.json()};
}
const pay=(extra={})=>({customer_id:'KH-A',payment_type:'PAYMENT',method:'BANK',amount:500000000,payment_date:'2026-01-20',reference:'UNC-001',...extra});
const recv=async(env,email,q='')=>(await call(env,email,'/api/receivables'+q)).json;
const row=(r,id)=>r.data.find(x=>x.order_id===id);

test('chỉ Kế toán/ADMIN lập phiếu thu; Kho không xem được tài chính',async()=>{
 const {env}=setup();
 for(const e of ['kt@ct.test','admin@ct.test'])assert.equal((await call(env,e,'/api/payments',{method:'POST',body:pay({amount:1000})})).status,201,e);
 for(const e of ['salea@ct.test','tpkd@ct.test','sadmin@ct.test','bod@ct.test'])assert.equal((await call(env,e,'/api/payments',{method:'POST',body:pay()})).status,403,e);
 for(const p of ['/api/payments','/api/receivables','/api/reports/sales'])assert.equal((await call(env,'kho@ct.test',p)).status,403,p);
});

test('công nợ = giá trị giao đã xác nhận − tiền đã phân bổ; hạn = ngày giao cuối + số ngày nợ; tính quá hạn',async()=>{
 const {env}=setup();
 const r0=await recv(env,'kt@ct.test');
 assert.equal(row(r0,'O-A1').delivered_value,750000000,'phiếu chờ xác nhận không tính');
 assert.equal(row(r0,'O-A1').due_date,'2026-02-11');
 assert.ok(row(r0,'O-A1').overdue_days>0);
 assert.equal(row(r0,'O-X'),undefined,'đơn hủy không tính công nợ');
 assert.equal(row(r0,'O-A2'),undefined,'đơn chưa giao, chưa thu không hiện');
 const c=await call(env,'kt@ct.test','/api/payments',{method:'POST',body:pay({allocations:[{order_id:'O-A1',amount:500000000}]})});
 assert.equal(c.status,201,JSON.stringify(c.json));
 const r1=await recv(env,'kt@ct.test');
 assert.deepEqual([row(r1,'O-A1').paid,row(r1,'O-A1').balance],[500000000,250000000]);
 assert.equal(r1.totals.balance,250000000+100000000);
 assert.equal(r1.totals.overdue_orders,2);
});

test('đặt cọc trước khi giao: đơn có số dư âm (khách trả trước); tiền chưa phân bổ hiện là tiền dư của khách',async()=>{
 const {env}=setup();
 await call(env,'kt@ct.test','/api/payments',{method:'POST',body:pay({payment_type:'DEPOSIT',amount:300000000,allocations:[{order_id:'O-A2',amount:200000000}]})});
 const r=await recv(env,'kt@ct.test');
 assert.equal(row(r,'O-A2').balance,-200000000);
 assert.equal(row(r,'O-A2').due_date,null);
 assert.deepEqual(r.credits.map(c=>[c.customer_id,c.unallocated]),[['KH-A',100000000]]);
 assert.equal(r.totals.unallocated,100000000);
});

test('dữ liệu phiếu thu sai bị từ chối',async()=>{
 const {db,env}=setup();
 const cases=[
  pay({amount:1000.5}),pay({amount:0}),pay({payment_type:'REFUND'}),pay({method:'CRYPTO'}),pay({payment_date:'20/01/2026'}),pay({customer_id:'KHONG'}),
  pay({amount:100,allocations:[{order_id:'O-A1',amount:101}]}),
  pay({allocations:[{order_id:'O-B1',amount:1000}]}),
  pay({allocations:[{order_id:'O-X',amount:1000}]}),
  pay({allocations:[{order_id:'O-A1',amount:1000},{order_id:'O-A1',amount:1000}]}),
 ];
 for(const body of cases)assert.equal((await call(env,'kt@ct.test','/api/payments',{method:'POST',body})).status,400,JSON.stringify(body));
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n,0);
});

test('phân bổ lại có khóa lạc quan; hủy phiếu bắt buộc lý do và không còn tính vào đã thu',async()=>{
 const {db,env}=setup();
 const c=(await call(env,'kt@ct.test','/api/payments',{method:'POST',body:pay({allocations:[{order_id:'O-A1',amount:400000000}]})})).json.data;
 const a=await call(env,'kt@ct.test','/api/payments/'+c.id+'/allocations',{method:'PUT',body:{allocations:[{order_id:'O-A1',amount:300000000},{order_id:'O-A2',amount:200000000}],expected_updated_at:c.updated_at}});
 assert.equal(a.status,200,JSON.stringify(a.json));
 assert.equal((await call(env,'kt@ct.test','/api/payments/'+c.id+'/allocations',{method:'PUT',body:{allocations:[],expected_updated_at:c.updated_at}})).status,409);
 const d=(await call(env,'kt@ct.test','/api/payments/'+c.id)).json.data;
 assert.deepEqual(d.allocations.map(x=>[x.code,x.amount]),[['DH2601-0001',300000000],['DH2601-0002',200000000]]);
 assert.equal((await call(env,'kt@ct.test','/api/payments/'+c.id+'/void',{method:'POST',body:{note:' ',expected_updated_at:a.json.data.updated_at}})).status,400);
 assert.equal((await call(env,'kt@ct.test','/api/payments/'+c.id+'/void',{method:'POST',body:{note:'Nhập trùng',expected_updated_at:a.json.data.updated_at}})).status,200);
 assert.equal(row(await recv(env,'kt@ct.test'),'O-A1').paid,0);
 const v=db.prepare('SELECT updated_at FROM payments WHERE id=?').get(c.id).updated_at;
 assert.equal((await call(env,'kt@ct.test','/api/payments/'+c.id+'/allocations',{method:'PUT',body:{allocations:[],expected_updated_at:v}})).status,409);
 const acts=db.prepare("SELECT action FROM audit_log WHERE entity='payments' AND entity_id=? ORDER BY rowid").all(c.id).map(x=>x.action);
 assert.deepEqual(acts,['CREATE','ALLOCATE','VOID']);
});

test('ràng buộc DB: tiền phải là số nguyên, tổng phân bổ không vượt phiếu, không sửa số tiền phiếu',async()=>{
 const {db,env}=setup();
 assert.throws(()=>db.prepare("INSERT INTO payments(id,customer_id,amount,payment_date,payment_type,created_by) VALUES('p1','KH-A',10.5,'2026-01-01','PAYMENT','kt@ct.test')").run(),/ctfood_money_integer/);
 const c=(await call(env,'kt@ct.test','/api/payments',{method:'POST',body:pay({amount:1000})})).json.data;
 assert.throws(()=>db.prepare("INSERT INTO payment_allocations(id,payment_id,order_id,amount) VALUES('x',?,'O-A1',1001)").run(c.id),/ctfood_allocation_exceeds_payment/);
 assert.throws(()=>db.prepare("UPDATE payments SET amount=2000 WHERE id=?").run(c.id),/ctfood_payment_locked/);
});

test('Sales chỉ thấy công nợ, phiếu thu, báo cáo của mình',async()=>{
 const {env}=setup();
 await call(env,'kt@ct.test','/api/payments',{method:'POST',body:pay({customer_id:'KH-B',allocations:[{order_id:'O-B1',amount:1000}]})});
 const ra=await recv(env,'salea@ct.test');
 assert.deepEqual(ra.data.map(x=>x.order_id),['O-A1']);
 assert.equal((await call(env,'salea@ct.test','/api/payments')).json.data.length,0);
 assert.equal((await call(env,'saleb@ct.test','/api/payments')).json.data.length,1);
 const rep=(await call(env,'salea@ct.test','/api/reports/sales?from=2026-01&to=2026-12')).json.data;
 assert.deepEqual(rep.by_sales.map(x=>x.key),['salea@ct.test']);
});

test('báo cáo doanh số: chỉ phiếu đã xác nhận, bỏ đơn hủy, đúng theo tháng/Sales/sản phẩm, hoa hồng',async()=>{
 const {env}=setup();
 const r=(await call(env,'tpkd@ct.test','/api/reports/sales?from=2026-01&to=2026-02')).json.data;
 assert.deepEqual(r.totals,{kg:12500,revenue:850000000,commission:7000000,orders:2});
 assert.deepEqual(r.by_month.map(m=>[m.key,m.revenue]),[['2026-01',750000000],['2026-02',100000000]]);
 assert.deepEqual(r.by_sales.map(s=>[s.key,s.kg,s.commission]),[['salea@ct.test',10500,5000000],['saleb@ct.test',2000,2000000]]);
 assert.deepEqual(r.by_product.map(p=>p.key),['SP1','SP2']);
 const jan=(await call(env,'tpkd@ct.test','/api/reports/sales?from=2026-01&to=2026-01')).json.data;
 assert.equal(jan.totals.revenue,750000000);
 assert.equal(r.receivables.find(x=>x.key==='salea@ct.test').overdue_ratio,100);
});

test('không hủy được đơn đã có tiền phân bổ',async()=>{
 const {db,env}=setup();
 await call(env,'kt@ct.test','/api/payments',{method:'POST',body:pay({payment_type:'DEPOSIT',allocations:[{order_id:'O-A2',amount:1000}]})});
 const v=db.prepare("SELECT updated_at FROM orders WHERE id='O-A2'").get().updated_at;
 const r=await call(env,'tpkd@ct.test','/api/orders/O-A2/status',{method:'POST',body:{status:'CANCELLED',note:'Khách hủy',expected_updated_at:v}});
 assert.equal(r.status,409);
 assert.match(r.json.error,/gỡ phân bổ/);
});
