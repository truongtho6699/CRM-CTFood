# Đăng nhập CT FOOD CRM: Google và tên đăng nhập/mật khẩu

Cập nhật ngày 27/11/2026.

## Trạng thái

| Phương thức | Cách hoạt động | Trạng thái |
| --- | --- | --- |
| Google | Đi qua Cloudflare Access (Google IdP) tại `/auth/google`. CRM đổi JWT của Access thành phiên CRM. | Đã chạy |
| Tên đăng nhập + mật khẩu | Form tại `/login` gửi tới `/api/auth/login`. CRM tự kiểm tra mật khẩu và cấp phiên CRM. | Code xong (migration 0011). Chỉ dùng được sau khi đổi cấu hình Access (mục 3). |

Cả hai cách đều dùng chung bảng `app_users` và cùng một bộ phân quyền. Một người có thể dùng cả hai cách: email để đăng nhập Google, tên đăng nhập để đăng nhập bằng mật khẩu.

## 1. Thiết kế bảo mật

- **Mật khẩu**
  - Lưu dạng băm PBKDF2-SHA256, 100.000 vòng, salt ngẫu nhiên 16 byte cho mỗi mật khẩu. Không lưu và không ghi nhật ký mật khẩu gốc.
  - Yêu cầu: dài 10–128 ký tự, có cả chữ và số, không chứa tên đăng nhập.
- **Tên đăng nhập**: 3–32 ký tự gồm chữ thường không dấu, số, dấu `.`, `_`, `-`. Không được trùng, và trigger D1 chặn giá trị sai định dạng.
- **Phiên đăng nhập**
  - Lưu trong cookie `__Host-ctcrm_sid` với các cờ `HttpOnly; Secure; SameSite=Lax`, hết hạn sau 12 giờ.
  - Mã phiên là 32 byte ngẫu nhiên. D1 chỉ lưu SHA-256 của mã phiên (bảng `auth_sessions`).
  - Khóa tài khoản ở Quản lý tài khoản thì phiên đang mở mất hiệu lực ngay.
- **Chống dò mật khẩu**
  - Sai 5 lần thì tài khoản bị khóa 15 phút, kể cả khi sau đó nhập đúng.
  - Một IP sai 20 lần trong 15 phút thì bị chặn (HTTP 429).
  - Tên sai, mật khẩu sai hay tài khoản đã ngừng đều nhận cùng một thông báo. Máy chủ luôn chạy phép băm để thời gian phản hồi không làm lộ tên đăng nhập có tồn tại hay không.
- **Chống CSRF**
  - Mọi yêu cầu ghi (POST/PATCH/DELETE, kể cả đăng nhập và đăng xuất) phải có `Origin` trùng với địa chỉ CRM.
  - Trang `/login` dùng `Referrer-Policy: same-origin` để trình duyệt gửi Origin thật.
- **Mật khẩu tạm**
  - Quản trị viên cấp mật khẩu tạm. Người dùng phải đổi mật khẩu trước khi dùng bất kỳ chức năng nào: API trả 403 cho mọi đường dẫn trừ `/api/me` và `/api/auth/password`.
- **Đổi mật khẩu**: các thiết bị khác đang đăng nhập bị đăng xuất. Khi quản trị viên đặt lại mật khẩu, mọi phiên đăng nhập bằng mật khẩu của người đó bị hủy.
- **Nhật ký**
  - Bảng `auth_events` ghi đăng nhập đúng/sai, khóa tài khoản, đăng xuất, đổi và đặt lại mật khẩu, đăng nhập Google.
  - `audit_log` ghi thao tác cấp đăng nhập của quản trị viên, không ghi mật khẩu.
- **Quên mật khẩu**: chưa có chức năng tự đặt lại qua email. Người dùng nhờ quản trị viên cấp mật khẩu tạm.

## 2. API

| Đường dẫn | Ai dùng | Việc |
| --- | --- | --- |
| `POST /api/auth/login` | Công khai | Nhận JSON hoặc form (`username`, `password`). Form nhận về 303: thành công thì về `/`, lỗi thì về `/login?e=...`. |
| `POST /api/auth/logout` | Người đã đăng nhập | Xóa phiên. Trả `google:true` nếu cần thoát thêm phiên Cloudflare Access. |
| `POST /api/auth/password` | Người đã đăng nhập | Đổi mật khẩu (`current_password`, `new_password`). Người chưa có mật khẩu đặt lần đầu mà không cần mật khẩu cũ. |
| `POST /api/users/:email/login` | ADMIN | Đặt `username` và/hoặc `password` (mật khẩu tạm); `unlock:true` để mở khóa; `remove_password:true` để bỏ mật khẩu. |
| `GET /auth/google` | Qua Cloudflare Access | Đổi JWT của Access thành phiên CRM, rồi về `/`. |

`/api/me` trả thêm `username`, `has_password`, `must_change_password` và `auth_method` (`PASSWORD`, `GOOGLE`, hoặc `ACCESS` khi chỉ có JWT).

Test nằm ở `tests/password-login.test.mjs` và `tests/login-page.test.mjs`.

## 3. Các bước đưa lên chạy thật (theo đúng thứ tự)

1. Chạy migration trên D1, **trước khi merge**:
   ```powershell
   npx wrangler d1 execute ctfood-crm --remote --file worker/migrations/0008_search_keys.sql
   npx wrangler d1 execute ctfood-crm --remote --file worker/migrations/0011_password_login.sql
   ```
   Chỉ chạy 0008 nếu D1 chưa có cột `customers.search_key`.
2. Merge PR. Lúc này Google vẫn chạy như cũ, vì Access vẫn bảo vệ toàn bộ trang.
3. Quản trị viên vào **Quản lý tài khoản**, bấm **Mật khẩu** ở từng người để cấp tên đăng nhập và mật khẩu tạm.
4. Đổi cấu hình Cloudflare Access (Zero Trust, mục Access, rồi Applications):
   - Mở ứng dụng **CT FOOD CRM - Authorized Users** và chọn **Edit**.
   - Ở dòng hostname `crm-ctfood.pages.dev`, điền **Path** = `auth/google`. Giữ nguyên dòng `*.crm-ctfood.pages.dev` để các bản xem trước vẫn yêu cầu Google.
   - Không đổi Application Audience (AUD) và Identity providers.
   - Ứng dụng Bypass cho `/login` có thể giữ hoặc xóa.
5. Kiểm tra lại:
   - Cửa sổ ẩn danh: mở `https://crm-ctfood.pages.dev/` thì về `/login`; đăng nhập bằng mật khẩu tạm, bị yêu cầu đổi, rồi vào được.
   - Bấm "Tiếp tục với Google" thì về trang Google, đăng nhập xong vào được CRM.

**Hoàn tác:** xóa Path `auth/google` ở bước 4 thì Access bảo vệ lại toàn bộ trang như cũ; đăng nhập bằng mật khẩu ngừng hoạt động, Google vẫn chạy.

Sau bước 4, khung giao diện (HTML/JS) của CRM ai cũng tải được, nhưng không có dữ liệu. Mọi dữ liệu đều qua `/api`, và `/api` luôn yêu cầu phiên CRM hoặc JWT của Access.
