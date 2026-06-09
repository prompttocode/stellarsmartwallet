# SOW Evidence

File nay gom bang chung de reviewer xem nhanh ma khong can doc code.

## Live Links

| Item | Link | Status | Notes |
|---|---|---|---|
| Backend health | https://privy-stellar-api.namvu3121.workers.dev/api/health | PASS | Cloudflare Worker public endpoint |
| Backend networks | https://privy-stellar-api.namvu3121.workers.dev/api/networks | TODO | Chup screenshot JSON khi nop |
| Mobile app | N/A | TODO | Dien link/TestFlight/APK neu co |

## Testnet Transaction Hashes

Can dien toi thieu 3 hash moi tu flow Testnet hien tai.

| # | Action | Network | Hash | Stellar Expert URL | Timestamp | Screenshot file | Status |
|---|---|---|---|---|---|---|---|
| 1 | Add USDC trustline | Testnet | TODO | TODO | TODO | TODO | TODO |
| 2 | Fund demo USDC/payment | Testnet | TODO | TODO | TODO | TODO | TODO |
| 3 | Send XLM or USDC | Testnet | TODO | TODO | TODO | TODO | TODO |
| 4 | Claim demo NFT | Testnet | TODO | TODO | TODO | TODO | TODO |

Stellar Expert URL format:

```text
https://stellar.expert/explorer/testnet/tx/<HASH>
```

## NFT / Collectibles Evidence

| Evidence | Expected | Screenshot file | Status | Notes |
|---|---|---|---|---|
| Portfolio Collectibles section before claim | Hien nut `Claim` hoac empty state | TODO | TODO |  |
| Portfolio Collectibles section after claim | Hien `Instawards Completion NFT` | TODO | TODO |  |
| NFT explorer asset link | Mo Stellar Expert asset page | TODO | TODO |  |

## Mainnet MVP Evidence

Mainnet MVP khong bat buoc giao dich tien that trong scope hien tai.

| Evidence | Expected | Screenshot file | Status | Notes |
|---|---|---|---|---|
| `/api/networks` | Co `testnet` va `mainnet` | TODO | TODO |  |
| Mobile Mainnet mode | Hien Mainnet/address/balance | TODO | TODO |  |
| Mainnet real-assets warning | UI canh bao giao dich mainnet dung tai san that | TODO | TODO |  |
| No Friendbot on Mainnet | Faucet testnet khong hien nhu Testnet | TODO | TODO |  |
| Deposit QR/address | Hien dia chi/QR deposit mainnet | TODO | TODO |  |

Statement:

```text
Mainnet MVP is live and ready for testing. No real funds were used for this
evidence pass.
```

## Cloudflare Evidence

| Evidence | Expected | Screenshot file | Status | Notes |
|---|---|---|---|---|
| Worker deployment | Deployment moi nhat success | TODO | TODO |  |
| D1 tables | Co `accounts`, `contacts`, `issuers`, `transactions` | TODO | TODO |  |
| Worker bindings | Co D1 binding `DB` | TODO | TODO |  |
