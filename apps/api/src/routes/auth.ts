import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { loginSchema, quickLoginSchema, registerSchema } from '@tito/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';

const BCRYPT_ROUNDS = 12;

function quickUsername(name: string, phone: string): string {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'tito';
  const suffix = createHash('sha256').update(phone).digest('hex').slice(0, 6);
  return `${base}_${suffix}`.slice(0, 20);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/quick', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const parsed = quickLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Revisa nombre, telefono y avatar' } });
      }
      const phone = parsed.data.phone.replace(/\D/g, '');
      const now = new Date();
      let user = await prisma.user.findUnique({ where: { phone } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { displayName: parsed.data.name, avatar: parsed.data.avatar, lastLoginAt: now, loginCount: { increment: 1 } },
        });
      } else {
        const digest = createHash('sha256').update(phone).digest('hex').slice(0, 20);
        const passwordHash = await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
        user = await prisma.user.create({
          data: {
            email: `player-${digest}@tito.local`,
            username: quickUsername(parsed.data.name, phone),
            passwordHash,
            displayName: parsed.data.name,
            phone,
            avatar: parsed.data.avatar,
            lastLoginAt: now,
            loginCount: 1,
            progress: { create: {} },
          },
        });
      }
      const token = app.jwt.sign({ sub: user.id, username: user.username, role: user.role }, { expiresIn: env.JWT_EXPIRES_IN });
      return reply.send({ ok: true, data: { token, user: { id: user.id, username: user.username, name: user.displayName, phone: user.phone, avatar: user.avatar } } });
    },
  );

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

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), loginCount: { increment: 1 } } });

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

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), loginCount: { increment: 1 } } });

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
