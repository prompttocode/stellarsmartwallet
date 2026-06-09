import type { Hono } from 'hono';
import { makeError, type WorkerBindings } from '../core';

function getRampProviders() {
  return [
    {
      configured: false,
      id: 'onchain-deposit',
      name: 'On-chain deposit',
      supports: ['deposit', 'withdraw'],
      type: 'deposit',
    },
  ];
}

function getDisabledRampResponse(): never {
  throw makeError(
    'Fiat ramp provider is not configured yet. Use on-chain deposit for now.',
    501,
  );
}

export function registerRampRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/ramp/providers', c =>
    c.json({
      providers: getRampProviders(),
    }),
  );

  app.post('/api/ramp/quote', () => getDisabledRampResponse());
  app.post('/api/ramp/checkout', () => getDisabledRampResponse());

}
