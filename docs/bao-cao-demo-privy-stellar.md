# Báo Cáo Demo App Ví Privy + Stellar

Ngày lập báo cáo: 25/05/2026

## 1. Mục tiêu demo

Mục tiêu của app là dựng một bản demo ví trên mạng thử nghiệm Stellar, có dùng Privy để đăng nhập và quản lý ví. Bản demo này dùng để chứng minh luồng cơ bản:

1. Người dùng đăng nhập bằng email.
2. App tạo hoặc lấy ví Stellar cho người dùng.
3. App hiển thị số dư XLM test.
4. App nạp XLM test.
5. App gửi XLM test sang ví khác.
6. App lưu và hiển thị lịch sử giao dịch demo.
7. Giao dịch có thể mở trên Stellar Expert để kiểm tra trên mạng thử nghiệm.

## 2. Kết luận nhanh

App hiện tại đã là một bản ví demo tương đối giống ví thật ở mức luồng sản phẩm. Người dùng có thể đăng nhập, có địa chỉ ví riêng, xem số dư, nạp XLM test, gửi XLM test và xem lịch sử giao dịch.

Tuy nhiên app chưa phải ví tiền thật. Hiện tại app đang chạy trên Stellar Testnet, tức là mạng thử nghiệm. XLM trong app là XLM test, không có giá trị tiền thật. Server cũng đang chạy local và database đang là file JSON local, phù hợp để demo nhưng chưa phù hợp để đưa lên sản phẩm thật.

## 3. Công nghệ đang dùng

App mobile:

- React Native 0.82.
- Privy Expo SDK để đăng nhập bằng email.
- Expo native modules để Privy hoạt động trên mobile.
- TypeScript cho phần app.

Server:

- Node.js + Express.
- Privy Node SDK và Privy API.
- Stellar SDK.
- Stellar Horizon Testnet.
- Friendbot của Stellar Testnet để nạp XLM test.
- Database demo bằng file JSON local.

Blockchain:

- Stellar Testnet.
- Đồng dùng trong demo: XLM test.

## 4. Các tính năng đã làm được

### 4.1. Đăng nhập bằng Privy

App đã có màn đăng nhập bằng email thật. Người dùng nhập email, Privy gửi mã xác minh, người dùng nhập mã để đăng nhập.

App dùng `PrivyProvider`, `useLoginWithEmail`, `usePrivy`, `useIdentityToken` từ Privy Expo SDK. Như vậy phần đăng nhập không còn là giả lập local.

Sau khi đăng nhập, app lấy thông tin người dùng từ phiên Privy và gửi về server để mở phiên ví demo.

### 4.2. Tạo user và ví Stellar

Server có logic tạo hoặc tìm user theo email. Nếu user chưa có ví demo, server sẽ tạo ví Stellar thông qua Privy.

Ví tạo ra có:

- Mã ví trong Privy.
- Địa chỉ ví Stellar bắt đầu bằng chữ `G`.
- Public key.
- Loại ví là Stellar.

Ý nghĩa: người dùng không phải tự tạo cụm từ khôi phục hoặc tự giữ khóa bí mật. Trong bản demo này, ví được Privy quản lý để app dễ dùng hơn.

### 4.3. Hiển thị thông tin ví

Sau khi vào app, người dùng thấy:

- Email tài khoản.
- Mạng đang dùng: Stellar Testnet.
- Số dư XLM test.
- Địa chỉ ví Stellar.
- Privy user id.
- Wallet id.
- Link mở ví trên Stellar Expert.

Địa chỉ ví này là địa chỉ thật trên Stellar Testnet, không phải chuỗi giả trong app.

### 4.4. Nạp XLM test

App có nút nạp XLM test. Khi bấm, server gọi Friendbot của Stellar Testnet để nạp XLM test vào địa chỉ ví.

Đây là luồng nạp tiền của môi trường thử nghiệm. Trên mạng thật sẽ không có Friendbot. Người dùng phải nạp XLM thật từ sàn hoặc từ ví khác.

### 4.5. Tạo người nhận demo

App có nút tạo người nhận demo. Khi bấm, server tạo thêm một ví Stellar mới qua Privy, sau đó nạp sẵn XLM test cho ví nhận.

Mục đích là giúp demo dễ hơn: không cần chuẩn bị sẵn một ví khác, app tự tạo một địa chỉ nhận để thử gửi.

### 4.6. Gửi XLM test

App đã có luồng gửi XLM test:

1. Người dùng nhập địa chỉ ví nhận.
2. Người dùng nhập số XLM muốn gửi.
3. Server kiểm tra địa chỉ ví gửi và ví nhận.
4. Server kiểm tra số XLM hợp lệ.
5. Server tạo giao dịch Stellar.
6. Privy ký giao dịch bằng ví đang quản lý.
7. Server gửi giao dịch lên Stellar Testnet.
8. App cập nhật lại số dư và lịch sử giao dịch.

