-- CT FOOD CRM — DỮ LIỆU MẪU ĐỂ DEMO / UAT. KHÔNG PHẢI DỮ LIỆU THẬT.
-- Mọi bản ghi có id bắt đầu bằng 'DEMO-' và tên gắn '[DEMO]'. Tài khoản mẫu dùng đuôi @demo.ctfood.invalid,
-- ở trạng thái active=0 nên không ai đăng nhập được bằng các tài khoản này.
-- Xoá sạch bằng worker/seeds/demo_cleanup.sql.
-- Chạy:  npx wrangler d1 execute ctfood-crm --remote --file=seeds/demo_seed.sql
-- Chạy lại nhiều lần không bị trùng (INSERT OR IGNORE).

INSERT OR IGNORE INTO app_users(email,full_name,role,active) VALUES
 ('sale.an@demo.ctfood.invalid','[DEMO] Nguyễn Văn An','SALES',0),
 ('sale.binh@demo.ctfood.invalid','[DEMO] Trần Thị Bình','SALES',0),
 ('truongphong@demo.ctfood.invalid','[DEMO] Lê Hoàng Trưởng phòng','SALES_MANAGER',0);

INSERT OR IGNORE INTO products(id,name,category,origin,brand,unit,active,updated_at) VALUES
 ('DEMO-SP01','[DEMO] Nạc vai heo đông lạnh','Thịt heo','Brazil','Seara','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP02','[DEMO] Móng heo sau','Thịt heo','Đức','Tönnies','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP03','[DEMO] Ba rọi heo rút sườn','Thịt heo','Tây Ban Nha','Vall Companys','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP04','[DEMO] Sườn non heo','Thịt heo','Canada','Olymel','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP05','[DEMO] Đùi gà góc tư','Thịt gà','Mỹ','Tyson','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP06','[DEMO] Cánh gà khúc giữa','Thịt gà','Brazil','BRF','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP07','[DEMO] Thăn ngoại bò','Thịt bò','Úc','JBS','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP08','[DEMO] Bắp bò','Thịt bò','Ấn Độ','Allana','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP09','[DEMO] Vịt nguyên con','Thịt vịt','Ba Lan','Drosed','kg',1,'2026-11-26T03:00:00.000Z'),
 ('DEMO-SP10','[DEMO] Lưỡi bò','Thịt bò','Mỹ','Cargill','kg',0,'2026-11-26T03:00:00.000Z');

-- Mã số thuế bắt đầu 9999 và số điện thoại 0999 để không trùng doanh nghiệp/thuê bao thật.
INSERT OR IGNORE INTO customers(id,name,tax_code,phone,email,address,region,owner_email,credit_limit,credit_days,status,updated_at) VALUES
 ('DEMO-KH01','[DEMO] Công ty TNHH Thực phẩm Minh An','9999000001','0999000001','muahang@minhan.demo.invalid','12 Lê Văn Lương, Thanh Xuân','Hà Nội','sale.an@demo.ctfood.invalid',900000000,30,'ACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH02','[DEMO] Công ty CP Phân phối Đại Việt','9999000002','0999000002',NULL,'45 Nguyễn Văn Linh, Quận 7','Hồ Chí Minh','sale.binh@demo.ctfood.invalid',600000000,15,'ACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH03','[DEMO] Nhà hàng Hương Việt','9999000003','0999000003',NULL,'8 Hàng Buồm, Hoàn Kiếm','Hà Nội','sale.an@demo.ctfood.invalid',0,0,'PROSPECT','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH04','[DEMO] Bếp ăn công nghiệp Sao Mai','9999000004','0999000004',NULL,'KCN Quang Minh, Mê Linh','Hà Nội','sale.an@demo.ctfood.invalid',300000000,15,'ACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH05','[DEMO] Chuỗi lẩu Nướng Phố','9999000005','0999000005',NULL,'102 Võ Văn Tần, Quận 3','Hồ Chí Minh','sale.binh@demo.ctfood.invalid',450000000,30,'ACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH06','[DEMO] Đại lý thực phẩm Hải Phòng Xanh','9999000006','0999000006',NULL,'20 Lạch Tray, Ngô Quyền','Hải Phòng','truongphong@demo.ctfood.invalid',200000000,7,'ACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH07','[DEMO] Cơ sở chế biến xúc xích Phú Gia','9999000007','0999000007',NULL,'Đường 22, Đức Hòa','Long An','sale.binh@demo.ctfood.invalid',0,0,'INACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH08','[DEMO] Siêu thị mini Gia Đình','9999000008','0999000008',NULL,'56 Trần Phú, Hải Châu','Đà Nẵng','truongphong@demo.ctfood.invalid',150000000,15,'ACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH09','[DEMO] Khách sạn Biển Xanh','9999000009','0999000009',NULL,'Trần Phú, Lộc Thọ','Khánh Hòa','sale.binh@demo.ctfood.invalid',0,0,'PROSPECT','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH10','[DEMO] Công ty TNHH Suất ăn Bình Minh','9999000010','0999000010',NULL,'KCN Tiên Sơn, Từ Sơn','Bắc Ninh','sale.an@demo.ctfood.invalid',350000000,30,'ACTIVE','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH11','[DEMO] Quán cơm Tấm Sài Gòn','9999000011','0999000011',NULL,'15 Phan Xích Long, Phú Nhuận','Hồ Chí Minh','truongtho53@gmail.com',0,0,'PROSPECT','2026-11-26T03:00:00.000Z'),
 ('DEMO-KH12','[DEMO] Nhà phân phối Cần Thơ Phát','9999000012','0999000012',NULL,'30 Đường 3/2, Ninh Kiều','Cần Thơ','truongtho53@gmail.com',250000000,15,'ACTIVE','2026-11-26T03:00:00.000Z');

