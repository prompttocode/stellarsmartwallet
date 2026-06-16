# Deploy Backend len Cloudflare Workers

Tai lieu nay danh cho backend Cloudflare trong `worker-api/`. Backend Express
cu trong `be/` van duoc giu lai de tham chieu/local, nhung ban deploy public
nen dung Worker moi vi Cloudflare Workers khong chay truc tiep mot server
Express/MySQL long-running.

Neu ban giao du an cho nguoi khac, doc them runbook van hanh:

```text
docs/cloudflare-operations.md
```

## Kien truc hien tai

```text
mobile / Telegram Mini App
        |
        v
Cloudflare Worker: worker-api/src/index.ts
        |
        +-- Privy REST/SDK: tao user, tao/import/export/sign Stellar wallet
        +-- Stellar Horizon: balance, trustline, payment, swap path, submit tx
        +-- Cloudflare D1: accounts, contacts, demo issuers, transactions
```

`worker-api` khong dung MySQL va khong dung file JSON local. Du lieu can luu
duoc dat trong Cloudflare D1, la SQLite serverless cua Cloudflare. Mot so cot
luu JSON text trong D1 de giu schema nho trong giai doan dau, nhung no van la
database Cloudflare, khong phai file tren may ban.

## Cau truc code sau khi tach

```text
worker-api/src/
  index.ts                    # tao Hono app, CORS, error handler, mount routes
  core.ts                     # type, config, D1, Privy, Stellar service helpers
  routes/
    base.ts                   # health, session, wallet, demo wallet routes
    stellar.ts                # balance, fund, trustline, send, swap routes
    ramp.ts                   # fiat ramp placeholder routes
    walletconnect.ts          # WalletConnect config, review/sign XDR routes
```

`index.ts` nen ngan. Neu sau nay can lam sach tiep, file nen tach tiep la
`core.ts`: chia thanh `db.ts`, `privy.ts`, `stellar.ts`, `assets.ts`.

## API da port

Nhom he thong:

- `GET /api/health`
- `GET /api/networks`
- `GET /api/assets?network=testnet|mainnet&search=...`
- `GET /api/collectibles?network=testnet&address=...`
- `GET /api/wallets`

Nhom session/wallet:

- `POST /api/session`
- `POST /api/demo/session`
- `POST /api/demo/auth-session`
- `POST /api/demo/account`
- `POST /api/wallets`
- `POST /api/wallets/import`
- `POST /api/wallets/watch-only`
- `POST /api/wallets/export`
- `POST /api/wallets/select` (Privy Bearer token required)
- `POST /api/wallets/rename` (Privy Bearer token required)
- `POST /api/wallets/archive` (Privy Bearer token required)
- `POST /api/demo/receiver`

Nhom Stellar:

- `GET /api/stellar/:network/:address`
- `POST /api/stellar/:network/fund`
- `POST /api/stellar/:network/trustline`
- `POST /api/stellar/:network/fund-asset`
- `POST /api/stellar/:network/fund-nft`
- `POST /api/stellar/:network/send`
- `POST /api/stellar/:network/swap/quote`
- `POST /api/stellar/:network/swap/execute`
- `POST /api/stellar/:network/swap`

Route legacy khong co `:network` van duoc giu va mac dinh la Testnet:

- `GET /api/stellar/:address`
- `POST /api/stellar/fund`
- `POST /api/stellar/trustline`
- `POST /api/stellar/fund-asset`
- `POST /api/stellar/fund-nft`
- `POST /api/stellar/send`
- `POST /api/stellar/swap/quote`
- `POST /api/stellar/swap/execute`
- `POST /api/stellar/swap`

Nhom ramp va WalletConnect:

- `GET /api/ramp/providers`
- `POST /api/ramp/quote`
- `POST /api/ramp/checkout`
- `GET /api/walletconnect/config`
- `POST /api/walletconnect/stellar/review-xdr`
- `POST /api/walletconnect/stellar/sign-xdr`

`/api/ramp/quote` va `/api/ramp/checkout` hien tra `501` neu chua cau hinh
provider fiat ramp that. Day la hanh vi co chu dich: API ro rang, khong gia
lap thanh cong.

## 1. Len Cloudflare tao account

1. Mo `https://dash.cloudflare.com`.
2. Dang ky/dang nhap Cloudflare.
3. Neu Cloudflare hoi plan, chon Free.
4. Vao menu `Workers & Pages`.

## 2. Tao Worker project tren web

Buoc nay giup ban thay project tren dashboard ngay. Sau do deploy tu may se
ghi de code Hello World bang code that trong repo.

1. Trong `Workers & Pages`, bam `Create application`.
2. Chon `Start with Hello World`.
3. Bam `Get started`.
4. Dat ten Worker la:

```text
privy-stellar-api
```

5. Bam `Deploy`.
6. Sau khi deploy Hello World xong, tam thoi de do. Code that se deploy o
   buoc sau bang Wrangler.

## 3. Tao D1 database tren web

1. Trong Cloudflare dashboard, mo `Storage & Databases`.
2. Chon `D1 SQL Database`.
3. Bam `Create Database`.
4. Dat ten database:

```text
privy_stellar_db
```

