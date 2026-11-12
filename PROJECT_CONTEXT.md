# PROJECT_CONTEXT.md — CT FOOD CRM

> **Trạng thái:** Dự án đang phát triển; tài liệu bàn giao bối cảnh kỹ thuật và nghiệp vụ.
> **Cập nhật:** 12/11/2026 (Asia/Bangkok)
> **Phiên bản mã nguồn được ghi nhận:** V0.1 — giao diện demo và API đọc dữ liệu, **chưa kiểm thử build / triển khai production**.
> **Repository:** https://github.com/truongtho6699/CRM-CTFood
> **Nguyên tắc:** Phân biệt `ĐÃ KIỂM CHỨNG`, `ĐÃ CÓ MÃ / CHƯA KIỂM THỬ`, `ĐỀ XUẤT`, `CHƯA CHỐT`. Không suy diễn mã nguồn đã viết là chức năng đã nghiệm thu.

## 1. Mục tiêu và bối cảnh

CT FOOD kinh doanh/phân phối thực phẩm đông lạnh, cần hệ thống quản lý khách hàng và vòng đời bán hàng, từ đầu mối/khách hàng, báo giá, đơn hàng, container/lô hàng, giao thực tế theo phiếu cân, thu tiền/cọc, công nợ đến báo cáo doanh số, giá vốn, lợi nhuận, hoa hồng và KPI.

**Quyết định từ người sử dụng:**
- **Không sử dụng MISA** làm nền tảng dự án CRM CT FOOD.
- **Hệ thống KPI là hệ thống duy nhất đã xác nhận triển khai thực tế** tại thời điểm lập bối cảnh này. Không coi CRM, ứng dụng Sale hoặc phần mềm kế toán khác là đang vận hành nếu chưa có bằng chứng.
- Mã nguồn dự án lưu tại `truongtho6699/CRM-CTFood`.
- Hướng hạ tầng lựa chọn: **Cloudflare**.
- Ưu tiên tận dụng dữ liệu báo cáo hiện có, giữ số liệu nguồn và KPI ổn định, giảm nhập lại dữ liệu, phân quyền chặt chẽ, sử dụng tốt trên điện thoại.

**Lưu ý về quyết định kiến trúc:** ERPNext/Frappe CRM, Krayin và Twenty đã từng được đem ra so sánh. **Repo này hiện là dự án mã nguồn riêng React/Vite + Cloudflare Workers/D1, không phải mã nguồn ERPNext và không xác nhận đã cài ERPNext**. Việc tiếp tục theo hướng tự xây cần được đánh giá chi phí/bảo trì so với giải pháp mã nguồn mở trước khi production.

## 2. Nguồn tài liệu đầu vào và thứ tự tham chiếu

1. **Đặc tả ban đầu** (bản nháp 0.1, 02/11/2026): https://docs.google.com/document/d/1fnmMQ5YDFvsShXuIv7ckMeWPGnq2o8Ugh8pR-leCzPM/edit
2. **Báo cáo kinh doanh HCM 2026** (báo cáo nguồn đến 10/10/2026): https://docs.google.com/spreadsheets/d/1ZzdiG7FahASRemrIS1YhI25pvE2JBX28u7IGe0GoRyc/edit
3. **Yêu cầu đội Sale và bảng rà soát nghiệp vụ** (tab `Trang tính2`, `Rivew 1`): https://docs.google.com/spreadsheets/d/1cbl_q8uxH_IlGil5XLxU2fOGrqRt9_-hP42wWZTAiuQ/edit?gid=1923294201
4. **Figma CT FOOD CRM — bộ bản vẽ V1:** https://www.figma.com/design/ZznXmotchhivlZ05NQllXE
5. **Hướng dẫn kiến trúc/triển khai:** [README.md](./README.md), [DEPLOYMENT.md](./DEPLOYMENT.md).

**Ưu tiên khi có xung đột:** quyết định đã được CT FOOD/BGĐ/Kế toán phê duyệt > dữ liệu chứng từ đã đối soát > đặc tả mới nhất đã phê duyệt > đề xuất trong tài liệu nháp. **Không tự chọn một phương án từ hai tài liệu mâu thuẫn rồi coi là quy định đã chốt.**

## 3. Phạm vi nghiệp vụ dự kiến

