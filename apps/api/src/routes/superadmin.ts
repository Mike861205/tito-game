import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env, isProd } from '../env.js';
import { prisma } from '../db.js';

type DeployStatus = 'running' | 'success' | 'failed';

interface DeployJob {
  id: string;
  status: DeployStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  pid?: number;
  logs: string[];
}

const loginSchema = z.object({ user: z.string().min(1).max(80), password: z.string().min(1).max(200) });
const deploySchema = z.object({ commitMessage: z.string().trim().min(3).max(120) });
const reportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(150),
});
const repoRoot = resolve(process.cwd(), '../..');
const stateFile = resolve(repoRoot, '.deploy-state.json');

function readJob(): DeployJob | undefined {
  if (!existsSync(stateFile)) return undefined;
  try {
    const job = JSON.parse(readFileSync(stateFile, 'utf8')) as DeployJob;
    return job.id && Array.isArray(job.logs) ? job : undefined;
  } catch {
    return undefined;
  }
}

function writeJob(job: DeployJob): void {
  writeFileSync(stateFile, JSON.stringify(job, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function isLoopback(req: FastifyRequest): boolean {
  const address = req.raw.socket.remoteAddress ?? '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

async function requireLocalAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isLoopback(req)) {
    await reply.code(403).send({ ok: false, error: { code: 'LOCAL_ONLY', message: 'Disponible solo en localhost' } });
    return;
  }
  try {
    await req.jwtVerify();
    if (req.user.role !== 'superadmin-local') throw new Error('Rol invalido');
  } catch {
    await reply.code(401).send({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sesion de superadmin invalida' } });
  }
}

function startDeploy(commitMessage: string): DeployJob {
  const job: DeployJob = {
    id: randomUUID(),
    status: 'running',
    startedAt: new Date().toISOString(),
    logs: ['Preparando validacion, push y despliegue...'],
  };
  writeJob(job);

  const script = resolve(repoRoot, 'scripts/deploy-production.mjs');
  const child = spawn(process.execPath, [script, '--message', commitMessage, '--state-file', stateFile, '--job-id', job.id], {
    cwd: repoRoot,
    windowsHide: true,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  const persisted = readJob() ?? job;
  persisted.pid = child.pid;
  writeJob(persisted);
  child.on('error', (error) => {
    job.logs.push(`No se pudo iniciar el despliegue: ${error.message}`);
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    writeJob(job);
  });
  child.unref();

  return persisted;
}

export async function superadminRoutes(app: FastifyInstance): Promise<void> {
  if (isProd || !env.SUPERADMIN_ENABLED || !env.SUPERADMIN_USER || !env.SUPERADMIN_PASSWORD) return;
  const adminUser = env.SUPERADMIN_USER;
  const adminPassword = env.SUPERADMIN_PASSWORD;

  app.post('/api/superadmin/login', async (req, reply) => {
    if (!isLoopback(req)) {
      return reply.code(403).send({ ok: false, error: { code: 'LOCAL_ONLY', message: 'Disponible solo en localhost' } });
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Datos invalidos' } });
    }
    const valid =
      constantTimeEqual(parsed.data.user, adminUser) &&
      constantTimeEqual(parsed.data.password, adminPassword);
    if (!valid) {
      return reply.code(401).send({ ok: false, error: { code: 'BAD_CREDENTIALS', message: 'Credenciales incorrectas' } });
    }
    const token = app.jwt.sign(
      { sub: 'local-deployer', username: adminUser, role: 'superadmin-local' },
      { expiresIn: '30m' },
    );
    return { ok: true, data: { token, user: adminUser, job: readJob() } };
  });

  app.get('/api/superadmin/deploy', { onRequest: [requireLocalAdmin] }, async () => ({
    ok: true,
    data: { job: readJob() ?? null },
  }));

  app.get('/api/superadmin/players', { onRequest: [requireLocalAdmin] }, async (req, reply) => {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Rango de fechas inválido' } });
    }
    const from = parsed.data.from ? new Date(parsed.data.from) : new Date(0);
    const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
    const activityRange = { gte: from, lte: to };
    const players = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: parsed.data.limit,
      select: {
        id: true, username: true, displayName: true, phone: true, avatar: true,
        createdAt: true, lastLoginAt: true, loginCount: true,
        progress: { select: { totalScore: true, coins: true } },
        runs: { where: { startedAt: activityRange }, select: { startedAt: true } },
        scores: { where: { createdAt: activityRange }, select: { timeMs: true, completed: true, score: true, createdAt: true } },
      },
    });
    const totalPlayers = await prisma.user.count();
    const newPlayers = await prisma.user.count({ where: { createdAt: activityRange } });
    const rows = players.map((player) => {
      const minutesPlayed = player.scores.reduce((total, score) => total + score.timeMs, 0) / 60000;
      const lastRun = player.runs.reduce<Date | null>((latest, run) => !latest || run.startedAt > latest ? run.startedAt : latest, null);
      const lastScore = player.scores.reduce<Date | null>((latest, score) => !latest || score.createdAt > latest ? score.createdAt : latest, null);
      const lastActivity = [player.lastLoginAt, lastRun, lastScore].filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      return {
        id: player.id,
        name: player.displayName ?? player.username,
        username: player.username,
        phone: player.phone,
        avatar: player.avatar,
        registeredAt: player.createdAt.toISOString(),
        lastLoginAt: player.lastLoginAt?.toISOString() ?? null,
        lastActivityAt: lastActivity?.toISOString() ?? null,
        logins: player.loginCount,
        games: player.runs.length,
        completedGames: player.scores.filter((score) => score.completed).length,
        minutesPlayed: Math.round(minutesPlayed * 10) / 10,
        score: player.progress?.totalScore ?? player.scores.reduce((total, score) => total + score.score, 0),
        coins: player.progress?.coins ?? 0,
      };
    });
    return {
      ok: true,
      data: {
        summary: {
          totalPlayers,
          newPlayers,
          totalLogins: rows.reduce((total, player) => total + player.logins, 0),
          totalGames: rows.reduce((total, player) => total + player.games, 0),
          totalMinutes: Math.round(rows.reduce((total, player) => total + player.minutesPlayed, 0) * 10) / 10,
        },
        players: rows,
      },
    };
  });

  app.post('/api/superadmin/deploy', { onRequest: [requireLocalAdmin] }, async (req, reply) => {
    const parsed = deploySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Escribe un mensaje de commit valido' } });
    }
    if (readJob()?.status === 'running') {
      return reply.code(409).send({ ok: false, error: { code: 'DEPLOY_RUNNING', message: 'Ya hay un despliegue en curso' } });
    }
    const job = startDeploy(parsed.data.commitMessage);
    return reply.code(202).send({ ok: true, data: { job } });
  });
}
