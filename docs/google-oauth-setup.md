# Google OAuth Setup For Privy Mobile

Note nay giai thich dung cho man hinh Google login trong Privy Dashboard.

## Can hieu nhanh

Co 3 noi khac nhau:

1. Google Cloud Console
   - Noi tao Google OAuth Client ID / Client secret.
   - Noi dien `Authorized redirect URI`.

2. Privy Login Methods / Google
   - Noi dan Google `Client ID` va `Client secret`.
   - Man hinh nay khong co o redirect URI.

3. Privy App Clients
   - Noi cho phep app mobile redirect ve app bang URL scheme.
   - App hien tai dung scheme: `privy`.

## Cach nhanh de test dev

Neu chi can test login Google trong dev:

1. Vao Privy Dashboard.
2. Chon app dang dung `PRIVY_APP_ID`.
3. Vao Login Methods / Socials / Google.
4. Bat Google toggle.
5. Co the de trong `Client ID` va `Client secret` de dung default OAuth credentials cua Privy.
6. Save changes.
7. Vao App settings / Clients / mobile app client.
8. Them Allowed URL scheme:

```text
privy
```

9. Them Allowed app identifiers:

```text
iOS bundle identifier: com.test.linhtinhhaha
Android package: com.privy
```

10. Rebuild app:

```sh
npm run ios
npm run android
```

Ly do can rebuild: iOS/Android da them native URL scheme, reload Metro thoi co
the chua du.

## Cach production/custom credentials

Dung cach nay khi muon Google login hien brand cua project thay vi default cua
Privy.

### Buoc 1: Tao OAuth client tren Google Cloud

1. Vao Google Cloud Console:

```text
https://console.cloud.google.com/apis/credentials
```

2. Chon dung Google Cloud project.
3. Neu chua cau hinh OAuth consent screen thi cau hinh truoc.
4. Vao Credentials.
5. Chon Create credentials / OAuth client ID.
6. Application type chon:

```text
Web application
```

7. O `Authorized redirect URIs`, them dung URL nay:

```text
https://auth.privy.io/api/v1/oauth/callback
```

8. Save.
9. Copy Google `Client ID` va `Client secret`.

### Buoc 2: Dan credentials vao Privy

1. Vao Privy Dashboard.
2. Chon app dang dung.
3. Vao Login Methods / Socials / Google.
4. Dan Google `Client ID`.
5. Dan Google `Client secret`.
6. Save changes.

Khong dua Google `Client secret` vao mobile app, server code, `.env.example`,
hay git.

### Buoc 3: Cau hinh mobile callback trong Privy

1. Vao App settings / Clients.
2. Mo mobile app client dang dung voi React Native.
3. Them Allowed URL scheme:

```text
privy
```

4. Them Allowed app identifiers:

```text
iOS bundle identifier: com.test.linhtinhhaha
Android package: com.privy
```

5. Save.

## OAuth tokens va scopes

Trong Privy Google settings:

- `Return OAuth tokens`: de off neu app chi can dang nhap.
- `Additional scopes`: de trong neu app chi can login co email/profile.

Default scope cua Google OAuth thuong la:

```text
openid email profile
```

Chi bat `Return OAuth tokens` hoac them scope neu app can goi Google API thay
mat user.

## Checklist khi test

1. Start backend:

```sh
npm run server
```

2. Start Metro:

```sh
npm start
```

3. Chay app iOS/Android sau khi rebuild.
4. O man login, bam `Continue with Google`.
5. Dang nhap Google trong browser.
6. Xac nhan browser redirect ve app.
7. Xac nhan app vao duoc vi Stellar.

Neu login thanh cong tren browser nhung khong quay ve app, kiem tra lai:

- App da rebuild sau khi them scheme chua.
- Privy App Client da allow scheme `privy` chua.
- iOS bundle id / Android package co dung khong.
- Google Cloud redirect URI co dung
  `https://auth.privy.io/api/v1/oauth/callback` khong.
