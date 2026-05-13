# Đặc tả Product Backlog (PB01–PB26)

**Hướng dẫn:** Mỗi mục PB dưới đây dùng định dạng **hai cột phân tách bằng phím Tab** (cột nhãn — cột nội dung), phù hợp sao chép sang bảng Word/Excel. Base URL API của ứng dụng có tiền tố ngữ cảnh `/api`.

---

1.1. Đặc tả Product Backlog Đăng ký

ID	PB01
Tiêu đề	Đăng ký
Tác nhân	Người dùng chưa đăng nhập
Mô tả	Chức năng cho phép người dùng tạo tài khoản khách trên hệ thống bằng cách nhập họ tên, email, số điện thoại, mật khẩu và xác nhận mật khẩu. Sau khi đăng ký thành công, người dùng được chuyển sang trang đăng nhập; sau khi đăng nhập mới sử dụng các chức năng nâng cao như đặt bàn, xem lịch sử đơn hàng và nhận thông báo. Hệ thống không lưu phiên JWT trên giao diện ngay sau bước đăng ký.
Các bước thực hiện	● 1. Người dùng truy cập trang “Đăng ký” trên website.
● 2. Người dùng nhập các thông tin cần thiết:
●	Họ và tên   
●	Email
●	Số điện thoại
●	Mật khẩu
●	Xác nhận mật khẩu
● 3. Người dùng nhấn nút “Đăng ký”.
● 4. Giao diện (Frontend) kiểm tra định dạng dữ liệu tại máy khách, sau đó gửi dữ liệu đăng ký đến máy chủ (Backend) thông qua RESTful API.
● 5. Backend thực hiện:
●	Kiểm tra dữ liệu hợp lệ
●	Kiểm tra email và số điện thoại đã tồn tại hay chưa
● 6. Nếu hợp lệ:
●	Lưu thông tin người dùng vào cơ sở dữ liệu (vai trò khách hàng)
●	Mã hóa mật khẩu
● 7. Hệ thống trả kết quả về giao diện (phản hồi có thể kèm bộ token nhưng giao diện không lưu sau đăng ký).
● 8. Giao diện hiển thị thông báo:
●	“Đăng ký thành công” (nếu thành công)
●	Hoặc thông báo / thông tin lỗi theo từng trường (nếu thất bại)
● 9. Sau thành công, hệ thống chuyển người dùng sang trang “Đăng nhập” để xác thực và sử dụng hệ thống.
Điều kiện trước	●	Người dùng chưa có tài khoản trùng email hoặc số điện thoại trên hệ thống
●	Hệ thống hoạt động bình thường
Điều kiện sau	●	Tài khoản người dùng được tạo thành công và lưu trong cơ sở dữ liệu
●	Người dùng có thể đăng nhập và sử dụng các chức năng yêu cầu xác thực
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap (hiển thị form đăng ký, kiểm tra dữ liệu tại máy khách)
-	API: RESTful API (kết nối giao diện — máy chủ)
-	Backend: Spring Boot (xử lý logic đăng ký, kiểm tra dữ liệu)
-	Database: MySQL (lưu thông tin người dùng)
-	Bảo mật: Mã hóa mật khẩu (bcrypt); JWT Authentication (sử dụng sau bước đăng nhập)
Độ phức tạp	Trung bình (kiểm tra dữ liệu, trùng lặp danh tính, mã hóa mật khẩu và tách bước đăng ký — đăng nhập)

---

1.2. Đặc tả Product Backlog Đăng nhập