### 3.1. Luồng cốt lõi

Khách hàng/khách tiềm năng → báo giá/chấp thuận điều kiện bán → đơn hàng (Offer hoặc hàng sẵn kho) → chuẩn bị hàng/container → giao một hoặc nhiều lần theo phiếu cân → xác nhận khối lượng thực giao → xác nhận thu tiền/cọc và phân bổ khoản thu → xác định công nợ/tuổi nợ → báo cáo và dữ liệu phục vụ KPI.

### 3.2. Danh sách chức năng

| Phân hệ | Yêu cầu đích | Mức độ ưu tiên |
| --- | --- | --- |
| Khách hàng | Danh mục, liên hệ, MST, địa chỉ, phân nhóm, Sales phụ trách, hạn mức tín dụng | P0 |
| CRM và chăm sóc | Khách tiềm năng, lịch gọi/gặp, nhắc việc, bàn giao khách | P1; phạm vi chi tiết chờ chốt |
| Sản phẩm | Mã hàng, nhóm hàng, xuất xứ, thương hiệu, đơn vị tính kg | P0 |
| Báo giá/đơn hàng | Nhiều mặt hàng, giá trước VAT, chiết khấu, loại Offer/hàng sẵn, cọc dự kiến, phê duyệt | P0 |
| Giao hàng | Lịch giao, nhiều lần giao, phiếu cân, khối lượng thực tế, chênh lệch, container/xe | P0 |
| Container/lô/kho | Lô nhập, container, nhà cung cấp, kho, tồn, nguyên tắc phân bổ giá vốn | P0/P1 |
| Thanh toán/công nợ | Cọc, thu từng phần, phân bổ một phiếu thu cho nhiều đơn, tuổi nợ, hạn mức | P0 |
| Lợi nhuận/hoa hồng | Giá vốn theo container hoặc phương pháp được duyệt, lãi gộp, hoa hồng | P1 |
| Báo cáo | Tổng quan, doanh thu tháng, Sales, khách hàng, sản phẩm, đơn chờ giao, công nợ | P1 |
| KPI | Trao đổi dữ liệu sản lượng và doanh thu **đã được xác nhận** với hệ thống KPI hiện hữu | P1, chưa tích hợp |
| Quản trị | Vai trò, kiểm soát quyền, duyệt ngoại lệ, khóa sổ, nhật ký, sao lưu/khôi phục | P0 |

### 3.3. Quy tắc nghiệp vụ quan trọng

- **Đơn ≠ giao hàng:** một đơn có thể giao nhiều lần; nguồn doanh số quản trị và KPI phải căn cứ **khối lượng thực giao đã xác nhận**, không lấy số lượng dự kiến trong đơn.
- Phải lưu riêng đầu đơn, các dòng sản phẩm và từng phiếu/lần giao; hỗ trợ quan hệ đơn ↔ container thông qua các lần giao.
- Tiền cọc và tiền thực thu là **giao dịch có số tiền, thời gian, chứng từ**, không chỉ là dấu tích `Đã thanh toán`. Một khoản thu có thể phân bổ nhiều đơn; cần quản lý hoàn/chuyển cọc.
- Cần thống nhất giá gốc trước hay sau VAT, thuế suất, chiết khấu/kg, dung sai chênh lệch cân, thời điểm ghi nhận doanh số và bắt đầu tính tuổi nợ.
- Bảo vệ **giá vốn, lợi nhuận** ở phía API/máy chủ, bao gồm cả kết quả tìm kiếm và xuất file; không chỉ ẩn cột ở trình duyệt.
- Sai sót sau khóa sổ cần chứng từ điều chỉnh và người phê duyệt; không xóa/sửa lịch sử âm thầm.
- Các dữ liệu bán hàng lịch sử cần đối soát chứng từ với Kế toán trước khi dùng làm số liệu chính thức.

### 3.4. Mâu thuẫn chưa được chốt

