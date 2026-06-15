# Phase 1 Demo - Tờ Nhắc Nhanh

## Mở đầu

> Hôm nay tôi sẽ tập trung vào bốn hạng mục của Phase 1: nền tảng backend, tích hợp Stellar Horizon, xác thực người dùng bằng Privy và kiểm thử luồng end-to-end trên Testnet. Dự án hiện đã phát triển vượt Phase 1, nhưng phần demo này sẽ bám sát phạm vi SOW.

## Trạng thái Phase 1

- **Day 1 - 3:** Backend đã được triển khai trên Cloudflare Workers với Hono, D1, server-side secrets, error handling và logging.
- **Day 4 - 6:** Đã kết nối Stellar Horizon; hỗ trợ lấy account, balance, transaction history, trustline, ký và gửi giao dịch.
- **Day 7 - 9:** Đăng nhập Google qua Privy; Worker xác minh identity token và liên kết user đã xác thực với Stellar wallet.
- **Day 10:** Public API đang hoạt động, 28 backend tests pass, mobile TypeScript pass và hai giao dịch Testnet đã được xác nhận thành công.

## Luồng kỹ thuật

> Sau khi user đăng nhập Google, Privy trả identity token cho mobile. Mobile gửi token này tới Cloudflare Worker. Worker xác minh token với Privy, lấy email đã được xác thực, sau đó tạo mới hoặc khôi phục Stellar wallet. Cuối cùng, Worker lấy balance và transaction history từ Horizon rồi trả session về mobile.

> Khi gửi giao dịch, Worker tạo Stellar transaction, yêu cầu Privy ký transaction hash, gắn signature vào transaction rồi submit lên Horizon.

## Vì sao không dùng Go?

> SOW ban đầu đề xuất Go microservices. Trong quá trình triển khai, team chuyển backend sang TypeScript và Hono trên Cloudflare Workers để giảm thời gian triển khai và vận hành. Các functional output của Phase 1 vẫn được giữ nguyên. Đây là một thay đổi về công nghệ và team sẵn sàng xác nhận lại nếu Go là tiêu chí nghiệm thu bắt buộc.

Không nói backend hiện tại là Go.

## Bảo mật

> Trong authenticated flow, backend không tin email do client tự gửi lên. Worker xác minh Privy identity token rồi lấy email trực tiếp từ Privy user profile. D1 chỉ lưu account và wallet metadata, không lưu raw private key. Việc ký giao dịch được yêu cầu qua Privy.

Hiện vẫn còn email fallback và các route `/api/demo/*` để phục vụ phát triển trên Testnet. Trước khi chạy production cần:

- Tắt demo routes.
- Bắt buộc Bearer token cho mọi thao tác nhạy cảm.
- Giới hạn CORS và thêm rate limiting.

## Bằng chứng

- Worker health: <https://privy-stellar-api.namvu3121.workers.dev/api/health>
- Networks: <https://privy-stellar-api.namvu3121.workers.dev/api/networks>
- Testnet assets: <https://privy-stellar-api.namvu3121.workers.dev/api/assets?network=testnet>
- Giao dịch 1: <https://stellar.expert/explorer/testnet/tx/800852ee4278b12c16ebd0ec80f7946d0be3b645e370b79feb30423099fd740b>
- Giao dịch 2: <https://stellar.expert/explorer/testnet/tx/b1c2c763b3cfb7cd01a271abf4e5d0ccc8e05ab98e6f0138d09792240bb8cd3a>
- Automated tests: `3 test files`, `28 tests`, tất cả đều pass.

## Dòng tiền

> Phase 1 chưa giữ tiền fiat và chưa trực tiếp cung cấp thanh khoản. Phase 1 tập trung vào authentication, wallet management và kết nối Stellar.

**Mua crypto bằng VND:**

User chuyển VND cho payment provider → provider xác nhận thanh toán → provider hoặc treasury gửi XLM/USDC vào Stellar wallet của user.

**Bán crypto nhận VND:**

User gửi XLM/USDC đến address và memo của provider → provider xác nhận giao dịch on-chain → provider chuyển VND vào tài khoản ngân hàng của user.

## Thanh khoản

> Thanh khoản do payment provider hoặc treasury partner cung cấp, không phải từ mobile app. Trước production cần có balance monitoring, giới hạn order, thời hạn tỷ giá, đối soát và từ chối order khi thanh khoản không đủ.

## Câu hỏi nhanh

**User đăng nhập lại có tạo ví mới không?**

> Không. Backend tìm account theo email đã được Privy xác thực và khôi phục wallet hiện có. Wallet chỉ được tạo khi account chưa có wallet phù hợp.

**Private key được lưu ở đâu?**

> D1 không lưu raw private key. Wallet và hoạt động ký được quản lý thông qua Privy.

**Testnet và Mainnet được tách thế nào?**

> Mỗi network sử dụng Horizon URL và network passphrase riêng. Chỉ Testnet được dùng Friendbot.

**USDC khác XLM như thế nào?**

> XLM là native asset. USDC là issued asset nên wallet cần trustline tới đúng issuer trước khi nhận hoặc giao dịch.

**Nếu Horizon hoặc Privy lỗi thì sao?**

> Worker trả HTTP error rõ ràng và trace ID để kiểm tra log. Giao dịch không được đánh dấu thành công nếu upstream thất bại.

**Backend đã production-ready chưa?**

> Chưa. Phase 1 đã hoàn thành để kiểm thử và xác minh trên Testnet. Trước production vẫn cần security hardening, compliance, settlement controls và thử nghiệm Mainnet với giá trị nhỏ.

## Giới hạn hiện tại

> KYC và VND ramp là phần vượt Phase 1. KYC photo upload hiện đang bị upstream Nginx giới hạn kích thước request với HTTP 413, vì vậy không đưa vào phần live demo hôm nay.

Nên nói:

> Phase 1 đã hoàn thành cho mục tiêu Testnet validation.

Không nên nói:

> Hệ thống đã production-ready.

## Kết thúc

> Phase 1 đã hoàn thành về mặt chức năng: backend đã được triển khai public, Privy authentication đã được xác minh, Stellar Horizon đã được kết nối, account-to-wallet mapping được lưu ổn định và các giao dịch Testnet đã được submit thành công.

