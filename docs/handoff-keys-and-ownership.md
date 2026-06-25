# Handoff: Cloudflare, Privy, Reown Keys

File nay dung khi chuyen project sang Cloudflare/Privy/Reown account khac.
No chi ro can thay ID/key o dau va can deploy lai cai gi.

## Tom tat nhanh

Neu doi chu/toan bo account dich vu, can thay 3 cum config:

```text
Mobile app
  mobile/src/config.ts

Cloudflare Worker
  worker-api/wrangler.toml
  Cloudflare Worker secrets
  Cloudflare D1 database

Third-party dashboards
  Privy Dashboard
  Reown / WalletConnect Cloud
  Payment provider / SeerBOT, neu doi doi tac ramp
```

## 1. Cloudflare Worker

Backend nam trong:

```text
worker-api/
```

File config Cloudflare:

```text
worker-api/wrangler.toml
```

Can thay cac muc nay khi dung Cloudflare account moi:

```toml
name = "privy-stellar-api"

[vars]
ALLOWED_ORIGINS = "*"
HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org"
HORIZON_MAINNET_URL = "https://horizon.stellar.org"
FRIENDBOT_URL = "https://friendbot.stellar.org"
PAYMENT_API_BASE_URL = "https://payment-api.dev.seerbot.io"
PAYMENT_CALLBACK_URL = "https://<new-worker-url>/api/ramp/callback"
WALLETCONNECT_PROJECT_ID = "<new-reown-project-id>"

[[d1_databases]]
binding = "DB"
database_name = "privy_stellar_db"
database_id = "<new-cloudflare-d1-database-id>"
```

Ghi nho:

- `name`: ten Worker tren Cloudflare.
- `PAYMENT_CALLBACK_URL`: phai tro ve URL Worker moi.
- `database_id`: lay tu D1 database moi tren Cloudflare.
- `binding` nen giu la `DB`, vi code dang doc `c.env.DB`.

Tao/cap nhat D1 schema:

```sh
cd worker-api
npm run d1:apply:remote
```

Deploy Worker:

```sh
cd worker-api
npm run deploy
```

## 2. Cloudflare Worker Secrets

Secrets khong nam trong git. Set trong Cloudflare Dashboard hoac Wrangler.

```text
Cloudflare Dashboard
  Workers & Pages
    <worker-name>
      Settings
        Variables and Secrets
```

Hoac bang CLI:

```sh
cd worker-api
npx wrangler secret put PRIVY_APP_ID
npx wrangler secret put PRIVY_APP_SECRET
npx wrangler secret put PARTNER_API_KEY
npx wrangler secret put PAYMENT_PARTNER_APP_KEY
npx wrangler secret put ADMIN_BOOTSTRAP_PASSWORD
```

Y nghia:

```text
PRIVY_APP_ID             # Privy app id, backend dung de goi Privy API
PRIVY_APP_SECRET         # Privy app secret, chi de backend
PARTNER_API_KEY          # key server-to-server cho /api/partner/*
PAYMENT_PARTNER_APP_KEY  # key goi sang SeerBOT/payment provider
ADMIN_BOOTSTRAP_PASSWORD # neu dung route admin/bootstrap/KYC test
```

Luu y: Cloudflare Secret da save thi khong xem lai duoc value. Mat key thi
rotate/update key moi.

Local dev co file mau:

```text
worker-api/.dev.vars.example
```

Neu can chay local, copy thanh:

```sh
cp worker-api/.dev.vars.example worker-api/.dev.vars
```

roi dien value local vao `.dev.vars`.

## 3. Mobile App Config

File public config cua mobile:

```text
mobile/src/config.ts
```

Can thay:

```ts
export const API_BASE_URL = 'https://<new-worker-url>';

export const PRIVY_APP_ID = '<new-privy-app-id>';
export const PRIVY_CLIENT_ID = '<new-privy-mobile-client-id>';
export const PRIVY_WEB_EXPORT_CLIENT_ID = '<new-privy-web-export-client-id>';
```

Y nghia:

- `API_BASE_URL`: URL backend Worker moi.
- `PRIVY_APP_ID`: app id lay trong Privy Dashboard.
- `PRIVY_CLIENT_ID`: client id cho mobile app.
- `PRIVY_WEB_EXPORT_CLIENT_ID`: client id cho web export wallet flow.

Khong bao gio dua `PRIVY_APP_SECRET` vao mobile app.

Sau khi doi file nay, can rebuild/reload mobile app.

## 4. Privy Dashboard

Can tao/chon app moi trong Privy Dashboard, roi lay:

```text
PRIVY_APP_ID
PRIVY_APP_SECRET
PRIVY_CLIENT_ID
PRIVY_WEB_EXPORT_CLIENT_ID
```

Can cau hinh trong Privy:

- Email/Google login method neu app dung social login.
- Stellar embedded wallet support.
- Mobile app identifiers / bundle id neu Privy yeu cau.
- Redirect/deep link scheme cua app.
- Web export wallet client cho route `/wallet-export`.

Hien tai mobile scheme nam o:

