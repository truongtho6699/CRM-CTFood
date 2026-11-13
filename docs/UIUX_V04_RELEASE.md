# CT FOOD CRM — Báo cáo cải tiến UI/UX V0.4

Ngày: 13/11/2026. Nguồn: Đánh giá Agent Hub (@DEV-21, @DEV-22, @DEV-24, @BIZ-05, @DATA-30) và Skill Hub (@SK-UIUX-01, @SK-UIUX-02, @SK-UIUX-04, @SK-DASH-01, @SK-DESIGN-01).

## Quyết định kiến trúc và phạm vi

- Không sửa dữ liệu thật, không nhập dữ liệu khách hàng, không thay D1, không thay hệ thống KPI hiện hữu.
- Xóa luồng hiển thị các giao dịch mẫu trong **giao diện đang hoạt động**; tệp `src/data.js` chứa mẫu cũ được giữ để tham chiếu, nhưng không được import làm dữ liệu Dashboard nữa.
- Dashboard chỉ hiển thị **số bản ghi khách hàng, khách tiềm năng và sản phẩm từ D1**, truy vấn API `GET /api/summary` đã kiểm tra vai trò. Không hiển thị doanh thu, công nợ, lợi nhuận hay sản lượng không có nguồn tin cậy.
- Tách menu 4 mục đã kết nối D1 và 4 nhóm chưa nghiệm thu; nhóm chưa nghiệm thu chỉ hiển thị hướng dẫn, không có form ghi mẫu.
- Danh sách 25 dòng/trang, tìm kiếm server-side, bộ lọc theo người sở hữu cho role SALES, giữ cơ chế Cloudflare Access.
- Giao diện mobile dùng thẻ dữ liệu, nút chạm >=43px, chỉnh typography và focus.
- Form có nút lưu trạng thái bận, lỗi trên form, xác nhận lưu từ API (`persisted=true`), rồi tải lại D1; người phụ trách lấy từ tài khoản đăng nhập thay vì nhập tự do.
- Có đăng xuất Access; màn xác thực dự phòng có nút thử lại và hướng đổi tài khoản Google thay cho điều hướng vòng lặp về chính trang đang mở.
- Mã nguồn chia thành `src/CRMApp.jsx`, `src/crm-v04.css`; `src/main.jsx` là điểm khởi chạy. Không còn tải stylesheet demo V0.3.

## Checklist nghiệm thu

| Mã | Kiểm thử | Tiêu chí | Kết quả |
|---|---|---|---|
| UX-01 | Desktop 1440px | Menu, Dashboard và bảng không tràn | Chưa kiểm thử trình duyệt |
| UX-02 | Tablet 768px | Bố cục không che nút | Chưa kiểm thử trình duyệt |
| UX-03 | Mobile 375px | Bảng thành thẻ; không cuộn ngang toàn màn | Chưa kiểm thử trình duyệt |
| UX-04 | Login Google | Qua Google Access, sau đó đúng email/role ADMIN | Chưa kiểm thử trình duyệt |
| UX-05 | Dashboard | Số liệu đếm bằng D1 cùng phạm vi quyền | Chưa kiểm thử end-to-end |
| UX-06 | Ngắt API | Không hiển thị số cũ như số mới, có lỗi rõ | Chưa kiểm thử trình duyệt |
| UX-07 | Tìm kiếm khách hàng | Server trả kết quả đúng | Chưa kiểm thử trình duyệt |
| UX-08 | Tìm kiếm lead/sản phẩm | Server trả kết quả đúng | Chưa kiểm thử trình duyệt |
| UX-09 | 25 bản ghi/trang | Nút trước/sau đúng | Chưa kiểm thử trình duyệt |
| UX-10 | Tạo mới khách hàng | API xác nhận `persisted=true`, tải lại còn dữ liệu | Chưa kiểm thử end-to-end |
| UX-11 | Sửa bản ghi | Chỉ tài khoản được quyền; audit có ghi | Chưa kiểm thử end-to-end |
| UX-12 | Bấm Lưu nhiều lần | Không tạo bản ghi lặp khi request đang chạy | Chưa kiểm thử trình duyệt |
| UX-13 | CSV | Chống giá trị bắt đầu bằng công thức Excel | Chưa kiểm thử mở trên Excel |
| UX-14 | Menu chưa nghiệm thu | Không cho lưu dữ liệu tài chính demo | Chưa kiểm thử trình duyệt |
| UX-15 | Performance | LCP <=2.5s, INP <=200ms, CLS <=0.1 | Chưa đo Web Vitals |

## Cần xác nhận

- Cloudflare Pages build/deploy commit cuối cùng `main` thành công.
- Đăng nhập bằng tài khoản ADMIN trong phiên trình duyệt và xác nhận /api/me, /api/summary, GET/POST/PATCH 3 danh mục.
- Thử trên điện thoại và thiết bị cấu hình thấp.
- Lighthouse/Web Vitals phải lấy số từ phép đo thực tế; thời gian build và dung lượng gzip không thay thế số đo người dùng.

## Hạn chế kiến trúc có chủ đích

- Chưa triển khai CRUD D1 cho đơn hàng, phiếu cân, thanh toán; cần BRD, trạng thái, kiểm soát công nợ, xác nhận giao và UAT.
- Chưa triển khai người dùng và phân quyền qua giao diện; chỉ dùng role trong D1 và Access.
- Chưa có kiểm thử truy cập thực tế cho từng vai trò trong phiên này.
