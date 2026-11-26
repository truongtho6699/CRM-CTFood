# CT FOOD CRM — TIẾN ĐỘ VÀ DANH SÁCH CÔNG VIỆC

**Ngày chốt báo cáo:** 26/11/2026 (giờ Việt Nam)  
**Môi trường:** https://crm-ctfood.pages.dev  
**Repo:** https://github.com/truongtho6699/CRM-CTFood  
**Trạng thái chung:** MVP nội bộ V0.4, đã triển khai Cloudflare Pages và D1; **chưa nghiệm thu vận hành toàn diện**.  
**Nguyên tắc:** Trạng thái “đã có mã” hoặc “build thành công” **không đồng nghĩa** “đã UAT end-to-end”; nội dung đề xuất không được ghi là đã phát triển.

## 1. Kiểm chứng trạng thái tại thời điểm lập báo cáo

- Cloudflare Pages production: deployment gần nhất được xác nhận **success/deploy** ở commit `64fc8727d5ef47136f10138a796b33c993c87f18` (26/11/2026 UTC; kiểm tra trực tiếp bằng Cloudflare API). Các deploy trước `7c6f543...` và `14d235c...` cũng báo success. Không khẳng định kiểm thử trình duyệt đã đạt.
- Cloudflare Access ứng dụng `CT FOOD CRM - Authorized Users` bảo vệ `crm-ctfood.pages.dev`; **chỉ Google IdP** trong `allowed_idps`, `auto_redirect_to_identity=true`. Quy tắc Access hiện chỉ cho phép email ADMIN `truongtho53@gmail.com`. Provider Cloudflare OTP vẫn có thể tồn tại trong danh mục IdP toàn tài khoản nhưng **không còn là phương thức của ứng dụng CRM**.
- Trang `/login` là một Access app khác, policy `bypass` công khai đúng đường dẫn đăng nhập; CRM tại `/` và `/api` tiếp tục có Access bảo vệ. `functions/login.js` phục vụ UI login độc lập.
- D1 `ctfood-crm` (ID `31866ea2-8f55-4dcb-b504-58bb3f3059b9`), đọc **chỉ SELECT**: `app_users=4`, `customers=12`, `leads=8`, `products=10`, `audit_log=0`. Kiểm tra `id LIKE 'DEMO-%'` cho thấy **toàn bộ 12/12 khách hàng, 8/8 leads, 10/10 sản phẩm là dữ liệu DEMO**; thêm `activities=3` dòng demo; `orders=0`, `deliveries=0`, `payments=0`, `containers=0`. Không suy luận đã nhập dữ liệu kinh doanh thật. Lưu ý 4 tài khoản gồm tài khoản quản trị và tài khoản mẫu ngừng hoạt động theo `README.md`.
- Đọc cấu trúc D1: `products.updated_at` tồn tại, có 2 trigger trên `customers` — bằng chứng kỹ thuật bổ trợ cho thay đổi migration 0003, **không thay thế nghiệm thu dữ liệu**.
- GitHub có workflow `.github/workflows/ci.yml` chạy `npm test` và `npm run build`. Các run thành công trước đây được ghi ở `PROJECT_CONTEXT.md` (44252433570 và 44252689070). **Chưa xác minh kết quả run CI gắn riêng commit production mới nhất trong lần rà soát này.**

## 2. CHECKLIST ĐÃ THỰC HIỆN / CÓ MÃ / CẤU HÌNH

| ID | Công việc | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- | --- |
| INF-01 | Khởi tạo repo và triển khai React/Vite + Cloudflare Pages | ✅ Đã triển khai | `src/CRMApp.jsx`, `package.json`; Pages success |
| INF-02 | Cloudflare D1 + Pages Functions kết nối API | ✅ Đã cấu hình | `worker/src/index.js`, `functions/api/[[path]].js`, D1 hiện có dữ liệu demo |
| INF-03 | Migration bảng lõi, leads, chuẩn mã trạng thái và updated_at | ✅ Có mã; DB đã có dấu hiệu áp dụng | `worker/migrations/0001_init.sql`, `0002_leads.sql`, `0003_status_codes_versioning.sql`; kiểm tra schema chỉ đọc |
| AUTH-01 | Google OAuth qua Cloudflare Zero Trust Access | ✅ Đã cấu hình | Google IdP duy nhất trên Access app CRM; vẫn cần UAT thực tế |
| AUTH-02 | Loại bỏ Cloudflare email OTP **khỏi lựa chọn đăng nhập CRM** | ✅ Đã cấu hình | `allowed_idps` chỉ chứa Google; không xóa IdP toàn tài khoản |
| AUTH-03 | Trang đăng nhập CT FOOD riêng `/login` | ✅ Đã triển khai | `functions/login.js`, Access bypass chỉ tại `/login` |
| AUTH-04 | Màn hình đăng nhập | ✅ Chỉ Google | Tab User/Password đã ẩn do AUTH-05 hoãn |
| SEC-01 | Kiểm tra JWT Access + ánh xạ tài khoản D1, RBAC theo vai trò | ✅ Có mã và test tự động | `worker/src/index.js`, `tests/rbac-api.test.mjs` |
| SEC-02 | Hạn chế Sales xem trường tài chính; tách quyền Logistics | ✅ Có mã và test tự động | API SQL chọn cột theo vai trò; UI phân hệ |
| SEC-03 | Kiểm soát sửa trùng bằng `expected_updated_at`, chuẩn hóa trạng thái | ✅ Có mã và test | Worker, `tests/migration-0003.test.mjs`, `README.md` |
| UI-01 | Giao diện CRM V0.4: Dashboard D1 và menu phân hệ | ✅ Có mã / đã deploy | `src/CRMApp.jsx`, `src/crm-v04.css` |
| UI-02 | Danh sách khách hàng, lead, sản phẩm: tìm kiếm, 25 dòng/trang, giao diện mobile | ✅ Có mã / đã deploy | `src/CRMApp.jsx`; chưa có UAT trên thiết bị thật |
| CRUD-01 | GET/POST/PATCH cho 3 danh mục khách hàng, lead, sản phẩm | ✅ Có mã API và UI | `worker/src/index.js`; **chưa xác nhận end-to-end trên tài khoản ADMIN thật** |
| QA-01 | Kiểm thử in-memory cho migration, bảo mật API, RBAC và trang login | ✅ Có bộ test | `tests/*.test.mjs`, CI workflow; không dùng DB production |
| DATA-01 | Bộ dữ liệu DEMO và script dọn DEMO | ✅ Có mã / D1 hiện có DEMO | `worker/seeds/demo_seed.sql`, `demo_cleanup.sql`; **chưa chạy dọn** |
| DOC-01 | Tài liệu bối cảnh và UAT | ✅ Có tài liệu | `PROJECT_CONTEXT.md`, `docs/UAT_D1_V02.md`, `docs/UIUX_V04_RELEASE.md` |

