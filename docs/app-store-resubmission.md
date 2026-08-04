# iOS App Store resubmission gate

Không gửi lại App Review chỉ vì build đã chạy. Bản phát hành chỉ đủ điều kiện
khi cả hai việc bên ngoài repo đã hoàn tất:

1. Apple Developer account đã được Apple duyệt là **Organization**, seller name
   là đúng pháp nhân.
2. Đã ký hợp đồng với exchange/ramp provider có giấy phép, production API và
   country matrix bằng văn bản.

Khi chưa có đối tác, code cố ý khóa Mainnet Swap/Ramp theo kiểu fail-closed.
Không thêm biến môi trường giả để mở tính năng trước khi có hồ sơ pháp lý.

## Sign in with Apple

Release App ID và Apple Client ID của native iOS app là:

```text
com.orbitlab.stellar
```

Thiết lập trên Apple Developer:

1. Certificates, Identifiers & Profiles > Identifiers > chọn
   `com.orbitlab.stellar` > bật **Sign in with Apple**.
2. Keys > tạo key mới, bật **Sign in with Apple**, chọn primary App ID ở trên.
3. Tải file `AuthKey_<KEY_ID>.p8`. Apple chỉ cho tải private key một lần.
4. Tạo lại manual distribution provisioning profile mà Xcode đang gọi là
   `wallet`, sau đó cài profile mới trên máy build.

Điền Privy Dashboard > Authentication > Apple như sau:

- Client ID: `com.orbitlab.stellar`
- Key ID: chuỗi Key ID hiển thị trong Apple Developer Keys (cũng nằm trong tên
  file `AuthKey_<KEY_ID>.p8`).
- Team ID: Apple Developer > Membership details > Team ID.
- Signing key: mở file `.p8` bằng text editor và dán **toàn bộ nội dung**, gồm
  cả hai dòng đầu/cuối:

```text
-----BEGIN PRIVATE KEY-----
...nội dung key...
-----END PRIVATE KEY-----
```

Đây là PKCS#8 PEM. Không upload tên file và không chỉ dán phần ở giữa. Bật thêm
**Return OAuth tokens** trong Privy để app giữ token cần cho việc revoke quyền
Apple khi user xóa account.

Backend cũng cần cùng Apple credential để gọi Apple token-revocation endpoint.
Không commit private key; đặt bằng Cloudflare secrets:

```sh
cd worker-api
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_KEY_ID
npx wrangler secret put APPLE_TEAM_ID
npx wrangler secret put APPLE_SIGNING_KEY
```

Với `APPLE_SIGNING_KEY`, dán nguyên văn nội dung `.p8`, gồm header/footer. App
sẽ từ chối hoàn tất account deletion nếu Apple account đã link mà token hoặc
cấu hình revoke còn thiếu; như vậy backend không báo xóa thành công giả.

Entitlement đã nằm ở `mobile/ios/Privy/Privy.entitlements`, và cả Debug/Release
đã trỏ `CODE_SIGN_ENTITLEMENTS` tới file này. Release vẫn dùng Team
`NJ63T783L2`, Bundle ID `com.orbitlab.stellar` và manual profile `wallet`.

## Reviewer fixed OTP

Nút public `Explore Testnet` không có trong Release; nó chỉ còn ở `__DEV__`.
Reviewer dùng nút **Continue with Email** giống user thật.

Trong Privy Dashboard, tạo một test email và fixed OTP. Không commit email/OTP
vào repo. Lưu chúng trong nơi quản lý secret và chép vào App Review Notes ở lần
gửi build. Sau login, hướng dẫn reviewer:

```text
Settings > Network > Testnet
```

Test account phải được seed KYC test status trong sandbox đối tác. Bật sandbox
chỉ khi đã có sandbox thật:

```text
EXCHANGE_SANDBOX_ENABLED=true
EXCHANGE_SANDBOX_PROVIDER_ID=<partner-sandbox-id>
PAYMENT_API_BASE_URL=<partner-sandbox-url>
PAYMENT_PARTNER_APP_KEY=<secret>
```

## Production exchange/ramp gate

