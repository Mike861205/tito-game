import type { AiCoachInput, AiCoachResponse, Progress } from '@tito/shared';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'tito.auth.token';

export interface LeaderboardRow {
  rank: number;
  username: string;
  score: number;
  timeMs: number;
  world: number;
  level: number;
  stars: number;
  achievedAt: string;
}

export interface RunTicket {
  runId: string;
  nonce: string;
  startedAt: number;
}

export interface ScoreResult {
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

class ApiClient {
  private token: string | null = localStorage.getItem(TOKEN_KEY);
  /** Si la API no responde, el juego sigue funcionando en modo offline. */
  online = false;

  get isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  setToken(token: string | null): void {
    this.token = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(init.headers ?? {}),
        },
      });
      const json = (await res.json()) as { ok: boolean; data?: T; error?: { message: string } };
      this.online = true;
      if (!json.ok) {
        console.warn(`[API] ${path}:`, json.error?.message);
        if (res.status === 401) this.setToken(null);
        return null;
      }
      return json.data ?? null;
    } catch {
      this.online = false;
      return null;
    }
  }

  async health(): Promise<boolean> {
    const data = await this.request<{ status: string }>('/api/health');
    return data?.status === 'healthy';
  }

  async register(email: string, username: string, password: string) {
    const data = await this.request<{ token: string; user: { username: string } }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify({ email, username, password }) },
    );
    if (data?.token) this.setToken(data.token);
    return data;
  }

  async login(emailOrUsername: string, password: string) {
    const data = await this.request<{ token: string; user: { username: string } }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ emailOrUsername, password }) },
    );
    if (data?.token) this.setToken(data.token);
    return data;
  }

  logout(): void {
    this.setToken(null);
  }

  async getProgress(): Promise<Progress | null> {
    if (!this.token) return null;
    return this.request<Progress>('/api/progress');
  }

  async saveProgress(progress: Omit<Progress, 'updatedAt'>): Promise<boolean> {
    if (!this.token) return false;
    const res = await this.request<{ updatedAt: string }>('/api/progress', {
      method: 'PUT',
      body: JSON.stringify(progress),
    });
    return Boolean(res);
  }

  async startRun(world: number, level: number): Promise<RunTicket | null> {
    if (!this.token) return null;
    return this.request<RunTicket>('/api/runs/start', {
      method: 'POST',
      body: JSON.stringify({ world, level }),
    });
  }

  async submitScore(result: ScoreResult, nonce: string) {
    if (!this.token) return null;
    const signature = await signScore(result, nonce);
    return this.request<{ id: string; stars: number; rank: number }>('/api/scores', {
      method: 'POST',
      body: JSON.stringify({ ...result, signature }),
    });
  }

  async leaderboard(params: { world?: number; level?: number; limit?: number; scope?: string } = {}) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );
    return (await this.request<LeaderboardRow[]>(`/api/leaderboard?${qs}`)) ?? [];
  }

  async coach(input: AiCoachInput): Promise<AiCoachResponse | null> {
    return this.request<AiCoachResponse>('/api/ai/coach', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}

/**
 * Firma HMAC-SHA256 del resultado usando el nonce del run.
 * Debe producir exactamente el mismo string que el servidor
 * (ver apps/api/src/lib/signature.ts).
 */
async function signScore(r: ScoreResult, nonce: string): Promise<string> {
  const secret = `${import.meta.env.VITE_SCORE_HMAC_SECRET ?? 'tito-score-secret-dev-only'}:${nonce}`;
  const canonical = [
    r.runId,
    r.world,
    r.level,
    r.score,
    r.timeMs,
    r.coins,
    r.enemiesDefeated,
    r.deaths,
    r.completed ? 1 : 0,
  ].join('|');

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(canonical));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const api = new ApiClient();
