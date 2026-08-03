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

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.progress = { ...defaultProgress(), ...(JSON.parse(raw) as Progress) };
    } catch {
      this.progress = defaultProgress();
    }
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) this.settings = { ...defaultSettings, ...(JSON.parse(raw) as Settings) };
    } catch {
      this.settings = defaultSettings;
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
    this.save();
  }
}

export const save = new SaveManager();
