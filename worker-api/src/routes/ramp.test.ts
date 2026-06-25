import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../core", () => ({
  assertAccountWallet: vi.fn(),
  assertAmount: (value: unknown) => {
    const amount = String(value || "").trim();

    if (!/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
      const error = new Error("Invalid amount") as Error & { status: number };
      error.status = 400;
      throw error;
    }

    return amount;
  },
  assertStellarAddress: vi.fn(),
  assertSufficientBalance: vi.fn(),
  ensureTrustline: vi.fn(),
  getSupportedAsset: vi.fn(
    async (
      _env: unknown,
      {
        assetCode,
        network,
      }: { assetCode: "USDC" | "XLM"; network: "mainnet" | "testnet" }
    ) => ({
      assetCode,
      assetIssuer:
        assetCode === "USDC"
          ? network === "testnet"
            ? "GTESTUSDC"
            : "GMAINUSDC"
          : null,
      isNative: assetCode === "XLM",
      network,
    })
  ),
  loadAccount: vi.fn(async () => ({ balances: [] })),
  makeError: (message: string, status = 500) => {
    const error = new Error(message) as Error & { status: number };
    error.status = status;
    return error;
  },
  normalizeNetwork: (value: unknown) =>
    value === "mainnet" ? "mainnet" : "testnet",
  readJsonBody: (context: { req: { json: () => Promise<unknown> } }) =>
    context.req.json(),
  requireAccountContext: vi.fn(async () => ({
    email: "user@example.com",
    id: "account-1",
  })),
  requireVerifiedKyc: vi.fn(async () => ({
    accountEmail: "user@example.com",
    providerUserId: "provider-user-1",
    status: "verified",
  })),
  shouldRequireMainnetAuth: (network: string) => network === "mainnet",
}));

import { requireAccountContext, requireVerifiedKyc } from "../core";
import { registerRampRoutes } from "./ramp";

type TestEnv = {
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  DB?: ReturnType<typeof createRampDb>;
  PAYMENT_API_BASE_URL: string;
  PAYMENT_CALLBACK_URL: string;
  PAYMENT_PARTNER_APP_KEY: string;
};

const env: TestEnv = {
  ADMIN_BOOTSTRAP_PASSWORD: "test-admin-password",
  PAYMENT_API_BASE_URL: "https://payments.example",
  PAYMENT_CALLBACK_URL: "https://worker.example/api/ramp/callback",
  PAYMENT_PARTNER_APP_KEY: "test-partner-key",
};