5. Location hint co the de mac dinh. Neu duoc chon, chon khu vuc gan user nhat.
6. Bam `Create`.
7. Mo database vua tao, vao `Settings`, copy `Database ID`.
8. Mo file:

```text
worker-api/wrangler.toml
```

9. Thay dong nay:

```toml
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

bang:

```toml
database_id = "database-id-ban-vua-copy"
```

Quan trong: binding trong `wrangler.toml` phai giu la `DB`, vi code dang doc
D1 qua `c.env.DB`.

## 4. Cai dependency tren may

```sh
cd worker-api
npm install
```

## 5. Dang nhap Wrangler vao Cloudflare

```sh
npx wrangler login
```

Lenh nay se mo browser. Chon account Cloudflare cua ban va approve.

## 6. Tao bang trong D1

Local dev:

```sh
npm run d1:apply:local
```

Remote Cloudflare:

```sh
npm run d1:apply:remote
```

Sau lenh remote, mo lai D1 database tren dashboard. Vao tab `Console` hoac
`Tables` de kiem tra cac bang `accounts`, `contacts`, `issuers`,
`transactions` da duoc tao.

## 7. Set secret Privy

Secret khong ghi vao `wrangler.toml`.

```sh
npx wrangler secret put PRIVY_APP_ID
npx wrangler secret put PRIVY_APP_SECRET
```

Neu muon set tren web:

1. Vao `Workers & Pages`.
2. Chon Worker `privy-stellar-api`.
3. Vao `Settings`.
4. Mo `Variables and Secrets`.
5. Bam `Add`.
6. Chon type `Secret`.
7. Them 2 secret:

```text
PRIVY_APP_ID
PRIVY_APP_SECRET
```

Neu dung WalletConnect/Reown, dien project id vao `WALLETCONNECT_PROJECT_ID`
trong `wrangler.toml`. Project id nay khong phai private secret.

Nen khoa CORS truoc khi public that:

```toml
ALLOWED_ORIGINS = "https://your-mini-app-domain.com,http://localhost:8081"
```

Trong local dev:

```sh
cp .dev.vars.example .dev.vars
```

Roi dien:

```env
ALLOWED_ORIGINS=*
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
WALLETCONNECT_PROJECT_ID=
```

File `.dev.vars` da duoc gitignore.

## 8. Chay local de test

```sh
npm run dev
```

Kiem tra:

```sh
curl http://localhost:8787/api/health
curl "http://localhost:8787/api/assets?network=testnet"
```

Lan dau goi `assets?network=testnet`, Worker se tao demo issuer USDC/USDT va
fund issuer bang Friendbot. Day la hanh vi binh thuong cho Testnet demo.

## 9. Kiem tra truoc deploy

```sh
npm run typecheck
npx wrangler deploy --dry-run --outdir /tmp/privy-stellar-worker-dryrun
npm audit --omit=dev
```

Neu 3 lenh nay pass thi bundle Worker da san sang de dua len Cloudflare.

## 10. Deploy code that len Worker

```sh
npm run deploy
```

Sau khi deploy thanh cong, Wrangler se in URL dang:

```text
https://privy-stellar-api.<your-account>.workers.dev
```

Dung URL nay lam backend public:

```text
API_BASE_URL=https://privy-stellar-api.<your-account>.workers.dev
```

## 11. Kiem tra tren Cloudflare web

1. Vao `Workers & Pages`.
2. Chon `privy-stellar-api`.
3. Mo tab `Deployments`, xem deployment moi nhat phai thanh cong.
4. Mo tab `Settings` > `Bindings`, kiem tra co D1 binding:

```text
Variable name: DB
Database: privy_stellar_db
```

5. Mo URL:

```text
https://privy-stellar-api.<your-account>.workers.dev/api/health
```

Neu thay JSON co `"ok": true` la backend public da song.

## 12. Cap nhat mobile hoac Telegram Mini App

Trong mobile hien tai, sua:

```text
mobile/src/config.ts
```

Thanh:

```ts
export const API_BASE_URL = 'https://privy-stellar-api.<your-account>.workers.dev';
```

Voi Telegram Mini App sau nay, frontend cung se dung URL Worker nay.

## Luu y san pham

- Testnet co Friendbot; Mainnet khong co faucet.
- Mainnet send/trustline/swap/import/export/XDR signing yeu cau Privy identity
  token hop le.
- Demo token issuer secret chi dung cho Testnet va duoc luu trong D1.
- WalletConnect signer hien reject FeeBump XDR de tranh ky nham giao dich phuc
  tap. Co the them support FeeBump sau neu can.
- Fiat ramp chua co provider that. Khi co provider, thay `getDisabledRampResponse`
  bang adapter provider va giu nguyen route contract.

## Evidence de nop theo SOW

Khi deploy xong, ban nen chuan bi:

- App link: URL Telegram bot hoac Telegram Mini App public.
- Backend link: URL Cloudflare Worker `/api/health`.
- Repo link: branch co `worker-api/`, `schema.sql`, `wrangler.toml`.
- Demo video: login, tao wallet, fund Testnet, add trustline, fund token, send,
  swap, xem transaction hash tren Stellar explorer.
- Screenshot: Cloudflare Worker deployment, D1 tables, mobile/Telegram flow,
  successful transaction hash.
