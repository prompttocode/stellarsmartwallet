# API Documentation

Base URL khi chạy local:

```text
http://localhost:8787
```

Mobile app khong goi Horizon truc tiep. App goi backend qua `API_BASE_URL`
trong `src/config.ts`, backend moi goi Privy API va Stellar Horizon.

## Auth

- Testnet demo cho phep mo session bang email de de demo.
- Mainnet va cac thao tac nhay cam can Privy identity token trong header:

```http
Authorization: Bearer <privy_identity_token>
```

Khong dua `PRIVY_APP_SECRET`, Google OAuth client secret, seed phrase hoac
private key vao app mobile.

## Network

Nhung route Stellar moi nen dung dang co `:network`:

```text
testnet
mainnet
```

Vi du:

```http
GET /api/stellar/testnet/<address>
POST /api/stellar/mainnet/send
```

Cac route cu khong co `:network` van duoc giu fallback ve `testnet`.

## Health And Config

### `GET /api/health`

Kiem tra backend dang chay va tra ve cau hinh public.

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

Tra ve danh sach network backend ho tro.

### `GET /api/assets?network=testnet`

Tra ve danh sach asset ho tro theo network.

## Session

### `POST /api/session`

Mo hoac khoi phuc session vi cho user hien tai.

Dung voi Privy token:

```json
{
  "identityToken": "<privy_identity_token>",
  "network": "testnet"
}
```

Fallback demo bang email:

```json
{
  "email": "user@example.com",
  "network": "testnet"
}
```

Response chinh:

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

Tao/khoi phuc session demo bang email. Phu hop cho testnet demo va fallback.

### `POST /api/demo/auth-session`

Tao/khoi phuc session demo bang Privy identity token.

## Wallets

### `GET /api/wallets`

Liet ke Stellar wallets tren Privy.

### `POST /api/wallets`

Tao vi Stellar moi cho account dang dang nhap.

Body:

```json
{
  "email": "user@example.com",
  "network": "testnet",
  "displayName": "Stellar testnet 2",
  "fund": true
}
```

Voi `network=mainnet`, backend khong goi Friendbot. User phai nap XLM that de
active vi.

### `POST /api/wallets/import`

Import Stellar secret key vao Privy. Route nay luon can Privy auth token.

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

Them vi watch-only. Vi nay xem duoc balance/history nhung khong ky giao dich.

### `POST /api/wallets/export`

Export private key hoac seed phrase. Route nay luon can Privy auth token.
App dang bat biometric va confirm `EXPORT` truoc khi goi.

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

Tao vi demo moi cho account theo email.

### `POST /api/demo/wallets/select`

Chon vi active.

### `POST /api/demo/wallets/rename`

Doi ten hien thi cua vi.

### `POST /api/demo/wallets/archive`

An vi khoi danh sach.

### `POST /api/demo/receiver`

Tao vi nguoi nhan demo tren testnet, fund XLM test va them trustline demo.
Route nay chi dung cho testnet.

## Stellar

### `GET /api/stellar/:network/:address`

Lay balance va transaction history cua dia chi Stellar.

Example:

```http
GET /api/stellar/testnet/GBHO...
```

### `POST /api/stellar/:network/fund`

Fund XLM test bang Friendbot. Chi hop le tren testnet.

Body:

```json
{
  "address": "G..."
}
```

### `POST /api/stellar/:network/fund-asset`

Fund asset demo tren testnet.

Body:

```json
{
  "address": "G...",
  "assetCode": "USDC",
  "amount": "100"
}
```

### `POST /api/stellar/:network/trustline`

Them trustline cho asset khong phai XLM.

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

Gui XLM hoac token Stellar.

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

Response co `hash`, `ledger`, `transaction.explorerUrl`, balances moi va
`transactions` da refresh.

### `POST /api/stellar/:network/swap/quote`

Lay quote swap. Tren testnet backend tra quote demo; tren mainnet backend dung
path payment cua Stellar.

### `POST /api/stellar/:network/swap/execute`

Thuc thi swap. Mainnet can Privy auth token.

## Ramp

### `GET /api/ramp/providers`

Tra ve danh sach provider top up/ramp dang cau hinh.

### `POST /api/ramp/quote`

Dang bi disable neu chua co provider that.

### `POST /api/ramp/checkout`

Dang bi disable neu chua co provider that.

## WalletConnect

### `GET /api/walletconnect/config`

Tra ve WalletConnect project id public neu da cau hinh.

### `POST /api/walletconnect/stellar/review-xdr`

Review XDR truoc khi ky.

### `POST /api/walletconnect/stellar/sign-xdr`

Ky XDR bang vi Privy. Route nay can Privy auth token.

## Error Format

Backend tra loi loi qua middleware chung:

```json
{
  "error": "Thong bao loi"
}
```

Mobile app doc field `error` va hien thi cho user.
