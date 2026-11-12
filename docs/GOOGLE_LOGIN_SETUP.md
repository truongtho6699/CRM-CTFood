# Kích hoạt đăng nhập Google cho CT FOOD CRM

**Trạng thái ngày 12/11/2026:** Tài khoản quản trị `truongtho53@gmail.com` đã có quyền `ADMIN` trong D1 và Cloudflare Access. Trang CRM đã có giao diện đăng nhập và nút **Đăng nhập bằng Google**, nhưng nút Google bị **khóa** cho đến khi nhà cung cấp danh tính Google OAuth được cấu hình và kiểm thử.

> Không nhầm phương thức **Cloudflare One-time PIN gửi vào Gmail** với **Đăng nhập qua tài khoản Google OAuth**.

## Cấu hình hiện tại (đã được xác nhận)

- Pages: https://crm-ctfood.pages.dev
- Zero Trust team domain: `rapid-hill-8ea1.cloudflareaccess.com`
- Ứng dụng Access: `CT FOOD CRM - Authorized Users`
- Chính sách Access: chỉ cho `truongtho53@gmail.com`; những email khác bị từ chối.
- Bảng D1 `app_users`: `truongtho53@gmail.com`, `ADMIN`, `active=1`.
- Provider Access có sẵn: `cloudflare` (không phải Google OAuth).
- Google OAuth chưa được kích hoạt; không lưu mật khẩu Google hoặc tạo tài khoản Google mới trong D1.

## Thao tác bắt buộc từ phía người sở hữu Google Cloud

1. Mở **Google Cloud Console → APIs & Services → Credentials** (hoặc Google Auth Platform) và tạo **OAuth Client ID** loại **Web application** cho riêng CRM CT FOOD.
2. Thêm **Authorized JavaScript origin**:

   `https://rapid-hill-8ea1.cloudflareaccess.com`

3. Thêm **Authorized redirect URI**:

   `https://rapid-hill-8ea1.cloudflareaccess.com/cdn-cgi/access/callback`

4. Chọn OAuth consent screen phù hợp; nếu dùng Gmail cá nhân cần chọn loại đối tượng **External**. Nếu Google yêu cầu chế độ Testing, phải thêm tài khoản kiểm thử.
5. Trong Cloudflare Zero Trust → **Integrations → Identity providers → Add new identity provider → Google**, nhập **Client ID** và **Client secret** từ Google. **Chỉ nhập Client secret trong dashboard Cloudflare Zero Trust, không đưa vào GitHub hoặc nội dung chat.**
6. Bấm **Test** ở Google identity provider, xác nhận Google trả về email đúng.
7. Mở Zero Trust → Access controls → Applications → `CT FOOD CRM - Authorized Users`, bật Google làm login method; giữ chính sách chỉ cho phép email quản trị đã được duyệt.
8. Kiểm tra login trực tiếp trên `https://crm-ctfood.pages.dev`, xác nhận API `/api/me` trả về email và role chính xác.
9. Chỉ **sau khi Google provider hoạt động**, có thể đặt biến môi trường Pages `VITE_GOOGLE_OAUTH_ENABLED=true` và trigger build lại để bật nút trong trang đăng nhập dự phòng. Đây là **biến hiển thị**, không phải biện pháp bảo mật. Quyền truy cập thật do Cloudflare Access + D1 quyết định.

**Quan trọng:** Vì Access bảo vệ **toàn bộ tên miền**, người chưa đăng nhập sẽ thấy trang đăng nhập Cloudflare **trước** khi tải giao diện React. Do đó nút Google chính cần xuất hiện trong màn hình Access sau bước 7; nút React chỉ phục vụ tình huống trang được tải nhưng xác thực API chưa xong. Không giảm bảo vệ Access của trang chỉ để hiện nút React.

## Kiểm thử nghiệm thu

- [ ] Google được thêm thành Identity Provider và test thành công.
- [ ] Màn hình Access xuất hiện tùy chọn **Google** hoặc tự chuyển sang Google theo thiết lập.
- [ ] `truongtho53@gmail.com` đăng nhập thành công qua Google, đúng role `ADMIN`.
- [ ] Email khác không nằm trong Access policy bị từ chối.
- [ ] Người dùng không có trong D1 hoặc `active=0` bị API từ chối.
- [ ] Ghi thử một khách hàng giả lập; tải lại trang thấy bản ghi từ D1, audit được ghi.
- [ ] Không có mật khẩu, Client secret hoặc token Google được commit vào GitHub.
- [ ] Hệ thống KPI cũ và dữ liệu thực không bị thay đổi.

Tham khảo hướng dẫn chính thức: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/
