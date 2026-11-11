`GET https://api.getstellar.shop/api/partner/transactions`

| Tham số tùy chọn trên URL | Ý nghĩa                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `network`                 | `mainnet` hoặc `testnet`; bỏ qua để lấy cả hai                                                      |
| `wallet`                  | Địa chỉ ví Stellar chính xác (`G...`)                                                               |
| `from`                    | Lấy giao dịch từ thời điểm này, có bao gồm mốc này; định dạng UTC ISO, ví dụ `2026-09-01T00:00:00Z` |
| `to`                      | Lấy giao dịch trước thời điểm này, không bao gồm mốc này; định dạng UTC ISO                         |
| `limit`                   | Số bản ghi mỗi trang: 1–100; mặc định 50                                                            |
| `cursor`                  | Dùng giá trị `nextCursor` của phản hồi trước để lấy trang tiếp theo, giữ nguyên các bộ lọc          |

Ví dụ gọi API sau khi đã thiết lập biến môi trường `PARTNER_TRANSACTIONS_API_KEY`:

```sh
curl 'https://api.getstellar.shop/api/partner/transactions?network=testnet&limit=50' \
  -H "Authorization: Bearer $PARTNER_TRANSACTIONS_API_KEY"
```

Cấu trúc phản hồi: `{ "data": [...], "nextCursor": "123", "limit": 50 }`.
`nextCursor: null` nghĩa là đã hết kết quả. Mỗi bản ghi có các trường `id`, `walletAddress`,
`network`, `operationId`, `transactionHash`, `direction`, `operation`,
`assetCode`, `assetIssuer`, `amount` (chuỗi), `fromAddress`, `toAddress`,
`ledger`, `createdAt` (thời điểm giao dịch) và `syncedAt` (thời điểm đồng bộ).

Mã lỗi: `400` tham số không hợp lệ, `401` thiếu hoặc sai key,
`503` server chưa cấu hình key.
