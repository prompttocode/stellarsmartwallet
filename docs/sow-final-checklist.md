# SOW Final Bug-Free Checklist

Dung checklist nay ngay truoc khi nop SOW. Trang thai hop le:

```text
PASS / FAIL / N/A
```

Neu la `N/A`, bat buoc ghi ly do trong Notes. Khong nop khi con `FAIL`.

## Backend Cloudflare

| Item | Status | Notes |
|---|---|---|
| Worker `privy-stellar-api` deploy success | TODO |  |
| `/api/health` tra `ok: true` | TODO |  |
| `/api/networks` tra ca Testnet va Mainnet | TODO |  |
| `/api/assets?network=testnet` tra XLM/USDC/USDT | TODO |  |
| `/api/collectibles?network=testnet&address=...` tra collectible demo | TODO |  |

## D1 Database

| Item | Status | Notes |
|---|---|---|
| D1 database `privy_stellar_db` ton tai | TODO |  |
| Worker binding name la `DB` | TODO |  |
| Bang `accounts` ton tai | TODO |  |
| Bang `contacts` ton tai | TODO |  |
| Bang `issuers` ton tai | TODO |  |
| Bang `transactions` ton tai | TODO |  |

## Privy Auth

| Item | Status | Notes |
|---|---|---|
| Email OTP login thanh cong | TODO |  |
| Google/social login neu bat trong dashboard | TODO |  |
| Session restore sau khi reopen app | TODO |  |
| `PRIVY_APP_SECRET` khong nam trong mobile code | TODO |  |

## Testnet Wallet

| Item | Status | Notes |
|---|---|---|
| Tao/load vi Stellar Testnet | TODO |  |
| Hien wallet address `G...` | TODO |  |
| Fund XLM bang Friendbot | TODO |  |
| Balance refresh dung | TODO |  |
| Receive QR/address hien dung | TODO |  |

## Token / Trustline / Send

| Item | Status | Notes |
|---|---|---|
| Add USDC trustline | TODO |  |
| Fund demo USDC | TODO |  |
| Send XLM thanh cong | TODO |  |
| Send USDC thanh cong | TODO |  |
| Transaction detail hien hash | TODO |  |
| Stellar Expert link mo dung tx | TODO |  |

## NFT Display

| Item | Status | Notes |
|---|---|---|
| Portfolio co section Collectibles | TODO |  |
| Chua claim thi hien action `Claim` | TODO |  |
| Claim demo NFT thanh cong | TODO |  |
| Sau claim hien `Instawards Completion NFT` | TODO |  |
| NFT co explorer link | TODO |  |

## Mainnet Readiness

| Item | Status | Notes |
|---|---|---|
| Switch sang Mainnet duoc | TODO |  |
| Mainnet wallet address hien dung | TODO |  |
| Mainnet balance load tu Horizon public | TODO |  |
| UI canh bao real assets | TODO |  |
| Mainnet khong co Friendbot/faucet demo | TODO |  |
| Deposit QR/address hien dung | TODO |  |

## Mobile Config

| Item | Status | Notes |
|---|---|---|
| `API_BASE_URL` tro vao Cloudflare Worker | PASS | `https://privy-stellar-api.namvu3121.workers.dev` |
| App restart sau khi doi config | TODO |  |
| Khong con dung backend LAN IP khi test production | TODO |  |

## Acceptance

```text
[ ] Khong con FAIL
[ ] Moi TODO da duoc doi thanh PASS hoac N/A
[ ] N/A nao cung co ly do
[ ] docs/sow-evidence.md co toi thieu 3 tx hash Testnet moi
[ ] Co screenshot NFT/Collectibles
[ ] Co screenshot Mainnet mode
```