- **Trạng thái đơn:** yêu cầu Sales dùng `CHỜ GIAO / THÀNH CÔNG / HỦY`; đặc tả đầu tiên nêu `Nháp / Đã cọc / Giao một phần / Đã giao / Hoàn tất / Đã hủy`. Đề xuất trạng thái nội bộ chi tiết và nhãn Sales đơn giản, **chưa phê duyệt**.
- **Công thức lãi:** tài liệu ban đầu tách hoa hồng khỏi lãi gộp; đề xuất từ Sales có công thức trừ chiết khấu/hoa hồng. Cần BGĐ/Kế toán chốt.
- **Giá vốn:** cần xác nhận theo container thực xuất, lô nhập hay bình quân; cách phân bổ tỷ giá, chi phí nhập và điều chỉnh sau kỳ.
- **Kỳ doanh thu:** báo cáo quản trị theo ngày giao hay kế toán theo hóa đơn; phải phân biệt hai khái niệm.
- **Phạm vi toàn hệ thống:** CRM + bán hàng/công nợ hay bao gồm cả kho, mua hàng, kế toán đầy đủ.
- **Vai trò:** Sales Admin và Logistics/Kho là một hay hai vai trò; quyền Trưởng phòng trong duyệt chiết khấu và xem giá vốn chưa chốt.

## 4. Báo cáo gốc và chuyển đổi dữ liệu

Báo cáo đã cung cấp có các tab như `TỔNG QUAN`, `ĐƠN CHƯA GIAO`, `DOANH THU THÁNG`, `THEO SALES`, `KHÁCH HÀNG`, `SẢN PHẨM`, `DỮ LIỆU 2026`, `PHƯƠNG PHÁP`, `DỮ LIỆU NGUỒN NGUYÊN BẢN`.

- Báo cáo tại thời điểm **10/10/2026** nêu doanh thu nguồn đã giao khoảng **158,07 tỷ đồng**, sản lượng khoảng **2.657 tấn**, đơn chờ giao khoảng **57,98 tỷ đồng**, biên lãi/lỗ nguồn ước tính khoảng **1,25%**.
- **Các số liệu trên chưa được đối soát đầy đủ với Kế toán** và **không được sử dụng như số liệu hạch toán chính thức**.
- Đặc tả ban đầu dự kiến nhập **481 dòng lịch sử**, chuẩn hóa khoảng **86 khách hàng**. Đây là **số lượng/khối lượng trong tài liệu nháp**, phải xác minh lại trước khi chuyển đổi.
- Cần chuẩn hóa mã khách, MST, tên Sale, sản phẩm, ngày giao, mã đơn, container; xử lý dòng trùng sau khi đối chiếu chứng từ, không tự xóa dòng có vẻ giống nhau.
- Không thay đổi trực tiếp các file báo cáo/kế toán nguồn nếu chưa có đồng ý.

## 5. Kiến trúc kỹ thuật dự kiến trên Cloudflare

```text
Trình duyệt (desktop/mobile)
          |
          v
Cloudflare Pages — React + Vite (frontend)
          |
          |  [CHƯA KẾT NỐI API Ở V0.1]
          v
Cloudflare Access — xác thực danh tính/JWT
          |
          v
Cloudflare Workers — API, phân quyền, nghiệp vụ
          |
          v
Cloudflare D1 — dữ liệu quản trị
          |
          +--- [TƯƠNG LAI / SAU PHÊ DUYỆT] --- Hệ thống KPI hiện hữu
```

### 5.1. Cấu trúc repository hiện ghi nhận

```text
README.md
DEPLOYMENT.md
PROJECT_CONTEXT.md
package.json
index.html
.gitignore
src/
  main.jsx          # React UI / dữ liệu demo
  style.css         # Giao diện responsive
  data.js           # Danh mục, cấu trúc form, dữ liệu giả lập
worker/
  package.json
  wrangler.toml     # Đang dùng placeholder database_id
  src/index.js      # Worker API đọc có kiểm tra Access JWT
  migrations/0001_init.sql
```

### 5.2. Dữ liệu và API

