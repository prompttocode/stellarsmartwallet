# API Backend

Backend API là lớp trung gian giữa mobile app, Privy và Stellar.

App gọi:

```text
API_BASE_URL=http://localhost:8787
```

Backend sẽ:

- Xác thực user bằng Privy identity token.
- Tạo/khôi phục ví Stellar theo tài khoản.
- Đọc balance, token list, lịch sử giao dịch từ Stellar Horizon.
- Ký và gửi giao dịch Stellar qua ví Privy.
- Cung cấp helper cho testnet demo như Friendbot, token demo, receiver demo.

Mobile app không được gọi Privy secret API hoặc giữ `PRIVY_APP_SECRET`.

## Auth

Các API nhạy cảm cần header:

```http
Authorization: Bearer <privy_identity_token>
```

Testnet demo có thể dùng `email` trong body. Mainnet và thao tác ký giao dịch
nên luôn dùng Privy token.

Luôn cần token:

- `POST /api/wallets/import`
- `POST /api/wallets/export`
- `POST /api/walletconnect/stellar/sign-xdr`

Cần token khi `network=mainnet`:

- `POST /api/wallets`
- `POST /api/wallets/watch-only`
- `POST /api/stellar/:network/trustline`
- `POST /api/stellar/:network/send`
- `POST /api/stellar/:network/swap/execute`

## Response Chuẩn

Thành công: HTTP `2xx`, trả JSON theo từng API.

Session thành công thường trả:

```json
{
  "account": {
    "email": "user@example.com",
    "wallet": {
      "id": "wallet_id",
      "address": "G...",
      "canSign": true,
      "network": "testnet"
    },
    "wallets": []
  },
  "balance": {
    "address": "G...",
    "exists": true,
    "xlm": "10000.0000000"
  },
  "balances": [],
  "transactions": []
}
```

Giao dịch thành công thường trả:

```json
{
  "hash": "tx_hash",
  "ledger": 123456,
  "transaction": {
    "hash": "tx_hash",
    "operation": "payment",
    "explorerUrl": "https://stellar.expert/explorer/testnet/tx/tx_hash"
  },
  "balances": [],
  "transactions": []
}
```

Thất bại luôn trả:

```json
{
  "error": "Thông báo lỗi"
}
```

Status lỗi hay gặp:

| Status | Ý nghĩa |
| --- | --- |
| `400` | Request sai: email/address/amount/network sai, ví chưa active, thiếu trustline. |
| `401` | Thiếu hoặc sai Privy identity token. |
| `403` | Ví không thuộc account, ví watch-only không được ký, XDR sai source ví. |
| `404` | Không tìm thấy account hoặc wallet. |
| `501` | Ramp chưa cấu hình provider thật. |
| `502` | Privy/Horizon không thực hiện được thao tác. |
| `500` | Lỗi server/env ngoài dự kiến. |

## System APIs

| API | Dùng để | Thành công | Thất bại |
| --- | --- | --- | --- |
| `GET /api/health` | Kiểm tra backend sống và config public. | `200 { ok, privyAppId, networks, walletConnectConfigured }` | `500` nếu server lỗi. |
| `GET /api/networks` | Lấy danh sách `testnet/mainnet` app có thể switch. | `200 { networks }` | `500` nếu server lỗi. |
| `GET /api/assets?network=testnet` | Lấy token list theo network. | `200 { network, assets }` | `400` network sai, `500` lỗi asset service. |

## Session APIs

| API | Dùng để | Thành công | Thất bại |
| --- | --- | --- | --- |
| `POST /api/session` | Đăng nhập/khôi phục session ví bằng `identityToken` hoặc email demo. Nếu chưa có ví cho network thì backend tạo ví mới. | `200 SessionResponse` | `400` email sai, `401` token sai, `500/502` lỗi Privy/backend. |
| `POST /api/demo/session` | Mở session demo bằng email, chủ yếu cho testnet. | `200 SessionResponse` | `400` email sai, `500/502` lỗi Privy/backend. |
| `POST /api/demo/auth-session` | Mở session demo bằng Privy identity token. | `200 SessionResponse` | `400` Privy user không có email, `401` thiếu/sai token. |

