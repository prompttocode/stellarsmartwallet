import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../core", () => {
  const makeError = (message: string, status = 500) => {
    const error = new Error(message) as Error & { status: number };
    error.status = status;
    return error;
  };

  return {
    assertAccountWallet: vi.fn(),
    assertSecretKey: vi.fn(),
    assertStellarAddress: vi.fn((address: unknown, field = "Wallet address") => {
      if (!String(address || "").startsWith("G")) {
        throw makeError(`${field} is not a valid Stellar address`, 400);
      }
    }),
    buildAccountSession: vi.fn(),
    buildTrustlineTransaction: vi.fn(),
    completeStellarWalletSecretExport: vi.fn(),
    createPrivyUser: vi.fn(),
    createSignableStellarWallet: vi.fn(),
    decodeWalletExportChallenge: vi.fn(),
    encryptWalletSecret: vi.fn(),
    findPrivyUserByEmail: vi.fn(),
    friendbotFund: vi.fn(),
    getAccountBalances: vi.fn(),
    getAccountByEmail: vi.fn(),
    getAccountHistory: vi.fn(),
    getEmailFromPrivyUser: vi.fn(),
    getIssuedAsset: vi.fn(),
    getOrCreateSessionAccountByEmail: vi.fn(),
    getPrivyClient: vi.fn(),
    getStellarServer: vi.fn(),
    getSupportedAssets: vi.fn(async () => []),
    getVisibleWallets: vi.fn(),
    isEmailLike: (value: unknown) => String(value || "").includes("@"),
    listNetworks: vi.fn(() => []),
    loadAccount: vi.fn(),
    makeError,
    normalizeAccountWallets: vi.fn((account) => account),
    normalizeAssetCode: (value: unknown) => String(value || "XLM").trim(),
    normalizeEmail: (value: unknown) => String(value || "").trim().toLowerCase(),
    normalizeNetwork: (value: unknown) =>
      value === "mainnet" ? "mainnet" : "testnet",
    normalizeWallet: vi.fn((wallet) => wallet),
    nowIso: () => new Date().toISOString(),
    prepareStellarWalletSecretExport: vi.fn(),
    privyRequest: vi.fn(),
    readJsonBody: (context: { req: { json: () => Promise<unknown> } }) =>
      context.req.json(),
    requireAccountContext: vi.fn(async () => ({
      email: "user@example.com",
      id: "account-1",
    })),
    sanitizeWalletName: (value: unknown) => String(value || "").trim(),
    saveAccount: vi.fn(),
    saveContact: vi.fn(),
    shouldRequireMainnetAuth: (network: string) => network === "mainnet",
  };
});

import { requireAccountContext } from "../core";
import { registerBaseRoutes } from "./base";

type TestEnv = {
  DB: ReturnType<typeof createFavoriteDb>;
};

function createFavoriteDb() {
  const favorites = new Map<string, Record<string, unknown>>();

  return {
    prepare(sql: string) {
      let values: unknown[] = [];

      return {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return this;
        },
        async all() {
          if (sql.includes("FROM account_favorite_assets")) {
            const [accountEmail, network] = values;
            const results = [...favorites.values()]
              .filter(
                (row) =>
                  row.account_email === accountEmail && row.network === network
              )
              .sort((a, b) =>
                String(b.updated_at || "").localeCompare(
                  String(a.updated_at || "")
                )
              );

            return { results };
          }

          return { results: [] };
        },
        async first() {
          if (
            sql.includes("FROM account_favorite_assets") &&
            sql.includes("asset_code = ?")
          ) {
            const [accountEmail, network, assetCode, assetIssuer] = values;

            return (
              [...favorites.values()].find(
                (row) =>
                  row.account_email === accountEmail &&
                  row.network === network &&
                  row.asset_code === assetCode &&
                  row.asset_issuer === assetIssuer
              ) || null
            );
          }

          if (sql.includes("FROM account_favorite_assets")) {
            const [accountEmail, id] = values;
            const row = favorites.get(String(id));

            return row?.account_email === accountEmail ? row : null;
          }

          return null;
        },
        async run() {
          if (sql.includes("INSERT INTO account_favorite_assets")) {
            const [
              id,
              accountEmail,
              network,
              assetCode,
              assetIssuer,
              displayName,
              homeDomain,
              image,
              createdAt,
              updatedAt,
            ] = values;
            const existing = [...favorites.values()].find(
              (row) =>
                row.account_email === accountEmail &&
                row.network === network &&
                row.asset_code === assetCode &&
                row.asset_issuer === assetIssuer
            );

            if (existing) {
              existing.display_name = displayName;
              existing.home_domain = homeDomain;
              existing.image = image;
              existing.updated_at = updatedAt;
            } else {
              favorites.set(String(id), {
                account_email: accountEmail,
                asset_code: assetCode,
                asset_issuer: assetIssuer,
                created_at: createdAt,
                display_name: displayName,
                home_domain: homeDomain,
                id,
                image,
                network,
                updated_at: updatedAt,
              });
            }

            return { success: true };
          }

          if (sql.includes("DELETE FROM account_favorite_assets")) {
            const [accountEmail, id] = values;
            const row = favorites.get(String(id));

            if (row?.account_email === accountEmail) {
              favorites.delete(String(id));
            }

            return { success: true };
          }

          return { success: true };
        },
      };
    },
  };
}