Nếu ví nhận chưa tồn tại trên Stellar Testnet, server dùng loại giao dịch tạo tài khoản mới. Nếu ví nhận đã tồn tại, server dùng loại giao dịch chuyển XLM bình thường.

Về mặt sản phẩm, đây chính là phần gần giống "rút tiền" hoặc "chuyển tiền" trong ví thật. Khác biệt là hiện tại đang gửi XLM test, không phải XLM thật.

### 4.7. Lịch sử giao dịch

App hiển thị lịch sử giao dịch demo sau khi gửi XLM. Mỗi dòng giao dịch có:

- Số XLM đã gửi.
- Địa chỉ ví nhận dạng rút gọn.
- Thời gian.
- Mã giao dịch rút gọn.
- Ledger.
- Link mở giao dịch trên Stellar Expert.

Hiện tại lịch sử đang lấy từ database demo local, không phải quét toàn bộ lịch sử trực tiếp từ Stellar. Tuy nhiên mỗi giao dịch được lưu kèm link explorer để kiểm tra trên mạng Stellar Testnet.

### 4.8. Xem giao dịch trên Stellar Expert

App có link mở ví hoặc giao dịch trên Stellar Expert. Đây là trang explorer để kiểm tra dữ liệu công khai trên Stellar Testnet.

Nói đơn giản: Stellar Expert giống như trang tra cứu sao kê công khai của mạng Stellar. Khi gửi giao dịch thành công, có thể mở link để xem giao dịch đó đã thật sự lên mạng thử nghiệm chưa.

### 4.9. Xử lý lỗi cơ bản

App đã có xử lý lỗi cơ bản:

- Báo lỗi khi email không hợp lệ.
- Báo lỗi khi thiếu mã xác minh.
- Báo lỗi khi thiếu ví nhận.
- Báo lỗi khi địa chỉ Stellar không hợp lệ.
- Báo lỗi khi ví gửi chưa có XLM test.
- Đã sửa lỗi spam alert khi app tự khôi phục phiên Privy.

### 4.10. Tách bố cục code

Code đã được tách ra khỏi một file dài ban đầu.

Phần app:

- `App.tsx`: bọc Privy và mở màn ví.
- `src/screens/WalletScreen.tsx`: màn hình và luồng chính của ví.
- `src/api/client.ts`: hàm gọi API.
- `src/components/WalletPrimitives.tsx`: các component nhỏ dùng lại.
- `src/styles/walletStyles.ts`: style giao diện.
- `src/types.ts`: kiểu dữ liệu dùng trong app.
- `src/utils/format.ts`: hàm format địa chỉ, ngày, lỗi.

Phần server:

- `be/index.js`: khởi động Express server.
- `be/routes/apiRoutes.js`: các API chính.
- `be/services/privy.js`: xử lý Privy.
- `be/services/stellar.js`: xử lý Stellar.
- `be/db.js`: đọc ghi database demo.
- `be/config.js`: cấu hình server.
- `be/middleware/errorHandler.js`: trả lỗi API.
- `be/utils/`: hàm tiện ích.

## 5. Các API server hiện có

Các API chính:

- `GET /api/health`: kiểm tra server và mạng Stellar Testnet.
- `POST /api/demo/auth-session`: mở phiên demo bằng token Privy.
- `POST /api/demo/session`: mở phiên demo bằng email, dùng cho demo và fallback.
- `POST /api/demo/receiver`: tạo người nhận demo.
- `GET /api/stellar/:address`: xem số dư ví Stellar.
- `POST /api/stellar/fund`: nạp XLM test bằng Friendbot.
- `POST /api/stellar/send`: gửi XLM test.
- `GET /api/wallets`: liệt kê ví Stellar từ Privy.
- `POST /api/wallets`: tạo ví Stellar thủ công.

## 6. Dữ liệu đang lưu ở đâu

App không tự lưu số XLM. Số XLM nằm trên Stellar Testnet.

Database demo local chỉ lưu:

- Email người dùng.
- Mapping giữa email, Privy user id và ví Stellar.
- Danh sách người nhận demo.
- Lịch sử giao dịch demo do app tạo.

File database demo:

```text
be/data/demo-db.json
```

Tại thời điểm kiểm tra, database demo local đang có:

- 6 tài khoản.
- 3 người nhận demo.
- 7 giao dịch.

File này đã được đưa vào `.gitignore`, nên không bị commit lên git.

## 7. Trạng thái chạy hiện tại

Tại thời điểm lập báo cáo, code app và server đã có đủ luồng demo. Tuy nhiên server local và Metro không chạy khi kiểm tra.

Để chạy demo lại:

```sh
npm run server
```

Mở terminal khác:

```sh
npm start
```

Mở terminal khác nữa:

```sh
npm run android
```

Nếu chạy trên điện thoại thật, địa chỉ API trong app đang là:

```text
http://192.168.1.19:8787
```

Nếu IP mạng của máy thay đổi, cần sửa lại `API_BASE_URL` trong:

```text
mobile/src/config.ts
```

## 8. Phần nào đã thật, phần nào vẫn là demo

Đã thật:

- Đăng nhập qua Privy thật.
- Tạo ví Stellar qua Privy thật.
- Địa chỉ ví Stellar là địa chỉ thật trên Stellar Testnet.
- Gửi giao dịch lên Stellar Testnet thật.
- Có thể xem giao dịch trên Stellar Expert.
- Số dư XLM lấy từ Stellar Horizon Testnet.

Vẫn là demo:

- XLM là XLM test, không phải tiền thật.
- Server chạy local trên máy dev.
- Database là file JSON local.
- Nút nạp dùng Friendbot, chỉ tồn tại trên Testnet.
- Một số API còn nới lỏng xác thực để demo dễ chạy.
- Lịch sử giao dịch lấy từ database local, chưa lấy toàn bộ trực tiếp từ Stellar.
- Chưa có màn xác nhận giao dịch kỹ như ví thật.
- Chưa có mã QR nhận tiền.
- Chưa có danh bạ người nhận thật.
- Chưa có deploy server public.

## 9. Đánh giá mức độ hoàn thành theo yêu cầu ban đầu

Câu yêu cầu ban đầu là:

```text
em tìm hiểu https://docs.privy.io/welcome rồi dựng thử demo trên mạng stellar
```

Với yêu cầu này, app hiện tại đã đáp ứng được phần demo cốt lõi:

- Có dùng Privy.
- Có tạo user và ví.
- Có dùng Stellar Testnet.
- Có giao dịch test thật trên Stellar Testnet.
- Có thể trình bày được luồng ví cơ bản.

Nếu chỉ cần demo cho sếp xem "Privy + Stellar có chạy được không", bản hiện tại đủ để demo.

Nếu cần demo như một sản phẩm ví gần hoàn chỉnh hơn, nên làm thêm các phần ở mục tiếp theo.

## 10. Việc nên làm tiếp để giống ví thật hơn

Ưu tiên 1: làm trải nghiệm ví rõ hơn

- Thêm màn nhận tiền.
- Hiển thị địa chỉ ví lớn, dễ copy.
- Thêm mã QR cho địa chỉ ví.
- Thêm nút copy địa chỉ.
- Thêm chia sẻ địa chỉ.

Ưu tiên 2: làm luồng gửi tiền giống ví thật

- Thêm màn xác nhận trước khi gửi.
- Hiển thị ví gửi, ví nhận, số XLM, phí mạng.
- Cảnh báo giao dịch không thể hoàn tác.
- Chặn gửi khi số dư không đủ.

Ưu tiên 3: làm lịch sử giao dịch tốt hơn

- Lấy lịch sử trực tiếp từ Stellar Horizon.
- Hiển thị trạng thái giao dịch.
- Phân biệt giao dịch gửi và nhận.
- Hiển thị giao dịch nạp test.

Ưu tiên 4: làm server nghiêm túc hơn

- Bắt buộc xác thực Privy token cho các API quan trọng.
- Không cho mở session chỉ bằng email.
- Đổi database từ JSON local sang database thật như PostgreSQL, Supabase hoặc Firebase.
- Deploy server lên internet.

Ưu tiên 5: chuẩn bị nếu muốn chạy tiền thật

- Đổi từ Stellar Testnet sang Stellar Mainnet.
- Bỏ Friendbot.
- Thêm cảnh báo rủi ro khi chuyển tiền thật.
- Quản lý phí mạng.
- Kiểm tra bảo mật server.
- Kiểm tra chính sách quản lý ví, khóa ví và quyền ký giao dịch.

## 11. Câu tóm tắt để báo cáo sếp

Em đã dựng được demo ví Stellar dùng Privy. App đăng nhập bằng email thật qua Privy, tạo ví Stellar do Privy quản lý, hiển thị địa chỉ ví và số dư XLM test, nạp XLM test từ Stellar Testnet, gửi XLM test sang ví khác, lưu lịch sử giao dịch và mở được giao dịch trên Stellar Expert để kiểm tra. Bản này chứng minh được luồng Privy kết hợp Stellar Testnet hoạt động. Hiện tại vẫn là bản demo vì server chạy local, database là file JSON và XLM là XLM test. Để tiến gần sản phẩm thật cần thêm màn nhận tiền, mã QR, màn xác nhận gửi tiền, lịch sử lấy trực tiếp từ Stellar, deploy server và siết xác thực Privy cho các API quan trọng.
