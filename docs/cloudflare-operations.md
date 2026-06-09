# Cloudflare Operations Runbook

Tai lieu nay de ban giao du an cho nguoi khac. Doc file nay truoc khi doi
Cloudflare, D1, Privy secret, hoac deploy backend.

## Dang dung nhung gi tren Cloudflare?

```text
Cloudflare account
  Workers & Pages
    Worker: privy-stellar-api
      URL: https://privy-stellar-api.namvu3121.workers.dev
      Entry: worker-api/src/index.ts
      Runtime: Cloudflare Workers
      Framework: Hono
  D1 SQL Database
    Database: privy_stellar_db
    Binding name trong Worker: DB
```

Backend Cloudflare nam trong:

```text
worker-api/
```

Mobile dang tro vao backend public tai:

```text
mobile/src/config.ts
```

## File quan trong

```text
worker-api/wrangler.toml       # ten Worker, D1 binding, public vars
worker-api/schema.sql          # schema tao bang D1
worker-api/src/index.ts        # tao app va mount routes
worker-api/src/core.ts         # service/helper chung: D1, Privy, Stellar
worker-api/src/routes/*.ts     # route theo domain
mobile/src/config.ts           # API_BASE_URL cho mobile
```

## Bien moi truong va secret

Trong `worker-api/wrangler.toml` co cac public vars:

```toml
ALLOWED_ORIGINS = "*"
HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org"
HORIZON_MAINNET_URL = "https://horizon.stellar.org"
FRIENDBOT_URL = "https://friendbot.stellar.org"
WALLETCONNECT_PROJECT_ID = ""
```

Secret phai set tren Cloudflare, khong commit vao git:

```text
PRIVY_APP_ID
PRIVY_APP_SECRET
```

Set secret bang terminal:

```sh
cd worker-api
npx wrangler secret put PRIVY_APP_ID
npx wrangler secret put PRIVY_APP_SECRET
```

Hoac set tren web:

```text
Cloudflare Dashboard
  Workers & Pages
    privy-stellar-api
      Settings
        Variables and Secrets
```

## D1 database

Ten database:

```text
privy_stellar_db
```

Binding trong Worker phai la:

```text
DB
```

Neu doi binding name, code se loi vi backend dang doc database qua:

```ts
c.env.DB
```

Schema hien co:

```text
accounts      # luu account theo email va danh sach wallet
contacts      # demo recipient/contact
issuers       # demo issuer USDC/USDT tren Testnet
transactions  # du phong luu transaction local
```

Tao/cap nhat bang remote D1:

```sh
cd worker-api
npm run d1:apply:remote
```

Tao/cap nhat bang local D1:

```sh
npm run d1:apply:local
```

## Gioi han Cloudflare D1 Free plan

Theo Cloudflare D1 docs:

```text
Databases/account: 10 tren Free
Database size: 500 MB moi database tren Free
Total account storage: 5 GB tren Free
Rows read: 5,000,000 rows/ngay tren Free
Rows written: 100,000 rows/ngay tren Free
Rows/table: khong gioi han, bi gioi han boi storage
Row/string/blob max size: 2 MB
Time Travel backup: 7 ngay tren Free
```

Neu vuot daily read/write limit, D1 tra loi cho client den khi quota reset.
Free quota reset hang ngay luc `00:00 UTC`.

Neu vuot storage limit, phai xoa du lieu cu hoac nang Workers Paid plan.

Nguon:

```text
https://developers.cloudflare.com/d1/platform/limits/
https://developers.cloudflare.com/d1/platform/pricing/
```

## Gioi han nay co dang lo cho du an hien tai khong?

Chua dang lo.

Du an hien tai chi luu metadata nho:

```text
email
wallet id/address/network
demo issuer
contact/demo recipient
mot so JSON metadata
```

Voi 500 MB D1 Free, du cho demo, SOW, testing, va mot luong user nho. Thu de
cham truoc thuong la `Rows read/ngay`, khong phai storage. Neu app lon len,
can tranh query full table va them index cho cac cot hay search/filter.

