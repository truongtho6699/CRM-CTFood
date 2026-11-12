# CT FOOD CRM — Cloudflare MVP

Ứng dụng quản lý khách hàng và bán hàng thực phẩm đông lạnh. Mã nguồn thuộc dự án CT FOOD.

## Tình trạng

**Bản V0.1 (dự thảo kỹ thuật / chưa triển khai production)**. Chỉ hệ thống KPI là đang vận hành; mã nguồn CRM mới không sửa hệ thống KPI.

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

## Cấu trúc

- `index.html`, `src/`: giao diện React/Vite.
- `worker/src/`: API Cloudflare Workers.
- `worker/migrations/`: mô hình dữ liệu D1.
- `docs/`: nghiệp vụ, lộ trình và danh sách quyết định cần chốt.

## An toàn

Không commit API key, Cloudflare token, dữ liệu khách hàng thật hay thông tin đăng nhập. Không đưa dữ liệu tài chính nhạy cảm vào dữ liệu demo.