ID	PB02
Tiêu đề	Đăng nhập
Tác nhân	Người dùng đã có tài khoản (khách hàng, nhân viên hoặc quản trị viên)
Mô tả	Cho phép xác thực bằng email hoặc số điện thoại kèm mật khẩu, hoặc đăng nhập bằng Google. Sau khi thành công, phiên làm việc được thiết lập và người dùng được chuyển tới khu chức năng theo vai trò.
Các bước thực hiện	● 1. Người dùng mở trang “Đăng nhập”.
● 2. Chọn một trong các cách: nhập tên đăng nhập (email hoặc số điện thoại) và mật khẩu; hoặc chọn đăng nhập Google.
● 3. Người dùng nhấn đăng nhập / xác nhận với nhà cung cấp Google.
● 4. Giao diện gửi yêu cầu tới Backend qua RESTful API.
● 5. Backend xác thực thông tin, cấp JWT và thông tin hồ sơ khi hợp lệ.
● 6. Giao diện lưu phiên cục bộ và chuyển hướng theo vai trò.
● 7. Khi đăng xuất, có thể gửi yêu cầu đăng xuất kèm tiêu đề ủy quyền để thu hồi phiên phía máy chủ.
Điều kiện trước	●	Tài khoản tồn tại và đang được kích hoạt
●	Với Google: đã cấu hình tích hợp OAuth
Điều kiện sau	●	Phiên truy cập hợp lệ cho các thao tác được phân quyền
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication; mã hóa mật khẩu (bcrypt) cho tài khoản mật khẩu
Độ phức tạp	Cao (nhiều phương thức đăng nhập, làm mới và kết thúc phiên)

---

1.3. Đặc tả Product Backlog Quên mật khẩu

ID	PB03
Tiêu đề	Quên mật khẩu
Tác nhân	Người dùng quên mật khẩu và có email đã đăng ký trên hệ thống
Mô tả	Cho phép yêu cầu mã OTP qua email và đặt lại mật khẩu mới. Thông báo khi gửi OTP được thiết kế theo hướng không tiết lộ chi tiết tồn tại tài khoản.
Các bước thực hiện	● 1. Tại trang “Đăng nhập”, người dùng mở khu vực quên mật khẩu.
● 2. Nhập email và yêu cầu gửi OTP.
● 3. Nhập OTP và mật khẩu mới, gửi xác nhận.
● 4. Backend kiểm tra OTP và cập nhật mật khẩu đã mã hóa.
● 5. Giao diện hiển thị kết quả thành công hoặc lỗi.
Điều kiện trước	●	Dịch vụ gửi email (SMTP) đã được cấu hình
Điều kiện sau	●	Mật khẩu mới có hiệu lực cho tài khoản tương ứng
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: Mã hóa mật khẩu (bcrypt)
Độ phức tạp	Trung bình (OTP, email, an toàn thông báo)

---

1.4. Đặc tả Product Backlog Quét mã QR

ID	PB04
Tiêu đề	Quét mã QR
Tác nhân	Khách tại bàn (không bắt buộc đăng nhập)
Mô tả	Khách quét QR Code hoặc mở siêu liên kết gắn với mã định danh bàn. Hệ thống thiết lập phiên tại bàn, hiển thị lời chào và cho phép gọi món, gọi nhân viên, đánh giá theo đúng bàn.
Các bước thực hiện	● 1. Khách quét QR và mở giao diện thực đơn tại bàn (URL chứa mã bàn).
● 2. Hệ thống lưu mã bàn trong phiên trình duyệt.
● 3. Giao diện gửi yêu cầu lấy thông tin bàn tới Backend.
● 4. Backend trả dữ liệu chào mừng và thông tin bàn.
● 5. Giỏ hàng tại bàn được gắn với mã bàn (và ngữ cảnh người dùng nếu đã đăng nhập) thông qua lưu trữ cục bộ.
Điều kiện trước	●	Bàn có mã QR hợp lệ và đang hoạt động
Điều kiện sau	●	Phiên tại bàn được thiết lập; các thao tác gắn đúng bàn
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	QR Code
Độ phức tạp	Trung bình (đồng bộ định danh bàn vật lý — số)

---

1.5. Đặc tả Product Backlog Xem danh sách món ăn