- Frontend V0.1 dùng `localStorage` để tạo/sửa dữ liệu **demo trong từng trình duyệt**; không đồng bộ máy chủ, không bảo mật mức production.
- Worker khai báo đường dẫn `/health`, `/api/me` và các endpoint **GET** cho danh mục `customers`, `products`, `orders`, `order_lines`, `deliveries`, `containers`, `payments`, `activities`.
- Worker dự kiến xác minh JWT `Cf-Access-Jwt-Assertion` từ Cloudflare Access theo JWKS, issuer, audience và kiểm tra tài khoản trong `app_users`. **Chưa xác thực hoạt động trên Cloudflare thật**.
- API V0.1 **từ chối các lệnh ghi**; chưa có luồng ghi production.
- Schema D1 khởi tạo `app_users`, `customers`, `products`, `containers`, `orders`, `order_lines`, `deliveries`, `payments`, `payment_allocations`, `activities`, `audit_log`.
- **Thiết kế mẫu chưa hoàn chỉnh cho số liệu tài chính:** các trường `REAL` của D1 và tính toán Javascript `Number` không nên sử dụng làm sổ tiền/khối lượng chính thức trước khi xây dựng quy tắc số nguyên/decimal, làm tròn, giao dịch/đối soát.

### 5.3. Kiến trúc và bảo mật bắt buộc trước production

- Frontend và API phải cùng đi qua cơ chế đăng nhập/ủy quyền đã kiểm thử; không cho phép trình duyệt tự khai báo danh tính bằng header email.
- Giới hạn quyền truy cập theo **vai trò và phạm vi đối tượng**, không chỉ quyền toàn bảng. Cần kiểm thử Sales không thể đọc công nợ/khách hàng ngoài phạm vi; giá vốn không xuất trong response Sales.
- Chặn ghi ngoài luồng duyệt, kiểm soát giao dịch đồng thời, idempotency, trùng chứng từ và nhật ký thay đổi.
- Có quy trình backup/restore D1, giám sát lỗi, quản lý secrets, chính sách thời hạn lưu chứng từ và khôi phục khi lỗi.
- Chưa có chứng cứ rằng Cloudflare Pages, Worker, D1, Access đã được tạo/triển khai cho repository này.
- Không công bố endpoint production khi bảo mật và nghiệp vụ ghi chưa nghiệm thu.

## 6. Trạng thái triển khai và mức độ tin cậy

| Hạng mục | Trạng thái | Bằng chứng / giới hạn |
| --- | --- | --- |
| Repo `CRM-CTFood` | **ĐÃ KIỂM CHỨNG** | GitHub truy cập được, tệp nguồn hiện hữu trên nhánh `main` |
| `README.md`, `DEPLOYMENT.md` | **ĐÃ KIỂM CHỨNG** | Đã đọc trực tiếp từ repo |
| Frontend React/Vite | **ĐÃ CÓ MÃ / CHƯA KIỂM THỬ** | `src/main.jsx`, `src/style.css`, `src/data.js` |
| Thao tác demo khách hàng, đơn, giao, phiếu thu | **ĐÃ CÓ MÃ / CHƯA KIỂM THỬ** | Sử dụng localStorage; không phải nghiệp vụ production |
| API Worker GET và kiểm tra JWT | **ĐÃ CÓ MÃ / CHƯA KIỂM THỬ** | `worker/src/index.js`; chưa có môi trường Access/D1 thật |
| Database schema D1 | **ĐÃ CÓ MÃ / CHƯA ÁP DỤNG** | `worker/migrations/0001_init.sql` |
| Build frontend / chạy local | **CHƯA KIỂM CHỨNG** | Chưa ghi nhận lệnh cài dependency, build thành công |
| Deploy Cloudflare Pages | **CHƯA THỰC HIỆN / CHƯA XÁC NHẬN** | Chưa có URL Preview hay kiểm thử |
| Deploy Worker + D1 + Access | **CHƯA THỰC HIỆN / CHƯA XÁC NHẬN** | Còn placeholder `database_id`, chưa có secrets |
| Frontend ↔ Worker ↔ D1 | **CHƯA KẾT NỐI** | Chế độ frontend hiện độc lập |
| Nghiệp vụ thu/chi, công nợ, giá vốn chính xác | **CHƯA NGHIỆM THU** | Công thức/sổ cái/phân bổ/điều chỉnh chưa hoàn thiện |
| Tích hợp KPI | **CHƯA THỰC HIỆN** | Chỉ có hệ thống KPI cũ là đang vận hành |
| Bản vẽ Figma | **ĐÃ TẠO / CHƯA DUYỆT UX** | Bộ phác thảo 24 màn hình desktop, 6 mobile, 1 sơ đồ phân hệ |

