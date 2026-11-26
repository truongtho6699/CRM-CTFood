# CT FOOD CRM — Mapping danh mục theo template nguồn

Ngày: 26/11/2026. Source: https://docs.google.com/spreadsheets/d/1cbl_q8uxH_IlGil5XLxU2fOGrqRt9_-hP42wWZTAiuQ/edit

Phạm vi: ba tab **Mã khách hàng - NCC**, **Mã hàng hóa**, **Mã công trình**. Những cột này là dữ liệu mẫu nguồn, **không được tự ghi các ví dụ vào Production**.

## 1. Khách hàng / Nhà cung cấp

| Cột Google Sheets | Trường D1 | Quy tắc |
|---|---|---|
| STT | Không lưu | Chỉ là số thứ tự của file |
| Sale phụ trách | `customers.source_sales_name` | Giữ nguyên tên theo nguồn như “HỒNG”; `owner_email` dùng account đang nhập để phân quyền; chưa tự suy ra email từ tên |
| Mã khách hàng | `customers.legacy_code` | Mã nghiệp vụ cũ (ví dụ KH0001); duy nhất, độc lập với `customers.id` là UUID |
| Tên khách | `customers.name` | Bắt buộc |
| MST | `customers.tax_code` | TEXT, không làm mất số 0 đầu; chống trùng |
| Email | `customers.email` | Email đối tác; không phải email đăng nhập |
| Địa chỉ | `customers.address` | Địa chỉ tự do |
| Tên người liên hệ | `customers.contact_name` | Ví dụ “Anh Trọng” |
| SĐT người liên hệ | `customers.contact_phone` | TEXT, giữ số 0 đầu và dấu + |
| Công nợ | `customers.credit_days` | Nhập số ngày nguyên (ví dụ “15 ngày” => 15); chỉ ADMIN/BOD được cập nhật, **không** suy ra dư nợ tiền |

Mở rộng đề xuất ngoài template: `partner_type` CUSTOMER/SUPPLIER/BOTH vì tab gộp khách/NCC. Đây là trường thiết kế bổ sung, không có cột phân loại riêng trong mẫu nguồn.

## 2. Hàng hóa

| Cột Google Sheets | Trường D1 | Quy tắc |
|---|---|---|
| STT | Không lưu | Chỉ số thứ tự |
| Mã hàng | `products.legacy_code` | Ví dụ HH0018; duy nhất, không thay UUID/ID nội bộ |
| Tên hàng hóa | `products.name` | Bắt buộc |
| Đơn vị | `products.unit` | kg / tấn / thùng / pallet |
| Hình thức | `products.packaging_type` | Ví dụ “thùng carton”, “pallet” |
| Khối lượng quy đổi | `products.conversion_kg` và `conversion_note` | “15kg” => 15; nếu “Mã cân”, chỉ lưu `conversion_note='Mã cân'` và giữ `conversion_kg=NULL` để tránh tính sai |

Trường nhóm hàng, xuất xứ là thông tin bổ sung từ CRM hiện tại, không có trong template mẫu này.

## 3. Mã công trình (số cont)

| Cột Google Sheets | Trường D1 | Quy tắc |
|---|---|---|
| STT | Không lưu | Chỉ số thứ tự |
| Mã Công trình (số cont) | `containers.id` | Ví dụ MEDU9856808; không ghi trùng |
| Tên hàng | `containers.source_product_name` và `containers.product_id` | Giữ tên nguyên văn; chọn **một hàng đã có trong CRM** để liên kết khóa ngoại |

Mã container được tạo trong trạng thái PLANNED, `quantity_kg=0`, `remaining_kg=0`. Việc này **không xác nhận hàng đã nhập kho hoặc có giá vốn**.

## 4. Những việc đã triển khai

- `worker/migrations/0009_catalog_templates.sql`: mở rộng 10 cột danh mục và chỉ mục tránh trùng.
- `worker/src/index.js`: API lưu và đọc trường mới, xác thực vai trò, kiểm tra đầu vào, audit, chống sửa nhầm.
- `src/data.js`: form và bảng Khách hàng/NCC, Hàng hóa đúng cấu trúc nguồn.
- `src/Catalogs.jsx`: form Container lưu tên sản phẩm nguồn và liên kết mã hàng có thật.
- `tests/catalog-template-schema.test.mjs`: kiểm thử schema, mã trùng, đơn vị quy đổi không hợp lệ, trường ghi chú Mã cân.

## 5. Giới hạn và nghiệm thu còn thiếu

- Không tự động tải dữ liệu từ Google Sheets/Excel; chưa có staging, rà soát trùng, đối chiếu Sales, duyệt và rollback lô nhập.
- Chưa có quy trình phân loại nhà cung cấp tự động từ dữ liệu cũ, vì template không có trường này.
- Chưa có phép đo hay biên bản UAT của người dùng đã đăng nhập Google sau khi cập nhật.
- Danh sách chọn sản phẩm trong form Container hiện giới hạn 100 mặt hàng; khi vượt quá cần tìm kiếm server-side.
- Mã Sales nguồn không tương đương `owner_email`; trước khi import toàn bộ, cần danh sách ánh xạ tên Sales -> tài khoản D1.
- Trường công nợ là **số ngày cho phép** chứ không phải dư nợ đầu kỳ.
- Khi có file thật phải đối chiếu tổng dòng, lỗi, trùng, nguồn và người phê duyệt trước khi ghi chính thức.