ID	PB05
Tiêu đề	Xem danh sách món ăn
Tác nhân	Khách; nhân viên tham chiếu thực đơn hiển thị cho khách
Mô tả	Hiển thị thực đơn các món đang được phép bán, thuộc danh mục đang hiển thị, sắp xếp theo thứ tự danh mục. Có thể phân trang hoặc tải dần trên giao diện.
Các bước thực hiện	● 1. Người dùng mở trang thực đơn.
● 2. Giao diện gửi yêu cầu tải danh sách.
● 3. Backend trả danh sách món kèm ảnh, giá, điểm đánh giá trung bình (nếu có).
● 4. Hệ thống hiển thị theo nhóm danh mục.
Điều kiện trước	●	Dữ liệu món và danh mục đã được cập nhật
Điều kiện sau	●	Người dùng xem được thực đơn hiện hành
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
Độ phức tạp	Thấp (đọc và hiển thị danh sách)

---

1.6. Đặc tả Product Backlog Xem chi tiết món ăn

ID	PB06
Tiêu đề	Xem chi tiết món ăn
Tác nhân	Khách duyệt thực đơn
Mô tả	Hiển thị chi tiết một món: hình ảnh, mô tả, giá, nhóm món; có thể xem đánh giá và thêm vào giỏ từ trang chi tiết.
Các bước thực hiện	● 1. Người dùng chọn một món để mở trang chi tiết.
● 2. Giao diện gửi yêu cầu lấy chi tiết món.
● 3. Backend trả nội dung hoặc báo không tìm thấy.
● 4. Hệ thống hiển thị nội dung chi tiết.
Điều kiện trước	●	Mã món hợp lệ
Điều kiện sau	●	Người dùng đọc được thông tin chi tiết món
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
Độ phức tạp	Thấp

---

1.7. Đặc tả Product Backlog Tìm kiếm và lọc món ăn

ID	PB07
Tiêu đề	Tìm kiếm và lọc món ăn
Tác nhân	Khách xem thực đơn
Mô tả	Tìm kiếm theo từ khóa qua máy chủ; lọc theo danh mục chủ yếu trên tập món đã tải tại giao diện.
Các bước thực hiện	● 1. Người dùng nhập từ khóa (không rỗng) và kích hoạt tìm kiếm.
● 2. Backend trả danh sách món khớp từ khóa (giới hạn số kết quả).
● 3. Người dùng có thể lọc theo danh mục trên danh sách đang hiển thị.
● 4. Hệ thống hiển thị kết quả hoặc thông báo không có món phù hợp.
Điều kiện trước	●	Đã tải hoặc sẵn sàng gọi API tìm kiếm
Điều kiện sau	●	Danh sách món phản ánh tiêu chí tìm kiếm hoặc lọc
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
Độ phức tạp	Trung bình (kết hợp truy vấn máy chủ và lọc cục bộ)

---

1.8. Đặc tả Product Backlog Quản lý giỏ hàng

ID	PB08
Tiêu đề	Quản lý giỏ hàng
Tác nhân	Khách trong phiên tại bàn (có thể đã đăng nhập)
Mô tả	Quản lý tạm các món đã chọn: số lượng, đơn giá, ghi chú; tính tạm tính. Dữ liệu lưu cục bộ trên trình duyệt theo mã bàn.
Các bước thực hiện	● 1. Từ thực đơn, người dùng thêm món vào giỏ; hệ thống lưu cục bộ.
● 2. Người dùng mở trang giỏ hàng trong phiên có mã bàn.
● 3. Điều chỉnh số lượng, xóa món hoặc xóa toàn bộ; cập nhật tạm tính.
● 4. Nếu không có mã bàn hợp lệ, hệ thống cảnh báo và không cho gửi đơn.
Điều kiện trước	●	Đã thiết lập phiên tại bàn (QR hợp lệ) cho luồng đặt món
Điều kiện sau	●	Giỏ hàng nhất quán trong cùng phiên
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap (lưu trữ cục bộ trên trình duyệt)
-	Backend: Spring Boot (ghi nhận đơn tại PB09)
-	API: RESTful API (khi xác nhận gửi đơn — PB09)
-	Database: MySQL
Độ phức tạp	Trung bình (đồng bộ giỏ với phiên bàn)

