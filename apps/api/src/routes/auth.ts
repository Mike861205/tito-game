import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema } from '@tito/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';

const BCRYPT_ROUNDS = 12;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: { code: 'VALIDATION', message: 'Datos invalidos', details: parsed.error.flatten() },
        });
      }
      const { email, username, password } = parsed.data;

      const exists = await prisma.user.findFirst({
        where: { OR: [{ email: email.toLowerCase() }, { username }] },
        select: { id: true },
      });
      if (exists) {
        return reply.code(409).send({
          ok: false,
          error: { code: 'USER_EXISTS', message: 'El email o usuario ya esta registrado' },
        });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          passwordHash,
          progress: { create: {} },
        },
        select: { id: true, email: true, username: true, role: true, createdAt: true },
      });

      const token = app.jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        { expiresIn: env.JWT_EXPIRES_IN },
      );

      return reply.code(201).send({
        ok: true,
        data: {
          token,
          user: { ...user, createdAt: user.createdAt.toISOString() },
        },
      });
    },
  );

  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: { code: 'VALIDATION', message: 'Datos invalidos' },
        });
      }
      const { emailOrUsername, password } = parsed.data;

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
        },
      });

      // Comparacion siempre ejecutada para evitar timing attacks de enumeracion.
      const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
      const valid = await bcrypt.compare(password, hash);

      if (!user || !valid) {
        return reply.code(401).send({
          ok: false,
          error: { code: 'BAD_CREDENTIALS', message: 'Usuario o contrasena incorrectos' },
        });
      }

      const token = app.jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        { expiresIn: env.JWT_EXPIRES_IN },
      );

      return {
        ok: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
          },
        },
      };
    },
  );

  app.get('/api/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });
    if (!user) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'No existe' } });
    }
    return { ok: true, data: { ...user, createdAt: user.createdAt.toISOString() } };
  });
}
