import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env, isProd } from '../env.js';

type DeployStatus = 'running' | 'success' | 'failed';

interface DeployJob {
  id: string;
  status: DeployStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  logs: string[];
}

const loginSchema = z.object({ user: z.string().min(1).max(80), password: z.string().min(1).max(200) });
const deploySchema = z.object({ commitMessage: z.string().trim().min(3).max(120) });
let currentJob: DeployJob | undefined;

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

function appendLog(job: DeployJob, chunk: Buffer): void {
  const lines = chunk.toString('utf8').replace(/\r/g, '').split('\n').filter(Boolean);
  job.logs.push(...lines);
  if (job.logs.length > 500) job.logs.splice(0, job.logs.length - 500);
}

function startDeploy(commitMessage: string): DeployJob {
  const job: DeployJob = {
    id: randomUUID(),
    status: 'running',
    startedAt: new Date().toISOString(),
    logs: ['Preparando validacion, push y despliegue...'],
  };
  currentJob = job;

  const repoRoot = resolve(process.cwd(), '../..');
  const script = resolve(repoRoot, 'scripts/deploy-production.mjs');
  const child = spawn(process.execPath, [script, '--message', commitMessage], {
    cwd: repoRoot,
    windowsHide: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk: Buffer) => appendLog(job, chunk));
  child.stderr.on('data', (chunk: Buffer) => appendLog(job, chunk));
  child.on('error', (error) => {
    job.logs.push(`No se pudo iniciar el despliegue: ${error.message}`);
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
  });
  child.on('close', (code) => {
    job.exitCode = code ?? 1;
    job.status = code === 0 ? 'success' : 'failed';
    job.finishedAt = new Date().toISOString();
    job.logs.push(code === 0 ? 'Despliegue terminado correctamente.' : `Despliegue detenido con codigo ${code ?? 1}.`);
  });

  return job;
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
    return { ok: true, data: { token, user: adminUser, job: currentJob } };
  });

  app.get('/api/superadmin/deploy', { onRequest: [requireLocalAdmin] }, async () => ({
    ok: true,
    data: { job: currentJob ?? null },
  }));

  app.post('/api/superadmin/deploy', { onRequest: [requireLocalAdmin] }, async (req, reply) => {
    const parsed = deploySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Escribe un mensaje de commit valido' } });
    }
    if (currentJob?.status === 'running') {
      return reply.code(409).send({ ok: false, error: { code: 'DEPLOY_RUNNING', message: 'Ya hay un despliegue en curso' } });
    }
    const job = startDeploy(parsed.data.commitMessage);
    return reply.code(202).send({ ok: true, data: { job } });
  });
}