**Không được phát biểu \"đã triển khai phần mềm hoàn chỉnh\", \"đã vận hành Cloudflare\" hoặc \"đã nghiệm thu\" khi chưa có biên bản/kiểm thử và URL môi trường thực tế.**

## 7. Các vấn đề phải làm rõ (nguồn: tab `Rivew 1`)

Checklist khảo sát nằm tại:
https://docs.google.com/spreadsheets/d/1cbl_q8uxH_IlGil5XLxU2fOGrqRt9_-hP42wWZTAiuQ/edit?gid=1923294201

Checklist đã được lập với **48 câu hỏi**, chia 8 nhóm:
- A: Phạm vi và tổ chức (A01–A05)
- B: Khách hàng & CRM (B01–B06)
- C: Đơn hàng và báo giá (C01–C07)
- D: Container, kho và giao hàng (D01–D07)
- E: Thanh toán và công nợ (E01–E06)
- F: Giá vốn, lợi nhuận và hoa hồng (F01–F05)
- G: Báo cáo và KPI (G01–G05)
- H: Phân quyền, dữ liệu và kỹ thuật (H01–H07)

**Quy ước:** `P0` phải thống nhất trước khi thiết kế chốt; `P1` cần thống nhất trước khi phát triển/đưa chức năng vào dùng; `P2` có thể ở giai đoạn mở rộng. Trạng thái mặc định `Chưa xác nhận` **không có nghĩa** CT FOOD đã đồng ý với phương án đề xuất.

## 8. Danh sách công việc tiếp theo

### P0 — Bảo đảm có thể phát triển an toàn

1. [ ] Chốt phạm vi giai đoạn đầu cùng BGĐ: CRM + bán hàng + giao hàng + công nợ, có/không bao gồm kế toán và kho đầy đủ.
2. [ ] Chốt vai trò, phân quyền khách/đơn, quyền phê duyệt và dữ liệu tài chính.
3. [ ] Chốt mô hình giao nhiều lần, phiếu cân, container, đơn Offer/hàng sẵn.
4. [ ] Chốt quy tắc doanh thu, VAT, giá vốn, thanh toán/cọc, tuổi nợ, hoàn/điều chỉnh.
5. [ ] Kiểm tra repo, cài Node dependencies, chạy lint/build/manual test; xử lý lỗi; ghi nhận kết quả và commit.
6. [ ] Kiểm tra hoạt động giao diện responsive; đối chiếu Figma với màn hình thật.
7. [ ] Tạo bộ test nghiệp vụ với **dữ liệu giả lập**, gồm giao nhiều lần, một đơn nhiều container, một khoản thu nhiều đơn, hủy/hoàn cọc, đổi trả, duyệt bán dưới giá vốn.
8. [ ] Thiết kế sơ đồ dữ liệu và API production, dùng kiểu tiền và khối lượng chính xác; giao dịch và audit chống thay đổi trái phép.
9. [ ] Thiết lập môi trường thử nghiệm Cloudflare Pages/Workers/D1/Access khi được phê duyệt; không triển khai production.
10. [ ] Kiểm thử quyền và bảo mật; ghi nhận lỗi trước khi mở ghi trên máy chủ.

### P1 — Hoàn thiện ứng dụng

11. [ ] Gắn frontend với API đã xác thực; thay thế localStorage bằng API thật khi sẵn sàng.
12. [ ] Xây chức năng tạo/sửa đơn nhiều dòng, xác nhận giao, quản lý tồn từng container.
13. [ ] Hoàn thiện thanh toán một-nhiều, công nợ và tuổi nợ theo quy tắc đã chốt.
14. [ ] Hoàn thiện workflow phê duyệt, quản lý kỳ và chứng từ điều chỉnh.
15. [ ] Đối chiếu dữ liệu chuyển đổi lịch sử cùng Kế toán.
16. [ ] Xây các báo cáo 6 góc nhìn, xuất file an toàn, báo cáo giá vốn/lãi gộp theo vai trò.
17. [ ] Thiết kế kết nối **đọc dữ liệu** phục vụ KPI, tránh ghi/sửa trực tiếp hệ KPI đang chạy.
18. [ ] Thử nghiệm UAT theo vai trò, trên máy tính và điện thoại; có tiêu chí đạt/chưa đạt.