---

1.9. Đặc tả Product Backlog Gửi yêu cầu gọi món

ID	PB09
Tiêu đề	Gửi yêu cầu gọi món
Tác nhân	Khách tại bàn (ưu tiên luồng QR)
Mô tả	Khách xác nhận giỏ và gửi đơn hàng gắn bàn. Hiện giao diện khách triển khai đầy đủ luồng gọi món cho khách tại bàn. Máy chủ còn hỗ trợ luồng gọi món cho khách đã đăng nhập; giao diện khu khách chưa tách riêng màn hình đặt món chỉ dành cho tài khoản đã đăng nhập qua kênh này.
Các bước thực hiện	● 1. Giỏ có ít nhất một món và có mã bàn hợp lệ.
● 2. Người dùng nhấn xác nhận gửi đơn.
● 3. Giao diện gửi yêu cầu tạo đơn tới Backend.
● 4. Backend kiểm tra bàn, món và tạo đơn cùng các dòng món.
● 5. Giao diện hiển thị thành công hoặc lỗi; có thể làm mới trạng thái đơn.
● 6. Khu vận hành có thể nhận thông báo đơn mới (WebSocket).
Điều kiện trước	●	Bàn và món thỏa điều kiện nghiệp vụ
Điều kiện sau	●	Đơn hàng được ghi nhận; có thể thông báo realtime tới vận hành
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Realtime: WebSocket
Độ phức tạp	Cao (tạo đơn, tính tiền, ràng buộc bàn, đồng bộ vận hành)

---

1.10. Đặc tả Product Backlog Theo dõi trạng thái đơn hàng

ID	PB10
Tiêu đề	Theo dõi trạng thái đơn hàng
Tác nhân	Khách tại bàn; khách đã đăng nhập
Mô tả	Cho phép xem trạng thái xử lý đơn và thanh toán: tại bàn theo mã QR; khi đã đăng nhập thì qua trang lịch sử và chi tiết đơn cá nhân.
Các bước thực hiện	● 1. Người dùng mở khu vực theo dõi (giỏ / đơn tại bàn hoặc trang lịch sử).
● 2. Giao diện gửi yêu cầu lấy đơn theo mã bàn hoặc theo tài khoản.
● 3. Backend trả dữ liệu đơn trong phạm vi được phép xem.
● 4. Hệ thống hiển thị trạng thái đơn và thanh toán.
Điều kiện trước	●	Đơn tồn tại và thuộc phạm vi được phép xem
Điều kiện sau	●	Người dùng nắm được tiến độ phục vụ
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication (luồng đã đăng nhập)
Độ phức tạp	Trung bình

---

1.11. Đặc tả Product Backlog Gọi nhân viên

ID	PB11
Tiêu đề	Gọi nhân viên
Tác nhân	Khách; nhân viên / quản trị (tiếp nhận)
Mô tả	Khách gửi yêu cầu hỗ trợ tại bàn kèm ghi chú tùy chọn. Nhân viên xem danh sách chờ và đánh dấu đã xử lý. Có thể nhận cập nhật thời gian thực.
Các bước thực hiện	● 1. Khách chọn chức năng gọi nhân viên và gửi yêu cầu (API công khai theo mã bàn).
● 2. Nhân viên mở trang tiếp nhận và tải danh sách yêu cầu chờ xử lý.
● 3. Sau khi xử lý tại quán, nhân viên đánh dấu hoàn tất.
● 4. Hệ thống có thể đẩy thông báo tới khu vận hành (WebSocket).
Điều kiện trước	●	Mã bàn hợp lệ và thỏa quy tắc gửi yêu cầu
Điều kiện sau	●	Yêu cầu được ghi nhận và cập nhật trạng thái
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Realtime: WebSocket
Độ phức tạp	Trung bình