function createRampDb() {
  const rows = new Map<string, Record<string, unknown>>();
  const paymentMethods = new Map<string, Record<string, unknown>>();

  return {
    prepare(sql: string) {
      let values: unknown[] = [];

      return {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return this;
        },
        async all() {
          if (sql.includes("FROM account_payment_methods")) {
            const [accountEmail] = values;
            const results = [...paymentMethods.values()]
              .filter((row) => row.account_email === accountEmail)
              .sort((a, b) => {
                const defaultDelta =
                  Number(b.is_default || 0) - Number(a.is_default || 0);

                if (defaultDelta) {
                  return defaultDelta;
                }

                return String(b.updated_at || "").localeCompare(
                  String(a.updated_at || "")
                );
              });

            return { results };
          }

          if (sql.includes("FROM ramp_orders")) {
            const [accountEmail, walletId, network, limit] = values;
            const results = [...rows.values()]
              .filter(
                (row) =>
                  row.account_email === accountEmail &&
                  row.wallet_id === walletId &&
                  row.network === network
              )
              .slice(0, Number(limit));

            return { results };
          }

          return { results: [] };
        },
        async first() {
          if (sql.includes("FROM account_payment_methods")) {
            if (sql.includes("bank_id") && sql.includes("account_number")) {
              const [accountEmail, bankId, accountNumber] = values;

              return (
                [...paymentMethods.values()].find(
                  (row) =>
                    row.account_email === accountEmail &&
                    row.bank_id === bankId &&
                    row.account_number === accountNumber
                ) || null
              );
            }

            const [accountEmail, id] = values;

            return (
              [...paymentMethods.values()].find(
                (row) => row.account_email === accountEmail && row.id === id
              ) || null
            );
          }

          if (sql.includes("FROM ramp_orders")) {
            const [paymentCode, providerOrderId] = values;

            return (
              [...rows.values()].find(
                (row) =>
                  row.payment_code === paymentCode ||
                  row.provider_order_id === providerOrderId
              ) || null
            );
          }

          return null;
        },
        async run() {
          if (sql.includes("INSERT INTO account_payment_methods")) {
            const [
              id,
              accountEmail,
              bankId,
              bankName,
              accountNumber,
              fullName,
              accountType,
              isDefault,
              createdAt,
              updatedAt,
            ] = values;
            const existing = [...paymentMethods.values()].find(
              (row) =>
                row.account_email === accountEmail &&
                row.bank_id === bankId &&
                row.account_number === accountNumber
            );
            const rowId = String(existing?.id || id);

            paymentMethods.set(rowId, {
              account_email: accountEmail,
              account_number: accountNumber,
              account_type: accountType,
              bank_id: bankId,
              bank_name: bankName,
              created_at: existing?.created_at || createdAt,
              full_name: fullName,
              id: rowId,
              is_default: isDefault,
              updated_at: updatedAt,
            });
          } else if (
            sql.includes("UPDATE account_payment_methods") &&
            sql.includes("SET is_default = 0")
          ) {
            const [updatedAt, accountEmail] = values;

            for (const row of paymentMethods.values()) {
              if (row.account_email === accountEmail) {
                row.is_default = 0;
                row.updated_at = updatedAt;
              }
            }
          } else if (
            sql.includes("UPDATE account_payment_methods") &&
            sql.includes("SET is_default = 1")
          ) {
            const [updatedAt, accountEmail, id] = values;
            const row = paymentMethods.get(String(id));

            if (row && row.account_email === accountEmail) {
              row.is_default = 1;
              row.updated_at = updatedAt;
            }
          } else if (
            sql.includes("UPDATE account_payment_methods") &&
            sql.includes("SET bank_id =")
          ) {
            const [
              bankId,
              bankName,
              accountNumber,
              fullName,
              accountType,
              isDefault,
              updatedAt,
              accountEmail,
              id,
            ] = values;
            const row = paymentMethods.get(String(id));

            if (row && row.account_email === accountEmail) {
              row.bank_id = bankId;
              row.bank_name = bankName;
              row.account_number = accountNumber;
              row.full_name = fullName;
              row.account_type = accountType;
              row.is_default = isDefault;
              row.updated_at = updatedAt;
            }
          } else if (sql.includes("DELETE FROM account_payment_methods")) {
            const [accountEmail, id] = values;
            const row = paymentMethods.get(String(id));

            if (row && row.account_email === accountEmail) {
              paymentMethods.delete(String(id));
            }
          }

          if (sql.includes("INSERT INTO ramp_orders")) {
            const [
              paymentCode,
              providerOrderId,
              accountKey,
              accountEmail,
              walletId,
              walletAddress,
              network,
              direction,
              assetCode,
              state,
              processingState,
              data,
              createdAt,
              updatedAt,
            ] = values;
            const existing = rows.get(String(paymentCode));

            rows.set(String(paymentCode), {
              account_email: accountEmail,
              account_key: accountKey,
              asset_code: assetCode,
              created_at: existing?.created_at || createdAt,
              data,
              direction,
              network,
              payment_code: paymentCode,
              processing_state: processingState,
              provider_order_id: providerOrderId,
              state,
              updated_at: updatedAt,
              wallet_address: walletAddress,
              wallet_id: walletId,
            });
          }

          return { success: true };
        },
      };
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function createApp() {
  const app = new Hono<{ Bindings: TestEnv }>();

  app.onError((error, context) =>
    context.json(
      { error: error.message },
      ((error as Error & { status?: number }).status || 500) as 400
    )
  );
  registerRampRoutes(app as never);

  return app;
}

function feeResponse() {
  return {
    data: {
      buy: {
        fee_rate: 0.008,
        max_order_amount: 100,
        min_fee: 5000,
        min_order_amount: 1,
        source: "binance",
        spread: 50,
      },
      sell: {
        fee_rate: 0.008,
        max_order_amount: 100,
        min_fee: 5000,
        min_order_amount: 1,
        source: "binance",
        spread: 50,
      },
      token: "XLM",
    },
    success: true,
  };
}

describe("payment ramp routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(requireAccountContext).mockResolvedValue({
      email: "user@example.com",
      id: "account-1",
    } as never);
    vi.mocked(requireVerifiedKyc).mockResolvedValue({
      accountEmail: "user@example.com",
      providerUserId: "provider-user-1",
      status: "verified",
    });
  });

  it("lists an empty saved payment method collection", async () => {
    const response = await createApp().request(
      "/api/ramp/payment-methods?email=user@example.com",
      undefined,
      { ...env, DB: createRampDb() }
    );
    const body = (await response.json()) as {
      data: { methods: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.data.methods).toEqual([]);
  });

  it("creates and lists a normalized saved payment method", async () => {
    const testEnv = { ...env, DB: createRampDb() };
    const app = createApp();
    const createResponse = await app.request(
      "/api/ramp/payment-methods",
      {
        body: JSON.stringify({
          accountNumber: "0123456789",
          accountType: 0,
          bankId: "970422",
          bankName: "MB Bank",
          email: "user@example.com",
          fullName: "nguyen van a",
          isDefault: true,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const createBody = (await createResponse.json()) as {
      data: { method: { fullName: string; isDefault: boolean } };
    };

    expect(createResponse.status).toBe(200);
    expect(createBody.data.method).toMatchObject({
      accountNumber: "0123456789",
      bankId: "970422",
      bankName: "MB Bank",
      fullName: "NGUYEN VAN A",
      isDefault: true,
    });

    const listResponse = await app.request(
      "/api/ramp/payment-methods?email=user@example.com",
      undefined,
      testEnv
    );
    const listBody = (await listResponse.json()) as {
      data: { methods: Array<{ id: string }> };
    };

    expect(listBody.data.methods).toHaveLength(1);
  });

  it("upserts duplicate bank account methods instead of creating duplicates", async () => {
    const testEnv = { ...env, DB: createRampDb() };
    const app = createApp();
    const payload = {
      accountNumber: "0123456789",
      accountType: 0,
      bankId: "970422",
      bankName: "MB Bank",
      email: "user@example.com",
      fullName: "NGUYEN VAN A",
    };

    const first = await app.request(
      "/api/ramp/payment-methods",
      {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const firstBody = (await first.json()) as {
      data: { method: { id: string } };
    };
    const second = await app.request(
      "/api/ramp/payment-methods",
      {
        body: JSON.stringify({
          ...payload,
          fullName: "NGUYEN VAN B",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const secondBody = (await second.json()) as {
      data: { method: { fullName: string; id: string } };
    };
    const listResponse = await app.request(
      "/api/ramp/payment-methods?email=user@example.com",
      undefined,
      testEnv
    );
    const listBody = (await listResponse.json()) as {
      data: { methods: Array<unknown> };
    };

    expect(secondBody.data.method.id).toBe(firstBody.data.method.id);
    expect(secondBody.data.method.fullName).toBe("NGUYEN VAN B");
    expect(listBody.data.methods).toHaveLength(1);
  });

  it("updates, defaults, deletes, and isolates saved payment methods by account", async () => {
    const testEnv = { ...env, DB: createRampDb() };
    const app = createApp();
    const create = async (accountNumber: string, bankName: string) => {
      const response = await app.request(
        "/api/ramp/payment-methods",
        {
          body: JSON.stringify({
            accountNumber,
            accountType: 0,
            bankId: "970422",
            bankName,
            email: "user@example.com",
            fullName: "NGUYEN VAN A",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
        testEnv
      );
      const body = (await response.json()) as {
        data: { method: { id: string } };
      };

      return body.data.method.id;
    };
    const firstId = await create("0123456789", "MB Bank");
    const secondId = await create("9876543210", "MB Bank");

    const defaultResponse = await app.request(
      `/api/ramp/payment-methods/${secondId}/default`,
      {
        body: JSON.stringify({ email: "user@example.com" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );

    expect(defaultResponse.status).toBe(200);

    const updateResponse = await app.request(
      `/api/ramp/payment-methods/${firstId}`,
      {
        body: JSON.stringify({
          accountNumber: "0123456789",
          accountType: 1,
          bankId: "970422",
          bankName: "MB Business",
          email: "user@example.com",
          fullName: "CONG TY A",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
      testEnv
    );
    const updateBody = (await updateResponse.json()) as {
      data: { method: { accountType: number; bankName: string } };
    };

    expect(updateBody.data.method).toMatchObject({
      accountType: 1,
      bankName: "MB Business",
    });

    vi.mocked(requireAccountContext).mockResolvedValueOnce({
      email: "other@example.com",
      id: "account-2",
    } as never);

    const unauthorizedDelete = await app.request(
      `/api/ramp/payment-methods/${firstId}?email=other@example.com`,
      { method: "DELETE" },
      testEnv
    );

    expect(unauthorizedDelete.status).toBe(404);

    const deleteResponse = await app.request(
      `/api/ramp/payment-methods/${firstId}?email=user@example.com`,
      { method: "DELETE" },
      testEnv
    );
    const listResponse = await app.request(
      "/api/ramp/payment-methods?email=user@example.com",
      undefined,
      testEnv
    );
    const listBody = (await listResponse.json()) as {
      data: { methods: Array<{ id: string; isDefault: boolean }> };
    };

    expect(deleteResponse.status).toBe(200);
    expect(listBody.data.methods).toEqual([
      expect.objectContaining({ id: secondId, isDefault: true }),
    ]);
  });

  it("quotes buy orders with rate and minimum fee", async () => {
    let ratePartnerKey: string | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        ratePartnerKey = new Headers(init?.headers).get("partner-app-key");

        return jsonResponse({
          buy: 5000,
          created_at: "2026-06-09T00:00:00.000Z",
          fee_rate_buy: 0.008,
          fee_rate_sell: 0.008,
          min_fee_vnd: 5000,
          sell: 4800,
        });
      })
    );

    const response = await createApp().request(
      "/api/ramp/quote",
      {
        body: JSON.stringify({
          amount: "10",
          assetCode: "XLM",
          direction: "buy",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );
    const body = (await response.json()) as {
      data: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(ratePartnerKey).toBe(env.PAYMENT_PARTNER_APP_KEY);
    expect(body.data).toMatchObject({
      fee_vnd: 5000,
      gross_vnd: 50000,
      total_vnd: 55000,
    });
  });

  it("creates a deposit order with Worker-owned fields", async () => {
    let upstreamBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        upstreamBody = JSON.parse(String(init?.body));
        return jsonResponse({
          data: { code: "BUY123", id: "1", state: 1 },
          success: true,
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await createApp().request(
      "/api/ramp/orders/deposit",
      {
        body: JSON.stringify({
          amount: "10",
          assetCode: "XLM",
          network: "testnet",
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamBody).toEqual({
      amount: "10",
      asset_code: "XLM",
      callback: env.PAYMENT_CALLBACK_URL,
      chain_id: 1,
      recipient: "GUSER",
      token_address: "",
      user_id: "provider-user-1",
    });
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toEqual(
      expect.objectContaining({})
    );
  });

  it("requires KYC before creating a deposit order", async () => {
    vi.mocked(requireVerifiedKyc).mockRejectedValueOnce(
      Object.assign(new Error("KYC_REQUIRED"), { status: 403 })
    );

    const response = await createApp().request(
      "/api/ramp/orders/deposit",
      {
        body: JSON.stringify({
          amount: "10",
          assetCode: "XLM",
          network: "testnet",
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("KYC_REQUIRED");
  });

  it("creates a withdrawal order with normalized bank data", async () => {
    let upstreamBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/config/fee/USDC")) {
          return jsonResponse(feeResponse());
        }

        upstreamBody = JSON.parse(String(init?.body));
        return jsonResponse({
          data: { code: "SELL123", id: "2", state: 1 },
          success: true,
        });
      })
    );

    const response = await createApp().request(
      "/api/ramp/orders/withdrawal",
      {
        body: JSON.stringify({
          amount: "5",
          assetCode: "USDC",
          network: "mainnet",
          paymentInfo: {
            accountNumber: "0123456789",
            accountType: 0,
            bankId: "970422",
            fullName: "nguyen van a",
          },
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamBody).toMatchObject({
      asset_code: "USDC",
      chain_id: 0,
      payment_info: {
        account_number: "0123456789",
        account_type: 0,
        bank_id: "970422",
        full_name: "NGUYEN VAN A",
      },
      token_address: "GMAINUSDC",
      user_id: "provider-user-1",
    });
  });

  it("proxies order status", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: { code: "ORDER123", processing_state: 13, state: 2 },
        success: true,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await createApp().request(
      "/api/ramp/orders/ORDER123",
      undefined,
      env
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://payments.example/api/orders/ORDER123",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("accepts the provider callback topic and processing state aliases", async () => {
    const testEnv = {
      ...env,
      DB: createRampDb(),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        return jsonResponse({
          data: {
            code: "CALLBACK123",
            id: "590",
            processing_state: 10,
            state: 1,
          },
          success: true,
        });
      })
    );

    const createResponse = await createApp().request(
      "/api/ramp/orders/deposit",
      {
        body: JSON.stringify({
          amount: "10",
          assetCode: "XLM",
          network: "testnet",
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );

    expect(createResponse.status).toBe(200);

    const callbackResponse = await createApp().request(
      "/api/ramp/callback",
      {
        body: JSON.stringify({
          id: "590",
          payload: {
            new_order_processing_state: 12,
            new_order_state: 5,
            old_order_processing_state: 0,
            old_order_state: 0,
            order_id: "590",
          },
          topic: "order.state_changed",
          ts: "2026-06-11T00:00:00.000Z",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );

    expect(callbackResponse.status).toBe(200);

    const historyResponse = await createApp().request(
      "/api/ramp/orders?email=user@example.com&network=testnet&sourceAddress=GUSER&sourceWalletId=wallet-1",
      undefined,
      testEnv
    );
    const historyBody = (await historyResponse.json()) as {
      data: { orders: Array<{ processing_state: number; state: number }> };
    };

    expect(historyBody.data.orders[0]).toMatchObject({
      processing_state: 12,
      state: 5,
    });
  });

  it("persists order history and preserves populated bank fields", async () => {
    const database = createRampDb();
    let statusRequest = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        if (url.endsWith("/api/orders/BUY123")) {
          statusRequest = true;
          return jsonResponse({
            data: {
              body: {
                bankInfo: {
                  bankAccountName: "",
                  bankAccountNumber: "0123456789",
                  bankName: "",
                  transferContent: "BUY123",
                },
              },
              code: "BUY123",
              id: "provider-1",
              processing_state: 10,
              state: 1,
            },
            success: true,
          });
        }

        return jsonResponse({
          data: {
            body: {
              bankInfo: {
                bankAccountName: "SEERBOT",
                bankAccountNumber: "0123456789",
                bankName: "MB Bank",
                transferContent: "BUY123",
                vaAmount: 60000,
              },
            },
            code: "BUY123",
            id: "provider-1",
            processing_state: 10,
            state: 1,
          },
          success: true,
        });
      })
    );
    const testEnv = { ...env, DB: database };
    const app = createApp();

    const createResponse = await app.request(
      "/api/ramp/orders/deposit",
      {
        body: JSON.stringify({
          amount: "10",
          assetCode: "XLM",
          network: "testnet",
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );

    expect(createResponse.status).toBe(200);

    const statusResponse = await app.request(
      "/api/ramp/orders/BUY123",
      undefined,
      testEnv
    );
    const statusBody = (await statusResponse.json()) as {
      data: {
        body: {
          bankInfo: {
            bankAccountName: string;
            bankName: string;
          };
        };
      };
    };

    expect(statusRequest).toBe(true);
    expect(statusBody.data.body.bankInfo).toMatchObject({
      bankAccountName: "SEERBOT",
      bankName: "MB Bank",
    });

    const historyResponse = await app.request(
      "/api/ramp/orders?email=user@example.com&network=testnet&sourceAddress=GUSER&sourceWalletId=wallet-1",
      undefined,
      testEnv
    );
    const historyBody = (await historyResponse.json()) as {
      data: { orders: Array<{ code: string }> };
    };

    expect(historyResponse.status).toBe(200);
    expect(historyBody.data.orders).toHaveLength(1);
    expect(historyBody.data.orders[0].code).toBe("BUY123");
  });

  it("bypasses Testnet buy payment without exposing the admin key", async () => {
    const database = createRampDb();
    const upstreamBodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        if (url.endsWith("/bypass-payment")) {
          upstreamBodies.push(JSON.parse(String(init?.body)));
          return jsonResponse({ success: true });
        }

        if (url.endsWith("/api/orders/BUY123")) {
          return jsonResponse({
            data: {
              code: "BUY123",
              id: "123",
              processing_state: 11,
              state: 2,
            },
            success: true,
          });
        }

        return jsonResponse({
          data: {
            code: "BUY123",
            id: "123",
            processing_state: 10,
            state: 1,
          },
          success: true,
        });
      })
    );
    const testEnv = { ...env, DB: database };
    const app = createApp();

    await app.request(
      "/api/ramp/orders/deposit",
      {
        body: JSON.stringify({
          amount: "1",
          assetCode: "XLM",
          network: "testnet",
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );

    const response = await app.request(
      "/api/ramp/orders/BUY123/bypass-payment",
      {
        body: JSON.stringify({
          email: "user@example.com",
          network: "testnet",
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const body = (await response.json()) as {
      data: { processing_state: number; state: number };
    };

    expect(response.status).toBe(200);
    expect(upstreamBodies).toEqual([
      {
        admin_key: "test-admin-password",
        order_id: 123,
      },
    ]);
    expect(body.data).toMatchObject({
      processing_state: 11,
      state: 2,
    });
    expect(JSON.stringify(body)).not.toContain("test-admin-password");
  });

  it("bypasses Testnet sell payment without exposing the admin key", async () => {
    const database = createRampDb();
    const upstreamBodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        if (url.endsWith("/bypass-sell-payment")) {
          upstreamBodies.push(JSON.parse(String(init?.body)));
          return jsonResponse({ success: true });
        }

        if (url.endsWith("/api/orders/SELL123")) {
          return jsonResponse({
            data: {
              code: "SELL123",
              id: "456",
              order_type: "sell",
              processing_state: 14,
              state: 3,
            },
            success: true,
          });
        }

        return jsonResponse({
          data: {
            code: "SELL123",
            id: "456",
            order_type: "sell",
            processing_state: 13,
            state: 2,
          },
          success: true,
        });
      })
    );
    const testEnv = { ...env, DB: database };
    const app = createApp();

    await app.request(
      "/api/ramp/orders/withdrawal",
      {
        body: JSON.stringify({
          amount: "1",
          assetCode: "XLM",
          network: "testnet",
          paymentInfo: {
            accountNumber: "0123456789",
            accountType: 0,
            bankId: "970422",
            fullName: "NGUYEN VAN A",
          },
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );

    const response = await app.request(
      "/api/ramp/orders/SELL123/bypass-sell-payment",
      {
        body: JSON.stringify({
          email: "user@example.com",
          network: "testnet",
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const body = (await response.json()) as {
      data: { processing_state: number; state: number };
    };

    expect(response.status).toBe(200);
    expect(upstreamBodies).toEqual([
      {
        admin_key: "test-admin-password",
        order_id: 456,
      },
    ]);
    expect(body.data).toMatchObject({
      processing_state: 14,
      state: 3,
    });
    expect(JSON.stringify(body)).not.toContain("test-admin-password");
  });

  it("forwards Testnet sell liquidity errors without creating a fake order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        if (url.endsWith("/api/orders/withdrawal")) {
          expect(init?.signal).toBeInstanceOf(AbortSignal);
          return jsonResponse(
            {
              success: false,
              error: {
                message: "Insufficient available liquidity for this order",
              },
            },
            400
          );
        }

        throw new Error(`Unexpected upstream request: ${url}`);
      })
    );

    const response = await createApp().request(
      "/api/ramp/orders/withdrawal",
      {
        body: JSON.stringify({
          amount: "10",
          assetCode: "XLM",
          network: "testnet",
          paymentInfo: {
            accountNumber: "0123456789",
            accountType: 0,
            bankId: "970422",
            fullName: "NGUYEN VAN A",
          },
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Insufficient available liquidity for this order");
  });

  it("returns a clear error when creating a sell order times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/config/fee/XLM")) {
          return jsonResponse(feeResponse());
        }

        if (url.endsWith("/api/orders/withdrawal")) {
          expect(init?.signal).toBeInstanceOf(AbortSignal);
          throw new DOMException(
            "The operation was aborted due to timeout",
            "TimeoutError"
          );
        }

        throw new Error(`Unexpected upstream request: ${url}`);
      })
    );

    const response = await createApp().request(
      "/api/ramp/orders/withdrawal",
      {
        body: JSON.stringify({
          amount: "10",
          assetCode: "XLM",
          network: "testnet",
          paymentInfo: {
            accountNumber: "0123456789",
            accountType: 0,
            bankId: "970422",
            fullName: "NGUYEN VAN A",
          },
          sourceAddress: "GUSER",
          sourceWalletId: "wallet-1",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(504);
    expect(body.error).toBe(
      "Payment provider timed out while creating the sell order. Please try again."
    );
  });

  it("proxies order cancellation", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: { order_state: 5, payment_code: "ORDER123" },
        success: true,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await createApp().request(
      "/api/ramp/orders/ORDER123/cancel",
      {
        body: JSON.stringify({ reason: "No longer needed" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://payments.example/api/orders/ORDER123/cancel",
      expect.objectContaining({
        body: JSON.stringify({ reason: "No longer needed" }),
        method: "POST",
      })
    );
  });

  it("proxies order redirect pages", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          headers: {
            Location: "https://payments.example/order/ORDER123?payment=success",
          },
          status: 302,
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await createApp().request(
      "/api/ramp/orders/ORDER123/success",
      undefined,
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://payments.example/order/ORDER123?payment=success"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://payments.example/api/orders/ORDER123/success",
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
      })
    );
  });

  it("preserves upstream order errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "CANCEL_NOT_ALLOWED",
              message: "Order cannot be cancelled",
            },
            success: false,
          },
          409
        )
      )
    );

    const response = await createApp().request(
      "/api/ramp/orders/ORDER123/cancel",
      {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Order cannot be cancelled",
    });
  });

  it("preserves upstream string error codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: "ORDER_NOT_ELIGIBLE",
            success: false,
          },
          400
        )
      )
    );

    const response = await createApp().request(
      "/api/ramp/orders/ORDER123/cancel",
      {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      env
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "ORDER_NOT_ELIGIBLE",
    });
  });
});
