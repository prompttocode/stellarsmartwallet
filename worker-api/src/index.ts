import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAllowedOrigin, makeError, type WorkerBindings } from './core';
import { registerBaseRoutes } from './routes/base';
import { registerCollectibleRoutes } from './routes/collectibles';
import { registerKycRoutes } from './routes/kyc';
import { registerRampRoutes } from './routes/ramp';
import { registerStellarRoutes } from './routes/stellar';
import { registerWalletExportPageRoute } from './routes/walletExportPage';
import { registerWalletConnectRoutes } from './routes/walletconnect';

const app = new Hono<WorkerBindings>();

app.use(
  '*',
  cors({
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    origin: (origin, c) => getAllowedOrigin(origin, c.env),
  }),
);

app.onError((error, c) => {
  const status = (error as { status?: number }).status || 500;
  const traceId = crypto.randomUUID();

  console.error(
    JSON.stringify({
      event: 'worker.request_error',
      message: error.message || 'Server error',
      method: c.req.method,
      path: c.req.path,
      service: 'privy-stellar-api',
      status,
      timestamp: new Date().toISOString(),
      traceId,
    }),
  );

  return c.json(
    {
      error: error.message || 'Server error',
      traceId,
    },
    status as 400,
    {
      'x-trace-id': traceId,
    },
  );
});

registerBaseRoutes(app);
registerWalletExportPageRoute(app);
registerKycRoutes(app);
registerStellarRoutes(app);
registerCollectibleRoutes(app);
registerRampRoutes(app);
registerWalletConnectRoutes(app);

export default app;
