# Thiết kế đăng nhập CT FOOD CRM — Google và tên đăng nhập/mật khẩu

Ngày cập nhật: 18/11/2026.

## Trạng thái thực tế

| Phương thức | Giao diện | Xác thực phía máy chủ | Trạng thái |
| --- | --- | --- | --- |
| Google qua Cloudflare Access | Có lựa chọn Google | Cloudflare Access đã cấu hình Google IdP; người dùng phải đăng nhập Google và được Access + D1 cho phép | Có thể sử dụng thông qua trang Access; chưa UAT tương tác qua ADMIN |
| Tên đăng nhập + mật khẩu riêng CT FOOD | Đã xây dựng biểu mẫu trong `src/AuthGateway.jsx` | Chưa có kho hash mật khẩu, xác thực và phiên người dùng nội bộ | **Chưa kích hoạt; nút bị khóa** |
| Cloudflare Access dự phòng | Cloudflare cung cấp màn đăng nhập | Provider Cloudflare đã bật | Có phương thức dự phòng |

**Quan trọng:** Tên miền `crm-ctfood.pages.dev` đang được Cloudflare Access bảo vệ tại lớp biên trước khi React tải. Người dùng chưa được cấp quyền sẽ thấy **màn hình Cloudflare Access** trước, chứ không trực tiếp thấy màn `AuthGateway.jsx`. Màn CT FOOD là màn dự phòng nếu frontend được tải mà /api/me không xác thực được. Không được tháo Access khỏi ứng dụng chỉ để hiển thị mẫu giao diện.

## Trải nghiệm mong muốn

1. Nhập tài khoản và mật khẩu hoặc chọn Google.
2. Cả hai phương thức sau khi xác minh phải ánh xạ đến cùng `app_users` (D1) và cùng RBAC.
3. Quyền ADMIN của `truongtho53@gmail.com` được cấp tại D1, không tạo tài khoản tự do.
4. Nếu chưa có phương thức xác thực backend an toàn, **không bật** nút mật khẩu.

## Việc bắt buộc trước khi kích hoạt mật khẩu thật

- Chốt chiến lược: dùng nhà cung cấp danh tính bên ngoài hỗ trợ mật khẩu (OIDC/SAML) tích hợp Cloudflare Access, hoặc triển khai dịch vụ đăng nhập riêng được bảo vệ chống brute-force.
- Nếu dùng OIDC: cấu hình IdP trên Cloudflare Access (có thể giữ Google song song), thiết lập ứng dụng, callback và chính sách email/nhóm. Không tự lưu mật khẩu trong frontend hoặc `localStorage`.
- Nếu làm auth riêng: mật khẩu phải hash chậm có salt, có reset mật khẩu an toàn, giới hạn thử sai, khóa phiên, cookie `HttpOnly;Secure;SameSite`, CSRF, audit, xét thiết bị và backup; phải cập nhật kiến trúc Access/Pages để không bypass được `/api`.
- Kiểm thử đăng nhập sai đúng, tài khoản ngừng hoạt động, chống đoán mật khẩu, phiên hết hạn, đổi mật khẩu, logout, Google và kiểm tra quyền tại API.
- Chỉ mở sản xuất khi UAT bảo mật đạt; việc này là **hạng mục riêng**, chưa phải phần đã hoàn thành.

## Triển khai giao diện

- `src/AuthGateway.jsx`: bố cục hai cột, hai lựa chọn Google và tên đăng nhập/mật khẩu, trường password bị khóa, biểu tượng hiển thị mật khẩu, thông báo bảo mật.
- `src/auth.css`: responsive desktop/mobile.
- Không sửa Access policies, không đổi xác thực Google đang chạy, không thêm mật khẩu mặc định cho tài khoản ADMIN, không thay D1 hoặc KPI.

Cần kiểm tra qua Cloudflare Pages build và phiên trình duyệt. Không gọi giao diện hiện tại là một dịch vụ username/password thực sự.
