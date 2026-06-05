# Mainnet Setup Note

Tai lieu nay giai thich nhung thu can dien de app Stellar wallet chay duoc
ca Testnet va Mainnet. App van giu nut doi qua lai Testnet/Mainnet; khong
chuyen thanh mainnet-only.

## 1. Dieu quan trong nhat

`API_BASE_URL` khong phai link Stellar. No la link backend cua minh.

Luon co 2 tang:

- Mobile app goi ve backend qua `API_BASE_URL`.
- Backend goi Privy API va Stellar Horizon.

Mainnet that chi bat dau khi:

- App dang o network `mainnet`.
- Backend co Privy key dung.
- Backend dung Stellar public network/Horizon mainnet.
- Vi mainnet duoc nap XLM that de active.

Khong can dua private key, seed phrase, hay secret vi cho agent/code reviewer.

## 2. Can dien gi vao dau?

### `mobile/src/config.ts`

Day la config public nam trong app mobile.

```ts
export const API_BASE_URL = 'https://api-your-domain.com';
export const PRIVY_APP_ID = 'your_privy_app_id';
export const PRIVY_CLIENT_ID = 'your_privy_client_id';
```

- `API_BASE_URL`: link backend cua ban.
  - Local device: lay IP LAN cua may dang chay server, vi du
    `http://192.168.1.8:8787`.
  - Production: lay URL tu noi deploy backend, vi du Render/VPS/domain rieng:
    `https://api.your-domain.com`.
- `PRIVY_APP_ID`: lay trong Privy Dashboard.
- `PRIVY_CLIENT_ID`: lay trong Privy Dashboard, dung cho mobile client.
- Khong bao gio de `PRIVY_APP_SECRET` trong file nay.

### `be/.env`

Copy tu `be/.env.example`:

```sh
cp be/.env.example be/.env
```

Sau do dien:

```env
PORT=8787

PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

HORIZON_TESTNET_URL=https://horizon-testnet.stellar.org
HORIZON_MAINNET_URL=https://horizon.stellar.org
FRIENDBOT_URL=https://friendbot.stellar.org

DB_DRIVER=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=stellar
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
```

- `PRIVY_APP_SECRET`: lay trong Privy Dashboard, chi de trong backend.
- `HORIZON_MAINNET_URL`: endpoint Stellar Mainnet. Mac dinh co the dung
  `https://horizon.stellar.org`.
- `HORIZON_TESTNET_URL`: endpoint Stellar Testnet.
- `FRIENDBOT_URL`: chi dung cho Testnet. Mainnet khong co faucet.
- MySQL config: lay tu MySQL local hoac database provider.

`be/.env` da nam trong `.gitignore`, khong commit file nay.

## 3. Privy la gi, lay key o dau?

Privy la dich vu dang nhap va quan ly vi. Trong app nay, user dang nhap bang
email OTP, backend dung Privy de tao/restore/sign vi Stellar.

Lay key tai Privy Dashboard:

1. Vao `https://dashboard.privy.io`.
2. Tao hoac chon app.
3. Lay:
   - `PRIVY_APP_ID`
   - `PRIVY_CLIENT_ID`
   - `PRIVY_APP_SECRET`
4. `APP_SECRET` chi dua vao `be/.env`.

## 4. Horizon la gi?

Horizon la API cua Stellar. Backend dung Horizon de doc balance, history,
submit transaction.

- Testnet Horizon: `https://horizon-testnet.stellar.org`
- Mainnet Horizon: `https://horizon.stellar.org`

Neu app co nhieu user that, nen can nhac dung Horizon provider rieng de on dinh
hon public endpoint.

## 5. Vi sao mainnet can XLM that?

Testnet co Friendbot de lay XLM gia. Mainnet khong co faucet.

Mainnet can XLM that de:

- Active account moi.
- Tra transaction fee.
- Giu minimum balance/reserve.
- Add trustline cho token nhu USDC/EURC.

Viec test mainnet nen bat dau bang so tien rat nho.

## 6. Checklist test mainnet

1. Chay backend:

   ```sh
   npm run server
   ```

2. Kiem tra API:

   ```sh
   curl http://localhost:8787/api/health
   curl http://localhost:8787/api/networks
   curl "http://localhost:8787/api/assets?network=testnet"
   curl "http://localhost:8787/api/assets?network=mainnet"
   ```

3. Chay app va dang nhap Privy bang email OTP.
4. O Testnet:
   - Tao/restore vi.
   - Fund testnet.
   - Send/swap/add trustline.
5. Chuyen sang Mainnet:
   - Tao/restore vi mainnet.
   - Vao Receive/Deposit lay dia chi.
   - Nap mot it XLM that vao dia chi do.
   - Cho balance/history cap nhat.
   - Thu gui mot luong XLM rat nho.
6. Dam bao Mainnet khong hien nut faucet/demo token.
7. Dam bao send/swap/add trustline/export key tren Mainnet co confirm/biometric.

## 7. Nhung gi khong nen lam

- Khong commit `be/.env`.
- Khong dua `PRIVY_APP_SECRET` vao mobile app.
- Khong dua private key/seed phrase cho ai.
- Khong test mainnet bang so tien lon luc dau.
- Khong tron issuer/token Testnet voi Mainnet.