function createApp() {
  const app = new Hono<{ Bindings: TestEnv }>();

  app.onError((error, context) =>
    context.json(
      { error: error.message },
      ((error as Error & { status?: number }).status || 500) as 400
    )
  );
  registerBaseRoutes(app as never);

  return app;
}

describe("favorite asset routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(requireAccountContext).mockResolvedValue({
      email: "user@example.com",
      id: "account-1",
    } as never);
  });

  it("lists an empty favorite asset collection", async () => {
    const response = await createApp().request(
      "/api/assets/favorites?email=user@example.com&network=mainnet",
      undefined,
      { DB: createFavoriteDb() }
    );
    const body = (await response.json()) as {
      data: { assets: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.data.assets).toEqual([]);
  });

  it("creates and lists a native favorite asset", async () => {
    const testEnv = { DB: createFavoriteDb() };
    const app = createApp();
    const createResponse = await app.request(
      "/api/assets/favorites",
      {
        body: JSON.stringify({
          assetCode: "XLM",
          displayName: "Lumens",
          email: "user@example.com",
          network: "mainnet",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const createBody = (await createResponse.json()) as {
      data: { asset: { assetIssuer: string | null; isNative: boolean } };
    };

    expect(createResponse.status).toBe(200);
    expect(createBody.data.asset).toMatchObject({
      assetIssuer: null,
      isNative: true,
    });

    const listResponse = await app.request(
      "/api/assets/favorites?email=user@example.com&network=mainnet",
      undefined,
      testEnv
    );
    const listBody = (await listResponse.json()) as {
      data: { assets: Array<{ assetCode: string }> };
    };

    expect(listBody.data.assets).toEqual([
      expect.objectContaining({ assetCode: "XLM" }),
    ]);
  });

  it("upserts duplicate favorite assets instead of creating duplicates", async () => {
    const testEnv = { DB: createFavoriteDb() };
    const app = createApp();
    const payload = {
      assetCode: "USDC",
      assetIssuer: "GISSUER",
      displayName: "USD Coin",
      email: "user@example.com",
      network: "testnet",
    };
    const first = await app.request(
      "/api/assets/favorites",
      {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const firstBody = (await first.json()) as {
      data: { asset: { id: string } };
    };
    const second = await app.request(
      "/api/assets/favorites",
      {
        body: JSON.stringify({
          ...payload,
          displayName: "USDC Testnet",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnv
    );
    const secondBody = (await second.json()) as {
      data: { asset: { displayName: string; id: string } };
    };
    const listResponse = await app.request(
      "/api/assets/favorites?email=user@example.com&network=testnet",
      undefined,
      testEnv
    );
    const listBody = (await listResponse.json()) as {
      data: { assets: Array<unknown> };
    };

    expect(secondBody.data.asset.id).toBe(firstBody.data.asset.id);
    expect(secondBody.data.asset.displayName).toBe("USDC Testnet");
    expect(listBody.data.assets).toHaveLength(1);
  });

  it("isolates favorite assets by network and account", async () => {
    const testEnv = { DB: createFavoriteDb() };
    const app = createApp();
    const create = async (network: "mainnet" | "testnet") => {
      const response = await app.request(
        "/api/assets/favorites",
        {
          body: JSON.stringify({
            assetCode: network === "mainnet" ? "XLM" : "USDC",
            assetIssuer: network === "mainnet" ? null : "GISSUER",
            displayName: network === "mainnet" ? "Lumens" : "USDC",
            email: "user@example.com",
            network,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
        testEnv
      );
      const body = (await response.json()) as {
        data: { asset: { id: string } };
      };

      return body.data.asset.id;
    };
    const mainnetId = await create("mainnet");
    await create("testnet");

    const mainnetList = await app.request(
      "/api/assets/favorites?email=user@example.com&network=mainnet",
      undefined,
      testEnv
    );
    const testnetList = await app.request(
      "/api/assets/favorites?email=user@example.com&network=testnet",
      undefined,
      testEnv
    );

    expect((await mainnetList.json()) as unknown).toMatchObject({
      data: { assets: [expect.objectContaining({ assetCode: "XLM" })] },
    });
    expect((await testnetList.json()) as unknown).toMatchObject({
      data: { assets: [expect.objectContaining({ assetCode: "USDC" })] },
    });

    vi.mocked(requireAccountContext).mockResolvedValueOnce({
      email: "other@example.com",
      id: "account-2",
    } as never);

    const unauthorizedDelete = await app.request(
      `/api/assets/favorites/${mainnetId}?email=other@example.com&network=mainnet`,
      { method: "DELETE" },
      testEnv
    );

    expect(unauthorizedDelete.status).toBe(404);

    const deleteResponse = await app.request(
      `/api/assets/favorites/${mainnetId}?email=user@example.com&network=mainnet`,
      { method: "DELETE" },
      testEnv
    );

    expect(deleteResponse.status).toBe(200);
  });

  it("rejects issued favorite assets without an issuer", async () => {
    const response = await createApp().request(
      "/api/assets/favorites",
      {
        body: JSON.stringify({
          assetCode: "USDC",
          displayName: "USDC",
          email: "user@example.com",
          network: "testnet",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { DB: createFavoriteDb() }
    );

    expect(response.status).toBe(400);
  });
});