**Lưu ý về trạng thái:** Các mục có mã hoặc CI đạt không tự động được đánh dấu “nghiệm thu nghiệp vụ”.

## 3. CHECKLIST CHƯA HOÀN THÀNH / CHƯA NGHIỆM THU

| Ưu tiên | ID | Hạng mục | Trạng thái và điều kiện hoàn tất | Phụ trách đề xuất |
| --- | --- | --- | --- | --- |
| P0→Hoãn | AUTH-05 | Đăng nhập bằng User/Password thực sự | ⏸️ **Hoãn theo quyết định chủ dự án (26/11/2026): chỉ dùng Google.** Đã ẩn tab mật khẩu trên màn đăng nhập và trang `/login` (cờ `PASSWORD_LOGIN_ENABLED` trong `src/AuthGateway.jsx`). Khi mở lại: ưu tiên IdP OIDC gắn vào Access, không tự lưu mật khẩu | Chủ dự án |
| P0 | UAT-01 | Google OAuth end-to-end trên ứng dụng | ✅ Đạt với ADMIN (26/11/2026) — xem mục 7. Còn lại: thử tài khoản chưa được cấp quyền và đăng xuất | ADMIN + QA |
| P0 | UAT-02 | CRUD và audit end-to-end | ✅ Đạt với ADMIN (26/11/2026) — xem mục 7. Quyền của vai trò khác chuyển sang SEC-04 | QA + nghiệp vụ |
| P0 | DATA-02 | Xác nhận dữ liệu DEMO và kế hoạch trước khi nhập thật | ❌ Chưa dọn DEMO; **không chạy cleanup khi chưa sao lưu và được chủ quản phê duyệt** | DATA + quản trị |
| P0 | DATA-03 | Module import lịch sử từ template Google Sheets/Excel | ❌ Chưa phát triển. Đã phân tích mẫu khách hàng/NCC, hàng hóa, container, giao dịch; cần staging, mapping, phát hiện trùng, duyệt, audit và rollback | BA + DATA + DEV |
| P0 | BIZ-01 | Chốt BRD các quy tắc đơn hàng, giao thực, VAT, công nợ, giá vốn, hoa hồng, KPI | ❌ Các câu hỏi P0 trong tab `Rivew 1` còn phải chốt; **không bật ghi tài chính** | BGĐ + Sales + Kế toán |
| P1 | ORDER-01 | CRUD đơn hàng nhiều dòng, trạng thái, giá bán và duyệt ngoại lệ | 🟡 Có mã + test (PR #5) theo **giả định tạm** ở mục 8: tạo/sửa đơn nhiều dòng, 3 trạng thái, Sale Admin xác nhận giao, TPKD/BGĐ hủy có lý do, audit. **Chưa tính KPI, chưa ghi tiền.** Cần migration 0005, UAT và BGĐ chốt C01–C05 | BA + DEV |
| P1 | LOG-01 | Container, tồn kho, phiếu cân, nhiều lần giao và đối chiếu số kg thực tế | 🟡 Phiếu cân + giao nhiều lần có mã + test (PR #6) theo **giả định tạm** ở mục 9: Sale Admin/Kho/Kế toán nhập, **Kế toán xác nhận kg thực giao**, hiển thị chênh lệch. Container/tồn kho/giá vốn **chưa làm**. Cần migration 0006, UAT, BGĐ chốt D01/D03/D04 | Kho + DEV |
| P1 | FIN-01 | Đặt cọc, thu tiền từng phần, công nợ, đối soát, hóa đơn | 🟡 Có mã + test (PR #8) theo **giả định tạm** mục 11: phiếu thu cọc/thanh toán (tiền số nguyên), phân bổ nhiều đơn, hủy phiếu có lý do, công nợ theo giao hàng, hạn = ngày giao cuối + số ngày nợ, tuổi nợ. Chưa VAT, chưa hoàn/chuyển cọc, chưa đối soát ngân hàng, chưa hóa đơn. Cần migration 0007 + UAT | Kế toán + DEV |
| P1 | KPI-01 | Kết nối dashboard KPI hiện có | 🟡 Báo cáo doanh số/sản lượng/CK theo Sales, tháng, sản phẩm, khách hàng + công nợ quá hạn theo Sales (PR #8), tính từ kg giao đã xác nhận. **Chưa kết nối hệ thống KPI hiện hành**, chưa có giá vốn/lợi nhuận | Quản trị KPI + DATA |
| P1 | SEC-04 | UAT RBAC bằng tài khoản Sales/Logistics/Kế toán thật | ⏳ Test tự động có nhưng chưa kiểm thử qua phiên thực tế | QA + quản trị |
| P1 | OPS-01 | Sao lưu, kiểm thử restore, khóa kỳ, rollback và giám sát | ❌ Chưa có biên bản nghiệm thu khôi phục DB / vận hành | DEVOPS |
| P1 | QA-02 | Lighthouse/Web Vitals, mobile, tải dữ liệu lớn và benchmark API | ❌ Chưa đo/kiểm thử với người dùng thật | UIUX + QA |
| P1 | SEC-05 | Kiểm tra bảo vệ toàn bộ đường dẫn preview và domain phụ | ✅ Đạt (26/11/2026) — `*.crm-ctfood.pages.dev` đã thêm vào Access app; xem mục 7. Lưu ý: Worker thừa `ctfood-crm` (chỉ file tĩnh, không D1) đã tắt build, nên xoá hẳn nếu không dùng | DEVOPS + QA |
| P2 | ADM-01 | Màn hình quản lý người dùng, cấp quyền, thu hồi quyền | 🟡 Có mã + test (PR #4): ADMIN thêm/sửa/khóa tài khoản, đổi vai trò, có audit, chống tự khóa, khóa lạc quan. Cần chạy migration 0004 rồi UAT. Lưu ý: tài khoản mới vẫn phải được thêm vào policy Cloudflare Access | BA + DEV |
| P2 | DOC-02 | Đồng bộ `README.md`, `DEPLOYMENT.md` và các tài liệu cũ đang nhắc `localStorage`/Cloudflare OTP | ✅ Đã đồng bộ (26/11/2026): README, DEPLOYMENT, AUTH_DUAL_METHOD. `PROJECT_CONTEXT.md` giữ nguyên là nhật ký lịch sử | DEV + BA |

## 4. LỘ TRÌNH ĐỀ XUẤT

| Giai đoạn | Công việc cần ưu tiên | Đầu ra nghiệm thu |
| --- | --- | --- |
| **GĐ1 — An toàn & xác thực** | AUTH-05, UAT-01, UAT-02, SEC-04, SEC-05 | Người dùng đăng nhập được theo phương thức đã duyệt; JWT/RBAC và CRUD đạt; không lộ dữ liệu |
| **GĐ2 — Chuẩn dữ liệu & import** | DATA-02, DATA-03; chốt ánh xạ mã KH, hàng, cont, Sale; xác nhận giá, ngày, thuế | Upload → staging → kiểm tra lỗi/trùng → duyệt → ghi D1 → đối soát và rollback |
| **GĐ3 — Nghiệp vụ bán/giao** | BIZ-01, ORDER-01, LOG-01 | Đơn nhiều dòng, giao nhiều lần, số lượng thực giao được xác nhận |
| **GĐ4 — Tài chính & KPI** | FIN-01, KPI-01, OPS-01, QA-02 | Công nợ/giá vốn/KPI khớp nguồn, phân quyền, khóa kỳ, backup/restore và báo cáo hiệu năng |

**Điều kiện mở dữ liệu thật:** Phải có sao lưu/khôi phục được thử, nguồn dữ liệu hợp lệ, người duyệt dữ liệu, phân quyền và kiểm thử đối soát; tránh tự nhập trực tiếp vào bảng D1 sản xuất.

## 5. QUY ƯỚC CẬP NHẬT

- ✅ **Đã triển khai / có bằng chứng:** có repo/Cloudflare/D1 hoặc kết quả test rõ ràng.
- 🟡 **Có giao diện / code nhưng chưa vận hành hoặc chưa nghiệm thu:** không mô tả là đã hoàn thành nghiệp vụ.
- ⏳ **Chờ kiểm chứng:** cần chứng cứ từ UAT, log/ảnh, người phụ trách.
- ❌ **Chưa thực hiện:** chưa có module/hạ tầng nghiệp vụ hoặc chưa đủ quyết định thiết kế.
- Không sửa các số DEMO bằng tay để biến thành dữ liệu thật.
- Sau mỗi đợt thay đổi: ghi commit, deployment, ca UAT, lỗi tồn và quyết định nghiệp vụ; cập nhật bảng trên trước khi tuyên bố hoàn tất.

## 6. THAM CHIẾU

- `PROJECT_CONTEXT.md` — lịch sử quyết định và diễn biến (có các snapshot cũ).
- `docs/UAT_D1_V02.md`, `docs/UIUX_V04_RELEASE.md` — kiểm thử chức năng/UI.
- `docs/AUTH_DUAL_METHOD.md` — lưu ý kiến trúc đăng nhập (một số câu mô tả Cloudflare OTP là trạng thái lịch sử, đã được thay bằng Google-only ở Access app).
- `README.md`, `DEPLOYMENT.md` — hướng dẫn cũ; cần đối chiếu theo thực trạng ngày 26/11.
- Template/Review 1: https://docs.google.com/spreadsheets/d/1cbl_q8uxH_IlGil5XLxU2fOGrqRt9_-hP42wWZTAiuQ/edit
- GitHub workflow: https://github.com/truongtho6699/CRM-CTFood/actions

## 7. KẾT QUẢ NGHIỆM THU GIAI ĐOẠN 1 — 26/11/2026

Thực hiện trên https://crm-ctfood.pages.dev (bản `main` sau PR #2) bằng phiên Google/Access thật của tài khoản ADMIN; đối chiếu D1 bằng truy vấn **chỉ SELECT**. Bản ghi thử đặt tên `[DEMO] …` để `demo_cleanup.sql` dọn được.

| Mã | Kịch bản | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| UAT-01 | Phiên Access → `/api/me`, `/api/summary` | ✅ Đạt | `/api/me` trả đúng email ADMIN, `role=ADMIN`, `active=1`; `/api/summary` `source=D1` (12/8/10) |
| UAT-03 | Tạo khách `[DEMO] UAT KH 001`, trạng thái "Tiềm năng" | ✅ Đạt | Báo "Đã thêm bản ghi vào D1"; D1 lưu `status=PROSPECT`, `owner_email` = tài khoản đăng nhập |
| UAT-04 | Tải lại trang | ✅ Đạt | Bản ghi còn, không nhân đôi |
| UAT-05 | Sửa số điện thoại | ✅ Đạt | D1 `0999200002`; `audit_log` có `UPDATE` |
| UAT-06 | Tạo khách trùng mã số thuế | ✅ Đạt | Báo "Mã số thuế đã tồn tại ở một khách hàng khác"; không có bản ghi mới, không ghi audit |
| UAT-07 | Sửa sản phẩm `DEMO-SP10` | ✅ Đạt | Cập nhật xuất xứ; `audit_log` `UPDATE products` |
| UAT-08 | Đổi giai đoạn lead `DEMO-LD08` → "Chuyển đổi" | ✅ Đạt | D1 lưu `CONVERTED`; audit ghi nhận |
| UAT-15 | Đối chiếu `audit_log` | ✅ Đạt | Đúng 4 dòng (1 CREATE, 3 UPDATE), đúng người thực hiện; 2 lần lưu bị từ chối không sinh audit |
| UAT-16 | Hai tab cùng sửa một khách | ✅ Đạt | Tab lưu sau báo "Bản ghi vừa được người khác cập nhật…"; địa chỉ tab cũ **không** được ghi |
| UAT-17 | Tìm theo số điện thoại | ✅ Đạt | `0999000005` → đúng 1 khách |
| UAT-18 | Mã trạng thái sau migration 0003 | ✅ Đạt | D1 chỉ còn `ACTIVE/PROSPECT/INACTIVE` và `NEW/CONTACTING/QUOTED/CONVERTED/REJECTED`; giao diện hiển thị nhãn tiếng Việt |
| SEC-05 | Truy cập không cookie (`credentials:'omit'`) | ✅ Đạt | Production `/`, `/api/me`, `/api/customers` và preview `fix-review-rbac-tests-status.*`, `c870255a.*` đều bị Access chuyển hướng; chỉ `crm-ctfood.pages.dev/login` trả 200 |

**Chưa chạy / còn lại:** UAT-12 (Origin/Content-Type — đã có test tự động, không giả lập được từ trình duyệt), UAT-13 và SEC-04 (cần tài khoản Google thật với vai trò SALES/LOGISTICS/ACCOUNTING), UAT-14 (xuất CSV có ký tự công thức — cần tải file), UAT-10 (hết phiên Access).

**Lỗi phát hiện và đã sửa trong đợt này:** sau khi bị từ chối 409, bảng phía sau vẫn hiện dữ liệu cũ → nay tự tải lại danh sách; `demo_cleanup.sql` chưa dọn bản ghi `[DEMO]` tạo trên giao diện → đã bổ sung (có test).

## 8. GIẢ ĐỊNH TẠM CHO PHÂN HỆ ĐƠN HÀNG (ORDER-01) — CHỜ BGĐ CHỐT

Nguồn: tab "Lưu đồ" của file "2026-CTF_Hoàn thiện phần mềm". Mỗi giả định gắn câu hỏi tương ứng ở tab "Rivew 1"; khi BGĐ chốt khác, chỉ cần sửa quy tắc tương ứng.

| Câu | Giả định đang áp dụng | Ở đâu trong mã |
| --- | --- | --- |
| C01 Mã đơn | `DH` + năm 2 số + tháng (giờ VN) + `-` + số thứ tự 4 chữ số trong tháng, ví dụ `DH2611-0001`; hệ thống tự sinh, không trùng | `worker/src/orders.js` (`codePrefix`, `nextCode`) |
| C02 Offer + sẵn kho | Mỗi đơn **một** loại: Offer hoặc Hàng sẵn kho; một đơn nhiều dòng hàng (tối đa 50) | `validateOrder` |
| C03 Trạng thái | 3 trạng thái theo Lưu đồ: **Chờ giao → Thành công / Hủy**; đã chốt thì không đổi lại, không sửa dòng | migration 0005 (trigger), `changeStatus` |
| C04 Ai sửa / hủy | Sales sửa đơn của mình khi còn Chờ giao; TPKD, Sale Admin, BGĐ, ADMIN sửa mọi đơn Chờ giao. **Sale Admin (và ADMIN)** xác nhận giao thành công; **TPKD, BGĐ, ADMIN** hủy, bắt buộc ghi lý do | `WRITE`, `CAN_SUCCESS`, `CAN_CANCEL` |
| C05 Giá & thuế | Giá bán lưu **chưa VAT**, số nguyên đ/kg; chưa áp thuế suất (vat_rate = 0) | `validateOrder`, `order_lines` |
| — Thành tiền | KL dự kiến × giá chưa VAT (Lưu đồ mục 6); chiết khấu/hoa hồng nhập riêng theo đ/kg, không trừ vào thành tiền | `SELECT_ORDER` |
| — Chủ đơn | Đơn thuộc Sales phụ trách khách hàng; Sales chỉ tạo đơn cho khách của mình; khách "Ngừng giao dịch" không tạo đơn được | `createOrder` |
| C06 Cọc | Chỉ lưu **cọc dự kiến** (số tiền); cọc thực nhận thuộc phân hệ Thu tiền (FIN-01) | — |

**Chưa làm trong ORDER-01 (để phân hệ sau):** giao nhiều lần và số kg thực giao (LOG-01) — hiện "Thành công" do Sale Admin xác nhận thủ công; tiền cọc/thanh toán thực (FIN-01); KPI và lợi nhuận (KPI-01).

## 9. GIẢ ĐỊNH TẠM CHO GIAO HÀNG & PHIẾU CÂN (LOG-01) — CHỜ BGĐ CHỐT

| Câu | Giả định đang áp dụng | Ở đâu trong mã |
| --- | --- | --- |
| D01 Nhiều container | Mỗi **phiếu cân gắn một dòng hàng** của đơn; một dòng giao **nhiều lần**, mỗi lần ghi **số container** (chữ, chưa nối bảng container). Một container có thể xuất hiện ở nhiều đơn | `worker/src/deliveries.js`, migration 0006 |
| D03 Ai nhập / xác nhận | **Sale Admin, Kho, Kế toán** nhập phiếu (KL cân, ngày, số phiếu, container, xe); **Kế toán (và ADMIN)** xác nhận — theo Lưu đồ mục 14 "Kế toán cập nhật số lượng thực tế giao" | `ENTRY`, `VERIFY` |
| D04 Chênh lệch | **Không chặn**: chi tiết đơn hiển thị KL đặt, KL đã xác nhận, KL chờ xác nhận và chênh lệch từng dòng | `src/Orders.jsx` |
| — Phiếu sai | Phiếu **Chờ xác nhận** sửa được; hủy phải ghi lý do; phiếu đã xác nhận/đã hủy bị khóa (API + trigger) | migration 0006 |
| — Liên quan Đơn hàng | Đơn đã có phiếu cân thì **không sửa dòng hàng**; "Thành công" cần ≥1 phiếu đã xác nhận và **không còn phiếu chờ**; không hủy đơn khi còn phiếu chưa hủy; đơn đã chốt không thêm phiếu | `worker/src/orders.js` |

**Chưa làm:** quản lý container/lô/tồn kho và giá vốn theo container (D02, D05, D06, F01); trả hàng/giao thừa thiếu có xử lý tiền (D07); KPI từ số kg đã xác nhận (KPI-01).

## 10. UAT ĐƠN HÀNG & PHIẾU CÂN TRÊN PRODUCTION — 26/11/2026

Phiên ADMIN thật trên https://crm-ctfood.pages.dev sau khi merge PR #3–#6 và chạy migration 0004–0006; đối chiếu D1 chỉ SELECT.

| Kịch bản | Kết quả | Bằng chứng |
| --- | --- | --- |
| Quản lý tài khoản: danh sách | ✅ | 4 tài khoản, 3 tài khoản DEMO "Đã khóa" |
| Tạo đơn 2 dòng | ✅ | `DH2611-0001`, tổng 183.050.000 đ, tự gán Sales phụ trách khách; form ẩn khách ngừng giao dịch và sản phẩm ngừng bán |
| Sửa đơn / hủy đơn có lý do | ✅ | Còn 1 dòng 185.000.000 đ; hủy hiển thị người, giờ, lý do |
| "Thành công" khi chưa có phiếu đã xác nhận | ✅ API chặn 409 | Thông báo "Chưa có phiếu cân nào được Kế toán xác nhận" — **lỗi giao diện không hiện thông báo**, đã sửa ở PR #7 |
| Thêm phiếu cân DEMO-DH01 | ✅ | 26.950,5 kg "Chờ xác nhận", số container tự viết hoa |
| Kế toán xác nhận phiếu (trang hàng chờ) | ✅ | "Đã xác nhận" + người xác nhận |
| Đơn → Thành công | ✅ | Chênh lệch dòng Nạc vai −49,5 kg hiển thị đúng |
| Nhật ký | ✅ | CREATE, VERIFY (deliveries) và COMPLETE (orders) đúng thứ tự, đúng người |

**Điểm cần BGĐ quyết thêm (phát sinh khi UAT):** DEMO-DH01 có 2 dòng nhưng mới giao dòng Nạc vai; dòng Sườn non (3.000 kg) chưa giao vẫn chuyển "Thành công" được, vì quy tắc tạm chỉ yêu cầu ≥1 phiếu đã xác nhận. Cần chốt: có bắt buộc **mọi dòng** phải có phiếu đã xác nhận, hoặc giao đủ trong ngưỡng sai số (ví dụ ±2%), trước khi "Thành công" không (gắn với C03/D04).

## 11. GIẢ ĐỊNH TẠM CHO THU TIỀN & CÔNG NỢ (FIN-01) VÀ BÁO CÁO & KPI (KPI-01) — CHỜ CHỐT

| Câu | Giả định đang áp dụng | Ở đâu trong mã |
| --- | --- | --- |
| E01 Công nợ phát sinh | **Theo giao hàng**: giá trị = Σ kg đã được Kế toán xác nhận × giá chưa VAT của dòng đơn (Lưu đồ mục 16) | `worker/src/finance.js` (`receivableRows`) |
| E02 Hạn thanh toán | **Ngày giao cuối đã xác nhận + số ngày nợ của khách** (`customers.credit_days`); quá hạn khi còn số dư sau hạn | `receivableRows` |
| E03 Phân bổ | Một phiếu thu phân bổ **nhiều đơn của cùng khách**; tổng phân bổ ≤ số tiền phiếu; phần còn lại là "tiền chưa phân bổ" của khách; Kế toán sửa phân bổ được (có nhật ký) | `setAllocations`, migration 0007 |
| C06 Cọc | Cọc thực nhận là phiếu thu loại **Đặt cọc**, phân bổ vào đơn như thanh toán (đơn chưa giao sẽ có số dư âm = khách trả trước) | `createPayment` |
| — Tiền | **Số nguyên (đồng)**, chặn ở API và trigger DB; phiếu đã lập không sửa số tiền — sai thì **hủy phiếu (bắt buộc lý do)** và lập lại | migration 0007 |
| — Quyền | **Kế toán, ADMIN** lập/phân bổ/hủy phiếu thu; Sales xem công nợ và phiếu thu của khách mình; Kho không xem tài chính | `WRITE`, `READ` |
| — Hủy đơn | Đơn có tiền đã phân bổ thì phải gỡ phân bổ trước khi hủy | `worker/src/orders.js` |
| G01 Ghi nhận doanh số | **Theo ngày giao trên phiếu cân đã xác nhận**; doanh thu KPI = kg đã xác nhận × giá chưa VAT; sản lượng KPI = kg đã xác nhận (Lưu đồ mục 15–16) | `salesReport` |
| — Hoa hồng | Σ kg đã xác nhận × CK/hoa hồng đ/kg nhập trên dòng đơn; **chưa trừ vào lãi** (F02 chưa chốt) | `salesReport` |

**Chưa làm:** VAT (C05), hoàn cọc/chuyển cọc/thanh toán thừa (E04), hạn mức tín dụng chặn đơn (E05), đối soát ngân hàng/nhắc nợ (E06), hóa đơn, giá vốn/lợi nhuận (F01–F05), trả hàng điều chỉnh doanh số (G03), kết nối hệ thống KPI hiện hành (A03).

## 12. UAT THU TIỀN & CÔNG NỢ, BÁO CÁO & KPI TRÊN PRODUCTION — 26/11/2026

| Kịch bản | Kết quả | Bằng chứng |
| --- | --- | --- |
| Công nợ từ phiếu cân đã xác nhận | ✅ | DEMO-DH01: 26.950,5 kg × 73.500 = 1.980.861.750 đ; hạn 26/12/2026 (giao 26/11 + 30 ngày) |
| Lập phiếu thu 500.000.000 đ, phân bổ 400.000.000 đ | ✅ | Đã phân bổ 400 tr, chưa phân bổ 100 tr |
| Sửa phân bổ (500 tr → 450 tr) | ✅ | Đã thu 450 tr, còn phải thu 1.530.861.750 đ, tiền chưa phân bổ 50 tr |
| Báo cáo KPI tháng 11 | ✅ | Sản lượng 26.950,5 kg; doanh thu 1.980.861.750 đ; CK/HH 13.475.250 đ (= 26.950,5 × 500) |
| Lỗi phát hiện | ❌→✅ | Trang trắng khi lưu phiếu rồi chuyển tab "Công nợ theo đơn" (đọc dữ liệu null) — sửa ở PR #9; bảng báo cáo phải cuộn ngang — sửa ở PR #9 |

Dữ liệu thử nằm trên khách DEMO, sẽ được `demo_cleanup.sql` dọn.

## 13. CẢI THIỆN GIAO DIỆN (UI/UX) — 26/11/2026

Đánh giá theo skill frontend-design (máy tính 1440px và điện thoại 390px), làm 2 bước:

| Bước | Nội dung | PR |
| --- | --- | --- |
| 1 | Sửa lỗi nhãn lệch trên điện thoại; bỏ thuật ngữ kỹ thuật (D1, Cloudflare, Lưu đồ, mã câu hỏi); gọn thông báo; tên nút cụ thể; menu tài khoản ở góc phải; bỏ nhãn viết HOA; ẩn mã UUID | #10 |
| 2 | Tổng quan "Việc cần làm" theo vai trò; trang chi tiết khách hàng (đơn hàng, công nợ, phiếu thu, chăm sóc; tạo đơn/lập phiếu thu/thêm việc tại chỗ); ô chọn khách hàng và sản phẩm có gõ tìm; danh sách 2 dòng trên điện thoại cho đơn hàng, khách hàng, công nợ, phiếu thu | #11 |
| 3 | Thanh tiến trình Đặt → Giao → Thu trên danh sách và chi tiết đơn, chi tiết khách hàng; tìm kiếm không phân biệt hoa/thường và có dấu/không dấu ("suon" ra "Sườn non heo", "dai viet" ra "Đại Việt"); lọc khách hàng theo trạng thái, khu vực, Sales và sắp xếp theo tên | (PR bước 3) |

API mới ở bước 2: `/api/worklist`, `/api/customers/:id/overview`, `/api/activities` (tạo, đánh dấu xong) — có test phạm vi vai trò (`tests/workspace-api.test.mjs`).

Bước 3 cần **migration 0008** (`0008_search_keys.sql`): thêm cột `search_key` (tên/điện thoại/MST đã bỏ dấu, viết thường) cho khách hàng, sản phẩm, khách tiềm năng, có trigger tự cập nhật; thêm chỉ mục khu vực, trạng thái. API mới: `/api/customers/facets`; `/api/customers` nhận `status`, `region`, `owner`, `sort=name|recent`; đơn hàng trả thêm `delivered_value` (giá trị đã giao xác nhận) và `paid` (đã phân bổ thu; ẩn với Kho). Test: `tests/search.test.mjs`.

Cách tính tiến trình: **Giao %** = kg trên phiếu cân đã xác nhận / kg đặt; **Thu %** = tiền phiếu thu đã phân bổ vào đơn / giá trị đã giao (chưa VAT). Tiền thu trước khi giao hiển thị là "Đã cọc". Nếu Ban giám đốc muốn tính Thu % trên giá trị có VAT hoặc trên toàn bộ giá trị đơn, cần sửa công thức.


## Cập nhật 26/11/2026 — Gộp ba danh mục nền vào menu Quản lý danh mục

**Phạm vi được yêu cầu:** Các tab Google Sheets `Mã khách hàng - NCC`, `Mã hàng hóa`, `Mã công trình` (theo nguồn: https://docs.google.com/spreadsheets/d/1cbl_q8uxH_IlGil5XLxU2fOGrqRt9_-hP42wWZTAiuQ/edit). Đây là ba **danh mục nền**, không phải ba giai đoạn nhập giao dịch và tài chính.

### Đã triển khai trong mã nguồn
- [x] Menu cha **Quản lý danh mục** thu gọn/mở rộng, với 3 mục: **Khách hàng / NCC**, **Hàng hóa**, **Container / Lô hàng**. Giữ menu Khách tiềm năng riêng, không nhân đôi danh mục đã có.
- [x] Trang tổng quan danh mục mới `src/Catalogs.jsx` theo giao diện V0.4: 3 thẻ điều hướng, màn hình danh sách Container, tìm kiếm, phân trang, trạng thái trống/tải/lỗi và responsive.
- [x] Tận dụng API và biểu mẫu D1 đã có của `customers`, `products`; menu đổi nhãn phù hợp template nhưng **chưa bổ sung đủ tất cả các trường đặc thù**.
- [x] API **POST /api/containers** mới cho ADMIN/BOD/SALES_MANAGER/SALES_ADMIN: kiểm tra mã container 4–64 ký tự, liên kết sản phẩm có thật và đang hoạt động, từ chối trùng, ghi audit trong D1 transaction. Tạo với số lượng và tồn = 0, **không nhập giá vốn/phiếu cân từ mã container**; Sales/Logistics chỉ có quyền xem.
- [x] Bộ test `tests/catalogs.test.mjs` kiểm tra chống trùng, mã sai, hàng chưa có, phân quyền, không tin giá vốn/số lượng ở input, audit và che giá vốn khỏi Sales.
- [x] Khắc phục tìm kiếm khi D1 Production **chưa áp dụng migration 0008_search_keys.sql**: API kiểm tra schema và dùng LIKE có escape khi thiếu `search_key`; khi migration có mặt thì dùng tìm kiếm bỏ dấu.

### Ranh giới phải giữ rõ
- [ ] Chưa phát triển **upload Excel/Google Sheets → staging → mapping → kiểm tra trùng → phê duyệt → ghi chính thức D1/hoàn tác**. Không tuyên bố ba template đã được import.
- [ ] Bảng `customers` hiện chưa phân biệt khách hàng với nhà cung cấp theo mã loại; chưa có trường riêng tên người liên hệ và điện thoại liên hệ, cũng chưa có cơ chế nhập mã cũ như `KH0001` riêng với UUID.
- [ ] Bảng `products` chưa có trường hình thức đóng gói và kg/thùng/pallet, cũng chưa chốt mã hàng cũ `HH0018` ↔ ID nội bộ.
- [ ] Mục `Mã công trình` trong file nguồn thực tế là **số container**, nhưng cần nghiệp vụ xác nhận quy tắc ánh xạ tên hàng → sản phẩm và tình trạng mã.
- [ ] Danh sách Container hiện chỉ cho tạo mã gắn sản phẩm; chưa mở chỉnh sửa hoặc xóa mã đã tồn tại (để tránh thay đổi dữ liệu liên quan phiếu cân, kho và giá vốn).
- [ ] UAT thực tế qua tài khoản Google chưa có biên bản; CI/deploy build không thay thế nghiệp vụ.
- [ ] Cần kiểm tra migration 0008 sau khi backup và được phê duyệt, chưa tự chạy schema change D1 trong đợt này.

**Lưu ý dữ liệu:** Chỉ sửa mã nguồn/triển khai GitHub–Pages; không nạp dữ liệu lịch sử từ spreadsheet hoặc thay đổi bản ghi Production trong lần triển khai này.

**Đối chiếu cuối cùng ngày 26/11/2026:** Cloudflare Pages deploy `c908d372e667b39bfba68f3881175a05eb6977d2` **success**. Truy vấn D1 chỉ đọc sau khi triển khai: `customers=13`, `leads=8`, `products=10`, `containers=0`, `audit_log=17`. Đây là snapshot **mới hơn** con số DEMO 12 khách hàng/0 audit ghi ở đầu tài liệu; có biến động dữ liệu trong lúc làm việc, không quy kết nguyên nhân khi chưa đối chiếu audit. Trong phiên triển khai danh mục này, trợ lý **không chạy lệnh ghi dữ liệu D1**, chỉ cập nhật repo và Cloudflare Pages tự deploy.


## Cập nhật 26/11/2026 — Hoàn thiện trường danh mục theo template nguồn

- [x] Đã đọc lại nguyên văn ba tab nguồn Google Sheets: `Mã khách hàng - NCC`, `Mã hàng hóa`, `Mã công trình`.
- [x] Tạo migration **`0009_catalog_templates.sql`** (chỉ ADD COLUMN và CREATE INDEX) cho mã nghiệp vụ cũ, loại đối tác, liên hệ, Sales nguồn, đóng gói, quy đổi và tên hàng nguyên văn theo container.
- [x] Đã lấy **D1 Time Travel bookmark** trước khi thay đổi: `0000003c-00000000-0000512f-728558f96ef7017e1b1af031019f2378`. Bảo quản trong tài liệu vận hành nội bộ; bookmark có thời hạn tùy chính sách Cloudflare, không thay thế backup độc lập.
- [x] Đã áp dụng migration 0009 lên D1 Production, ghi nhận vào `d1_migrations`. Đối chiếu có cột `partner_type`, `conversion_kg`, `source_product_name`. Không làm thay đổi số lượng bản ghi của khách hàng/sản phẩm/container; tại thời điểm đối chiếu `13/10/0`, audit `17`.
- [x] Đã mở rộng API đọc/ghi, kiểm tra email, mã nghiệp vụ cũ trùng, công nợ số ngày, quy đổi kg hợp lệ. Sales và nhóm không có quyền tài chính **không được thay đổi credit_days**, giá vốn container vẫn được phân quyền riêng.
- [x] Màn hình Khách hàng/NCC và Hàng hóa có đủ cột/biểu mẫu, Container có thêm trường tên hàng nguồn, giữ nguyên mã container và liên kết mã hàng D1.
- [x] Thêm test cấu trúc `tests/catalog-template-schema.test.mjs` và tài liệu mapping `docs/CATALOG_TEMPLATE_MAPPING.md`.
- [ ] Chưa xây dựng import hàng loạt Excel/Google Sheets với staging, xác minh trùng và phê duyệt.
- [ ] Chưa có bằng chứng UAT đăng nhập Google → tạo/sửa/tải lại các trường template trên trình duyệt.
- [ ] Chưa chốt ánh xạ Sales nguồn sang `owner_email` và xác minh đơn vị quy đổi dạng `Mã cân` từ phòng ban.
- [ ] Chưa có biên bản CI cho commit cuối trong lần rà soát (Cloudflare build/deploy là kiểm tra riêng).


## Cập nhật 26/11/2026 — Phân hệ Nhập dữ liệu Excel dành riêng cho ADMIN

**Yêu cầu:** Tách nhập Excel khỏi ba danh mục, đặt trong phần Quản trị hệ thống và chỉ tài khoản ADMIN thao tác.

### Đã ghi mã trong repo
- [x] `src/CRMApp.jsx`: thêm menu **Quản trị → Nhập dữ liệu Excel** (`#/imports`), ẩn với các vai trò không phải ADMIN. Trang chỉ render với ADMIN; người truy cập route trực tiếp khi không có quyền được chuyển về Tổng quan.
- [x] `src/AdminExcelImport.jsx`: tải file, chọn Khách hàng/NCC / Hàng hóa / Container, chọn loại đối tác, xem kết quả kiểm tra từng dòng, đánh dấu xác nhận, ghi D1, xem lịch sử các đợt.
- [x] `src/importExcelParser.js`: đọc `.xlsx` và `.csv` tại trình duyệt, ánh xạ đúng tiêu đề nguồn, có giới hạn kích thước 3 MB/1.000 dòng. Nội dung file gốc không được gửi lên máy chủ; chỉ gửi các trường được chuẩn hóa để kiểm tra và nhập. Trình duyệt cần hỗ trợ giải nén `deflate-raw` cho xlsx; trường hợp không hỗ trợ, có thể lưu CSV UTF-8.
- [x] `worker/src/imports.js`: API chỉ ADMIN (`/api/imports/preview`, `/commit`, `/history`); API tự kiểm tra mã trùng, loại dữ liệu, giới hạn mỗi đợt 30 dòng, đối chiếu sản phẩm cho container, ghi INSERT+audit+batch log trong một giao dịch. Không tự sửa/xóa bản ghi cũ, không thay tồn kho/giá vốn.
- [x] `worker/migrations/0010_import_batches.sql`: bảng lưu lô nhập; migration đã được áp dụng qua Cloudflare API, có ghi trong `d1_migrations`. Có Time Travel bookmark trước migration.
- [x] `tests/import-parser.test.mjs`, `tests/import-api.test.mjs`: kiểm tra ánh xạ template CSV, quyền ADMIN, chống trùng, lưu audit và lịch sử.
- [x] Đã thêm style theo bố cục V0.4.

### Kiểm chứng / giới hạn
- [x] Migration 0010 báo thành công; số đếm D1 trước migration: 13 khách hàng, 10 sản phẩm, 0 container, 17 audit. **Không dùng template nguồn để nhập thử vào Production.**
- [ ] **Chưa xác nhận Cloudflare deploy của commit cuối** do API Cloudflare trả HTTP 503 trong các lần tra cứu trạng thái mới nhất. Mã nguồn đã có trong repo nhưng không được khẳng định giao diện production đã phát hành.
- [ ] Chưa có biên bản chạy GitHub Actions cho toàn bộ test ở commit mới nhất và chưa UAT thực tế trong phiên Google ADMIN.
- [ ] Preview hiện kiểm tra từng đợt nhỏ; khi file rất lớn có thể cần tiếp tục hoàn thiện tiến trình nhập nền và khả năng khôi phục từ dòng cuối.
- [ ] Với template Container chỉ có tên hàng, mã hàng được đối chiếu bằng tên khớp chính xác; nếu không khớp, hệ thống từ chối và yêu cầu làm sạch dữ liệu hoặc bổ sung mã sản phẩm.
- [ ] Với template Khách/NCC chưa có cột phân loại: ADMIN chọn loại áp dụng cho lô. Sale nguồn được bảo toàn bằng tên, owner_email tạm là tài khoản ADMIN thực hiện nhập; cần chốt ánh xạ Sales thực tế trước khi sử dụng nghiệp vụ phân quyền sở hữu.

**Không được nhập file dữ liệu thật cho đến khi kiểm thử ứng dụng thực tế, test import-preview/commit và quy trình sao lưu đạt.**
