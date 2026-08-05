import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { corsOrigins, env, isProd } from './env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { runRoutes } from './routes/scores.js';
import { progressRoutes } from './routes/progress.js';
import { levelRoutes } from './routes/levels.js';
import { aiRoutes } from './routes/ai.js';
import { superadminRoutes } from './routes/superadmin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isProd
      ? { level: 'info' }
      : {
          level: 'debug',
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            mediaSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", ...corsOrigins],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origen no permitido por CORS'), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    allowList: isProd ? [] : ['127.0.0.1', '::1'],
  });

  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate('authenticate', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply
        .code(401)
        .send({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token invalido o ausente' } });
    }
  });

  app.decorate('optionalAuth', async (req) => {
    try {
      await req.jwtVerify();
    } catch {
      /* invitado */
    }
  });

  app.setErrorHandler((error: unknown, req, reply) => {
    if (error instanceof ZodError) {
      return reply
        .code(400)
        .send({ ok: false, error: { code: 'VALIDATION', message: 'Datos invalidos' } });
    }
    const err = error as { statusCode?: number; code?: string; message?: string };
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error({ err: error }, 'Error no controlado');
    return reply.code(status).send({
      ok: false,
      error: {
        code: err.code ?? 'INTERNAL',
        message:
          status >= 500 && isProd ? 'Error interno del servidor' : (err.message ?? 'Error'),
      },
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(levelRoutes);
  await app.register(runRoutes);
  await app.register(progressRoutes);
  await app.register(aiRoutes);
  await app.register(superadminRoutes);

  // En produccion la API tambien sirve el build del juego.
  const staticDir = resolve(__dirname, '..', env.STATIC_DIR);
  const servesGame = isProd && existsSync(staticDir);
  if (servesGame) {
    await app.register(fastifyStatic, { root: staticDir, prefix: '/' });
    app.log.info(`Sirviendo cliente estatico desde ${staticDir}`);
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api')) {
      return reply
        .code(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
    }
    if (servesGame) return reply.sendFile('index.html');
    return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'No encontrado' } });
  });

  return app;
}
