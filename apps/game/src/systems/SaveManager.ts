import {
  LEVELS_PER_WORLD,
  STARTING_LIVES,
  WORLD_IDS,
  levelId,
  nextLevel,
  type Progress,
} from '@tito/shared';
import { api } from './ApiClient';

const STORAGE_KEY = 'tito.progress.v1';
const SETTINGS_KEY = 'tito.settings.v1';
const CHECKPOINTS_KEY = 'tito.checkpoints.v1';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  aiCoach: boolean;
}

const defaultSettings: Settings = { musicVolume: 0.5, sfxVolume: 0.7, aiCoach: true };

function defaultProgress(): Progress {
  return {
    currentWorld: 1,
    currentLevel: 1,
    lives: STARTING_LIVES,
    totalScore: 0,
    coins: 0,
    unlocked: [levelId(1, 1)],
    levelStats: {},
  };
}

/**
 * Guardado local (siempre) + sincronizacion con Neon via API (si hay sesion).
 * El juego nunca se bloquea si la API esta caida.
 */
class SaveManager {
  progress: Progress = defaultProgress();
  settings: Settings = defaultSettings;
  private checkpoints: Record<string, number> = {};

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.progress = { ...defaultProgress(), ...(JSON.parse(raw) as Progress) };
    } catch {
      this.progress = defaultProgress();
    }
    this.sanitizeProgress();
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) this.settings = { ...defaultSettings, ...(JSON.parse(raw) as Settings) };
    } catch {
      this.settings = defaultSettings;
    }
    try {
      const raw = localStorage.getItem(CHECKPOINTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      this.checkpoints = Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, number] =>
          Number.isInteger(entry[1]) && Number(entry[1]) >= 0,
        ),
      );
    } catch {
      this.checkpoints = {};
    }
  }

  /**
   * Corrige un progreso guardado invalido (ej. version anterior del juego)
   * para que `currentWorld`/`currentLevel` siempre apunten a un nivel real
   * y `unlocked` nunca quede vacio. Sin esto, `getLevelDesign` puede tirar
   * y dejar el Mapa de Mundos sin poder abrirse.
   */
  private sanitizeProgress(): void {
    const validWorld = WORLD_IDS.includes(this.progress.currentWorld as (typeof WORLD_IDS)[number]);
    const validLevel =
      Number.isInteger(this.progress.currentLevel) &&
      this.progress.currentLevel >= 1 &&
      this.progress.currentLevel <= LEVELS_PER_WORLD;
    if (!validWorld || !validLevel) {
      this.progress.currentWorld = 1;
      this.progress.currentLevel = 1;
    }
    if (!Array.isArray(this.progress.unlocked) || this.progress.unlocked.length === 0) {
      this.progress.unlocked = [levelId(1, 1)];
    }
  }

  /** Trae el progreso del servidor y se queda con el mejor de los dos. */
  async syncFromServer(): Promise<void> {
    const remote = await api.getProgress();
    if (!remote) return;
    const localScore = this.progress.totalScore;
    if (remote.totalScore >= localScore) {
      this.progress = {
        ...remote,
        unlocked: [...new Set([...remote.unlocked, ...this.progress.unlocked])],
      };
      this.persistLocal();
    } else {
      void this.persistRemote();
    }
  }

  private persistLocal(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
  }

  private async persistRemote(): Promise<void> {
    const { updatedAt: _ignored, ...payload } = this.progress;
    await api.saveProgress(payload);
  }

  save(): void {
    this.persistLocal();
    void this.persistRemote();
  }

  saveSettings(settings: Partial<Settings>): void {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  isUnlocked(world: number, level: number): boolean {
    return this.progress.unlocked.includes(levelId(world, level));
  }

  unlock(world: number, level: number): void {
    const id = levelId(world, level);
    if (!this.progress.unlocked.includes(id)) this.progress.unlocked.push(id);
  }

  /** Guarda la bandera mas avanzada alcanzada en un nivel. */
  setCheckpoint(world: number, level: number, checkpointIndex: number): void {
    const id = levelId(world, level);
    const previous = this.checkpoints[id] ?? -1;
    if (checkpointIndex <= previous) return;
    this.checkpoints[id] = checkpointIndex;
    localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(this.checkpoints));
  }

  getCheckpoint(world: number, level: number): number | null {
    const value = this.checkpoints[levelId(world, level)];
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  }

  clearCheckpoint(world: number, level: number): void {
    const id = levelId(world, level);
    if (!(id in this.checkpoints)) return;
    delete this.checkpoints[id];
    localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(this.checkpoints));
  }

  /** Registra el resultado de un nivel completado. */
  completeLevel(
    world: number,
    level: number,
    result: { score: number; timeMs: number; stars: number },
  ): void {
    const id = levelId(world, level);
    const prev = this.progress.levelStats[id];
    this.progress.levelStats[id] = {
      bestScore: Math.max(prev?.bestScore ?? 0, result.score),
      bestTimeMs: prev?.bestTimeMs ? Math.min(prev.bestTimeMs, result.timeMs) : result.timeMs,
      stars: Math.max(prev?.stars ?? 0, result.stars),
      completed: true,
    };
    this.progress.totalScore += result.score;

    const next = nextLevel(world, level);
    if (next) {
      this.unlock(next.world, next.level);
      this.progress.currentWorld = next.world;
      this.progress.currentLevel = next.level;
    }
    this.save();
  }

  get stars(): number {
    return Object.values(this.progress.levelStats).reduce((sum, s) => sum + s.stars, 0);
  }

  get maxStars(): number {
    return WORLD_IDS.length * LEVELS_PER_WORLD * 3;
  }

  get gameCompleted(): boolean {
    return Boolean(this.progress.levelStats[levelId(5, LEVELS_PER_WORLD)]?.completed);
  }

  reset(): void {
    this.progress = defaultProgress();
    this.checkpoints = {};
    localStorage.removeItem(CHECKPOINTS_KEY);
    this.save();
  }
}

export const save = new SaveManager();
