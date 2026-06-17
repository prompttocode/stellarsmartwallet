import type { Hono } from 'hono';
import type { WorkerBindings } from '../core';

type WalletExportPageState = {
  address: string;
  appId: string;
  email: string;
  network: string;
  returnUrl?: string;
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
    <style>
      :root {
        color-scheme: dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top, rgba(86, 90, 255, 0.28), transparent 36%),
          #090b10;
        color: #f5f7fb;
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
        min-height: 100vh;
        padding: 24px 18px 20px;
      }

      .card {
        max-width: 480px;
        margin: 0 auto;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(11, 15, 24, 0.94);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
      }

      .eyebrow {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(97, 103, 255, 0.18);
        color: #c8cbff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      h1 {
        margin: 14px 0 10px;
        font-size: 28px;
        line-height: 1.15;
      }

      p {
        margin: 0;
        color: #c7cfdd;
        line-height: 1.6;
      }

      .stack {
        display: grid;
        gap: 14px;
        margin-top: 22px;
      }

      .info {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .label {
        margin-bottom: 6px;
        color: #8e9bb0;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .value {
        word-break: break-word;
        color: #ffffff;
        font-size: 14px;
      }

      .actions {
        display: grid;
        gap: 12px;
        margin-top: 24px;
      }

      .primary,
      .secondary {
        width: 100%;
        padding: 14px 16px;
        border-radius: 14px;
        border: 0;
        font-weight: 700;
      }

      .primary {
        background: linear-gradient(135deg, #5f67ff, #8a5dff);
        color: #ffffff;
      }

      .primary:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
      }

      .status {
        min-height: 22px;
        font-size: 14px;
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
        const [sessionResetDone, setSessionResetDone] = useState(false);
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
    const network = String(c.req.query('network') || 'mainnet').trim();
    const returnUrl = String(c.req.query('returnUrl') || '').trim();

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
        email,
        network,
        returnUrl: returnUrl || undefined,
      }),
    );
  });
}
