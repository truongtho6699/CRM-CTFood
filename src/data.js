export const STORAGE_KEY = 'ctfood-crm-demo-v1';
export const MENU = [
  {section:'TỔNG QUAN',items:[['dashboard','Tổng quan'],['reports','Báo cáo kinh doanh']]},
  {section:'QUẢN LÝ KHÁCH HÀNG',items:[['customers','Khách hàng'],['leads','Khách tiềm năng'],['activities','Chăm sóc khách hàng']]},
  {section:'BÁN HÀNG',items:[['orders','Đơn hàng'],['products','Sản phẩm'],['quotes','Báo giá & phê duyệt']]},
  {section:'GIAO NHẬN & KHO',items:[['deliveries','Giao hàng & phiếu cân'],['containers','Container'],['inventory','Tồn kho']]},
  {section:'TÀI CHÍNH',items:[['payments','Phiếu thu & đặt cọc'],['receivables','Công nợ'],['profit','Giá vốn & lợi nhuận']]},
  {section:'HỆ THỐNG',items:[['kpi','Đối chiếu KPI'],['users','Người dùng & phân quyền'],['settings','Cấu hình']]},
];
export const SAMPLE = {
  customers:[
    {id:'KH001',name:'Công ty Thực phẩm Minh An',phone:'0900000001',tax:'0100000001',owner:'Nguyễn An',region:'Hà Nội',status:'Đang giao dịch',limit:900000000,term:30},
    {id:'KH002',name:'Công ty Phân phối Đại Việt',phone:'0900000002',tax:'0200000002',owner:'Trần Bình',region:'Hồ Chí Minh',status:'Đang giao dịch',limit:600000000,term:15},
    {id:'KH003',name:'Nhà hàng Hương Việt',phone:'0900000003',tax:'0300000003',owner:'Nguyễn An',region:'Hà Nội',status:'Tiềm năng',limit:0,term:0},
  ],
  products:[
    {id:'SP001',name:'Nạc vai heo đông lạnh',group:'Thịt heo',origin:'Brazil',unit:'kg'},
    {id:'SP002',name:'Móng heo sau',group:'Thịt heo',origin:'Đức',unit:'kg'},
    {id:'SP003',name:'Thịt gà đông lạnh',group:'Thịt gà',origin:'Brazil',unit:'kg'},
  ],
  orders:[
    {id:'DDH-DEMO-001',customerId:'KH001',productId:'SP001',type:'Hàng sẵn kho',quantity:27000,unitPrice:73500,status:'Giao một phần',expected:'2026-11-20',note:'Đơn dữ liệu mẫu'},
    {id:'DDH-DEMO-002',customerId:'KH002',productId:'SP002',type:'Offer',quantity:12000,unitPrice:46000,status:'Chờ giao',expected:'2026-12-03',note:'Đơn dữ liệu mẫu'},
  ],
  deliveries:[{id:'PG-DEMO-001',orderId:'DDH-DEMO-001',containerId:'CONT-DEMO-01',date:'2026-11-09',quantity:13000,status:'Đã xác nhận'}],
  containers:[{id:'CONT-DEMO-01',productId:'SP001',quantity:28000,remaining:15000,arrival:'2026-11-01',status:'Đang bán'}],
  payments:[{id:'PT-DEMO-001',customerId:'KH001',orderId:'DDH-DEMO-001',date:'2026-11-09',amount:200000000,type:'Đặt cọc'}],
  leads:[{id:'LEAD-001',name:'Cửa hàng Thực phẩm An Khang',contact:'0900000004',owner:'Nguyễn An',stage:'Đang liên hệ'}],
  activities:[{id:'ACT-001',customerId:'KH003',title:'Gọi điện giới thiệu sản phẩm',due:'2026-11-14',owner:'Nguyễn An',status:'Chưa thực hiện'}],
  quotes:[],
};
export const SCHEMAS={
 customers:{title:'Khách hàng',columns:[['id','Mã KH'],['name','Khách hàng'],['phone','Điện thoại'],['owner','Sales'],['region','Khu vực'],['status','Trạng thái']],fields:[['name','Tên khách hàng','text'],['phone','Số điện thoại','tel'],['tax','Mã số thuế','text'],['owner','Sales phụ trách','text'],['region','Khu vực','text'],['address','Địa chỉ khách hàng','text'],['status','Trạng thái','select:Đang giao dịch|Tiềm năng|Ngừng giao dịch']]},
 leads:{title:'Khách tiềm năng',columns:[['id','Mã'],['name','Tên khách'],['contact','Liên hệ'],['owner','Phụ trách'],['stage','Giai đoạn']],fields:[['name','Tên khách tiềm năng','text'],['contact','Số liên hệ','tel'],['owner','Nhân viên phụ trách','text'],['stage','Giai đoạn','select:Mới|Đang liên hệ|Đã báo giá|Chuyển đổi|Không phù hợp']]},
 activities:{title:'Chăm sóc khách hàng',columns:[['id','Mã'],['customerId','Mã KH'],['title','Nội dung'],['due','Ngày thực hiện'],['owner','Phụ trách'],['status','Trạng thái']],fields:[['customerId','Mã khách hàng','text'],['title','Nội dung chăm sóc','text'],['due','Hạn thực hiện','date'],['owner','Người phụ trách','text'],['status','Trạng thái','select:Chưa thực hiện|Đang thực hiện|Hoàn thành']]},
 products:{title:'Sản phẩm',columns:[['id','Mã SP'],['name','Tên sản phẩm'],['group','Nhóm hàng'],['origin','Xuất xứ'],['unit','Đơn vị']],fields:[['name','Tên sản phẩm','text'],['group','Nhóm hàng','select:Thịt heo|Thịt bò|Thịt gà|Thịt vịt|Khác'],['origin','Xuất xứ','text'],['unit','Đơn vị','select:kg|tấn|thùng']]},
 orders:{title:'Đơn hàng',columns:[['id','Mã đơn'],['customerId','Mã KH'],['productId','Sản phẩm'],['type','Loại đơn'],['quantity','KL dự kiến (kg)'],['unitPrice','Giá trước VAT'],['status','Trạng thái']],fields:[['customerId','Mã khách hàng','text'],['productId','Mã sản phẩm','text'],['type','Loại đơn','select:Offer|Hàng sẵn kho'],['quantity','Khối lượng dự kiến (kg)','number'],['unitPrice','Giá trước VAT (đ/kg)','number'],['expected','Ngày giao dự kiến','date'],['status','Trạng thái','select:Nháp|Chờ giao|Giao một phần|Đã giao|Hoàn tất|Đã hủy'],['note','Ghi chú','text']]},
 quotes:{title:'Báo giá & phê duyệt',columns:[['id','Mã báo giá'],['customerId','Khách hàng'],['productId','Sản phẩm'],['quantity','Khối lượng'],['unitPrice','Đơn giá'],['status','Trạng thái']],fields:[['customerId','Mã khách hàng','text'],['productId','Mã sản phẩm','text'],['quantity','Số kg','number'],['unitPrice','Đơn giá','number'],['status','Trạng thái','select:Nháp|Chờ duyệt|Đã duyệt|Từ chối']]},
 deliveries:{title:'Giao hàng & phiếu cân',columns:[['id','Mã phiếu'],['orderId','Đơn hàng'],['containerId','Container'],['date','Ngày giao'],['quantity','KL thực tế (kg)'],['status','Trạng thái']],fields:[['orderId','Mã đơn hàng','text'],['containerId','Số container','text'],['date','Ngày giao','date'],['quantity','KL cân thực tế (kg)','number'],['status','Trạng thái','select:Chờ xác nhận|Đã xác nhận|Hủy']]},
 containers:{title:'Container',columns:[['id','Số container'],['productId','Mặt hàng'],['quantity','KL nhập (kg)'],['remaining','KL còn (kg)'],['arrival','Ngày về'],['status','Trạng thái']],fields:[['id','Số container','text'],['productId','Mã sản phẩm','text'],['quantity','KL nhập (kg)','number'],['remaining','KL còn (kg)','number'],['arrival','Ngày về','date'],['status','Trạng thái','select:Đang vận chuyển|Về cảng|Đang bán|Đã hết']]},
 payments:{title:'Phiếu thu & đặt cọc',columns:[['id','Mã phiếu'],['customerId','Khách hàng'],['orderId','Mã đơn'],['date','Ngày thu'],['amount','Số tiền'],['type','Loại thu']],fields:[['customerId','Mã khách hàng','text'],['orderId','Mã đơn liên quan','text'],['date','Ngày thu','date'],['amount','Số tiền (VND)','number'],['type','Loại thu','select:Đặt cọc|Thanh toán|Hoàn tiền']]},
};
export function createSample(){return JSON.parse(JSON.stringify(SAMPLE));}
export function sum(arr,fn){return arr.reduce((a,x)=>a+(Number(fn(x))||0),0)}
export function currency(v){return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Number(v)||0)+' ₫'}
export function num(v){return new Intl.NumberFormat('vi-VN').format(Number(v)||0)}
export function paidFor(orderId,db){return sum(db.payments.filter(x=>x.orderId===orderId&&x.type!=='Hoàn tiền'),x=>x.amount)-sum(db.payments.filter(x=>x.orderId===orderId&&x.type==='Hoàn tiền'),x=>x.amount)}
export function deliveredFor(orderId,db){return sum(db.deliveries.filter(x=>x.orderId===orderId&&x.status==='Đã xác nhận'),x=>x.quantity)}
export function revenueFor(order,db){return deliveredFor(order.id,db)*Number(order.unitPrice||0)}
export function dueFor(order,db){return Math.max(0,revenueFor(order,db)-paidFor(order.id,db))}