### P2 — Mở rộng

19. [ ] Tự động nhắc chăm sóc khách, công nợ; cân nhắc Zalo/email khi có cơ sở đồng ý và kênh được phép.
20. [ ] Bổ sung luồng mua hàng, quản lý tồn sâu, dự báo theo nhu cầu thực tế.
21. [ ] AI hỗ trợ tóm tắt, dự báo, cảnh báo sau khi dữ liệu và quyền đã ổn định.

## 9. Những điều **không được tự ý thay đổi**

1. Không dùng MISA cho dự án này trừ khi CT FOOD đổi chủ trương bằng quyết định rõ ràng.
2. Không sửa hệ thống KPI đang hoạt động, cấu hình KPI, dữ liệu KPI hoặc công thức KPI khi chưa được chấp thuận và có phương án khôi phục.
3. Không sửa dữ liệu báo cáo gốc, không tự xóa dòng trùng, không chuyển dữ liệu thật lên môi trường thử nghiệm khi chưa được cho phép.
4. Không lộ giá vốn, lợi nhuận, dữ liệu tài chính nhạy cảm cho Sales hoặc người không đủ quyền, kể cả qua API/export/log.
5. Không tự triển khai production, đổi DNS/tên miền, tạo dịch vụ có phí, bật public endpoint hay sử dụng tài khoản thật khi chưa được duyệt.
6. Không đưa secrets, JWT, token, mật khẩu, email nội bộ hoặc dữ liệu khách hàng thật vào GitHub công khai.
7. Không coi đề xuất tỷ lệ chiết khấu/hoa hồng, cách tính giá vốn/lãi hoặc trạng thái đơn là quy định chính thức nếu chưa được chốt.
8. Không sửa logic nghiệp vụ đã khóa sổ mà thiếu chứng từ điều chỉnh/phê duyệt/audit.
9. Không đánh đồng dữ liệu mẫu demo và dữ liệu báo cáo thực tế.
10. Khi thay đổi kiến trúc, phải cập nhật `README.md`, `DEPLOYMENT.md` và tài liệu này, nêu tác động và khả năng rollback.

## 10. Tiêu chí nghiệm thu trước khi cho người dùng thật

- [ ] Frontend build và chạy ổn trên desktop + mobile, không có lỗi nghiêm trọng.
- [ ] Cloudflare Access, API, D1 xác minh danh tính và cấp quyền đúng.
- [ ] Người dùng Sales không thể nhìn/tải dữ liệu ngoài quyền; không đọc giá vốn/lợi nhuận.
- [ ] Tạo đơn nhiều dòng và giao nhiều lần không làm lệch lượng giao/đơn.
- [ ] Xác nhận phiếu cân không trùng; có kiểm soát sửa/hủy.
- [ ] Thu tiền một hoặc nhiều đơn, cọc và hoàn cọc được đối chiếu đến từng chứng từ.
- [ ] Công nợ khách/đơn, giá vốn, lợi nhuận, hoa hồng khớp mẫu tính tay được Kế toán xác nhận.
- [ ] Báo cáo theo Sales, khách, mặt hàng, tháng và đơn chờ giao khớp dữ liệu kiểm thử.
- [ ] Hệ thống KPI cũ không bị ảnh hưởng; số liệu tích hợp có nguồn và đối chiếu.
- [ ] Sao lưu/khôi phục, audit, phân quyền, kiểm thử UAT và kế hoạch rollback đều đạt.

## 11. Hướng dẫn dùng tài liệu này cho các lần làm việc tiếp

Trước khi sửa mã:
1. Đọc tài liệu này, `README.md`, `DEPLOYMENT.md`, yêu cầu gốc và tình trạng `Rivew 1` mới nhất.
2. Kiểm tra repo và commit hiện tại, không giả định code/build đã đúng.
3. Phân biệt việc **đã kiểm chứng**, **mã đã viết**, **đề xuất** và **chưa chốt**.
4. Nêu rõ thay đổi dự kiến, ảnh hưởng tới dữ liệu/quyền/KPI trước khi chỉnh code.
5. Chỉ triển khai môi trường thật sau khi được phê duyệt; ưu tiên kiểm thử trên dữ liệu giả lập.
6. Sau mỗi thay đổi đáng kể: cập nhật trạng thái, tài liệu và kết quả kiểm thử trong repo.

