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
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: #f8f9fa;
        color: #1a1a1a;
      }

      button, input {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      #root {
        min-height: 100vh;
        width: 100%;
      }

      .shell {
        display: grid;
        grid-template-columns: 1fr 1fr;
        min-height: 100vh;
      }

      .card-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 60px 48px;
        background: #ffffff;
      }

      .card-side {
        background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 60px 48px;
        color: #ffffff;
      }

      .progress-bar {
        height: 3px;
        background: #e5e7eb;
        border-radius: 2px;
        margin-bottom: 48px;
        overflow: hidden;
      }

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #0ea5e9 0%, #06b6d4 100%);
        width: 33%;
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .step-indicator {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 16px;
      }

      h1 {
        margin: 0 0 24px;
        font-size: 42px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.02em;
        color: #1a1a1a;
      }

      .card-side h1 {
        color: #ffffff;
        font-size: 38px;
      }

      p {
        margin: 0;
        color: #6b7280;
        line-height: 1.8;
        font-size: 16px;
        font-weight: 400;
      }

      .card-side p {
        color: #d1d5db;
      }

      .stack {
        display: grid;
        gap: 20px;
        margin-top: 40px;
      }

      .info {
        padding: 20px;
        border-radius: 12px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .card-side .info {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.12);
      }

      .info:hover {
        background: #eff6ff;
        border-color: #0ea5e9;
        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.08);
        transform: translateY(-2px);
      }

      .card-side .info:hover {
        background: rgba(14, 165, 233, 0.1);
        border-color: rgba(14, 165, 233, 0.3);
        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
      }

      .label {
        margin-bottom: 8px;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .value {
        word-break: break-word;
        color: #1e293b;
        font-size: 15px;
        font-weight: 600;
        font-family: 'Courier New', monospace;
      }

      .card-side .value {
        color: #f1f5f9;
      }

      .actions {
        display: grid;
        gap: 14px;
        margin-top: 40px;
      }

      .primary, .secondary {
        width: 100%;
        padding: 14px 24px;
        border-radius: 8px;
        border: 0;
        font-weight: 600;
        font-size: 16px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .primary {
        background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
      }

      .primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(14, 165, 233, 0.4);
      }

      .primary:active:not(:disabled) {
        transform: translateY(0);
      }

      .primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .secondary {
        background: #f3f4f6;
        color: #1e293b;
        border: 1px solid #e5e7eb;
      }

      .secondary:hover:not(:disabled) {
        background: #e2e8f0;
        border-color: #cbd5e1;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      .status {
        min-height: 24px;
        font-size: 14px;
        margin-top: 20px;
        text-align: center;
        font-weight: 500;
        animation: fadeInStatus 0.4s ease;
      }

      @keyframes fadeInStatus {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .status.error {
        color: #dc2626;
        background: #fee2e2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 12px 16px;
      }

      .status.success {
        color: #059669;
        background: #ecfdf5;
        border: 1px solid #d1fae5;
        border-radius: 8px;
        padding: 12px 16px;
      }

      .status.warning {
        color: #d97706;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 8px;
        padding: 12px 16px;
      }

      .side-badge {
        display: inline-block;
        padding: 8px 16px;
        background: rgba(14, 165, 233, 0.2);
        border: 1px solid rgba(14, 165, 233, 0.4);
        border-radius: 6px;
        color: #7dd3fc;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 24px;
      }

      .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 48px 0;
      }

      .preload {
        align-items: center;
        color: #64748b;
        display: flex;
        flex-direction: column;
        gap: 16px;
        justify-content: center;
        min-height: 100vh;
        padding: 32px;
        text-align: center;
      }

      .loader {
        animation: spin 0.9s linear infinite;
        border: 3px solid #e5e7eb;
        border-radius: 50%;
        border-top-color: #0ea5e9;
        height: 36px;
        width: 36px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 1024px) {
        .shell {
          grid-template-columns: 1fr;
        }
        .card-side {
          display: none;
        }
        .card-container {
          padding: 40px 32px;
        }
        h1 {
          font-size: 36px;
        }
      }

      @media (max-width: 640px) {
        .card-container {
          padding: 32px 24px;
        }
        h1 {
          font-size: 28px;
        }
        p {
          font-size: 15px;
        }
        .stack {
          gap: 16px;
          margin-top: 32px;
        }
        .actions {
          margin-top: 32px;
        }
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="preload">
        <div class="loader"></div>
        <p>Loading secure wallet export...</p>
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
        if (!user) return "";
        if (typeof user.email?.address === "string") return user.email.address.trim().toLowerCase();
        if (typeof user.email?.email === "string") return user.email.email.trim().toLowerCase();
        const linkedAccounts = Array.isArray(user.linkedAccounts) ? user.linkedAccounts : Array.isArray(user.linked_accounts) ? user.linked_accounts : [];
        const match = linkedAccounts.find(account => account?.type === "email" && (account?.address || account?.email)) || linkedAccounts.find(account => account?.address || account?.email);
        return String(match?.address || match?.email || "").trim().toLowerCase();
      }

      function postToHost(message) {
        if (!window.ReactNativeWebView?.postMessage) return;
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }

      function buildReturnUrl(status) {
        if (!INITIAL_STATE.returnUrl) return "";
        const separator = INITIAL_STATE.returnUrl.includes("?") ? "&" : "?";
        return INITIAL_STATE.returnUrl + separator + "status=" + encodeURIComponent(status);
      }

      function sleep(ms) {
        return new Promise(resolve => window.setTimeout(resolve, ms));
      }

      function getSessionResetStorageKey() {
        return ["privy-wallet-export-reset", INITIAL_STATE.appId, INITIAL_STATE.sessionId].join(":");
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
        } catch {}
      }

      function finishFlow(completed) {
        const status = completed ? "success" : "cancel";
        if (window.ReactNativeWebView?.postMessage) {
          postToHost({ completed, type: "close" });
          return;
        }
        const nextUrl = buildReturnUrl(status);
        if (nextUrl) window.location.assign(nextUrl);
      }

      function ExportView() {
        const { ready, authenticated, user } = usePrivy();
        const { login } = useLogin();
        const { logout } = useLogout();
        const { exportWallet } = useExportWallet();
        const [status, setStatus] = useState("loading");
        const [error, setError] = useState("");
        const [sessionResetDone, setSessionResetDone] = useState(hasCompletedSessionReset);
        const [sessionResetting, setSessionResetting] = useState(false);
        const exportStartedRef = useRef(false);
        const sessionResetStartedRef = useRef(false);
        const currentEmail = useMemo(() => getEmailFromUser(user), [user]);
        const expectedEmail = INITIAL_STATE.email;
        const hasUser = Boolean(user);
        const emailMatches = !expectedEmail || !currentEmail || currentEmail === expectedEmail;

        const startExport = useCallback(async () => {
          if (exportStartedRef.current) return;
          exportStartedRef.current = true;
          setError("");
          setStatus("exporting");

          try {
            let lastError = null;
            for (let attempt = 0; attempt < 4; attempt += 1) {
              try {
                await exportWallet({
                  address: INITIAL_STATE.address,
                  uiOptions: { hideWalletAddress: false },
                });
                setStatus("done");
                return;
              } catch (nextError) {
                lastError = nextError;
                if (nextError instanceof Error && nextError.message.includes("User must be authenticated before exporting their Privy wallet") && attempt < 3) {
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
              nextError instanceof Error && nextError.message.includes("User must be authenticated before exporting their Privy wallet")
                ? "Privy still did not finish establishing the browser session for export. Close this page, open export again from the app, and sign in once more."
                : nextError instanceof Error
                ? nextError.message
                : "Unable to export this wallet right now.",
            );
          }
        }, [exportWallet]);

        useEffect(() => {
          if (!ready || sessionResetDone || sessionResetting || sessionResetStartedRef.current || !authenticated) return;
          sessionResetStartedRef.current = true;
          exportStartedRef.current = false;
          setError("");
          setSessionResetting(true);
          setStatus("signing_out");
          logout()
            .catch(nextError => {
              setError(nextError instanceof Error ? nextError.message : "Unable to clear the previous browser session.");
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
        }, [authenticated, emailMatches, hasUser, ready, sessionResetDone, sessionResetting]);

        const helperText =
          status === "done"
            ? "Privy closed the secure export modal. Return to the app only after you have copied the Stellar secret key into offline storage."
            : status === "exporting"
            ? "Privy is opening the secure export modal. The secret key is displayed on Privy's secure domain, not inside this app."
            : status === "loading"
            ? "Loading Privy's secure export tools. This usually takes a few seconds."
            : status === "authorizing"
            ? "Privy accepted the login. Finishing the browser session setup before export can start..."
            : status === "signing_out"
            ? "Clearing any saved Privy browser session first. You will need to sign in again for this export."
            : status === "mismatch"
            ? "This browser session is signed into a different Privy account. Sign out here, then sign in with the same account you use in the mobile app."
            : authenticated
            ? "The browser session is ready. Start the export flow from this page."
            : "Sign in with the same Privy account you use in the app, then start the export flow here.";

        const statusClass = error ? "status error" : status === "done" ? "status success" : status === "mismatch" ? "status warning" : "status";

        return html\`
          <div className="shell">
            <div className="card-container">
              <div>
                <div className="step-indicator">Step 2 of 3</div>
                <h1>Export Stellar recovery key</h1>
                <p>\${helperText}</p>

                <div className="stack">
                  <div className="info">
                    <div className="label">Wallet address</div>
                    <div className="value">\${INITIAL_STATE.address}</div>
                  </div>
                  <div className="info">
                    <div className="label">Expected account</div>
                    <div className="value">\${expectedEmail || "Use the same Privy account as the app"}</div>
                  </div>
                  <div className="info">
                    <div className="label">Signed in here</div>
                    <div className="value">\${currentEmail || "Not signed in yet"}</div>
                  </div>
                  <div className="info">
                    <div className="label">Network</div>
                    <div className="value">\${INITIAL_STATE.network}</div>
                  </div>
                </div>

                <div className="actions">
                  \${status === "done" ? html\`<button className="primary" onClick=\${() => finishFlow(true)}>Return to app</button>\` : null}
                  \${!authenticated && ready ? html\`<button className="primary" disabled=\${!sessionResetDone} onClick=\${async () => {
                    setError("");
                    setStatus("authorizing");
                    try {
                      await login({ loginMethods: ["email", "google"] });
                    } catch (nextError) {
                      setStatus("ready");
                      setError(nextError instanceof Error ? nextError.message : "Unable to start Privy sign-in right now.");
                    }
                  }}>Sign in with email or Google</button>\` : null}
                  \${authenticated && status !== "done" ? html\`<button className="secondary" onClick=\${async () => {
                    exportStartedRef.current = false;
                    setError("");
                    setStatus("ready");
                    await logout();
                    markSessionResetComplete();
                    setSessionResetDone(true);
                  }}>Sign out here</button>\` : null}
                  \${authenticated && emailMatches && sessionResetDone && status === "ready" ? html\`<button className="primary" onClick=\${startExport}>Export wallet</button>\` : null}
                  \${status !== "done" ? html\`<button className="secondary" onClick=\${() => finishFlow(false)}>Cancel</button>\` : null}
                </div>

                <div className=\${statusClass}>
                  \${error || (status === "loading" ? "Loading Privy..." : status === "exporting" ? "Waiting for Privy..." : !authenticated ? "Use email OTP or Google. If Google is blocked by this browser, use email OTP instead." : "")}
                </div>
              </div>
            </div>
            <div className="card-side">
              <div className="side-badge">Step 2 of 3</div>
              <h1>Secure recovery export</h1>
              <p>Follow the steps on the left to securely export your wallet recovery key. Your private information stays encrypted at all times.</p>
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
        return React.createElement(PrivyProvider, providerProps, React.createElement(ExportView));
      }

      createRoot(document.getElementById("root")).render(html\`<\${App} />\`);
    </script>
  </body>
</html>`;
}

export function registerWalletExportPageRoute(app: Hono<WorkerBindings>) {
  app.get('/wallet-export', c => {
    const address = String(c.req.query('address') || '').trim();
    const email = String(c.req.query('email') || '').trim().toLowerCase();
    const clientId = String(c.req.query('clientId') || '').trim();
    const network = String(c.req.query('network') || 'mainnet').trim();
    const returnUrl = String(c.req.query('returnUrl') || '').trim();
    const sessionId = String(c.req.query('t') || `${address}:${email}:${network}`).trim();

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
