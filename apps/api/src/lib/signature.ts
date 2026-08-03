import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';

/**
 * Firma HMAC de los resultados de una partida.
 * El cliente recibe un `nonce` al iniciar el run y firma el resultado.
 * No es infalible (el cliente es publico) pero corta el 99% de los
 * envios de puntajes falsos hechos con curl/Postman.
 */
export function createNonce(): string {
  return randomBytes(24).toString('hex');
}

export interface ScorePayload {
  runId: string;
  world: number;
  level: number;
  score: number;
  timeMs: number;
  coins: number;
  enemiesDefeated: number;
  deaths: number;
  completed: boolean;
}

export function scoreSignature(payload: ScorePayload, nonce: string): string {
  const canonical = [
    payload.runId,
    payload.world,
    payload.level,
    payload.score,
    payload.timeMs,
    payload.coins,
    payload.enemiesDefeated,
    payload.deaths,
    payload.completed ? 1 : 0,
  ].join('|');

  return createHmac('sha256', `${env.SCORE_HMAC_SECRET}:${nonce}`).update(canonical).digest('hex');
}

export function verifyScoreSignature(
  payload: ScorePayload,
  nonce: string,
  signature: string,
): boolean {
  const expected = scoreSignature(payload, nonce);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