Body session thường dùng:

```json
{
  "email": "user@example.com",
  "identityToken": "<privy_identity_token>",
  "network": "testnet"
}
```

## Wallet APIs

| API | Dùng để | Thành công | Thất bại |
| --- | --- | --- | --- |
| `GET /api/wallets` | Liệt kê Stellar wallets đang có trên Privy. | `200 { wallets }` | `500/502` lỗi Privy/env. |
| `POST /api/wallets` | Tạo ví Stellar mới cho account hiện tại. Testnet có thể auto fund, mainnet phải nạp XLM thật. | `201 SessionResponse` | `401` mainnet thiếu token, `404` account không tồn tại, `500/502` lỗi Privy/backend. |
| `POST /api/wallets/import` | Import Stellar secret key `S...` vào Privy. | `201 SessionResponse` | `400` secret sai, `401` thiếu token, `502` Privy chưa hỗ trợ import cho app. |
| `POST /api/wallets/watch-only` | Thêm ví chỉ xem bằng public address `G...`. Ví này không ký giao dịch. | `201 SessionResponse` | `400` address sai, `401` mainnet thiếu token, `404` account không tồn tại. |
| `POST /api/wallets/export` | Export private key/seed phrase. App cần biometric và xác nhận `EXPORT` trước khi gọi. | `200 { network, secret, type }` | `400` thiếu `EXPORT`, `401` thiếu token, `403` ví không thuộc account, `404` không thấy ví, `502` Privy chưa bật client export. |

Body tạo/watch/import/export ví thường dùng:

```json
{
  "email": "user@example.com",
  "network": "mainnet",
  "walletId": "wallet_id",
  "address": "G...",
  "secret": "S...",
  "displayName": "Wallet name",
  "type": "private_key",
  "confirmation": "EXPORT"
}
```

## Demo Wallet APIs

| API | Dùng để | Thành công | Thất bại |
| --- | --- | --- | --- |
| `POST /api/demo/account` | Seed nhanh Privy user và Stellar wallet demo. | `201 { account }` | `400` email sai, `500/502` lỗi Privy/backend. |
| `POST /api/demo/wallets` | Tạo thêm ví demo cho account email. | `201 SessionResponse` | `400` email sai, `404` account không tồn tại, `500/502` lỗi Privy/backend. |
| `POST /api/demo/wallets/select` | Đổi ví active. | `200 SessionResponse` | `404` không tìm thấy ví active. |
| `POST /api/demo/wallets/rename` | Đổi tên ví. | `200 SessionResponse` | `404` không tìm thấy ví. |
| `POST /api/demo/wallets/archive` | Ẩn ví khỏi danh sách. | `200 SessionResponse` | `400` nếu ẩn ví cuối cùng, `404` không tìm thấy ví. |
| `POST /api/demo/receiver` | Tạo ví người nhận testnet, fund XLM test và add trustline demo để test send token. | `201 { contact, balance }` | `500/502` lỗi Privy/Friendbot/Horizon. |

Body demo wallet thường dùng:

```json
{
  "email": "user@example.com",
  "network": "testnet",
  "walletId": "wallet_id",
  "displayName": "Wallet name",
  "label": "Người nhận demo"
}
```

## Stellar APIs