INSERT OR IGNORE INTO leads(id,name,contact,owner_email,stage,updated_at) VALUES
 ('DEMO-LD01','[DEMO] Cửa hàng thực phẩm An Khang','0999100001','sale.an@demo.ctfood.invalid','NEW','2026-11-26T03:00:00.000Z'),
 ('DEMO-LD02','[DEMO] Nhà hàng BBQ Hàn Quốc Seoul','0999100002','sale.binh@demo.ctfood.invalid','CONTACTING','2026-11-26T03:00:00.000Z'),
 ('DEMO-LD03','[DEMO] Trường mầm non Hoa Sen (bếp ăn)','0999100003','sale.an@demo.ctfood.invalid','QUOTED','2026-11-26T03:00:00.000Z'),
 ('DEMO-LD04','[DEMO] Chuỗi cơm gà Hội An','0999100004','truongphong@demo.ctfood.invalid','CONTACTING','2026-11-26T03:00:00.000Z'),
 ('DEMO-LD05','[DEMO] Xưởng chế biến chả lụa Thủ Đức','0999100005','sale.binh@demo.ctfood.invalid','CONVERTED','2026-11-26T03:00:00.000Z'),
 ('DEMO-LD06','[DEMO] Quán nhậu Bia Hơi Phố Cổ','0999100006','sale.an@demo.ctfood.invalid','REJECTED','2026-11-26T03:00:00.000Z'),
 ('DEMO-LD07','[DEMO] Resort Mũi Né','0999100007','truongtho53@gmail.com','NEW','2026-11-26T03:00:00.000Z'),
 ('DEMO-LD08','[DEMO] Đại lý Thái Nguyên Food','0999100008','truongtho53@gmail.com','QUOTED','2026-11-26T03:00:00.000Z');

INSERT OR IGNORE INTO activities(id,customer_id,title,due_date,owner_email,status) VALUES
 ('DEMO-CS01','DEMO-KH03','[DEMO] Gọi điện giới thiệu bảng giá tháng 12','2026-11-28','sale.an@demo.ctfood.invalid','PENDING'),
 ('DEMO-CS02','DEMO-KH05','[DEMO] Gửi mẫu sườn non cho bếp trưởng','2026-11-30','sale.binh@demo.ctfood.invalid','PENDING'),
 ('DEMO-CS03','DEMO-KH01','[DEMO] Đối chiếu công nợ tháng 11','2026-12-02','sale.an@demo.ctfood.invalid','DONE');

