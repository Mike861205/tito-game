import type { EnemyKind } from '@tito/shared';

export type BossTier = 'mid' | 'final';
export type BossMovement = 'leap' | 'hover' | 'charge' | 'stomp';
export type BossAttackKind = 'thorn' | 'sand' | 'ice' | 'shock' | 'magma';

export interface BossProfile {
  id: string;
  name: string;
  title: string;
  world: number;
  tier: BossTier;
  texture: string;
  movement: BossMovement;
  attack: BossAttackKind;
  summon: Exclude<EnemyKind, 'boss'>;
  maxHp: number;
  score: number;
  speed: number;
  patrolRange: number;
  width: number;
  height: number;
  accent: number;
}

const profiles: readonly BossProfile[] = [
  { id: 'guardian-esmeralda', name: 'Coloso Esmeralda', title: 'Guardián de las raíces', world: 1, tier: 'mid', texture: 'boss-w1-mid', movement: 'stomp', attack: 'thorn', summon: 'goomb', maxHp: 9, score: 4200, speed: 74, patrolRange: 210, width: 116, height: 124, accent: 0x63e68b },
  { id: 'rey-bellota', name: 'Rey Bellota', title: 'Soberano de la pradera', world: 1, tier: 'final', texture: 'boss-w1-final', movement: 'leap', attack: 'thorn', summon: 'flyer', maxHp: 15, score: 7200, speed: 92, patrolRange: 250, width: 130, height: 142, accent: 0xb7f36b },
  { id: 'escorpion-cristal', name: 'Escorpión de Cristal', title: 'Cazador de las dunas', world: 2, tier: 'mid', texture: 'boss-w2-mid', movement: 'charge', attack: 'sand', summon: 'spiker', maxHp: 10, score: 4600, speed: 104, patrolRange: 240, width: 138, height: 112, accent: 0xffc857 },
  { id: 'djinn-antiguo', name: 'Djinn Antiguo', title: 'Señor de la tormenta', world: 2, tier: 'final', texture: 'boss-w2-final', movement: 'hover', attack: 'sand', summon: 'slider', maxHp: 16, score: 7600, speed: 96, patrolRange: 270, width: 126, height: 150, accent: 0xffba49 },
  { id: 'bestia-glacial', name: 'Bestia Glacial', title: 'Guardián del hielo', world: 3, tier: 'mid', texture: 'boss-w3-mid', movement: 'leap', attack: 'ice', summon: 'flyer', maxHp: 11, score: 5000, speed: 86, patrolRange: 220, width: 128, height: 128, accent: 0x7fe9ff },
  { id: 'dragon-boreal', name: 'Dragón Boreal', title: 'Aliento del invierno', world: 3, tier: 'final', texture: 'boss-w3-final', movement: 'hover', attack: 'ice', summon: 'spiker', maxHp: 17, score: 8000, speed: 108, patrolRange: 290, width: 148, height: 142, accent: 0x8be8ff },
  { id: 'magnetron', name: 'Magnetrón', title: 'Núcleo de alto voltaje', world: 4, tier: 'mid', texture: 'boss-w4-mid', movement: 'charge', attack: 'shock', summon: 'slider', maxHp: 12, score: 5400, speed: 112, patrolRange: 250, width: 124, height: 132, accent: 0x58d9ff },
  { id: 'mecha-tuerca', name: 'Mecha-Tuerca X', title: 'Máquina de destrucción', world: 4, tier: 'final', texture: 'boss-w4-final', movement: 'stomp', attack: 'shock', summon: 'ghost', maxHp: 18, score: 8500, speed: 98, patrolRange: 270, width: 136, height: 150, accent: 0xff6b57 },
  { id: 'salamandra-obsidiana', name: 'Salamandra Obsidiana', title: 'Titán de las brasas', world: 5, tier: 'mid', texture: 'boss-w5-mid', movement: 'leap', attack: 'magma', summon: 'ghost', maxHp: 13, score: 6000, speed: 104, patrolRange: 260, width: 142, height: 124, accent: 0xff7043 },
  { id: 'lord-magma', name: 'Lord Magma', title: 'Emperador del volcán', world: 5, tier: 'final', texture: 'boss-w5-final', movement: 'hover', attack: 'magma', summon: 'spiker', maxHp: 20, score: 10000, speed: 116, patrolRange: 310, width: 150, height: 154, accent: 0xff5722 },
];

export const BOSS_PROFILES = profiles;

export function getBossProfile(world: number, tier: BossTier): BossProfile {
  const profile = profiles.find((candidate) => candidate.world === world && candidate.tier === tier);
  if (!profile) throw new Error(`Jefe inexistente para mundo ${world} (${tier})`);
  return profile;
}
