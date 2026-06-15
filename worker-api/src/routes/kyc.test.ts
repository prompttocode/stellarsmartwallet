import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../core', () => ({
  getKycSummaryForAccount: vi.fn(async () => ({ status: 'not_started' })),
  makeError: (message: string, status = 500) => {
    const error = new Error(message) as Error & { status: number };
    error.status = status;
    return error;
  },
  readJsonBody: (context: { req: { json: () => Promise<unknown> } }) =>
    context.req.json(),
  requireAuthenticatedAccount: vi.fn(async () => ({
    email: 'user@example.com',
    id: 'account-1',
  })),
  saveAccountKyc: vi.fn(async (_env, record) => ({
    ...record,
    status: 'verified',
    updatedAt: '2026-06-13T00:00:00.000Z',
  })),
}));

import {
  getKycSummaryForAccount,
  saveAccountKyc,
} from '../core';
import { registerKycRoutes } from './kyc';

type TestEnv = {
  PAYMENT_API_BASE_URL: string;
  PAYMENT_PARTNER_APP_KEY: string;
};

const env: TestEnv = {
  PAYMENT_API_BASE_URL: 'https://payments.example',
  PAYMENT_PARTNER_APP_KEY: 'test-partner-key',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

function createApp() {
  const app = new Hono<{ Bindings: TestEnv }>();

  app.onError((error, context) =>
    context.json(
      { error: error.message },
      ((error as Error & { status?: number }).status || 500) as 400,
    ),
  );
  registerKycRoutes(app as never);

  return app;
}

describe('kyc routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns current KYC status for the signed-in account', async () => {
    vi.mocked(getKycSummaryForAccount).mockResolvedValueOnce({
      status: 'verified',
      providerUserId: 'provider-1',
    });

    const response = await createApp().request(
      '/api/kyc/status',
      {
        headers: { Authorization: 'Bearer test-token' },
        method: 'GET',
      },
      env,
    );
    const body = (await response.json()) as {
      data: { providerUserId: string; status: string };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      providerUserId: 'provider-1',
      status: 'verified',
    });
  });

  it('submits CCCD images to the payment API and stores sanitized KYC data', async () => {
    let upstreamBody: Uint8Array | null = null;
    let upstreamContentType = '';
    let upstreamPartnerKey = '';
    const frontImage = btoa('front-image'.repeat(12));
    const backImage = btoa('back-image'.repeat(12));

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);

        upstreamBody = init?.body as Uint8Array;
        upstreamContentType = headers.get('content-type') || '';
        upstreamPartnerKey = headers.get('partner-app-key') || '';

        return jsonResponse({
          data: {
            dob: '1990-01-15',
            email: 'user@example.com',
            id: 7,
            id_number: '001234567890',
            kyc_image_back: 'https://s3.example/back.jpg',
            kyc_image_front: 'https://s3.example/front.jpg',
            name: 'NGUYEN VAN A',
            phone: '0901234567',
          },
          success: true,
        });
      }),
    );

    const response = await createApp().request(
      '/api/kyc/id-card',
      {
        body: JSON.stringify({
          imageBackBase64: backImage,
          imageFrontBase64: frontImage,
          phone: '090 123 4567',
        }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(upstreamPartnerKey).toBe(env.PAYMENT_PARTNER_APP_KEY);
    expect(upstreamContentType).toMatch(
      /^multipart\/form-data; boundary=----PrivyStellarBoundary[a-f0-9]{32}$/,
    );
    expect(upstreamBody).toBeInstanceOf(Uint8Array);

    const upstreamFormData = await new Response(upstreamBody, {
      headers: { 'Content-Type': upstreamContentType },
    }).formData();

    expect(upstreamFormData.get('email')).toBe('user@example.com');
    expect(upstreamFormData.get('phone')).toBe('0901234567');

    const upstreamFront = upstreamFormData.get('image_front') as unknown;
    const upstreamBack = upstreamFormData.get('image_back') as unknown;

    if (!(upstreamFront instanceof File) || !(upstreamBack instanceof File)) {
      throw new Error('Expected multipart CCCD image files');
    }

    expect(upstreamFront.name).toBe('cccd-front.jpg');
    expect(upstreamFront.type).toBe('image/jpeg');
    expect(await upstreamFront.text()).toBe('front-image'.repeat(12));
    expect(upstreamBack.name).toBe('cccd-back.jpg');
    expect(upstreamBack.type).toBe('image/jpeg');
    expect(await upstreamBack.text()).toBe('back-image'.repeat(12));
    expect(saveAccountKyc).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        accountEmail: 'user@example.com',
        cccdLast4: '7890',
        dob: '1990-01-15',
        fullName: 'NGUYEN VAN A',
        phone: '0901234567',
        providerUserId: '7',
      }),
    );
    expect(JSON.stringify(vi.mocked(saveAccountKyc).mock.calls[0][1])).not.toContain(
      's3.example',
    );
  });
});
