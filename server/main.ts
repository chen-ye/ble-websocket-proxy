import { Application, Router } from 'https://deno.land/x/oak@v10.6.0/mod.ts';
import { fromFileUrl, join } from 'https://deno.land/std@0.143.0/path/mod.ts';
import { WebSocketP, WebSocketManager } from './websocket-manager.ts';

const app = new Application();

// Logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get('X-Response-Time');
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// Timing
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set('X-Response-Time', `${ms}ms`);
});

const webSocketManager = new WebSocketManager();

const router = new Router();
router
  .get('/', async (ctx, next) => {
    try {
      await ctx.send({
        root: join(fromFileUrl(import.meta.url), '..', 'static'),
        index: 'index.html',
      });
    } catch {
      await next();
    }
  })
  .all('/ws/ble', (ctx) => {
    if (ctx.request.headers.get('upgrade')?.includes('websocket')) {
      const ws = ctx.upgrade();
      webSocketManager.addBleConnection(new WebSocketP(ws));
    } else {
      console.error(Error('No upgrade header.'), ctx);
    }
  })
  .all('/ws/game', (ctx) => {
    if (ctx.request.headers.get('upgrade')?.includes('websocket')) {
      const ws = ctx.upgrade();
      webSocketManager.addGameConnection(new WebSocketP(ws));
    } else {
      console.error(Error('No upgrade header.'), ctx);
    }
  })
  .all('/ws/ble/raw/:type', (ctx) => {
    const type = ctx?.params?.type as string | undefined;
    if (!type) {
      const error = Error('No type specified.');
      console.error(error, ctx);
      ctx.response.status = 400;
      ctx.response.body = error.message;
    }
    if (ctx.request.headers.get('upgrade')?.includes('websocket')) {
      const ws = ctx.upgrade();
      webSocketManager.addRawBleConnection(new WebSocketP(ws), type as string);
    } else {
      console.error(Error('No upgrade header.'), ctx);
    }
  })
  .all('/ws/game/raw/:type', (ctx) => {
    const type = ctx?.params?.type as string | undefined;
    if (!type) {
      const error = Error('No type specified.');
      console.error(error, ctx);
      ctx.response.status = 400;
      ctx.response.body = error.message;
    }
    if (ctx.request.headers.get('upgrade')?.includes('websocket')) {
      const ws = ctx.upgrade();
      webSocketManager.addRawGameConnection(new WebSocketP(ws), type as string);
    } else {
      console.error(Error('No upgrade header.'), ctx);
    }
  });

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