---

1.12. Đặc tả Product Backlog Đặt bàn trực tuyến

ID	PB12
Tiêu đề	Đặt bàn trực tuyến
Tác nhân	Khách đã đăng nhập
Mô tả	Cho phép đặt bàn trực tuyến: chọn thời gian, số khách, bàn / khu vực theo dữ liệu hệ thống cung cấp.
Các bước thực hiện	● 1. Nếu chưa đăng nhập, hệ thống chuyển tới trang đăng nhập kèm đích quay lại.
● 2. Người dùng mở trang đặt bàn và tải lựa chọn khu vực — bàn.
● 3. Điền biểu mẫu và gửi yêu cầu đặt bàn kèm phiên đăng nhập.
● 4. Backend ghi nhận lịch đặt với trạng thái ban đầu theo quy ước.
● 5. Giao diện hiển thị thông báo kết quả.
Điều kiện trước	●	Phiên đăng nhập hợp lệ
Điều kiện sau	●	Lịch đặt được tạo trong hệ thống
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Trung bình

---

1.13. Đặc tả Product Backlog Hủy đặt bàn

ID	PB13
Tiêu đề	Hủy đặt bàn
Tác nhân	Khách đã đăng nhập (chính chủ lịch đặt)
Mô tả	Cho phép hủy lịch đặt còn trong diện cho phép. Hệ thống chỉ chấp nhận khi lịch thuộc đúng tài khoản đang đăng nhập.
Các bước thực hiện	● 1. Người dùng mở trang lịch sử và xem chi tiết đặt bàn.
● 2. Nếu được phép, chọn hủy và xác nhận.
● 3. Backend cập nhật trạng thái hủy.
● 4. Giao diện cập nhật hiển thị.
Điều kiện trước	●	Lịch ở trạng thái cho phép hủy
Điều kiện sau	●	Lịch được ghi nhận đã hủy
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Thấp

---

1.14. Đặc tả Product Backlog Xem lịch sử đơn hàng

ID	PB14
Tiêu đề	Xem lịch sử đơn hàng
Tác nhân	Khách đã đăng nhập
Mô tả	Trang lịch sử hợp nhất lịch đặt bàn và lịch đơn món, có lọc và phân trang trên giao diện.
Các bước thực hiện	● 1. Người dùng đăng nhập và mở trang lịch sử.
● 2. Giao diện tải song song dữ liệu lịch đặt bàn và đơn món của tài khoản.
● 3. Người dùng có thể mở chi tiết đơn.
● 4. Hệ thống hiển thị theo thời gian và bộ lọc đã chọn.
Điều kiện trước	●	Phiên đăng nhập hợp lệ
Điều kiện sau	●	Người dùng xem được lịch sử thuộc tài khoản
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Trung bình

---

1.15. Đặc tả Product Backlog Đánh giá

ID	PB15
Tiêu đề	Đánh giá
Tác nhân	Khách đã đăng nhập; khách tại bàn (luồng đánh giá theo mã bàn)
Mô tả	Cho phép xem đánh giá công khai theo món; gửi, sửa, xóa đánh giá theo điều kiện nghiệp vụ (đã hoàn thành và thanh toán, chưa đánh giá, …). Có luồng riêng cho khách tại bàn kèm mã QR.
Các bước thực hiện	● 1. Người dùng mở trang đánh giá hoặc luồng đánh giá tại bàn.
● 2. Hệ thống tải đơn / ngữ cảnh đủ điều kiện và (nếu cần) danh sách đánh giá theo món.
● 3. Người dùng điền biểu mẫu và gửi; có thể chỉnh sửa hoặc xóa đánh giá của mình trong phạm vi cho phép.
● 4. Backend lưu và áp dụng quy tắc hiển thị công khai.
Điều kiện trước	●	Thỏa điều kiện nghiệp vụ theo từng luồng (đăng nhập / mã bàn)
Điều kiện sau	●	Đánh giá được ghi nhận hoặc cập nhật
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API (nhóm endpoint đánh giá công khai, theo tài khoản và theo khách tại bàn)
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication (luồng đã đăng nhập)
Độ phức tạp	Cao (hai ngữ cảnh khách, quy tắc đủ điều kiện)

