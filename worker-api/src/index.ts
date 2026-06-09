import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAllowedOrigin, makeError, type WorkerBindings } from './core';
import { registerBaseRoutes } from './routes/base';
import { registerCollectibleRoutes } from './routes/collectibles';
import { registerRampRoutes } from './routes/ramp';
import { registerStellarRoutes } from './routes/stellar';
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

  return c.json(
    {
      error: error.message || 'Server error',
    },
    status as 400,
  );
});

registerBaseRoutes(app);
registerStellarRoutes(app);
registerCollectibleRoutes(app);
registerRampRoutes(app);
registerWalletConnectRoutes(app);

export default app;
