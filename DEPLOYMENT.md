# Kế hoạch triển khai Cloudflare — chưa thực hiện

## 1. Trạng thái hiện tại

Đã chuẩn bị mã nguồn, **chưa triển khai Cloudflare Pages / Worker / D1 và chưa tạo dữ liệu thật**. Không sử dụng MISA. Hệ thống KPI cũ độc lập.

## 2. Giao diện thử nghiệm (Cloudflare Pages)

1. Trên Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Chọn repository `truongtho6699/CRM-CTFood`.
3. Framework preset: Vite, Build command: `npm run build`, Build output directory: `dist`.
4. Để **Preview** trước; không gắn tên miền production hay tải dữ liệu thật.
5. Đây là frontend DEMO dùng localStorage. **Không sử dụng để quản trị khách hàng thực** vì dữ liệu lưu trên máy người dùng, không đồng bộ và không có xác thực.

## 3. Backend Cloudflare Worker + D1 (giai đoạn kế tiếp)

1. Tạo Cloudflare D1 database tên `ctfood-crm`. Ghi lại **database ID thật**.
2. Cập nhật duy nhất `worker/wrangler.toml` ở trường `database_id`.
3. Trong thư mục `worker/`, chạy `npm install` và `npx wrangler d1 migrations apply ctfood-crm --local` để chạy thử cục bộ.
4. Bắt buộc thiết lập ứng dụng Cloudflare Access cho đường dẫn API và chính sách chỉ cho phép nhân viên CT FOOD được duyệt.
5. Đặt secret `CF_ACCESS_TEAM_DOMAIN` (ví dụ `company.cloudflareaccess.com`) và `CF_ACCESS_AUD` (Application Audience Tag) bằng `npx wrangler secret put ...`.
6. Worker kiểm tra JWT Access bằng khoá công khai, xác nhận issuer và audience. **Không chấp nhận email do trình duyệt tự gửi**.
7. Tạo tài khoản quản trị đầu tiên bằng lệnh SQL có kiểm soát sau khi đối chiếu email Access thực. Không commit dữ liệu người dùng.
8. Chạy migration D1 remote và triển khai Worker chỉ khi nghiệm thu, cấu hình bảo vệ truy cập và bản sao lưu đạt yêu cầu.

## 4. Checklist bảo mật trước production

- [ ] Cloudflare Access bảo vệ toàn bộ API và địa chỉ Worker.
- [ ] JWT được xác minh, không dựa vào header email giả mạo.
- [ ] Phân quyền theo vai trò và phạm vi khách hàng tại API.
- [ ] Sales không nhận bất kỳ giá vốn/lợi nhuận từ response.
- [ ] Kiểm thử nghiệp vụ đơn giao nhiều lần và payment allocations.
- [ ] Các dữ liệu tiền, khối lượng phải dùng cơ chế tính chính xác phù hợp, không dùng số thực dấu phẩy động cho sổ kế toán thật.
- [ ] Xử lý concurrency, audit, backup và restore.
- [ ] Chốt quy tắc VAT, công nợ, lãi gộp và khóa sổ cùng kế toán.
- [ ] Không đưa dữ liệu khách hàng, API tokens hoặc secret vào GitHub.
- [ ] Không phát hành production trước khi BGĐ/đội triển khai phê duyệt.

## 5. Các điều kiện kỹ thuật phải hoàn tất

Chế độ DEMO frontend và API Worker là **hai khối độc lập** ở V0.1. API mới có các tài nguyên đọc an toàn, chưa tích hợp vào form của giao diện. Các quy trình tạo đơn nhiều dòng, xác nhận giao, tính công nợ chuẩn, phân bổ thu tiền, giá vốn và KPI phải hoàn thiện và kiểm thử ở các đợt tiếp theo. Không coi mã nguồn V0.1 là ERP hoặc phần mềm kế toán hoàn chỉnh.
