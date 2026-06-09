import type { Context, Hono } from "hono";
import {
  assertAccountWallet,
  assertAmount,
  assertSufficientBalance,
  assertStellarAddress,
  ensureTrustline,
  getSupportedAsset,
  loadAccount,
  makeError,
  normalizeNetwork,
  readJsonBody,
  requireAccountContext,
  shouldRequireMainnetAuth,
  type Env,
  type StellarNetwork,
  type WorkerBindings,
} from "../core";

type RampDirection = "buy" | "sell";
type RampAssetCode = "USDC" | "XLM";

type PaymentFeeConfig = {
  max_order_amount?: number | null;
  min_fee: number;
  min_order_amount: number;
  fee_rate: number;
  source: string;
  spread: number;
};

type PaymentRate = {
  buy: number;
  created_at: string;
  fee_rate_buy: number;
  fee_rate_sell: number;
  min_fee_vnd: number;
  sell: number;
};

type RampOrderData = Record<string, unknown>;

const PAYMENT_ORDER_TIMEOUT_MS = 15_000;

type StoredRampOrderRow = {
  account_email: string;
  account_key: string;
  asset_code: string;
  created_at: string;
  data: string;
  direction: RampDirection;
  network: StellarNetwork;
  payment_code: string;
  processing_state: number | null;
  provider_order_id: string | null;
  state: number | null;
  updated_at: string;
  wallet_address: string;
  wallet_id: string;
};