---

1.16. Đặc tả Product Backlog AI Recommendation

ID	PB16
Tiêu đề	AI Recommendation
Tác nhân	Khách sử dụng trợ lý trò chuyện
Mô tả	Hỗ trợ hỏi đáp về thực đơn, gợi ý món (kết hợp luật nội bộ và Gemini AI tùy cấu hình), ghi nhận hội thoại và phản hồi khi chọn món từ gợi ý.
Các bước thực hiện	● 1. Người dùng mở trang trợ lý trò chuyện và nhập nội dung.
● 2. Giao diện gửi tin nhắn tới Backend.
● 3. Backend xử lý (luật nội bộ và/hoặc Gemini), trả lời và có thể kèm danh sách món gợi ý.
● 4. Nếu người dùng chọn món từ gợi ý, có thể gửi phản hồi về lựa chọn.
Điều kiện trước	●	Cấu hình Gemini và khóa API (nếu dùng nhánh AI từ xa); có thể bật/tắt trong PB25
Điều kiện sau	●	Phản hồi hiển thị; hội thoại và nhật ký gợi ý (nếu có) được lưu
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	AI: Gemini AI
Độ phức tạp	Cao

---

1.17. Đặc tả Product Backlog Quản lý đặt bàn

ID	PB17
Tiêu đề	Quản lý đặt bàn
Tác nhân	Nhân viên; quản trị viên
Mô tả	Xem lịch đặt theo ngày, xác nhận, ghi nhận khách đến (có thể gắn bàn), hoàn thành, chỉnh sửa thông tin lịch. Lưu ý: hủy lịch chỉ áp dụng cho chính chủ đặt bàn; nhân viên dùng cùng kênh có thể không hủy thay khách nếu không trùng chủ lịch.
Các bước thực hiện	● 1. Nhân viên đăng nhập và mở trang quản lý đặt chỗ.
● 2. Tải danh sách theo ngày hoặc trong ngày.
● 3. Thực hiện xác nhận, khách đến, hoàn thành hoặc chỉnh sửa lịch đặt.
● 4. Giao diện cập nhật theo phản hồi; có thể đồng bộ thông báo lịch trong ngày.
Điều kiện trước	●	Phiên nhân viên hoặc quản trị hợp lệ
Điều kiện sau	●	Trạng thái và nội dung lịch đặt đồng bộ với vận hành
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Cao (nhiều chuyển trạng thái; hạn chế hủy thay khách)

---

1.18. Đặc tả Product Backlog Xử lý yêu cầu thanh toán

ID	PB18
Tiêu đề	Xử lý yêu cầu thanh toán
Tác nhân	Nhân viên; quản trị (thu ngân)
Mô tả	Xem danh sách đơn chưa thu và lịch sử đã thu, xem bản in hóa đơn, xác nhận thanh toán và phương thức.
Các bước thực hiện	● 1. Nhân viên mở trang quản lý thanh toán và tải danh sách đơn.
● 2. Chọn đơn, xem chi tiết / hóa đơn in nếu cần.
● 3. Chọn phương thức thanh toán và xác nhận.
● 4. Backend cập nhật trạng thái thanh toán; giao diện làm mới danh sách.
Điều kiện trước	●	Đơn ở trạng thái cho phép ghi nhận thanh toán
Điều kiện sau	●	Đơn được ghi nhận đã thanh toán kèm phương thức
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Trung bình

---