| API | Dùng để | Thành công | Thất bại |
| --- | --- | --- | --- |
| `GET /api/stellar/:network/:address` | Lấy balance và lịch sử giao dịch của địa chỉ Stellar. | `200 { address, exists, xlm, balances, transactions }` | `400` address/network sai, `500/502` Horizon lỗi. |
| `POST /api/stellar/:network/fund` | Nạp XLM test bằng Friendbot. Chỉ dùng testnet. | `200 { address, balances, transactions, xlm }` | `400` address sai hoặc gọi mainnet, `500/502` Friendbot/Horizon lỗi. |
| `POST /api/stellar/:network/fund-asset` | Nạp token demo testnet như USDC/USDT demo. | `200 { balances, transaction, transactions }` | `400` asset/amount/address sai, ví nhận chưa active hoặc thiếu trustline. |
| `POST /api/stellar/:network/trustline` | Thêm trustline cho token không phải XLM. | `200 { alreadyTrusted, transaction, balances, transactions }` | `400` ví chưa active/asset sai, `401` mainnet thiếu token, `403` ví không thuộc account/watch-only. |
| `POST /api/stellar/:network/send` | Gửi XLM hoặc token Stellar. | `200 { hash, ledger, transaction, sourceBalances, destinationBalances, transactions }` | `400` amount/address/asset sai, ví chưa active, ví nhận thiếu trustline; `401` mainnet thiếu token; `403` ví không thuộc account/watch-only. |
| `POST /api/stellar/:network/swap/quote` | Xem trước tỷ giá swap. | `200 { fromAmount, toAmount, rate, destMin, network }` | `400` address/amount/asset sai hoặc mainnet không tìm được path. |
| `POST /api/stellar/:network/swap/execute` | Thực thi swap. `POST /api/stellar/:network/swap` là alias. | `200 { hash, ledger, transaction, balances, transactions }` | `400` swap invalid/thiếu balance/trustline/path, `401` mainnet thiếu token, `403` ví không thuộc account/watch-only. |

Body Stellar thường dùng:

```json
{
  "email": "user@example.com",
  "sourceWalletId": "wallet_id",
  "sourceAddress": "G...",
  "destination": "G...",
  "assetCode": "XLM",
  "assetIssuer": null,
  "amount": "1",
  "fromAssetCode": "XLM",
  "toAssetCode": "USDC"
}
```

Route cũ không có `:network` vẫn tồn tại và luôn chạy như testnet:

```http
GET /api/stellar/:address
POST /api/stellar/fund
POST /api/stellar/fund-asset
POST /api/stellar/trustline
POST /api/stellar/send
POST /api/stellar/swap/quote
POST /api/stellar/swap/execute
POST /api/stellar/swap
```

## Ramp APIs

| API | Dùng để | Thành công | Thất bại |
| --- | --- | --- | --- |
| `GET /api/ramp/providers` | Xem app đã có provider faucet/on-ramp nào chưa. | `200 { providers }` | `500` nếu server lỗi. |
| `POST /api/ramp/quote` | Lấy quote mua/bán qua fiat ramp. Hiện chưa cấu hình provider. | Chưa có trong V1. | `501 { error }`. |
| `POST /api/ramp/checkout` | Tạo checkout qua fiat ramp. Hiện chưa cấu hình provider. | Chưa có trong V1. | `501 { error }`. |

## WalletConnect APIs

| API | Dùng để | Thành công | Thất bại |
| --- | --- | --- | --- |
| `GET /api/walletconnect/config` | Lấy WalletConnect project id public cho mobile app. | `200 { configured, projectId, relays }` | `500` nếu server lỗi. |
| `POST /api/walletconnect/stellar/review-xdr` | Parse XDR trước khi ký để app hiển thị user sắp ký gì. | `200 { fee, memo, operationCount, operations, source }` | `400` XDR sai network/passphrase, `403` XDR sai source ví. |
| `POST /api/walletconnect/stellar/sign-xdr` | Ký XDR bằng ví Privy. Nếu `submit=true`, backend submit lên Stellar. | `200 { review, signedXdr, submitted, transaction }` | `400` XDR sai, `401` thiếu token, `403` ví không thuộc account/XDR sai source, `502` Privy/Horizon lỗi. |

Body WalletConnect thường dùng:

```json
{
  "email": "user@example.com",
  "network": "testnet",
  "sourceWalletId": "wallet_id",
  "sourceAddress": "G...",
  "xdr": "AAAA...",
  "submit": false
}
```