## Deploy backend

Chay kiem tra truoc deploy:

```sh
cd worker-api
npm run typecheck
npx wrangler deploy --dry-run --outdir /tmp/privy-stellar-worker-dryrun
npm audit --omit=dev
```

Deploy that:

```sh
npm run deploy
```

Sau deploy, test:

```sh
curl https://privy-stellar-api.namvu3121.workers.dev/api/health
curl "https://privy-stellar-api.namvu3121.workers.dev/api/assets?network=testnet"
```

Ket qua tot la `/api/health` co:

```json
{"ok":true}
```

## Cap nhat mobile backend URL

File:

```text
mobile/src/config.ts
```

Gia tri production hien tai:

```ts
export const API_BASE_URL = 'https://privy-stellar-api.namvu3121.workers.dev';
```

Neu chay backend local bang Wrangler dev, co the tam doi thanh:

```ts
export const API_BASE_URL = 'http://<LAN-IP-cua-may>:8787';
```

Sau khi doi config mobile, restart Metro/app de bundle moi duoc load.

## Kiem tra tren Cloudflare Dashboard

Worker:

```text
Workers & Pages
  privy-stellar-api
    Deployments      # xem deploy moi nhat co thanh cong khong
    Logs             # xem request/error runtime
    Settings
      Bindings       # xem DB binding
      Variables and Secrets
```

D1:

```text
Storage & Databases
  D1 SQL Database
    privy_stellar_db
      Tables / Console
      Metrics
      Settings
```

Theo doi quota D1:

```text
D1 SQL Database
  privy_stellar_db
    Metrics
      Row Metrics
```

## Loi hay gap

### Invalid uuid khi chay d1:apply:remote

Nguyen nhan thuong gap: copy `database_id` sai, vi Cloudflare dashboard doi khi
hien ID co tien to/nhan dan den dan nham.

Dung dinh dang UUID nhu:

```text
582ba8ad-9a77-4330-a5f1-9b15afae4401
```

Sai:

```text
R582ba8ad-9a77-4330-a5f1-9b15afae4401
```

Sua trong:

```text
worker-api/wrangler.toml
```

### Missing PRIVY_APP_ID or PRIVY_APP_SECRET

Can set secret cho Worker:

```sh
npx wrangler secret put PRIVY_APP_ID
npx wrangler secret put PRIVY_APP_SECRET
```

Sau khi set secret, deploy lai:

```sh
npm run deploy
```

### D1 binding DB not found

Kiem tra `worker-api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "privy_stellar_db"
database_id = "..."
```

Kiem tra tren Cloudflare Dashboard:

```text
Worker Settings > Bindings
```

### Mobile van goi backend local

Kiem tra:

```text
mobile/src/config.ts
```

Phai la:

```ts
export const API_BASE_URL = 'https://privy-stellar-api.namvu3121.workers.dev';
```

Sau do restart Metro/app.

### Testnet assets lan dau load hoi cham

Lan dau goi:

```text
/api/assets?network=testnet
```

backend se tao demo issuer USDC/USDT va fund bang Friendbot. Day la hanh vi
binh thuong.

### Mainnet fund khong hoat dong

Dung. Mainnet khong co Friendbot/faucet. Wallet mainnet phai duoc deposit XLM
that de active.

## Khi ban giao cho nguoi khac

Nguoi nhan can co:

```text
1. Quyen vao Cloudflare account hoac duoc moi lam member.
2. Quyen vao Privy Dashboard de xem App ID/App Secret.
3. Repo source code.
4. Node.js >= 20.
5. Wrangler login vao dung Cloudflare account.
```

Checklist ban giao:

```text
[ ] Cloudflare Worker: privy-stellar-api
[ ] D1 database: privy_stellar_db
[ ] D1 binding: DB
[ ] PRIVY_APP_ID da set
[ ] PRIVY_APP_SECRET da set
[ ] /api/health tra ok true
[ ] mobile/src/config.ts tro vao workers.dev URL
[ ] npm run typecheck pass
[ ] wrangler dry-run pass
```
