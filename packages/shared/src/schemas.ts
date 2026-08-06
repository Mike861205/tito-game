import { z } from 'zod';

/** ---------- Auth ---------- */
export const registerSchema = z.object({
  email: z.string().email('Email invalido').max(190),
  username: z
    .string()
    .min(3, 'Minimo 3 caracteres')
    .max(20, 'Maximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, numeros y guion bajo'),
  password: z.string().min(8, 'Minimo 8 caracteres').max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  emailOrUsername: z.string().min(3).max(190),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const quickLoginSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(40),
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, 'Telefono invalido'),
  avatar: z.enum(['explorer', 'fox', 'dragon', 'robot', 'ice', 'fire']),
});
export type QuickLoginInput = z.infer<typeof quickLoginSchema>;

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/** ---------- Sesion de juego ---------- */
export const startRunSchema = z.object({
  world: z.number().int().min(1).max(5),
  level: z.number().int().min(1).max(4),
});
export type StartRunInput = z.infer<typeof startRunSchema>;

export const runTokenSchema = z.object({
  runId: z.string(),
  nonce: z.string(),
  startedAt: z.number(),
});
export type RunToken = z.infer<typeof runTokenSchema>;

/** ---------- Puntajes ---------- */
export const submitScoreSchema = z.object({
  runId: z.string().min(8),
  world: z.number().int().min(1).max(5),
  level: z.number().int().min(1).max(4),
  score: z.number().int().min(0).max(9_999_999),
  timeMs: z.number().int().min(0).max(60 * 60 * 1000),
  coins: z.number().int().min(0).max(9999),
  enemiesDefeated: z.number().int().min(0).max(9999),
  deaths: z.number().int().min(0).max(999),
  completed: z.boolean(),
  /** HMAC calculado en el cliente con el nonce del run */
  signature: z.string().min(16),
});
export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;

export const leaderboardQuerySchema = z.object({
  world: z.coerce.number().int().min(1).max(5).optional(),
  level: z.coerce.number().int().min(1).max(4).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(['global', 'weekly', 'me']).default('global'),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int(),
  username: z.string(),
  score: z.number().int(),
  timeMs: z.number().int(),
  world: z.number().int(),
  level: z.number().int(),
  achievedAt: z.string(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

/** ---------- Progreso ---------- */
export const progressSchema = z.object({
  currentWorld: z.number().int().min(1).max(5),
  currentLevel: z.number().int().min(1).max(4),
  lives: z.number().int().min(0).max(9),
  totalScore: z.number().int().min(0),
  coins: z.number().int().min(0),
  unlocked: z.array(z.string()),
  levelStats: z.record(
    z.string(),
    z.object({
      bestScore: z.number().int().min(0),
      bestTimeMs: z.number().int().min(0),
      stars: z.number().int().min(0).max(3),
      completed: z.boolean(),
    }),
  ),
  updatedAt: z.string().optional(),
});
export type Progress = z.infer<typeof progressSchema>;

export const saveProgressSchema = progressSchema.omit({ updatedAt: true });
export type SaveProgressInput = z.infer<typeof saveProgressSchema>;

/** ---------- IA (OpenAI) ---------- */
export const aiCoachSchema = z.object({
  world: z.number().int().min(1).max(5),
  level: z.number().int().min(1).max(4),
  deaths: z.number().int().min(0).max(999),
  lastDeathCause: z.enum(['enemigo', 'caida', 'pinchos', 'lava', 'tiempo', 'desconocido']),
  timeMs: z.number().int().min(0),
});
export type AiCoachInput = z.infer<typeof aiCoachSchema>;

export const aiCoachResponseSchema = z.object({
  tip: z.string(),
  taunt: z.string(),
  source: z.enum(['openai', 'local']),
});
export type AiCoachResponse = z.infer<typeof aiCoachResponseSchema>;

/** ---------- Respuesta generica de la API ---------- */
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
