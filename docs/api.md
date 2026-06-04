# Tài liệu API

Base URL khi chạy local:

```text
http://localhost:8787
```

Mobile app không gọi Horizon trực tiếp. App gọi backend qua `API_BASE_URL`
trong `src/config.ts`, backend mới gọi Privy API và Stellar Horizon.

## Auth

- Testnet demo cho phép mở session bằng email để dễ demo.
- Mainnet và các thao tác nhạy cảm cần Privy identity token trong header:

```http
Authorization: Bearer <privy_identity_token>
```

Không đưa `PRIVY_APP_SECRET`, Google OAuth client secret, seed phrase hoặc
private key vào app mobile.

## Network

Những route Stellar mới nên dùng dạng có `:network`:

```text
testnet
mainnet
```

Ví dụ:

```http
GET /api/stellar/testnet/<address>
POST /api/stellar/mainnet/send
```

Các route cũ không có `:network` vẫn được giữ fallback về `testnet`.

## Health And Config

### `GET /api/health`

Kiểm tra backend đang chạy và trả về cấu hình public.

Response:

```json
{
  "ok": true,
  "privyAppId": "cmp...",
  "network": "Stellar Testnet + Mainnet",
  "networks": [
    {
      "network": "testnet",
      "label": "Stellar Testnet",
      "horizonUrl": "https://horizon-testnet.stellar.org",
      "supportsFriendbot": true
    }
  ],
  "walletConnectConfigured": false
}
```

### `GET /api/networks`

Trả về danh sách network backend hỗ trợ.

### `GET /api/assets?network=testnet`

Trả về danh sách asset hỗ trợ theo network.

## Session

### `POST /api/session`

Mở hoặc khôi phục session ví cho user hiện tại.

Dùng với Privy token:

```json
{
  "identityToken": "<privy_identity_token>",
  "network": "testnet"
}
```

Fallback demo bằng email:

```json
{
  "email": "user@example.com",
  "network": "testnet"
}
```

Response chính:

```json
{
  "account": {
    "id": "did:privy:...",
    "email": "user@example.com",
    "wallet": {
      "id": "wallet_id",
      "address": "G...",
      "canSign": true,
      "kind": "privy",
      "network": "testnet"
    },
    "wallets": []
  },
  "balances": [],
  "transactions": [],
  "network": "testnet"
}
```

### `POST /api/demo/session`

Tạo hoặc khôi phục session demo bằng email. Phù hợp cho testnet demo và fallback.

### `POST /api/demo/auth-session`

Tạo hoặc khôi phục session demo bằng Privy identity token.

## Wallets

### `GET /api/wallets`

Liệt kê Stellar wallets trên Privy.

### `POST /api/wallets`

Tạo ví Stellar mới cho account đang đăng nhập.

Body:

```json
{
  "email": "user@example.com",
  "network": "testnet",
  "displayName": "Stellar testnet 2",
  "fund": true
}
```

Với `network=mainnet`, backend không gọi Friendbot. User phải nạp XLM thật để
active ví.

### `POST /api/wallets/import`

Import Stellar secret key vào Privy. Route này luôn cần Privy auth token.

Body:

```json
{
  "email": "user@example.com",
  "network": "mainnet",
  "secret": "S...",
  "displayName": "Imported mainnet"
}
```

### `POST /api/wallets/watch-only`

Thêm ví watch-only. Ví này xem được balance/history nhưng không ký giao dịch.

### `POST /api/wallets/export`

Export private key hoặc seed phrase. Route này luôn cần Privy auth token.
App đang bật biometric và confirm `EXPORT` trước khi gọi.

Body:

```json
{
  "email": "user@example.com",
  "network": "mainnet",
  "walletId": "wallet_id",
  "type": "private_key",
  "confirmation": "EXPORT"
}
```

## Demo Wallet Helpers

### `POST /api/demo/wallets`

Tạo ví demo mới cho account theo email.

### `POST /api/demo/wallets/select`

Chọn ví active.

### `POST /api/demo/wallets/rename`

Đổi tên hiển thị của ví.

### `POST /api/demo/wallets/archive`

Ẩn ví khỏi danh sách.

### `POST /api/demo/receiver`

Tạo ví người nhận demo trên testnet, fund XLM test và thêm trustline demo.
Route này chỉ dùng cho testnet.

## Stellar

### `GET /api/stellar/:network/:address`

Lấy balance và transaction history của địa chỉ Stellar.

Example:

```http
GET /api/stellar/testnet/GBHO...
```

### `POST /api/stellar/:network/fund`

Fund XLM test bằng Friendbot. Chỉ hợp lệ trên testnet.

Body:

```json
{
  "address": "G..."
}
```

### `POST /api/stellar/:network/fund-asset`

Fund asset demo trên testnet.

Body:

```json
{
  "address": "G...",
  "assetCode": "USDC",
  "amount": "100"
}
```

### `POST /api/stellar/:network/trustline`

Thêm trustline cho asset không phải XLM.

Body:

```json
{
  "email": "user@example.com",
  "sourceWalletId": "wallet_id",
  "sourceAddress": "G...",
  "assetCode": "USDC",
  "assetIssuer": "G..."
}
```

### `POST /api/stellar/:network/send`

Gửi XLM hoặc token Stellar.

Body:

```json
{
  "email": "user@example.com",
  "accountId": "did:privy:...",
  "sourceWalletId": "wallet_id",
  "sourceAddress": "G...",
  "destination": "G...",
  "assetCode": "XLM",
  "assetIssuer": null,
  "amount": "1"
}
```

Response có `hash`, `ledger`, `transaction.explorerUrl`, balances mới và
`transactions` đã refresh.

### `POST /api/stellar/:network/swap/quote`

Lấy quote swap. Trên testnet backend trả quote demo; trên mainnet backend dùng
path payment của Stellar.

### `POST /api/stellar/:network/swap/execute`

Thực thi swap. Mainnet cần Privy auth token.

## Ramp

### `GET /api/ramp/providers`

Trả về danh sách provider top up/ramp đang cấu hình.

### `POST /api/ramp/quote`

Đang bị disable nếu chưa có provider thật.

### `POST /api/ramp/checkout`

Đang bị disable nếu chưa có provider thật.

## WalletConnect

### `GET /api/walletconnect/config`

Trả về WalletConnect project id public nếu đã cấu hình.

### `POST /api/walletconnect/stellar/review-xdr`

Review XDR trước khi ký.

### `POST /api/walletconnect/stellar/sign-xdr`

Ký XDR bằng ví Privy. Route này cần Privy auth token.

## Error Format

Backend trả lỗi qua middleware chung:

```json
{
  "error": "Thông báo lỗi"
}
```

Mobile app đọc field `error` và hiển thị cho user.
