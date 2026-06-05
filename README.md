# Privy Stellar Wallet

Repo chia riêng backend và mobile app cho ví Stellar dùng Privy.

## Structure

```text
.
├── be/       # Express backend: Privy, Stellar Horizon, MySQL, API routes
├── mobile/   # React Native app: iOS, Android, screens, hooks, assets
└── docs/     # API docs, mainnet setup, verification notes
```

## Install

Dependency được cài riêng theo từng app. Không dùng npm workspaces, nên mỗi phần
có `node_modules` riêng:

```sh
cd mobile
npm install --legacy-peer-deps
```

```sh
cd ../be
npm install
```

## Run Mobile

```sh
npm run start
npm run ios
npm run android
```

Hoặc chạy trực tiếp trong thư mục mobile:

```sh
cd mobile
npm run start
npm run ios
npm run android
```

## Run Backend

Copy env backend:

```sh
cp be/.env.example be/.env
```

Điền Privy/MySQL/Horizon config trong `be/.env`, sau đó chạy:

```sh
npm run server
```

Hoặc:

```sh
cd be
npm run start
```

## Config

- Mobile public config: `mobile/src/config.ts`
- Backend secret config: `be/.env`
- Backend env template: `be/.env.example`
- API docs: `docs/api.md`

Không đưa `PRIVY_APP_SECRET`, seed phrase, private key, hoặc MySQL password vào mobile app.