---

*Tài liệu này là bản ghi bối cảnh để tiếp tục phát triển, **không thay thế BRD/SRS đã được phê duyệt, nghiệm thu UAT hoặc tài liệu vận hành production**.*


## 12. Cập nhật triển khai Cloudflare ngày 12/11/2026

**Đã kiểm tra trực tiếp qua Cloudflare API**:

- Cloudflare Pages: `crm-ctfood`, tài khoản `00c6e399d9baf5da69a16301d8c5e4a6`; liên kết GitHub `truongtho6699/CRM-CTFood` nhánh `main`.
- Trang dự kiến: https://crm-ctfood.pages.dev
- Cấu hình build đã đặt: `npm run build`, thư mục `dist`.
- Đã tạo **D1** riêng tên `ctfood-crm`, ID `31866ea2-8f55-4dcb-b504-58bb3f3059b9`, khu vực APAC.
- Đã áp dụng `0001_init.sql` vào D1 và đọc lại các bảng: `app_users`, `customers`, `products`, `orders`, `order_lines`, `deliveries`, `containers`, `payments`, `payment_allocations`, `activities`, `audit_log`.
- Đã binding Pages Functions `DB` tới D1 trên cả Preview và Production.
- Đã thêm `functions/api/health.js` để kiểm tra kết nối D1, và `functions/api/[[path]].js` cho API bảo vệ quyền. Phần này có mã trong repo.
- Đã xác nhận một deployment Cloudflare Pages chạy **build/deploy thành công và `uses_functions=true`** (commit `cc7d7228d9a83e1f2ac6370a1d99f53ca19ee111`).
- **BẢO MẬT CHƯA HOÀN TẤT**: Cloudflare API trả `access.api.error.not_enabled`. Chưa có ứng dụng Access/đăng nhập được cấp quyền. Các API nghiệp vụ sẽ từ chối truy cập khi thiếu cấu hình Access.
- **CHƯA ĐẠT YÊU CẦU LƯU DỮ LIỆU QUA GIAO DIỆN**: frontend vẫn dùng `localStorage`; D1 đã tạo cấu trúc nhưng chưa mở API ghi an toàn và chưa kết nối frontend ↔ API D1.

**Việc phải làm tiếp:**
1. Kích hoạt Cloudflare Access trên tài khoản (có sự đồng ý của quản trị viên) và cấu hình ứng dụng bảo vệ `crm-ctfood.pages.dev`, chính sách nhóm người được phép truy cập.
2. Cấu hình `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` cho API; kiểm tra JWT và ánh xạ người dùng trong `app_users`.
3. Hoàn thiện endpoints `POST/PATCH` có validation, phân quyền theo bản ghi, audit và giao dịch; kết nối giao diện để **lưu D1**.
4. Kiểm tra smoke test trang chủ và `/api/health`, luồng tạo/đọc/sửa khách hàng và đơn hàng bằng dữ liệu thử.
5. Chưa đưa dữ liệu thật vào D1 trước khi kiểm thử bảo mật, xác minh backup/restore và quy tắc nghiệp vụ.


## 13. Cập nhật xác thực Access và lưu D1 — 12/11/2026

**Đã xác minh qua Cloudflare API:**
- Cloudflare Zero Trust organization đang hoạt động: `rapid-hill-8ea1.cloudflareaccess.com`.
- Ứng dụng Access `CT FOOD CRM - Authorized Users` bảo vệ `crm-ctfood.pages.dev`. Chính sách ban đầu chỉ cho phép tài khoản quản trị Cloudflare đã xác minh; không mở truy cập cho toàn bộ Internet.
- Đã cấu hình `CF_ACCESS_TEAM_DOMAIN` và `CF_ACCESS_AUD` vào Cloudflare Pages production/preview (AUD là định danh ứng dụng, không phải mật khẩu).
- Đã thêm đúng **1 tài khoản ADMIN** trong bảng `app_users`. Không có dữ liệu khách hàng/sản phẩm/khách tiềm năng thật.
- Đã tạo bảng `leads` trong D1 qua migration `0002_leads.sql`.
- API trong `worker/src/index.js` hiện có **GET, POST, PATCH** đối với `customers`, `products`, `leads`, với kiểm tra JWT Access, quyền theo vai trò, dữ liệu đầu vào và ghi `audit_log`.
- Đã kết nối ba phân hệ trên giao diện React với API cùng tên miền `/api`; nếu xác thực không thành công, giao diện báo rõ trạng thái DEMO và không tuyên bố dữ liệu đã lưu D1.
- **Đã xác nhận Cloudflare Pages build và deploy thành công** đối với commit giao diện tích hợp D1 `b47a4c65d9032d58579b77ad7bdabb34468e0f7a`. Pages Functions `uses_functions = true`.
- Đã xác nhận một nhà cung cấp đăng nhập loại `cloudflare` đang được cấu hình trong Zero Trust.