function getPaymentBaseUrl(env: Env) {
  const value = String(env.PAYMENT_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (!value) {
    throw makeError("Payment API is not configured", 503);
  }

  return value;
}

async function paymentRequest<T>(
  env: Env,
  path: string,
  options: RequestInit = {},
  requiresPartnerKey = false
) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresPartnerKey) {
    const partnerKey = String(env.PAYMENT_PARTNER_APP_KEY || "").trim();

    if (!partnerKey) {
      throw makeError("Payment partner key is not configured", 503);
    }

    headers.set("partner-app-key", partnerKey);
  }

  const response = await fetch(`${getPaymentBaseUrl(env)}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let body: unknown = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = body as {
      error?: string | { message?: string };
      message?: string;
    } | null;
    const message =
      (typeof errorBody?.error === "string"
        ? errorBody.error
        : errorBody?.error?.message) ||
      errorBody?.message ||
      `Payment service returned HTTP ${response.status}`;
    throw makeError(message, response.status);
  }

  return body as T;
}

async function paymentRedirect(env: Env, path: string) {
  const headers = new Headers({
    Accept: "text/html,application/json",
  });
  const partnerKey = String(env.PAYMENT_PARTNER_APP_KEY || "").trim();

  if (!partnerKey) {
    throw makeError("Payment partner key is not configured", 503);
  }

  headers.set("partner-app-key", partnerKey);

  const response = await fetch(`${getPaymentBaseUrl(env)}${path}`, {
    headers,
    method: "GET",
    redirect: "manual",
  });
  const location = response.headers.get("location");

  if (location && response.status >= 300 && response.status < 400) {
    return new Response(null, {
      headers: {
        Location: location,
      },
      status: response.status,
    });
  }

  const text = await response.text();

  return new Response(text, {
    headers: {
      "Content-Type": response.headers.get("content-type") || "text/plain",
    },
    status: response.status,
  });
}

function isPopulated(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function mergePopulatedRecord(
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined
) {
  const result = { ...(previous || {}) };

  for (const [key, value] of Object.entries(next || {})) {
    if (isPopulated(value)) {
      result[key] = value;
    }
  }

  return result;
}

function mergeRampOrderData(
  previous: RampOrderData | null | undefined,
  next: RampOrderData
) {
  if (!previous) {
    return next;
  }

  const previousBody = previous.body as Record<string, unknown> | undefined;
  const nextBody = next.body as Record<string, unknown> | undefined;
  const previousBankInfo = previousBody?.bankInfo as
    | Record<string, unknown>
    | undefined;
  const nextBankInfo = nextBody?.bankInfo as
    | Record<string, unknown>
    | undefined;

  return {
    ...previous,
    ...next,
    body: {
      ...mergePopulatedRecord(previousBody, nextBody),
      bankInfo: mergePopulatedRecord(previousBankInfo, nextBankInfo),
    },
    pay_data: mergePopulatedRecord(
      previous.pay_data as Record<string, unknown> | undefined,
      next.pay_data as Record<string, unknown> | undefined
    ),
    payment_info: mergePopulatedRecord(
      previous.payment_info as Record<string, unknown> | undefined,
      next.payment_info as Record<string, unknown> | undefined
    ),
    sell_transaction_hash:
      next.sell_transaction_hash || previous.sell_transaction_hash,
    transaction_hash: next.transaction_hash || previous.transaction_hash,
  };
}

function getPaymentResponseData(response: unknown) {
  const value = response as { data?: unknown } | null;

  return value?.data && typeof value.data === "object"
    ? (value.data as RampOrderData)
    : null;
}

function replacePaymentResponseData(response: unknown, data: RampOrderData) {
  if (response && typeof response === "object") {
    return {
      ...(response as Record<string, unknown>),
      data,
    };
  }

  return {
    data,
    success: true,
  };
}

function isPaymentTimeoutError(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  const message = error instanceof Error ? error.message : String(error);

  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /aborted|timed out|timeout/i.test(message)
  );
}

function parseStoredOrder(row: StoredRampOrderRow | null) {
  if (!row?.data) {
    return null;
  }

  try {
    return JSON.parse(row.data) as RampOrderData;
  } catch {
    return null;
  }
}

function getRampOrderCreatedAt(order: RampOrderData, fallback: string) {
  const value = order.created_at;

  if (typeof value === "string") {
    const timestamp = new Date(value);

    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }

  if (value && typeof value === "object") {
    const seconds = Number((value as { seconds?: unknown }).seconds);
    const nanos = Number((value as { nanos?: unknown }).nanos || 0);

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
    }
  }

  return fallback;
}

async function findStoredRampOrder(env: Env, reference: string) {
  if (!env.DB) {
    return null;
  }

  return env.DB.prepare(
    `SELECT *
     FROM ramp_orders
     WHERE payment_code = ? OR provider_order_id = ?
     LIMIT 1`
  )
    .bind(reference, reference)
    .first<StoredRampOrderRow>();
}

async function saveRampOrderSnapshot(
  env: Env,
  order: RampOrderData,
  metadata: {
    accountEmail: string;
    accountKey: string;
    assetCode: RampAssetCode;
    direction: RampDirection;
    network: StellarNetwork;
    walletAddress: string;
    walletId: string;
  }
) {
  if (!env.DB) {
    return order;
  }

  const paymentCode = String(order.code || order.payment_code || "").trim();

  if (!paymentCode) {
    return order;
  }

  const providerOrderId = String(order.id || order.order_id || "").trim();
  const now = new Date().toISOString();
  const createdAt = getRampOrderCreatedAt(order, now);
  const state = Number(order.state ?? order.order_state);
  const processingState = Number(
    order.processing_state ?? order.processingState
  );

  await env.DB.prepare(
    `INSERT INTO ramp_orders (
       payment_code,
       provider_order_id,
       account_key,
       account_email,
       wallet_id,
       wallet_address,
       network,
       direction,
       asset_code,
       state,
       processing_state,
       data,
       created_at,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(payment_code) DO UPDATE SET
       provider_order_id = excluded.provider_order_id,
       account_key = excluded.account_key,
       account_email = excluded.account_email,
       wallet_id = excluded.wallet_id,
       wallet_address = excluded.wallet_address,
       network = excluded.network,
       direction = excluded.direction,
       asset_code = excluded.asset_code,
       state = excluded.state,
       processing_state = excluded.processing_state,
       data = excluded.data,
       updated_at = excluded.updated_at`
  )
    .bind(
      paymentCode,
      providerOrderId || null,
      metadata.accountKey,
      metadata.accountEmail,
      metadata.walletId,
      metadata.walletAddress,
      metadata.network,
      metadata.direction,
      metadata.assetCode,
      Number.isFinite(state) ? state : null,
      Number.isFinite(processingState) ? processingState : null,
      JSON.stringify(order),
      createdAt,
      now
    )
    .run();

  return order;
}

async function mergeAndSaveStoredRampOrder(
  env: Env,
  reference: string,
  next: RampOrderData
) {
  const row = await findStoredRampOrder(env, reference);

  if (!row) {
    return next;
  }

  const merged = mergeRampOrderData(parseStoredOrder(row), next);

  await saveRampOrderSnapshot(env, merged, {
    accountEmail: row.account_email,
    accountKey: row.account_key,
    assetCode: row.asset_code as RampAssetCode,
    direction: row.direction,
    network: row.network,
    walletAddress: row.wallet_address,
    walletId: row.wallet_id,
  });

  return merged;
}

async function saveUntrackedRampOrderFromQuery(
  c: Context<WorkerBindings>,
  order: RampOrderData
) {
  const sourceAddress = String(c.req.query("sourceAddress") || "").trim();
  const sourceWalletId = String(c.req.query("sourceWalletId") || "").trim();
  const email = String(c.req.query("email") || "").trim();

  if (!sourceAddress || !sourceWalletId || !email) {
    return order;
  }

  const context = await getOrderContext(
    c,
    {
      email,
      network: c.req.query("network"),
      sourceAddress,
      sourceWalletId,
    },
    false
  );
  const direction = normalizeDirection(
    order.order_type || c.req.query("direction")
  );
  const assetCode = normalizeRampAsset(
    order.asset_code || c.req.query("assetCode")
  );
  const snapshot = {
    ...order,
    asset_code: assetCode,
    chain_id: order.chain_id ?? (context.network === "testnet" ? 1 : 0),
    order_type: direction,
  };

  await saveRampOrderSnapshot(c.env, snapshot, {
    accountEmail: context.account.email,
    accountKey: context.account.id || context.account.email,
    assetCode,
    direction,
    network: context.network,
    walletAddress: context.sourceAddress,
    walletId: context.sourceWalletId,
  });

  return snapshot;
}

function normalizeRampAsset(value: unknown): RampAssetCode {
  const assetCode = String(value || "")
    .trim()
    .toUpperCase();

  if (assetCode !== "USDC" && assetCode !== "XLM") {
    throw makeError("Payment orders support XLM or USDC only", 400);
  }

  return assetCode;
}

function normalizeDirection(value: unknown): RampDirection {
  if (value === "buy" || value === "sell") {
    return value;
  }

  throw makeError("Direction must be buy or sell", 400);
}

async function getFeeConfig(env: Env, assetCode: RampAssetCode) {
  return paymentRequest<{
    success: boolean;
    data: {
      buy: PaymentFeeConfig;
      sell: PaymentFeeConfig;
      token: RampAssetCode;
    };
  }>(env, `/config/fee/${assetCode}`);
}

async function getRate(env: Env, assetCode: RampAssetCode) {
  return paymentRequest<PaymentRate>(
    env,
    assetCode === "USDC" ? "/api/rate/usdt_vnd" : "/api/rate/xlm_vnd"
  );
}

function validateOrderRange(amount: string, config: PaymentFeeConfig) {
  const value = Number(amount);

  if (value < config.min_order_amount) {
    throw makeError(`Minimum order is ${config.min_order_amount}`, 400);
  }

  if (
    config.max_order_amount !== null &&
    config.max_order_amount !== undefined &&
    value > config.max_order_amount
  ) {
    throw makeError(`Maximum order is ${config.max_order_amount}`, 400);
  }
}

async function getOrderContext(
  c: Context<WorkerBindings>,
  body: Record<string, unknown>,
  requireSigner: boolean
) {
  const network = normalizeNetwork(body.network);
  const sourceWalletId = String(body.sourceWalletId || "").trim();
  const sourceAddress = String(body.sourceAddress || "").trim();
  const account = await requireAccountContext(
    c.env,
    c.req.header("authorization"),
    body,
    {
      network,
      requireAuth: shouldRequireMainnetAuth(network),
    }
  );

  assertStellarAddress(sourceAddress, "Wallet");
  assertAccountWallet({
    account,
    address: sourceAddress,
    network,
    requireSigner,
    walletId: sourceWalletId,
  });

  return {
    account,
    network,
    sourceAddress,
    sourceWalletId,
  };
}

function getCallbackUrl(c: Context<WorkerBindings>) {
  return (
    String(c.env.PAYMENT_CALLBACK_URL || "").trim() ||
    `${new URL(c.req.url).origin}/api/ramp/callback`
  );
}

async function buildOrderPayload(
  c: Context<WorkerBindings>,
  body: Record<string, unknown>,
  direction: RampDirection
) {
  const amount = assertAmount(body.amount);
  const assetCode = normalizeRampAsset(body.assetCode);
  const context = await getOrderContext(c, body, direction === "sell");
  const asset = await getSupportedAsset(c.env, {
    assetCode,
    network: context.network,
  });
  const feeConfig = await getFeeConfig(c.env, assetCode);
  const directionConfig = feeConfig.data[direction];

  validateOrderRange(amount, directionConfig);

  if (direction === "buy" && assetCode === "USDC") {
    const recipientAccount = await loadAccount(
      c.env,
      context.sourceAddress,
      context.network
    );

    if (!recipientAccount) {
      throw makeError("Activate the Stellar wallet with XLM first", 400);
    }

    ensureTrustline(recipientAccount, asset, "Recipient wallet");
  }

  if (direction === "sell") {
    const sourceAccount = await loadAccount(
      c.env,
      context.sourceAddress,
      context.network
    );

    if (!sourceAccount) {
      throw makeError("Source wallet is not active on Stellar", 400);
    }

    ensureTrustline(sourceAccount, asset, "Source wallet");
    assertSufficientBalance(sourceAccount, asset, amount);
  }

  return {
    amount,
    asset,
    asset_code: assetCode,
    callback: getCallbackUrl(c),
    chain_id: context.network === "testnet" ? 1 : 0,
    context,
    token_address: asset.assetIssuer || "",
    user_id: context.account.id || context.account.email,
  };
}

function getRampProviders(env: Env) {
  return [
    {
      configured: Boolean(
        env.PAYMENT_API_BASE_URL && env.PAYMENT_PARTNER_APP_KEY
      ),
      id: "seerbot-vnd",
      name: "Seerbot VND",
      supports: ["buy", "sell"],
      type: "fiat",
    },
  ];
}

export function registerRampRoutes(app: Hono<WorkerBindings>) {
  app.get("/api/ramp/providers", (c) =>
    c.json({
      providers: getRampProviders(c.env),
    })
  );

  app.post("/api/ramp/quote", async (c) => {
    const body = await readJsonBody(c);
    const amount = assertAmount(body.amount);
    const assetCode = normalizeRampAsset(body.assetCode);
    const direction = normalizeDirection(body.direction);
    const [rate, feeConfig] = await Promise.all([
      getRate(c.env, assetCode),
      getFeeConfig(c.env, assetCode),
    ]);
    const config = feeConfig.data[direction];

    validateOrderRange(amount, config);

    const unitRate = rate[direction];
    const grossVnd = Number(amount) * unitRate;
    const feeVnd = Math.max(grossVnd * config.fee_rate, config.min_fee);
    const totalVnd =
      direction === "buy"
        ? Math.ceil(grossVnd + feeVnd)
        : Math.max(0, Math.floor(grossVnd - feeVnd));

    return c.json({
      success: true,
      data: {
        amount,
        asset_code: assetCode,
        created_at: rate.created_at,
        direction,
        fee_rate: config.fee_rate,
        fee_vnd: Math.ceil(feeVnd),
        gross_vnd: Math.round(grossVnd),
        max_order_amount: config.max_order_amount ?? null,
        min_fee_vnd: config.min_fee,
        min_order_amount: config.min_order_amount,
        rate: unitRate,
        source: config.source,
        total_vnd: totalVnd,
      },
    });
  });

  app.get("/api/ramp/orders", async (c) => {
    const network = normalizeNetwork(c.req.query("network"));
    const sourceWalletId = String(c.req.query("sourceWalletId") || "").trim();
    const sourceAddress = String(c.req.query("sourceAddress") || "").trim();
    const account = await requireAccountContext(
      c.env,
      c.req.header("authorization"),
      {
        email: c.req.query("email"),
      },
      {
        network,
        requireAuth: shouldRequireMainnetAuth(network),
      }
    );

    assertStellarAddress(sourceAddress, "Wallet");
    assertAccountWallet({
      account,
      address: sourceAddress,
      network,
      walletId: sourceWalletId,
    });

    if (!c.env.DB) {
      return c.json({
        success: true,
        data: { orders: [] },
      });
    }

    const requestedLimit = Number(c.req.query("limit") || 50);
    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 50)
    );
    const rows = await c.env.DB.prepare(
      `SELECT *
       FROM ramp_orders
       WHERE account_email = ? AND wallet_id = ? AND network = ?
       ORDER BY created_at DESC, updated_at DESC
       LIMIT ?`
    )
      .bind(account.email, sourceWalletId, network, limit)
      .all<StoredRampOrderRow>();
    const orders = (rows.results || [])
      .map((row) => parseStoredOrder(row))
      .filter((order): order is RampOrderData => Boolean(order));

    return c.json({
      success: true,
      data: { orders },
    });
  });

  app.post("/api/ramp/orders/deposit", async (c) => {
    const body = await readJsonBody(c);
    const order = await buildOrderPayload(c, body, "buy");
    const response = await paymentRequest(
      c.env,
      "/api/orders/deposit",
      {
        body: JSON.stringify({
          amount: order.amount,
          asset_code: order.asset_code,
          callback: order.callback,
          chain_id: order.chain_id,
          recipient: order.context.sourceAddress,
          token_address: order.token_address,
          user_id: order.user_id,
        }),
        method: "POST",
      },
      true
    );
    const responseData = getPaymentResponseData(response);

    if (!responseData) {
      return c.json(response);
    }

    const snapshot = mergeRampOrderData(responseData, {
      ...responseData,
      amount: responseData.amount || order.amount,
      asset_code: responseData.asset_code || order.asset_code,
      chain_id: responseData.chain_id ?? order.chain_id,
      order_type: "buy",
    });

    await saveRampOrderSnapshot(c.env, snapshot, {
      accountEmail: order.context.account.email,
      accountKey: order.context.account.id || order.context.account.email,
      assetCode: order.asset_code,
      direction: "buy",
      network: order.context.network,
      walletAddress: order.context.sourceAddress,
      walletId: order.context.sourceWalletId,
    });

    return c.json(replacePaymentResponseData(response, snapshot));
  });

  app.post("/api/ramp/orders/withdrawal", async (c) => {
    const body = await readJsonBody(c);
    const order = await buildOrderPayload(c, body, "sell");
    const paymentInfo = (body.paymentInfo || {}) as Record<string, unknown>;
    const bankId = String(paymentInfo.bankId || "").trim();
    const fullName = String(paymentInfo.fullName || "")
      .trim()
      .toUpperCase();
    const accountNumber = String(paymentInfo.accountNumber || "").trim();
    const accountType = Number(paymentInfo.accountType);

    if (!/^\d{6}$/.test(bankId)) {
      throw makeError("Bank BIN must contain 6 digits", 400);
    }

    if (!/^[A-Z0-9 ]{2,100}$/.test(fullName)) {
      throw makeError(
        "Account holder name must use unaccented letters and numbers",
        400
      );
    }

    if (!/^\d{4,30}$/.test(accountNumber)) {
      throw makeError("Bank account number is invalid", 400);
    }

    if (![0, 1, 2].includes(accountType)) {
      throw makeError("Bank account type is invalid", 400);
    }

    const normalizedPaymentInfo = {
      account_number: accountNumber,
      account_type: accountType,
      bank_id: bankId,
      full_name: fullName,
    };
    const response = await paymentRequest(
      c.env,
      "/api/orders/withdrawal",
      {
        body: JSON.stringify({
          amount: order.amount,
          asset_code: order.asset_code,
          callback: order.callback,
          chain_id: order.chain_id,
          payment_info: normalizedPaymentInfo,
          token_address: order.token_address,
          user_id: order.user_id,
        }),
        method: "POST",
        signal: AbortSignal.timeout(PAYMENT_ORDER_TIMEOUT_MS),
      },
      true
    ).catch((error: unknown) => {
      if (isPaymentTimeoutError(error)) {
        throw makeError(
          "Payment provider timed out while creating the sell order. Please try again.",
          504
        );
      }

      throw error;
    });
    const responseData = getPaymentResponseData(response);

    if (!responseData) {
      return c.json(response);
    }

    const snapshot = mergeRampOrderData(responseData, {
      ...responseData,
      amount: responseData.amount || order.amount,
      asset_code: responseData.asset_code || order.asset_code,
      chain_id: responseData.chain_id ?? order.chain_id,
      order_type: "sell",
      payment_info: mergePopulatedRecord(
        normalizedPaymentInfo,
        responseData.payment_info as Record<string, unknown> | undefined
      ),
    });

    await saveRampOrderSnapshot(c.env, snapshot, {
      accountEmail: order.context.account.email,
      accountKey: order.context.account.id || order.context.account.email,
      assetCode: order.asset_code,
      direction: "sell",
      network: order.context.network,
      walletAddress: order.context.sourceAddress,
      walletId: order.context.sourceWalletId,
    });

    return c.json(replacePaymentResponseData(response, snapshot));
  });

  app.get("/api/ramp/orders/:id", async (c) => {
    const reference = String(c.req.param("id") || "").trim();
    const id = encodeURIComponent(reference);

    if (!id) {
      throw makeError("Order id is required", 400);
    }

    const stored = await findStoredRampOrder(c.env, reference);

    const response = await paymentRequest(
      c.env,
      `/api/orders/${id}`,
      { method: "GET" },
      true
    );
    const responseData = getPaymentResponseData(response);

    if (!responseData) {
      return c.json(response);
    }

    const merged = stored
      ? await mergeAndSaveStoredRampOrder(c.env, reference, responseData)
      : await saveUntrackedRampOrderFromQuery(c, responseData);

    return c.json(replacePaymentResponseData(response, merged));
  });

  app.get("/api/ramp/orders/:id/success", async (c) => {
    const id = encodeURIComponent(String(c.req.param("id") || "").trim());

    if (!id) {
      throw makeError("Order id is required", 400);
    }

    return paymentRedirect(c.env, `/api/orders/${id}/success`);
  });

  app.get("/api/ramp/orders/:id/error", async (c) => {
    const id = encodeURIComponent(String(c.req.param("id") || "").trim());

    if (!id) {
      throw makeError("Order id is required", 400);
    }

    return paymentRedirect(c.env, `/api/orders/${id}/error`);
  });

  app.get("/api/ramp/orders/:id/cancel", async (c) => {
    const id = encodeURIComponent(String(c.req.param("id") || "").trim());

    if (!id) {
      throw makeError("Order id is required", 400);
    }

    return paymentRedirect(c.env, `/api/orders/${id}/cancel`);
  });

  app.post("/api/ramp/orders/:id/bypass-payment", async (c) => {
    const reference = String(c.req.param("id") || "").trim();
    const body = await readJsonBody(c);

    if (!reference) {
      throw makeError("Order id is required", 400);
    }

    const context = await getOrderContext(c, body, false);

    if (context.network !== "testnet") {
      throw makeError("Payment bypass is available on Testnet only", 403);
    }

    const row = await findStoredRampOrder(c.env, reference);

    if (
      !row ||
      row.account_email !== context.account.email ||
      row.wallet_id !== context.sourceWalletId ||
      row.wallet_address !== context.sourceAddress ||
      row.network !== context.network
    ) {
      throw makeError("Payment order not found for this wallet", 404);
    }

    if (row.direction !== "buy") {
      throw makeError("Payment bypass supports buy orders only", 400);
    }

    const adminKey = String(c.env.ADMIN_BOOTSTRAP_PASSWORD || "").trim();

    if (!adminKey) {
      throw makeError("Payment bypass is not configured", 503);
    }

    const storedOrder = parseStoredOrder(row);

    const providerOrderId = Number(storedOrder?.id || row.provider_order_id);

    if (!Number.isInteger(providerOrderId) || providerOrderId <= 0) {
      throw makeError("Provider order id is invalid", 400);
    }

    await paymentRequest(c.env, "/bypass-payment", {
      body: JSON.stringify({
        admin_key: adminKey,
        order_id: providerOrderId,
      }),
      method: "POST",
    });

    const statusResponse = await paymentRequest(
      c.env,
      `/api/orders/${encodeURIComponent(row.payment_code)}`,
      { method: "GET" },
      true
    );
    const statusData = getPaymentResponseData(statusResponse);
    const merged = statusData
      ? await mergeAndSaveStoredRampOrder(c.env, row.payment_code, statusData)
      : storedOrder;

    return c.json({
      success: true,
      data: merged,
    });
  });

  app.post("/api/ramp/orders/:id/bypass-sell-payment", async (c) => {
    const reference = String(c.req.param("id") || "").trim();
    const body = await readJsonBody(c);

    if (!reference) {
      throw makeError("Order id is required", 400);
    }

    const context = await getOrderContext(c, body, false);

    if (context.network !== "testnet") {
      throw makeError("Sell payment bypass is available on Testnet only", 403);
    }

    const row = await findStoredRampOrder(c.env, reference);

    if (
      !row ||
      row.account_email !== context.account.email ||
      row.wallet_id !== context.sourceWalletId ||
      row.wallet_address !== context.sourceAddress ||
      row.network !== context.network
    ) {
      throw makeError("Payment order not found for this wallet", 404);
    }

    if (row.direction !== "sell") {
      throw makeError("Sell payment bypass supports sell orders only", 400);
    }

    const adminKey = String(c.env.ADMIN_BOOTSTRAP_PASSWORD || "").trim();

    if (!adminKey) {
      throw makeError("Sell payment bypass is not configured", 503);
    }

    const storedOrder = parseStoredOrder(row);

    const providerOrderId = Number(storedOrder?.id || row.provider_order_id);

    if (!Number.isInteger(providerOrderId) || providerOrderId <= 0) {
      throw makeError("Provider order id is invalid", 400);
    }

    await paymentRequest(c.env, "/bypass-sell-payment", {
      body: JSON.stringify({
        admin_key: adminKey,
        order_id: providerOrderId,
      }),
      method: "POST",
    });

    const statusResponse = await paymentRequest(
      c.env,
      `/api/orders/${encodeURIComponent(row.payment_code)}`,
      { method: "GET" },
      true
    );
    const statusData = getPaymentResponseData(statusResponse);
    const merged = statusData
      ? await mergeAndSaveStoredRampOrder(c.env, row.payment_code, statusData)
      : storedOrder;

    return c.json({
      success: true,
      data: merged,
    });
  });

  app.post("/api/ramp/orders/:id/cancel", async (c) => {
    const reference = String(c.req.param("id") || "").trim();
    const id = encodeURIComponent(reference);
    const body = await readJsonBody(c);

    if (!id) {
      throw makeError("Order id is required", 400);
    }

    const response = await paymentRequest(
      c.env,
      `/api/orders/${id}/cancel`,
      {
        body: JSON.stringify({
          reason: String(body.reason || "User requested cancellation").trim(),
        }),
        method: "POST",
      },
      true
    );
    const responseData = getPaymentResponseData(response) || {};
    const merged = await mergeAndSaveStoredRampOrder(
      c.env,
      decodeURIComponent(id),
      {
        ...responseData,
        state: responseData.state ?? responseData.order_state ?? 5,
      }
    );

    return c.json(replacePaymentResponseData(response, merged));
  });

  app.post("/api/ramp/callback", async (c) => {
    const body = await readJsonBody(c);
    const payload = (body.payload || {}) as Record<string, unknown>;

    if (
      body.topic !== "order.state.change" ||
      !String(body.id || payload.order_id || "").trim() ||
      !Number.isFinite(Number(payload.new_order_state))
    ) {
      throw makeError("Invalid payment callback payload", 400);
    }

    const orderReference = String(body.id || payload.order_id).trim();
    const callbackUpdate: RampOrderData = {
      state: Number(payload.new_order_state),
    };
    const nextProcessingState = Number(payload.new_processing_state);

    if (Number.isFinite(nextProcessingState)) {
      callbackUpdate.processing_state = nextProcessingState;
    }

    await mergeAndSaveStoredRampOrder(c.env, orderReference, callbackUpdate);

    return c.json({ success: true });
  });
}
