import { Application, Router, fromFileUrl, join } from './deps.ts';
import { WebSocketP, ConnectionManager } from './connection-manager.ts';

const connectionManager = new ConnectionManager();

const initWebsocketApp = () => {
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
        connectionManager.addBleConnection(new WebSocketP(ws));
      } else {
        console.error(Error('No upgrade header.'), ctx);
      }
    })
    .all('/ws/game', (ctx) => {
      if (ctx.request.headers.get('upgrade')?.includes('websocket')) {
        const ws = ctx.upgrade();
        connectionManager.addGameConnection(new WebSocketP(ws));
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
        connectionManager.addRawBleConnection(
          new WebSocketP(ws),
          type as string,
        );
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
        connectionManager.addRawGameConnection(
          new WebSocketP(ws),
          type as string,
        );
      } else {
        console.error(Error('No upgrade header.'), ctx);
      }
    });

  app.use(router.routes());
  app.use(router.allowedMethods());
  app.listen({ port: 8000 });
};

const initBeamNGListener = async () => {
  const listener = Deno.listen({
    port: 20202,
    transport: 'tcp',
    hostname: '0.0.0.0',
  });
  for await (const conn of listener) {
    try {
      const remoteAddr = conn.remoteAddr as Deno.NetAddr;
      console.log(`${remoteAddr?.hostname}:${remoteAddr?.port} connected.`);
      connectionManager.addBeamNGConnection(conn);
    } catch (e) {
      console.error(e);
    }
  }
};

await Promise.allSettled([initWebsocketApp(), initBeamNGListener()]);