1.19. Đặc tả Product Backlog Quản lý bàn và QR

ID	PB19
Tiêu đề	Quản lý bàn và QR
Tác nhân	Quản trị viên; nhân viên (xem danh sách bàn vận hành)
Mô tả	Quản trị tạo, sửa, vô hiệu hóa bàn, làm mới mã QR, tải ảnh mã QR. Nhân viên xem danh sách bàn phục vụ vận hành.
Các bước thực hiện	● 1. Quản trị mở trang quản lý bàn / sơ đồ bàn.
● 2. Thực hiện thao tác CRUD bàn và quản lý mã QR.
● 3. Tải file ảnh QR khi cần in dán.
● 4. Nhân viên có thể tra cứu danh sách bàn.
Điều kiện trước	●	Quyền quản trị cho thao tác cấu hình bàn và mã
Điều kiện sau	●	Dữ liệu bàn và mã QR đồng bộ với thực tế
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	QR Code
-	Bảo mật: JWT Authentication
Độ phức tạp	Trung bình

---

1.20. Đặc tả Product Backlog Quản lý món ăn và danh mục

ID	PB20
Tiêu đề	Quản lý món ăn và danh mục
Tác nhân	Quản trị viên
Mô tả	Duy trì danh mục và món ăn: thêm, sửa, ẩn (xóa mềm), bật/tắt còn phục vụ, tải ảnh món lên dịch vụ lưu trữ đám mây.
Các bước thực hiện	● 1. Quản trị mở trang quản lý thực đơn.
● 2. Thao tác danh mục và món qua biểu mẫu trên giao diện quản trị.
● 3. Tải ảnh món khi cần.
● 4. Bật/tắt trạng thái còn món.
Điều kiện trước	●	Quyền quản trị; cấu hình lưu trữ ảnh nếu dùng tải lên
Điều kiện sau	●	Thực đơn hiển thị cho khách phản ánh thay đổi
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Cao (phân cấp danh mục — món, phương tiện, trạng thái kinh doanh)

---

1.21. Đặc tả Product Backlog Quản lý đơn hàng

ID	PB21
Tiêu đề	Quản lý đơn hàng
Tác nhân	Nhân viên; quản trị viên
Mô tả	Xem đơn, cập nhật trạng thái, tạo đơn gắn bàn, bổ sung món vào đơn đang mở, tra cứu lịch sử đã thanh toán; có thể thông báo thời gian thực.
Các bước thực hiện	● 1. Nhân viên mở trang quản lý đơn hàng và tải danh sách.
● 2. Mở chi tiết đơn; cập nhật trạng thái xử lý.
● 3. Tạo đơn gắn bàn khi cần.
● 4. Bổ sung món vào đơn hiện có.
● 5. Giao diện và (nếu có) kênh realtime cập nhật theo sự kiện.
Điều kiện trước	●	Phiên nhân viên hoặc quản trị hợp lệ
Điều kiện sau	●	Trạng thái đơn, dòng món và tổng tiền phản ánh vận hành
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
-	Realtime: WebSocket
Độ phức tạp	Cao

---

1.22. Đặc tả Product Backlog Thống kê báo cáo

ID	PB22
Tiêu đề	Thống kê báo cáo
Tác nhân	Quản trị viên; nhân viên (theo phân quyền hệ thống)
Mô tả	Hiển thị tổng quan hoạt động, doanh thu theo khoảng thời gian và món bán chạy trên trang tổng quan.
Các bước thực hiện	● 1. Người dùng được phép mở trang tổng quan.
● 2. Giao diện gửi yêu cầu các chỉ số tổng quan, doanh thu và món bán chạy.
● 3. Backend tổng hợp dữ liệu và trả về.
● 4. Hệ thống hiển thị biểu đồ và số liệu.
Điều kiện trước	●	Phiên hợp lệ với quyền xem thống kê
Điều kiện sau	●	Người quản lý có cái nhìn tổng hợp về vận hành và doanh thu
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Trung bình