```text
mobile/app.json
```

```json
{
  "expo": {
    "scheme": "privy"
  }
}
```

WalletConnect metadata cung dung scheme nay trong:

```text
mobile/src/walletconnect/client.ts
```

Neu doi scheme, doi ca hai noi va cap nhat lai tren dashboard lien quan.

Quan trong: neu doi sang Privy app moi, user/wallet cu trong Privy app cu khong
tu dong chuyen sang app moi. D1 `accounts` dang luu `privy_user_id` va
`privy_wallet_id` cua app cu. Cach an toan nhat la dung D1 database moi/empty
cho Privy app moi, tru khi co ke hoach migration rieng.

## 5. Reown / WalletConnect

Project ID lay tai Reown / WalletConnect Cloud.

Backend tra project id cho mobile qua:

```text
GET /api/walletconnect/config
```

No doc tu:

```text
worker-api/wrangler.toml
```

```toml
WALLETCONNECT_PROJECT_ID = "<new-reown-project-id>"
```

Neu doi Reown account:

1. Tao project moi tren Reown Cloud.
2. Copy Project ID.
3. Thay `WALLETCONNECT_PROJECT_ID` trong `worker-api/wrangler.toml`.
4. Deploy Worker.
5. Mobile tu goi backend de lay project id moi.

Project ID nay la public identifier, khong phai secret, nhung van nen dung dung
project cua minh de theo doi quota/analytics.

## 6. Payment Provider / SeerBOT

Neu doi payment provider hoac doi SeerBOT account, thay:

```text
worker-api/wrangler.toml
  PAYMENT_API_BASE_URL
  PAYMENT_CALLBACK_URL

Cloudflare Secret
  PAYMENT_PARTNER_APP_KEY
```

`PAYMENT_CALLBACK_URL` phai la URL public cua Worker moi:

```text
https://<new-worker-url>/api/ramp/callback
```

Ramp order routes goi provider qua:

```text
POST /api/orders/deposit
POST /api/orders/withdrawal
GET  /api/orders/:id
POST /api/orders/:id/cancel
```

## 7. Partner API Key

Server-to-server partner routes:

```text
POST /api/partner/session
POST /api/partner/wallets
```

Key doc tu Cloudflare Secret:

```text
PARTNER_API_KEY
```

Request co the dung:

```http
Authorization: Bearer <PARTNER_API_KEY>
```

hoac:

```http
x-partner-api-key: <PARTNER_API_KEY>
```

Key nay rat nhay cam. Khong dua vao frontend/mobile app.

## 8. Doi domain/backend URL

Neu Worker URL moi la:

```text
https://api.your-domain.com
```

Can doi:

```text
mobile/src/config.ts
  API_BASE_URL

worker-api/wrangler.toml
  PAYMENT_CALLBACK_URL

Privy Dashboard
  allowed origins / redirect URLs neu co

Payment provider dashboard
  callback URL neu provider cau hinh dashboard
```

Docs/scripts co the dang hard-code URL cu, chi can doi neu tiep tuc dung:

```text
scripts/demo-phase1-preflight.sh
docs/*.md
```

## 9. Checklist chuyen account

```text
[ ] Tao Cloudflare Worker moi
[ ] Tao D1 database moi
[ ] Sua worker-api/wrangler.toml: name, database_id, PAYMENT_CALLBACK_URL
[ ] Tao Privy app moi
[ ] Set Worker secrets: PRIVY_APP_ID, PRIVY_APP_SECRET
[ ] Tao Reown project moi
[ ] Sua WALLETCONNECT_PROJECT_ID
[ ] Neu dung ramp: set PAYMENT_API_BASE_URL va PAYMENT_PARTNER_APP_KEY
[ ] Neu dung partner API: set PARTNER_API_KEY
[ ] Chay npm run d1:apply:remote trong worker-api
[ ] Deploy Worker
[ ] Sua mobile/src/config.ts: API_BASE_URL, PRIVY_APP_ID, PRIVY_CLIENT_ID, PRIVY_WEB_EXPORT_CLIENT_ID
[ ] Rebuild mobile app
[ ] Test /api/health
[ ] Test /api/session
[ ] Test tao vi testnet
[ ] Test WalletConnect config
[ ] Test ramp callback neu co
```

Lenh test nhanh:

```sh
curl https://<new-worker-url>/api/health
curl https://<new-worker-url>/api/walletconnect/config
```

## 10. Nhung thu khong nen commit

Khong commit:

```text
PRIVY_APP_SECRET
PARTNER_API_KEY
PAYMENT_PARTNER_APP_KEY
ADMIN_BOOTSTRAP_PASSWORD
private key / S... key / seed phrase
```

Co the commit:

```text
API_BASE_URL
PRIVY_APP_ID
PRIVY_CLIENT_ID
PRIVY_WEB_EXPORT_CLIENT_ID
WALLETCONNECT_PROJECT_ID
HORIZON_TESTNET_URL
HORIZON_MAINNET_URL
FRIENDBOT_URL
```

Nhung neu muon giam lo public config, co the dua chung vao CI/env build rieng.