Không còn URL `payment-api.dev.seerbot.io` trong `wrangler.toml`. Mainnet swap
quote/execute dừng trước Horizon và trả
`SWAP_PROVIDER_ADAPTER_NOT_IMPLEMENTED` cho tới khi adapter production của đối
tác được viết. Horizon strict-send chỉ chạy ở Testnet.

Production chỉ được cấu hình sau khi pháp chế kiểm tra hợp đồng, license number,
government registry link, API docs, DPA và trách nhiệm KYC/AML/sanctions/
monitoring. Các biến bắt buộc:

```text
EXCHANGE_PROVIDER_ID=<contracted-provider-id>
EXCHANGE_PROVIDER_NAME=<legal/provider display name>
EXCHANGE_PROVIDER_STATUS=active
EXCHANGE_LICENSE_VALID_UNTIL=YYYY-MM-DD
EXCHANGE_ALLOWED_COUNTRIES=VN,SG,...
PAYMENT_API_BASE_URL=https://<production-provider>
PAYMENT_PARTNER_APP_KEY=<secret>
```

Mỗi user còn phải có row server-side trong `account_exchange_profiles` với
provider khớp, country đã xác minh, KYC `approved`/`verified`, và sanctions
status `clear`. Client không có API để tự ghi row này; provider adapter/webhook
phải ghi sau khi xác minh.

Các cổng đặc biệt:

- US mặc định khóa; chỉ mở khi
  `EXCHANGE_US_PERMISSIONS_VERIFIED=true` sau khi kiểm tra MSB/state permissions.
- UK mặc định khóa; chỉ mở khi
  `EXCHANGE_UK_PROMOTIONS_APPROVED=true` sau khi kiểm tra FCA promotion path.
- Việt Nam mặc định khóa; cần
  `EXCHANGE_VN_PILOT_LICENSE_ID=<verified-license-id>` từ cơ chế thí điểm, không
  dùng giấy đăng ký doanh nghiệp thay thế.

Áp dụng migration cho database đang tồn tại **một lần** trước khi deploy code:

```sh
cd worker-api
npm run d1:compliance:remote
```

Database mới dùng `schema.sql`, không chạy migration `ALTER TABLE` lần nữa.

## Legal links và dữ liệu

Cả hai label hiện mở URL do product owner cung cấp bằng browser sheet:

```text
https://www.freeprivacypolicy.com/live/edd04a75-c08d-4c20-959c-941401ce9dce
```

URL này là Privacy Policy, chưa phải Terms of Service. Trước review nên xuất bản
một Terms document riêng và đổi `TERMS_OF_SERVICE_URL`. Privacy Policy phải ghi
đúng pháp nhân, KYC/CCCD, phone, bank account, wallet address, blockchain
transactions, Privy, Apple/Google và exchange/ramp processors.

Settings chỉ render/copy email dạng `n*****@gmail.com`; backend và account lookup
vẫn dùng email gốc. Đây là privacy UX, không thay cho Sign in with Apple theo
Guideline 4.8.

Account deletion hiện yêu cầu hai lần xác nhận, biometric khi thiết bị hỗ trợ,
Privy identity token, revoke Apple authorization nếu Apple đã link, xóa Privy
user và xóa PII trong D1. Public blockchain history không thể bị xóa và UI nói
rõ điều này.

## App Review Notes template

Chỉ điền template này sau khi hai resubmission gates đầu tài liệu đã đạt:

```text
Organization legal name: <legal name>
Licensed provider(s): <provider + license + registry link>
Allowed storefronts: <exact country list>
Reviewer email: <Privy test email>
Fixed OTP: <Privy fixed OTP>
Test path: Continue with Email > Settings > Network > Testnet > Swap/Ramp
Sandbox provider: <provider name>
Production restriction: server-side country/KYC/sanctions/license gate;
Mainnet never executes through Stellar Horizon DEX.
```

Đính kèm contract, license/registry evidence, country/storefront matrix, token
list, public API docs, transaction-flow diagram và AML/KYC/sanctions/complaint
handling documents. Trả lời từng câu Apple hỏi; không tuyên bố production
compliant khi adapter/hợp đồng chưa hoàn tất.