---

1.23. Đặc tả Product Backlog Quản lý tài khoản người dùng

ID	PB23
Tiêu đề	Quản lý tài khoản người dùng
Tác nhân	Quản trị viên
Mô tả	Tạo, xem, phân trang, lọc theo vai trò, cập nhật hồ sơ, đặt lại mật khẩu, kích hoạt / vô hiệu hóa tài khoản.
Các bước thực hiện	● 1. Quản trị mở trang quản lý tài khoản.
● 2. Thực hiện thao tác quản lý qua giao diện quản trị tài khoản.
● 3. Xác nhận và kiểm tra phản hồi trên giao diện.
Điều kiện trước	●	Quyền quản trị
Điều kiện sau	●	Hồ sơ người dùng phản ánh thay đổi; mật khẩu lưu dạng băm
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication; mã hóa mật khẩu (bcrypt)
Độ phức tạp	Trung bình

---

1.24. Đặc tả Product Backlog Quản lý đánh giá

ID	PB24
Tiêu đề	Quản lý đánh giá
Tác nhân	Quản trị viên
Mô tả	Duyệt, lọc, xem chi tiết đánh giá; ẩn / hiện; xóa nội dung vi phạm.
Các bước thực hiện	● 1. Quản trị mở trang quản lý đánh giá.
● 2. Áp dụng bộ lọc và xem danh sách đánh giá.
● 3. Thực hiện ẩn, hiện hoặc xóa đánh giá.
Điều kiện trước	●	Quyền quản trị
Điều kiện sau	●	Nội dung hiển thị công khai phù hợp chính sách
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
Độ phức tạp	Trung bình

---

1.25. Đặc tả Product Backlog Quản lý hệ thống AI Recommendation

ID	PB25
Tiêu đề	Quản lý hệ thống AI Recommendation
Tác nhân	Quản trị viên
Mô tả	Đọc và cập nhật cấu hình gợi ý AI (bật/tắt Gemini, thời gian chờ, …), xem thống kê và nhật ký gợi ý; ảnh hưởng tới PB16.
Các bước thực hiện	● 1. Quản trị mở trang cấu hình AI.
● 2. Tải cấu hình, thống kê và nhật ký gợi ý gần đây.
● 3. Lưu cấu hình mới sau khi kiểm tra.
Điều kiện trước	●	Quyền quản trị
Điều kiện sau	●	Tham số vận hành AI được cập nhật
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
-	AI: Gemini AI
Độ phức tạp	Cao

---

1.26. Đặc tả Product Backlog Quản lý trạng thái bàn

ID	PB26
Tiêu đề	Quản lý trạng thái bàn
Tác nhân	Nhân viên; quản trị viên
Mô tả	Hiển thị trạng thái vận hành bàn (trống, đang dùng, đã đặt, cần dọn) và cập nhật trạng thái; có thể đồng bộ qua WebSocket.
Các bước thực hiện	● 1. Nhân viên mở trang trạng thái bàn.
● 2. Tải danh sách bàn.
● 3. Chọn trạng thái mới cho từng bàn.
● 4. Giao diện cập nhật; có thể nhận sự kiện đồng bộ thời gian thực.
Điều kiện trước	●	Phiên nhân viên hoặc quản trị hợp lệ
Điều kiện sau	●	Trạng thái bàn khớp thực tế sảnh
Công nghệ sử dụng	-	Frontend: HTML, CSS, JavaScript, Bootstrap
-	API: RESTful API
-	Backend: Spring Boot
-	Database: MySQL
-	Bảo mật: JWT Authentication
-	Realtime: WebSocket
Độ phức tạp	Trung bình

---

*Tài liệu mô tả chức năng theo phạm vi triển khai hiện tại; khi nghiệp vụ thay đổi, cần cập nhật lại đặc tả cho khớp vận hành thực tế.*
