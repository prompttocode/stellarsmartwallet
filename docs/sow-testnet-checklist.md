# SOW Testnet E2E Checklist

Dung file nay de verify cac core features tren Stellar Testnet truoc khi nop
SOW. Moi dong can co screenshot hoac note ro rang neu khong chup.

Backend dang dung:

```text
https://privy-stellar-api.namvu3121.workers.dev
```

## Checklist

| # | Step | Expected result | Status | Screenshot file | Tx hash | Notes |
|---|---|---|---|---|---|---|
| 1 | Open `/api/health` | JSON co `ok: true` | TODO |  | N/A |  |
| 2 | Open mobile app | App load va khong bao backend error | TODO |  | N/A |  |
| 3 | Login bang Privy | User vao duoc wallet screen | TODO |  | N/A |  |
| 4 | Create/load Testnet wallet | Hien Stellar address `G...` | TODO |  | N/A |  |
| 5 | Fund Testnet XLM | XLM balance tang, wallet active | TODO |  | N/A |  |
| 6 | Add USDC trustline | USDC row chuyen sang trusted | TODO |  |  |  |
| 7 | Fund demo USDC | USDC balance tang | TODO |  |  |  |
| 8 | Create test receiver | Receiver address duoc dien san | TODO |  | N/A |  |
| 9 | Send XLM | Transaction success va co hash | TODO |  |  |  |
| 10 | Send USDC | Transaction success va co hash | TODO |  |  |  |
| 11 | Claim demo NFT | Collectibles hien `Instawards Completion NFT` | TODO |  |  |  |
| 12 | Open transaction detail | Hien status, hash, sender/recipient | TODO |  | N/A |  |
| 13 | Open Stellar Expert link | Link explorer mo dung transaction | TODO |  | N/A |  |

## Curl Checks

```sh
curl https://privy-stellar-api.namvu3121.workers.dev/api/health
curl "https://privy-stellar-api.namvu3121.workers.dev/api/assets?network=testnet"
curl "https://privy-stellar-api.namvu3121.workers.dev/api/collectibles?network=testnet&address=<WALLET_ADDRESS>"
```

## Acceptance

- Khong con dong `FAIL`.
- Moi dong `TODO` phai duoc doi thanh `PASS`, `FAIL`, hoac `N/A`.
- Neu `N/A`, cot Notes phai co ly do.
- It nhat 3 tx hash Testnet hop le duoc dua sang `docs/sow-evidence.md`.
