# CT FOOD CRM — Cloudflare MVP

Ứng dụng quản lý khách hàng và bán hàng thực phẩm đông lạnh. Mã nguồn thuộc dự án CT FOOD.

## Tình trạng

**Bản tiền sản xuất (V0.4) đang chạy tại https://crm-ctfood.pages.dev**, được Cloudflare Access bảo vệ, dữ liệu lưu trên Cloudflare D1. Chỉ 3 danh mục **Khách hàng, Khách tiềm năng, Sản phẩm** đọc/ghi D1; Đơn hàng, Giao hàng, Thu tiền, Công nợ, KPI vẫn khóa cho tới khi nghiệm thu (xem `docs/UAT_D1_V02.md`). Hệ thống KPI đang vận hành độc lập, mã nguồn CRM không sửa hệ thống KPI.

- Giao diện tiếng Việt, dùng trên desktop và điện thoại.
- Các phân hệ: tổng quan, khách hàng, sản phẩm, đơn hàng, giao hàng, container, thu tiền, công nợ, báo cáo, cấu hình.
- **Chế độ xem thử** sử dụng dữ liệu giả lập lưu trong trình duyệt (localStorage), không được dùng làm dữ liệu sản xuất.
- **Chế độ máy chủ**: Cloudflare Worker + D1, API có xác thực Cloudflare Access bằng JWT và phân quyền theo vai trò. Không bật chế độ này trước khi thiết lập Access, D1, kiểm thử.
- **Không tích hợp MISA**. Kết nối KPI là việc riêng sau nghiệm thu.

## Tài liệu yêu cầu và giao diện

- Đặc tả ban đầu: https://docs.google.com/document/d/1fnmMQ5YDFvsShXuIv7ckMeWPGnq2o8Ugh8pR-leCzPM
- Báo cáo gốc: https://docs.google.com/spreadsheets/d/1ZzdiG7FahASRemrIS1YhI25pvE2JBX28u7IGe0GoRyc
- Khảo sát Sales / Review 1: https://docs.google.com/spreadsheets/d/1cbl_q8uxH_IlGil5XLxU2fOGrqRt9_-hP42wWZTAiuQ
- Thiết kế Figma: https://www.figma.com/design/ZznXmotchhivlZ05NQllXE

## Chạy thử giao diện ở máy tính

Yêu cầu Node.js 20+.

```bash
npm install
npm run dev
```

Mở http://localhost:5173 . Dữ liệu hiển thị là **dữ liệu giả lập** và nằm trong trình duyệt. Nhấn nút "Khôi phục dữ liệu mẫu" trong Cấu hình để đặt lại.

```bash
npm run build
```

Kết quả tạo trong thư mục `dist/` phù hợp Cloudflare Pages. Chưa có kết nối máy chủ trong chế độ giao diện mẫu.

## Hạ tầng production đề xuất

- Frontend: Cloudflare Pages (Vite static).
- API: Cloudflare Workers (mã trong `worker/`).
- Database: Cloudflare D1 (migrations trong `worker/migrations/`).
- Đăng nhập: Cloudflare Access (Google Workspace hoặc nhà cung cấp danh tính phù hợp), **Worker kiểm tra JWT Access bằng JWKS**, không tin header email chưa xác minh.
- Phân quyền phía máy chủ. Sales không được đọc giá vốn, lợi nhuận.
- Sao lưu, giám sát, nhật ký và đối soát bắt buộc trước production.

Xem `DEPLOYMENT.md` trước khi thiết lập môi trường. **Không tự ý trỏ dữ liệu thực hoặc triển khai production khi chưa có phê duyệt.**

## Nguyên tắc nghiệp vụ

1. Tách đơn / dòng đơn / từng lần giao; doanh số KPI theo **lượng giao đã được xác nhận**, không lấy lượng dự kiến.
2. Tiền cọc và thanh toán một phần được lưu như giao dịch, không dùng cờ "đã thanh toán" đơn giản.
3. Giá vốn theo container, hoa hồng, thuế và quy tắc chốt lãi cần Ban Giám đốc / Kế toán xác nhận.
4. Phân quyền: Sales, Trưởng phòng, Sale Admin, Kế toán, Logistics/Kho, BGĐ. Trạng thái và phạm vi từng vai trò còn đang khảo sát.
5. Mọi số liệu minh họa trong ứng dụng không phải số liệu chính thức.

## Kiểm thử

```bash
npm ci
npm test
```

Bộ test chạy các migration thật trên SQLite trong bộ nhớ (Node 22.5+) và gọi API với JWT RS256 ký tại chỗ, kiểm tra: xác thực Access, phạm vi dữ liệu của Sales, che giá vốn/hạn mức tín dụng, quyền ghi theo vai trò, chuẩn hóa trạng thái, khóa lạc quan khi hai người cùng sửa, và migration trên dữ liệu cũ.

## Dữ liệu mẫu (demo / UAT)

D1 thật có thể nạp dữ liệu mẫu để trình diễn và chạy UAT: 12 khách hàng, 8 khách tiềm năng, 10 sản phẩm, 3 việc chăm sóc. Mọi bản ghi có mã `DEMO-…` và tên gắn `[DEMO]`; mã số thuế `9999…`, điện thoại `0999…` để không trùng doanh nghiệp thật. Ba tài khoản Sales mẫu dùng đuôi `@demo.ctfood.invalid` và ở trạng thái **ngừng hoạt động**, nên không ai đăng nhập được bằng chúng.

```bash
cd worker
npx wrangler d1 execute ctfood-crm --remote --file=seeds/demo_seed.sql      # nạp (chạy lại không bị trùng)
npx wrangler d1 execute ctfood-crm --remote --file=seeds/demo_cleanup.sql   # xoá sạch trước khi nhập dữ liệu thật
```

File xoá chỉ xoá bản ghi `DEMO-…` và nhật ký sửa của chúng; khách hàng bạn tự tạo trên giao diện (mã UUID) cần xoá thủ công.

## Quy ước dữ liệu

- Trạng thái khách hàng lưu bằng mã: `ACTIVE`, `PROSPECT`, `INACTIVE`. Giai đoạn khách tiềm năng: `NEW`, `CONTACTING`, `QUOTED`, `CONVERTED`, `REJECTED`. Giao diện hiển thị nhãn tiếng Việt; API nhận cả mã lẫn nhãn và luôn lưu mã. Trigger trong D1 chặn giá trị khác.
- Mọi lệnh sửa (PATCH) phải gửi `expected_updated_at` là `updated_at` của bản ghi khi mở form. Nếu bản ghi đã bị người khác sửa, API trả 409 và không ghi đè.

## Cấu trúc

- `index.html`, `src/`: giao diện React/Vite.
- `worker/src/`: API Cloudflare Workers.
- `worker/migrations/`: mô hình dữ liệu D1.
- `docs/`: nghiệp vụ, lộ trình và danh sách quyết định cần chốt.

## An toàn

Không commit API key, Cloudflare token, dữ liệu khách hàng thật hay thông tin đăng nhập. Không đưa dữ liệu tài chính nhạy cảm vào dữ liệu demo.
