# E2E Verification Note

Ngay verify: 2026-06-04

## Scope

Note nay ghi lai cac lenh da chay de verify code hien tai va checklist manual
can quay/demo cho Phase 1.

Da them trong dot nay:

- Google OAuth login button qua Privy Expo SDK.
- Deep link scheme `privy` cho iOS/Android OAuth callback.
- API docs tai `docs/api.md`.
- Jest smoke test mocks cho cac native module de test render chay trong Node.

## Command Verification

### TypeScript

```sh
npx tsc --noEmit --pretty false
```

Ket qua: pass.

### Unit / smoke test

```sh
npm test -- --runInBand
```

Ket qua: pass.

```text
PASS __tests__/App.test.tsx
Tests: 1 passed, 1 total
```

### Lint

```sh
npm run lint
```

Ket qua: pass voi warnings con lai.

Warnings hien co:

- `WalletManagerModal.tsx`: shadow variable warning.
- Mot so inline style warnings.
- Mot so `react/no-unstable-nested-components` warnings trong `WalletApp.tsx`.

Khong con lint error.

### iOS plist

```sh
plutil -lint ios/Privy/Info.plist
```

Ket qua: pass.

### Android manifest

```sh
xmllint --noout android/app/src/main/AndroidManifest.xml
```

Ket qua: pass.

### iOS bundle

```sh
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output /tmp/privy-google-login-bundle/main.jsbundle \
  --assets-dest /tmp/privy-google-login-bundle/assets
```

Ket qua: pass. Metro co warning tu dependency `@noble/hashes/crypto.js` export
fallback, nhung bundle van tao thanh cong.

### Android bundle

```sh
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output /tmp/privy-google-login-bundle/index.android.bundle \
  --assets-dest /tmp/privy-google-login-bundle/android-assets
```

Ket qua: pass. Metro co warning tu dependency `@noble/hashes/crypto.js` export
fallback, nhung bundle van tao thanh cong.

## Backend API Verification

Da start server local bang:

```sh
npm run server
```

Da verify cac endpoint:

```sh
curl -sS http://localhost:8787/api/health
curl -sS http://localhost:8787/api/networks
curl -sS 'http://localhost:8787/api/assets?network=testnet'
curl -sS 'http://localhost:8787/api/assets?network=mainnet'
```

Ket qua:

- `/api/health`: `ok: true`, co Testnet va Mainnet.
- `/api/networks`: tra ve `mainnet` va `testnet`.
- `/api/assets?network=testnet`: co XLM, USDC demo, USDT demo.
- `/api/assets?network=mainnet`: co XLM, USDC, EURC, PYUSD, AQUA, yXLM, yUSDC.

Server local da duoc dung sau khi verify.

## Testnet Evidence

Hai transaction hash cu trong local DB da duoc verify tren Horizon Testnet:

1. `800852ee4278b12c16ebd0ec80f7946d0be3b645e370b79feb30423099fd740b`
   - Horizon: `successful: true`
   - Ledger: `2720590`
   - Created at: `2026-05-24T08:56:23Z`
   - Stellar Expert:
     `https://stellar.expert/explorer/testnet/tx/800852ee4278b12c16ebd0ec80f7946d0be3b645e370b79feb30423099fd740b`

2. `b1c2c763b3cfb7cd01a271abf4e5d0ccc8e05ab98e6f0138d09792240bb8cd3a`
   - Horizon: `successful: true`
   - Ledger: `2720560`
   - Created at: `2026-05-24T08:53:52Z`
   - Stellar Expert:
     `https://stellar.expert/explorer/testnet/tx/b1c2c763b3cfb7cd01a271abf4e5d0ccc8e05ab98e6f0138d09792240bb8cd3a`

Khuyen nghi khi nop bao cao/demo: tao them 1 giao dich testnet moi trong luc
quay video, roi dua tx hash moi nhat vao report.

## Google Login Setup Needed

Code app da co nut `Continue with Google`, nhung Google OAuth chi chay het flow
sau khi cau hinh tren Privy Dashboard.

Can lam trong Privy Dashboard:

- Vao app dang dung `PRIVY_APP_ID`.
- Vao Login Methods / Socials.
- Enable Google OAuth.
- Vao App Clients cua mobile app.
- Them allowed URL scheme: `privy`.
- Them allowed app identifiers:
  - iOS bundle identifier: `com.test.linhtinhhaha`
  - Android package: `com.privy`

Neu chi test development:

- Co the bat Google bang default OAuth credentials cua Privy.
- Khong can dua Google Client ID/Secret vao repo.

Neu muon production/custom branding:

- Tao OAuth Client trong Google Cloud voi application type la `Web App`.
- Authorized redirect URI cua Google phai la:

```text
https://auth.privy.io/api/v1/oauth/callback
```

- Copy Google `Client ID` va `Client secret` vao Privy Dashboard.
- Khong dua Google `Client secret` vao mobile app hay git.

Sau khi cau hinh dashboard, can rebuild native app:

```sh
npm run ios
npm run android
```

Ly do: iOS/Android da them URL scheme native, reload Metro thoi co the chua du.

## Manual E2E Checklist

Dung checklist nay khi quay demo:

1. Start backend `npm run server`.
2. Start Metro `npm start`.
3. Mo app tren iOS hoac Android.
4. Login bang email OTP Privy.
5. Logout, login lai bang `Continue with Google`.
6. Xac nhan app vao duoc vi Stellar cua cung user.
7. Testnet: fund XLM bang Friendbot.
8. Testnet: tao receiver demo.
9. Testnet: gui XLM/token.
10. Mo History va Transaction Detail.
11. Copy tx hash va mo Stellar Expert link.
12. Switch sang Mainnet.
13. Xac nhan Mainnet khong hien faucet/Friendbot demo.
14. Xac nhan Mainnet yeu cau auth/biometric cho thao tac nhay cam.

## Security Notes

- Khong can dua private key, seed phrase, Google client secret hay
  `PRIVY_APP_SECRET` cho nguoi review video.
- `PRIVY_APP_ID`, `PRIVY_CLIENT_ID`, `API_BASE_URL` la public config cua app.
- `PRIVY_APP_SECRET` chi nam trong `server/.env`.