-- Đơn hàng mẫu (cần migration 0005). Trạng thái theo Lưu đồ: PENDING / SUCCESS / CANCELLED.
INSERT OR IGNORE INTO orders(id,code,customer_id,sales_email,order_type,status,expected_date,delivery_address,note,deposit_expected,container_count,created_by,status_note,status_by,status_at,created_at,updated_at) VALUES
 ('DEMO-DH01','DEMO-DH01','DEMO-KH01','sale.an@demo.ctfood.invalid','IN_STOCK','PENDING','2026-12-03','Kho Minh An, Thanh Xuân','[DEMO] Giao 2 đợt',200000000,1,'sale.an@demo.ctfood.invalid',NULL,NULL,NULL,'2026-11-20 02:00:00','2026-11-26T03:00:00.000Z'),
 ('DEMO-DH02','DEMO-DH02','DEMO-KH02','sale.binh@demo.ctfood.invalid','OFFER','PENDING','2026-12-20','Kho Đại Việt, Quận 7','[DEMO] Offer chờ lịch tàu',150000000,2,'sale.binh@demo.ctfood.invalid',NULL,NULL,NULL,'2026-11-21 02:00:00','2026-11-26T03:00:00.000Z'),
 ('DEMO-DH03','DEMO-DH03','DEMO-KH05','sale.binh@demo.ctfood.invalid','IN_STOCK','PENDING','2026-11-15','102 Võ Văn Tần, Quận 3','[DEMO] Đã giao đủ',0,0,'sale.binh@demo.ctfood.invalid',NULL,NULL,NULL,'2026-11-10 02:00:00','2026-11-26T03:00:00.000Z'),
 ('DEMO-DH04','DEMO-DH04','DEMO-KH04','sale.an@demo.ctfood.invalid','OFFER','PENDING','2026-11-30','KCN Quang Minh','[DEMO] Khách đổi kế hoạch',0,1,'sale.an@demo.ctfood.invalid',NULL,NULL,NULL,'2026-11-12 02:00:00','2026-11-26T03:00:00.000Z'),
 ('DEMO-DH05','DEMO-DH05','DEMO-KH12','truongtho53@gmail.com','IN_STOCK','PENDING','2026-12-08','30 Đường 3/2, Ninh Kiều','[DEMO] Đơn do ADMIN phụ trách',100000000,1,'truongtho53@gmail.com',NULL,NULL,NULL,'2026-11-25 02:00:00','2026-11-26T03:00:00.000Z');
-- Trigger chỉ cho chèn dòng hàng khi đơn còn PENDING: tạo mọi đơn PENDING, chèn dòng, rồi mới chốt DH03/DH04.
-- Chỉ chèn dòng còn thiếu của đơn PENDING để chạy lại file không vướng trigger khóa đơn đã chốt.
INSERT INTO order_lines(id,order_id,product_id,contracted_kg,unit_price_ex_vat,discount_per_kg,vat_rate,commission_per_kg)
 SELECT v.column1,v.column2,v.column3,v.column4,v.column5,0,0,v.column6 FROM (VALUES
 ('DEMO-DL01','DEMO-DH01','DEMO-SP01',27000,73500,500),
 ('DEMO-DL02','DEMO-DH01','DEMO-SP04',3000,98000,0),
 ('DEMO-DL03','DEMO-DH02','DEMO-SP05',54000,42000,300),
 ('DEMO-DL04','DEMO-DH03','DEMO-SP04',1200,102000,500),
 ('DEMO-DL05','DEMO-DH04','DEMO-SP02',12000,46000,0),
 ('DEMO-DL06','DEMO-DH05','DEMO-SP06',8000,61000,0),
 ('DEMO-DL07','DEMO-DH05','DEMO-SP07',500,215000,2000)) v
 JOIN orders o ON o.id=v.column2 AND o.status='PENDING'
 WHERE NOT EXISTS(SELECT 1 FROM order_lines x WHERE x.id=v.column1);
UPDATE orders SET status='SUCCESS',status_note='Đã giao đủ theo phiếu cân',status_by='truongphong@demo.ctfood.invalid',status_at='2026-11-16T03:00:00.000Z'
 WHERE id='DEMO-DH03' AND status='PENDING';
UPDATE orders SET status='CANCELLED',status_note='Khách hoãn mua sang quý sau',status_by='truongphong@demo.ctfood.invalid',status_at='2026-11-18T03:00:00.000Z'
 WHERE id='DEMO-DH04' AND status='PENDING';
