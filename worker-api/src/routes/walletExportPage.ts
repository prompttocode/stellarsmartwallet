import type { Hono } from 'hono';
import type { WorkerBindings } from '../core';

type WalletExportPageState = {
  address: string;
  appId: string;
  clientId?: string;
  email: string;
  network: string;
  returnUrl?: string;
  sessionId: string;
};

function encodeState(state: WalletExportPageState) {
  return JSON.stringify(state).replace(/</g, '\\u003c');
}

function renderWalletExportPage(state: WalletExportPageState) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1"
    />
    <title>Privy Recovery Export</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {
        color-scheme: dark;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 50% -20%, rgba(184, 255, 69, 0.12), #050505 60%);
        background-attachment: fixed;
        color: #FFFFFF;
      }

      button,
      input {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      #root {
        min-height: 100vh;
      }

      .shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
      }

      .card {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        padding: 32px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        background: rgba(17, 19, 24, 0.7);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        box-shadow: 0 40px 100px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(184, 255, 69, 0.15);
        color: #B8FF45;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        border: 1px solid rgba(184, 255, 69, 0.3);
        box-shadow: 0 0 20px rgba(184, 255, 69, 0.2);
      }

      h1 {
        margin: 20px 0 12px;
        font-size: 32px;
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }

      p {
        margin: 0;
        color: #a0aec0;
        line-height: 1.6;
        font-size: 16px;
      }

      .stack {
        display: grid;
        gap: 16px;
        margin-top: 32px;
      }

      .info {
        padding: 16px 20px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: background 0.3s ease;
      }

      .info:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .label {
        margin-bottom: 6px;
        color: #718096;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .value {
        word-break: break-word;
        color: #ffffff;
        font-size: 15px;
        font-weight: 500;
      }

      .actions {
        display: grid;
        gap: 14px;
        margin-top: 36px;
      }

      .primary,
      .secondary {
        width: 100%;
        padding: 16px;
        border-radius: 16px;
        border: 0;
        font-weight: 700;
        font-size: 16px;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .primary {
        background: linear-gradient(135deg, #B8FF45, #95E01D);
        color: #000000;
        box-shadow: 0 4px 15px rgba(184, 255, 69, 0.2);
      }

      .primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(184, 255, 69, 0.4);
      }

      .primary:active:not(:disabled) {
        transform: translateY(0);
      }

      .primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .secondary {
        background: #2C2C2E;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .secondary:hover {
        background: #3A3A3C;
        transform: translateY(-1px);
      }

      .status {
        min-height: 22px;
        font-size: 14px;
        margin-top: 16px;
        text-align: center;
        font-weight: 500;
      }

      .status.error {
        color: #ffb4b4;
      }

      .status.success {
        color: #98efba;
      }

      .status.warning {
        color: #ffd58a;
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="shell">
        <div class="card">
          <div class="eyebrow">Secure Recovery Export</div>
          <h1>Preparing secure export</h1>
          <p>
            Loading Privy's secure recovery export flow. If this screen does not
            finish loading, close it and try again from the app.
          </p>
        </div>
      </div>
    </div>
    <script type="module">
      import React, {
        useCallback,
        useEffect,
        useMemo,
        useRef,
        useState,
      } from "https://esm.sh/react@18.3.1?target=es2022";
      import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1&target=es2022";
      import htm from "https://esm.sh/htm@3.1.1";
      import {
        PrivyModal,
        PrivyProvider,
        useLogin,
        useLogout,
        usePrivy,
      } from "https://esm.sh/@privy-io/react-auth@3.31.0?deps=react@18.3.1,react-dom@18.3.1&target=es2022";
      import { useExportWallet } from "https://esm.sh/@privy-io/react-auth@3.31.0/extended-chains?deps=react@18.3.1,react-dom@18.3.1&target=es2022";

      const html = htm.bind(React.createElement);
      const INITIAL_STATE = ${encodeState(state)};

      function getEmailFromUser(user) {
        if (!user) {
          return "";
        }

        if (typeof user.email?.address === "string") {
          return user.email.address.trim().toLowerCase();
        }

        if (typeof user.email?.email === "string") {
          return user.email.email.trim().toLowerCase();
        }

        const linkedAccounts = Array.isArray(user.linkedAccounts)
          ? user.linkedAccounts
          : Array.isArray(user.linked_accounts)
          ? user.linked_accounts
          : [];

        const match = linkedAccounts.find(
          account =>
            account?.type === "email" &&
            (account?.address || account?.email),
        ) ||
          linkedAccounts.find(account => account?.address || account?.email);

        return String(match?.address || match?.email || "")
          .trim()
          .toLowerCase();
      }

      function postToHost(message) {
        if (!window.ReactNativeWebView?.postMessage) {
          return;
        }

        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }

      function buildReturnUrl(status) {
        if (!INITIAL_STATE.returnUrl) {
          return "";
        }

        const separator = INITIAL_STATE.returnUrl.includes("?") ? "&" : "?";

        return INITIAL_STATE.returnUrl + separator + "status=" + encodeURIComponent(status);
      }

      function sleep(ms) {
        return new Promise(resolve => window.setTimeout(resolve, ms));
      }

      function getSessionResetStorageKey() {
        return [
          "privy-wallet-export-reset",
          INITIAL_STATE.appId,
          INITIAL_STATE.sessionId,
        ].join(":");
      }

      function hasCompletedSessionReset() {
        try {
          return window.sessionStorage.getItem(getSessionResetStorageKey()) === "1";
        } catch {
          return false;
        }
      }

      function markSessionResetComplete() {
        try {
          window.sessionStorage.setItem(getSessionResetStorageKey(), "1");
        } catch {
          // Safari private mode can block storage. The in-memory state still covers
          // email OTP, while Google redirect needs storage when it is available.
        }
      }

      function finishFlow(completed) {
        const status = completed ? "success" : "cancel";

        if (window.ReactNativeWebView?.postMessage) {
          postToHost({
            completed,
            type: "close",
          });
          return;
        }

        const nextUrl = buildReturnUrl(status);

        if (nextUrl) {
          window.location.assign(nextUrl);
        }
      }

      function ExportView() {
        const { ready, authenticated, user } = usePrivy();
        const { login } = useLogin();
        const { logout } = useLogout();
        const { exportWallet } = useExportWallet();
        const [status, setStatus] = useState("loading");
        const [error, setError] = useState("");
        const [sessionResetDone, setSessionResetDone] = useState(
          hasCompletedSessionReset,
        );
        const [sessionResetting, setSessionResetting] = useState(false);
        const exportStartedRef = useRef(false);
        const sessionResetStartedRef = useRef(false);
        const currentEmail = useMemo(() => getEmailFromUser(user), [user]);
        const expectedEmail = INITIAL_STATE.email;
        const hasUser = Boolean(user);
        const emailMatches =
          !expectedEmail ||
          !currentEmail ||
          currentEmail === expectedEmail;

        const startExport = useCallback(async () => {
          if (exportStartedRef.current) {
            return;
          }

          exportStartedRef.current = true;
          setError("");
          setStatus("exporting");

          try {
            let lastError = null;

            for (let attempt = 0; attempt < 4; attempt += 1) {
              try {
                await exportWallet({
                  address: INITIAL_STATE.address,
                  uiOptions: {
                    hideWalletAddress: false,
                  },
                });

                setStatus("done");
                return;
              } catch (nextError) {
                lastError = nextError;

                if (
                  nextError instanceof Error &&
                  nextError.message.includes(
                    "User must be authenticated before exporting their Privy wallet",
                  ) &&
                  attempt < 3
                ) {
                  setStatus("authorizing");
                  await sleep(1200 * (attempt + 1));
                  setStatus("exporting");
                  continue;
                }

                throw nextError;
              }
            }

            throw lastError;
          } catch (nextError) {
            exportStartedRef.current = false;
            setStatus("ready");
            setError(
              nextError instanceof Error &&
              nextError.message.includes(
                "User must be authenticated before exporting their Privy wallet",
              )
                ? "Privy still did not finish establishing the browser session for export. Close this page, open export again from the app, and sign in once more."
                : nextError instanceof Error
                ? nextError.message
                : "Unable to export this wallet right now.",
            );
          }
        }, [exportWallet]);

        useEffect(() => {
          if (
            !ready ||
            sessionResetDone ||
            sessionResetting ||
            sessionResetStartedRef.current ||
            !authenticated
          ) {
            return;
          }

          sessionResetStartedRef.current = true;
          exportStartedRef.current = false;
          setError("");
          setSessionResetting(true);
          setStatus("signing_out");

          logout()
            .catch(nextError => {
              setError(
                nextError instanceof Error
                  ? nextError.message
                  : "Unable to clear the previous browser session.",
              );
            })
            .finally(() => {
              setSessionResetting(false);
            });
        }, [authenticated, logout, ready, sessionResetDone, sessionResetting]);

        useEffect(() => {
          if (!ready) {
            setStatus("loading");
            return;
          }

          if (sessionResetting) {
            setStatus("signing_out");
            return;
          }

          if (!authenticated) {
            if (!sessionResetDone) {
              markSessionResetComplete();
              setSessionResetDone(true);
            }
            exportStartedRef.current = false;
            setStatus("ready");
            return;
          }

          if (!sessionResetDone) {
            setStatus("signing_out");
            return;
          }

          if (!hasUser) {
            setStatus("authorizing");
            return;
          }

          if (!emailMatches) {
            exportStartedRef.current = false;
            setStatus("mismatch");
            return;
          }

          if (!exportStartedRef.current) {
            setStatus("ready");
          }
        }, [
          authenticated,
          emailMatches,
          hasUser,
          ready,
          sessionResetDone,
          sessionResetting,
        ]);

        const helperText =
          status === "done"
            ? "Privy closed the secure export modal. Return to the app only after you have copied the Stellar secret key into offline storage."
          : status === "exporting"
            ? "Privy is opening the secure export modal. The secret key is displayed on Privy's secure domain, not inside this app."
          : status === "authorizing"
            ? "Privy accepted the login. Finishing the browser session setup before export can start..."
          : status === "signing_out"
            ? "Clearing any saved Privy browser session first. You will need to sign in again for this export."
          : status === "mismatch"
            ? "This browser session is signed into a different Privy account. Sign out here, then sign in with the same account you use in the mobile app."
          : authenticated
            ? "The browser session is ready. Start the export flow from this page."
            : "Sign in with the same Privy account you use in the app, then start the export flow here.";

        const statusClass =
          error
            ? "status error"
            : status === "done"
            ? "status success"
            : status === "mismatch"
            ? "status warning"
            : "status";

        return html\`
          <div className="shell">
            <div className="card">
              <div className="eyebrow">Secure Recovery Export</div>
              <h1>Export Stellar recovery key</h1>
              <p>\${helperText}</p>

              <div className="stack">
                <div className="info">
                  <div className="label">Wallet address</div>
                  <div className="value">\${INITIAL_STATE.address}</div>
                </div>
                <div className="info">
                  <div className="label">Expected account</div>
                  <div className="value">
                    \${expectedEmail || "Use the same Privy account as the app"}
                  </div>
                </div>
                <div className="info">
                  <div className="label">Signed in here</div>
                  <div className="value">
                    \${currentEmail || "Not signed in yet"}
                  </div>
                </div>
                <div className="info">
                  <div className="label">Network</div>
                  <div className="value">\${INITIAL_STATE.network}</div>
                </div>
              </div>

              <div className="actions">
                \${status === "done"
                  ? html\`
                      <button
                        className="primary"
                        onClick=\${() => finishFlow(true)}
                      >
                        Return to app
                      </button>
                    \`
                  : null}

                \${!authenticated && ready
                  ? html\`
                      <button
                        className="primary"
                        disabled=\${!sessionResetDone}
                        onClick=\${async () => {
                          setError("");
                          setStatus("authorizing");
                          try {
                            await login({
                              loginMethods: ["email", "google"],
                            });
                          } catch (nextError) {
                            setStatus("ready");
                            setError(
                              nextError instanceof Error
                                ? nextError.message
                                : "Unable to start Privy sign-in right now.",
                            );
                          }
                        }}
                      >
                        Sign in with email or Google
                      </button>
                    \`
                  : null}

                \${authenticated && status !== "done"
                  ? html\`
                      <button
                        className="secondary"
                        onClick=\${async () => {
                          exportStartedRef.current = false;
                          setError("");
                          setStatus("ready");
                          await logout();
                          markSessionResetComplete();
                          setSessionResetDone(true);
                        }}
                      >
                        Sign out here
                      </button>
                    \`
                  : null}

                \${authenticated && emailMatches && sessionResetDone && status === "ready"
                  ? html\`
                      <button className="primary" onClick=\${startExport}>
                        Export wallet
                      </button>
                    \`
                  : null}

                \${status !== "done"
                  ? html\`
                      <button
                        className="secondary"
                        onClick=\${() => finishFlow(false)}
                      >
                        Cancel
                      </button>
                    \`
                  : null}
              </div>

              <div className=\${statusClass}>
                \${error ||
                (status === "exporting"
                  ? "Waiting for Privy..."
                  : !authenticated
                  ? "Use email OTP or Google. If Google is blocked by this browser, use email OTP instead."
                  : "")}
              </div>
            </div>
            <\${PrivyModal} />
          </div>
        \`;
      }

      function App() {
        const providerProps = {
          appId: INITIAL_STATE.appId,
          clientId: INITIAL_STATE.clientId || undefined,
        };

        return React.createElement(
          PrivyProvider,
          providerProps,
          React.createElement(ExportView),
        );
      }

      createRoot(document.getElementById("root")).render(html\`<\${App} />\`);
    </script>
  </body>
</html>`;
}

export function registerWalletExportPageRoute(app: Hono<WorkerBindings>) {
  app.get('/wallet-export', c => {
    const address = String(c.req.query('address') || '').trim();
    const email = String(c.req.query('email') || '')
      .trim()
      .toLowerCase();
    const clientId = String(c.req.query('clientId') || '').trim();
    const network = String(c.req.query('network') || 'mainnet').trim();
    const returnUrl = String(c.req.query('returnUrl') || '').trim();
    const sessionId = String(
      c.req.query('t') || `${address}:${email}:${network}`,
    ).trim();

    if (!address) {
      return c.html(
        '<!DOCTYPE html><html><body><p>Missing wallet export parameters. Reload the mobile app and try export again.</p></body></html>',
        400,
      );
    }

    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');

    return c.html(
      renderWalletExportPage({
        address,
        appId: c.env.PRIVY_APP_ID,
        clientId: clientId || undefined,
        email,
        network,
        returnUrl: returnUrl || undefined,
        sessionId,
      }),
    );
  });
}
