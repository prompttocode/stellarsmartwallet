import { describe, expect, it, vi } from 'vitest';
import type { Env } from './core';
import { revokeAppleAuthorization } from './core';

function bytesToPem(bytes: ArrayBuffer) {
  const base64 = btoa(
    String.fromCharCode(...new Uint8Array(bytes)),
  );
  const lines = base64.match(/.{1,64}/g) || [];

  return `-----BEGIN PRIVATE KEY-----\n${lines.join(
    '\n',
  )}\n-----END PRIVATE KEY-----`;
}

describe('Apple authorization revocation', () => {
  it('creates an ES256 client secret and sends the OAuth token to Apple', async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const signingKey = bytesToPem(
      (await crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey,
      )) as ArrayBuffer,
    );
    let requestBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = String(init?.body || '');
        return new Response(null, { status: 200 });
      }),
    );

    await revokeAppleAuthorization(
      {
        APPLE_CLIENT_ID: 'com.orbitlab.stellar',
        APPLE_KEY_ID: 'KEY123',
        APPLE_SIGNING_KEY: signingKey,
        APPLE_TEAM_ID: 'TEAM123',
      } as Env,
      'apple-refresh-token',
    );

    const form = new URLSearchParams(requestBody);
    const clientSecret = String(form.get('client_secret') || '');

    expect(form.get('client_id')).toBe('com.orbitlab.stellar');
    expect(form.get('token')).toBe('apple-refresh-token');
    expect(form.get('token_type_hint')).toBe('refresh_token');
    expect(clientSecret.split('.')).toHaveLength(3);
  });

  it('fails closed when Apple credentials are not configured', async () => {
    await expect(
      revokeAppleAuthorization({} as Env, 'apple-refresh-token'),
    ).rejects.toMatchObject({
      message: 'APPLE_REVOCATION_NOT_CONFIGURED',
      status: 503,
    });
  });
});
