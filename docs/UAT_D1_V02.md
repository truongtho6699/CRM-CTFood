# UAT — CT FOOD CRM V0.2 (Cloudflare Access + D1)

> Trạng thái: **Chưa nghiệm thu end-to-end trong phiên đăng nhập trình duyệt**.
> Đối tượng: Quản trị viên CT FOOD. Môi trường: https://crm-ctfood.pages.dev
> Không dùng tên, số điện thoại, mã số thuế, hợp đồng hay dữ liệu tài chính thật.

## Điều kiện trước khi kiểm thử

- Đăng nhập qua Cloudflare Access với tài khoản đã được cho phép.
- D1 `ctfood-crm` đã được ràng buộc vào Pages Functions.
- Màn hình phải hiển thị **D1 KẾT NỐI · 3 DANH MỤC**.
- Chỉ các chức năng **Khách hàng, Sản phẩm, Khách tiềm năng** được ghi D1.
- Các phân hệ **Đơn hàng, Phiếu cân, Thu tiền, Công nợ** vẫn là demo và **không được dùng cho vận hành thật**.

## Kịch bản kiểm thử

| Mã | Kịch bản | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| UAT-01 | Truy cập chưa đăng nhập | Cloudflare Access yêu cầu xác thực | Chưa chạy |
| UAT-02 | Đăng nhập tài khoản quản trị được cấp quyền | Hiển thị D1 KẾT NỐI | Chưa chạy |
| UAT-03 | Thêm khách hàng có tên giả lập `UAT KH 001` | Trả về thành công, dữ liệu có ID từ D1 | Chưa chạy |
| UAT-04 | Tải lại trang / mở bằng thiết bị khác với cùng quyền | Khách hàng còn tồn tại và không bị trùng | Chưa chạy |
| UAT-05 | Sửa số điện thoại khách hàng thử | Đọc lại thấy dữ liệu mới, `audit_log` có hành động UPDATE | Chưa chạy |
| UAT-06 | Nhập 2 khách hàng có mã số thuế giả giống nhau | Hệ thống ngăn trùng và báo lỗi, không ghi nhầm | Chưa chạy |
| UAT-07 | Tạo/sửa sản phẩm giả lập | Dữ liệu duy trì sau khi tải lại | Chưa chạy |
| UAT-08 | Tạo/sửa khách tiềm năng giả lập | Dữ liệu duy trì sau khi tải lại | Chưa chạy |
| UAT-09 | Làm mới D1 trên từng danh mục | Đồng bộ dữ liệu mới nhất, không mất dữ liệu | Chưa chạy |
| UAT-10 | Ngắt kết nối / hết phiên Access | Không có thao tác ghi danh mục nào rơi về localStorage | Chưa chạy |
| UAT-11 | Gọi GET/POST `/api/customers` không có JWT hợp lệ | Từ chối, không lộ dữ liệu | Chưa chạy |
| UAT-12 | POST khác Origin hoặc Content-Type không phải JSON | API từ chối yêu cầu ghi | Chưa chạy |
| UAT-13 | Đăng nhập vai trò Sales chưa được cấp sản phẩm | Không thêm/sửa sản phẩm được | Chưa chạy |
| UAT-14 | Kiểm tra xuất CSV khi có ô bắt đầu bằng =, +, - hoặc @ | Excel không diễn giải như công thức nguy hiểm | Chưa chạy |
| UAT-15 | Đối chiếu bảng `customers`, `products`, `leads`, `audit_log` | Số bản ghi và người thay đổi khớp thao tác | Chưa chạy |

## Cần xử lý sau UAT

- Chưa có kiểm thử xuyên suốt trình duyệt có phiên Access, do đó **không đánh dấu Đạt** cho các bước trên khi chỉ thấy build thành công.
- Quy tắc số ngày/hạn mức nợ chưa được phê duyệt; biểu mẫu live chưa lưu hai trường này để tránh tạo cảm giác đã ghi nhận chính sách tín dụng.
- Cần xác minh bảo vệ các URL preview/deployment; không cho phép truy cập dữ liệu bằng cách né trang chính.
- Cần hoàn thiện trang quản lý người dùng, quy trình sao lưu khôi phục D1 và thử nghiệm khôi phục.
- Đơn hàng, chiết khấu, phiếu cân, thanh toán và giá vốn phải có tài liệu nghiệp vụ chốt + kiểm thử giao dịch trước khi bật API ghi.

## Nguyên tắc nghiệm thu

**Build thành công ≠ nghiệp vụ hoạt động đạt.** Chỉ đánh dấu Đạt khi đã kiểm thử bằng phiên đăng nhập được phép, đọc lại D1 và đối chiếu nhật ký.