**Chưa kiểm chứng / chưa nghiệm thu:**
- Chưa có kiểm thử end-to-end từ phiên đăng nhập trình duyệt của người dùng: thêm khách, tải lại, xác nhận vẫn tồn tại D1, phân quyền và lịch sử audit.
- Các phân hệ `orders`, `deliveries`, `payments`, `containers` vẫn **chưa có API ghi production**; giao diện các phần này vẫn DEMO (`localStorage`).
- Chưa nhập dữ liệu thực; chưa thiết lập đầy đủ backup/restore và UAT tài chính.
- Không coi D1 được tạo và mã CRUD đã viết là chứng nhận toàn hệ thống đã sẵn sàng production.

**Kiểm thử bắt buộc tiếp theo:** Đăng nhập `https://crm-ctfood.pages.dev` bằng tài khoản quản trị được cho phép; vào `Khách hàng`, nhập một bản ghi hoàn toàn giả lập, lưu, tải lại trang, kiểm tra dữ liệu còn tồn tại; đối chiếu bảng `customers` và `audit_log` trong D1. Nếu giao diện hiển thị `DEMO`, **không nhập dữ liệu thật** và kiểm tra lại Access/JWT/Pages API. Kiểm thử sản phẩm và khách tiềm năng tương tự.


## 14. Cập nhật V0.2 — Kiểm soát trạng thái lưu D1 (12/11/2026)

Các thay đổi mã nguồn được đẩy lên GitHub sau khi kích hoạt Cloudflare Access:

- Giao diện không còn cho tạo/sửa/CSV ở ba danh mục D1 khi **API chưa xác thực**. Không được âm thầm ghi vào `localStorage` trong trường hợp kết nối D1 lỗi.
- Biểu mẫu ghi rõ nút `Lưu lên D1` khi kết nối hợp lệ; các phân hệ còn ở giai đoạn demo ghi `Lưu dữ liệu mẫu`.
- Bổ sung `Làm mới D1` và đọc danh sách phân trang nhiều đợt (tối đa 2.000 bản ghi/đợt tải hiện tại).
- Nút tạo/sửa sản phẩm phản ánh quyền cơ bản của người dùng; API vẫn là nơi quyết định quyền cuối cùng.
- API ghi D1 yêu cầu `Origin` khớp tên miền và `Content-Type: application/json` nhằm hạn chế ghi yêu cầu chéo nguồn.
- Sửa `/api/health` phản ánh thực trạng JWT bắt buộc thay vì thông báo Access chưa được bật.
- Bỏ hai trường `hạn mức nợ` và `số ngày được nợ` khỏi form live vì API chưa ghi chúng và chính sách tín dụng chưa chốt. Không được hứa hai trường đã được lưu.
- Đã tạo checklist kiểm thử `docs/UAT_D1_V02.md` với 15 kịch bản chưa xác nhận.

**Giới hạn còn tồn tại:** Chưa kiểm thử UI qua phiên đăng nhập thực: kết nối điều khiển trình duyệt Opera báo `Browser not connected`. Kiểm tra build Cloudflare có thể xác nhận giao diện biên dịch, nhưng **không thay thế thử nghiệm API GET/POST/PATCH qua Access từ trình duyệt được cấp quyền**. Phải hoàn thành UAT trước khi dùng dữ liệu khách hàng thật. Không nhập bản ghi thử vào danh mục kinh doanh nếu không có quy tắc nhận diện/xóa test và đối chiếu audit.
