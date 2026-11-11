# Firebase: bật/tắt Swap và VND

Project hiện tại: `orbitwallet-cad50`.

Tạo hai parameter kiểu **Boolean** trong Remote Config rồi **Publish changes**:

| Key | Điều khiển |
| --- | --- |
| `swap_enabled` | Tab Swap, báo giá, thực hiện swap và nội dung giới thiệu Swap |
| `vnd_enabled` | Mua/rút VND, kích hoạt ví bằng mua XLM, KYC, ngân hàng đã lưu và lịch sử đơn VND |

`true` = bật, `false` = tắt. Hai cờ độc lập.

- iOS đọc cả hai cờ trong **một lần fetch khi mở app**. Publish rồi đóng hẳn/mở lại app để nhận trạng thái mới.
- Fetch interval tối thiểu: 0 ms; timeout khởi tạo: 5 giây.
- Thiếu key nào thì key đó là `false`. Fetch lỗi/timeout thì cả hai `false`; không dùng cached `true` làm fallback.
- Android vẫn bật cả hai và chưa fetch Firebase, giữ nguyên hành vi cũ.
- Send/Receive trực tiếp, lịch sử on-chain, WalletConnect và faucet Testnet không bị tắt theo hai cờ này.
- Code mới **không đọc** `exchange_features_enabled`. Theo yêu cầu chủ sản phẩm, key cũ đã được xóa khỏi Firebase ở Config Version 13. Bản app cũ còn đọc key chung sẽ về `false` sau lần fetch thành công không còn key đó.

Hai key mới đã được publish với default Boolean `true`, giữ nguyên trạng thái bật của cờ chung trước khi xóa. Không có conditional values trên cờ cũ tại thời điểm chuyển đổi.

Các tính năng và việc sử dụng Remote Config phải được mô tả minh bạch với App Review; đây không phải cơ chế ẩn chức năng khi review hoặc thay thế điều kiện pháp lý.
