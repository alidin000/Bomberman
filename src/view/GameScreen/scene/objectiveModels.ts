import * as THREE from 'three';
import type { CampaignObjectiveStatus } from '../../../engine/types';
import type { HighContrastOverride } from './highContrast';
import {
  HALF_TURN, InkedToken, TokenPart, ball, box, buildInkedToken, cone, cylinder, dome, gem,
  ring, rock, tokenPart as p, tokenToonMaterial,
} from './inkedToken';

/**
 * Campaign objectives as inked models, one shape per job: a villager who
 * waves a lantern under a "!" until reached (then a check mark), a watch
 * pavilion that cracks, burns and falls as its HP drops, a barred gate that
 * opens once its guard is beaten, and a stone circle whose seal lifts when
 * the boss arena unlocks. Every variant is one shared vertex-coloured body
 * plus one ink hull (two draw calls), on the toon program ShaderWarmup
 * compiles, so a state change swaps geometry and never compiles a shader.
 * Coordinates are in cell units with y = 0 on the floor.
 */

const DARK = '#1f2937';
const STONE = '#9ca3af';
const PALE_STONE = '#c4c0b8';
const TIMBER = '#8b5e34';
const PLASTER = '#efe3c8';
const GOLD = '#facc15';
const EMBER = '#f97316';
const SOOT = '#3f3f46';
const SAFE = '#22c55e';
const ALERT = '#f97316';
const DANGER = '#dc2626';
const IRON = '#64748b';

// --- Rescue targets --------------------------------------------------------

export type RescueState = 'waiting' | 'safe';

const ROBE = '#e9dcc0';
const SASH = '#b45309';
const SKIN = '#f2c7a2';
const HAIR = '#3f2a1d';

function villager(): TokenPart[] {
  return [
    p(cone(0.2, 0.5, 8), ROBE, [0, 0.27, 0]),
    p(cylinder(0.1, 0.11, 0.05, 8), SASH, [0, 0.31, 0]),
    p(ball(0.12, 8, 6), SKIN, [0, 0.6, 0]),
    p(dome(0.125, 8), HAIR, [0, 0.615, -0.012], [-0.35, 0, 0]),
    p(ball(0.05, 5, 4), HAIR, [0, 0.72, -0.06]),
    p(box(0.025, 0.025, 0.02), DARK, [-0.04, 0.6, 0.115], undefined, undefined, false),
    p(box(0.025, 0.025, 0.02), DARK, [0.04, 0.6, 0.115], undefined, undefined, false),
  ];
}

const RESCUE_PARTS: Record<RescueState, () => TokenPart[]> = {
  // One arm up with a paper lantern, a floating "!" overhead.
  waiting: () => [
    ...villager(),
    p(box(0.06, 0.26, 0.06), ROBE, [0.14, 0.6, 0.02], [0, 0, -0.45]),
    p(box(0.06, 0.22, 0.06), ROBE, [-0.12, 0.38, 0.03], [0, 0, 0.25]),
    p(cylinder(0.065, 0.065, 0.11, 8), '#fde68a', [0.22, 0.83, 0.02]),
    p(cylinder(0.075, 0.075, 0.02, 8), '#7c2d12', [0.22, 0.895, 0.02]),
    p(cylinder(0.075, 0.075, 0.02, 8), '#7c2d12', [0.22, 0.765, 0.02]),
    p(box(0.07, 0.17, 0.07), ALERT, [0, 1.04, 0]),
    p(box(0.07, 0.07, 0.07), ALERT, [0, 0.89, 0]),
  ],
  // Arms down, lantern lowered, a check mark overhead.
  safe: () => [
    ...villager(),
    p(box(0.06, 0.24, 0.06), ROBE, [0.13, 0.38, 0.03], [0, 0, -0.2]),
    p(box(0.06, 0.24, 0.06), ROBE, [-0.13, 0.38, 0.03], [0, 0, 0.2]),
    p(cylinder(0.055, 0.055, 0.09, 8), '#d6c08a', [0.18, 0.22, 0.08]),
    p(box(0.07, 0.13, 0.07), SAFE, [-0.06, 0.95, 0], [0, 0, 0.7]),
    p(box(0.07, 0.26, 0.07), SAFE, [0.05, 1.0, 0], [0, 0, -0.6]),
  ],
};

// --- Defense structure -----------------------------------------------------

/** How damaged a defended structure is, from its HP (shape, not only colour). */
export type StructureDamage = 'intact' | 'cracked' | 'critical' | 'ruined';
export const STRUCTURE_DAMAGE_STATES: StructureDamage[] = ['intact', 'cracked', 'critical', 'ruined'];

/**
 * Any real hit shows (a Story hit takes 30 of 100, a Normal one 50 to 65),
 * and under this share of its HP one more hit can bring the structure down.
 */
export const STRUCTURE_CRACKED_BELOW = 0.9;
export const STRUCTURE_CRITICAL_AT = 0.45;

/** The damage a structure shows for its HP; a failed defense is a ruin. */
export function structureDamageFor(
  hp: number | undefined,
  maxHp: number | undefined,
  status?: CampaignObjectiveStatus
): StructureDamage {
  if (status === 'failed') return 'ruined';
  const max = maxHp && maxHp > 0 ? maxHp : 100;
  const share = Math.max(0, Math.min(1, (hp ?? max) / max));
  if (share <= 0) return 'ruined';
  if (share <= STRUCTURE_CRITICAL_AT) return 'critical';
  if (share < STRUCTURE_CRACKED_BELOW) return 'cracked';
  return 'intact';
}

/** The pennant: none while locked, a triangle while held, a banner once secured. */
export type StructureFlag = 'none' | 'alert' | 'secured';

export function structureFlagFor(status: CampaignObjectiveStatus): StructureFlag {
  if (status === 'active') return 'alert';
  if (status === 'complete') return 'secured';
  return 'none';
}

const ROOF_TILE = '#3d5a6c';
const RIDGE = '#26394a';
const SMOKE = '#a8a29e';
const DARK_SMOKE = '#57534e';
const FLAME = '#fde047';

function pavilionBody(damage: StructureDamage): TokenPart[] {
  const plinth = p(box(0.8, 0.12, 0.8), STONE, [0, 0.06, 0]);
  const door = p(box(0.16, 0.22, 0.02), DARK, [0, 0.23, 0.295], undefined, undefined, false);
  const windows = [-0.17, 0.17].map((x) => (
    p(box(0.1, 0.05, 0.02), DARK, [x, 0.36, 0.295], undefined, undefined, false)
  ));
  const post = (x: number, z: number, h = 0.36) => (
    p(box(0.07, h, 0.07), TIMBER, [x, 0.12 + h / 2, z])
  );
  switch (damage) {
    case 'intact':
      // Whole walls under a tiled roof with a gold finial.
      return [
        plinth,
        p(box(0.58, 0.34, 0.58), PLASTER, [0, 0.29, 0]),
        post(-0.29, -0.29), post(0.29, -0.29), post(-0.29, 0.29), post(0.29, 0.29),
        p(box(0.64, 0.05, 0.64), TIMBER, [0, 0.47, 0]),
        door, ...windows,
        p(cone(0.54, 0.26, 4), ROOF_TILE, [0, 0.62, 0], [0, Math.PI / 4, 0]),
        p(cone(0.1, 0.07, 4), RIDGE, [0, 0.73, 0], [0, Math.PI / 4, 0]),
        p(cone(0.04, 0.14, 6), GOLD, [0, 0.8, 0]),
      ];
    case 'cracked':
      // A notch out of the top corner, a split post, the roof knocked
      // askew, cracks on the front and grey smoke from the gap.
      return [
        plinth,
        p(box(0.58, 0.24, 0.58), PLASTER, [0, 0.24, 0]),
        p(box(0.38, 0.1, 0.58), PLASTER, [-0.1, 0.41, 0]),
        post(-0.29, -0.29), post(0.29, -0.29), post(-0.29, 0.29),
        p(box(0.07, 0.2, 0.07), TIMBER, [0.3, 0.22, 0.3], [0, 0, 0.25]),
        p(box(0.5, 0.05, 0.64), TIMBER, [-0.07, 0.47, 0], [0, 0, 0.05]),
        door, ...windows,
        p(box(0.022, 0.2, 0.01), DARK, [0.13, 0.28, 0.296], [0, 0, 0.5], undefined, false),
        p(box(0.022, 0.12, 0.01), DARK, [0.05, 0.18, 0.296], [0, 0, -0.4], undefined, false),
        p(cone(0.52, 0.24, 4), ROOF_TILE, [-0.06, 0.6, -0.02], [0, Math.PI / 4, 0.2]),
        p(ball(0.085, 7, 5), SMOKE, [0.24, 0.66, 0.16]),
        p(ball(0.06, 7, 5), SMOKE, [0.3, 0.8, 0.1]),
        p(rock(0.06), PALE_STONE, [0.36, 0.05, 0.3]),
        p(rock(0.045), PLASTER, [0.28, 0.04, 0.4]),
      ];
    case 'critical':
      // Broken walls, a fallen post, the roof slumped in; flames and dark
      // smoke rise out of it.
      return [
        plinth,
        p(box(0.58, 0.18, 0.58), PLASTER, [0, 0.21, 0]),
        p(box(0.28, 0.12, 0.58), PLASTER, [-0.15, 0.36, 0]),
        p(box(0.14, 0.06, 0.3), PLASTER, [0.1, 0.33, -0.14]),
        post(-0.29, -0.29, 0.3), post(0.29, -0.29, 0.24),
        p(box(0.07, 0.07, 0.42), TIMBER, [0.24, 0.15, 0.27], [0, 0.5, 0]),
        p(box(0.3, 0.12, 0.01), SOOT, [0.06, 0.22, 0.296], undefined, undefined, false),
        p(cone(0.44, 0.18, 4), ROOF_TILE, [-0.12, 0.4, -0.1], [0.35, Math.PI / 4, -0.3]),
        p(cone(0.08, 0.26, 5), EMBER, [0.12, 0.43, 0.1]),
        p(cone(0.05, 0.16, 5), FLAME, [0.12, 0.38, 0.15], undefined, undefined, false),
        p(cone(0.065, 0.2, 5), EMBER, [-0.1, 0.5, 0.16]),
        p(ball(0.1, 7, 5), DARK_SMOKE, [0.04, 0.72, -0.02]),
        p(ball(0.07, 7, 5), DARK_SMOKE, [0.12, 0.86, -0.06]),
        p(rock(0.07), PALE_STONE, [0.38, 0.06, 0.18]),
        p(rock(0.055), PLASTER, [-0.36, 0.05, 0.34]),
        p(rock(0.05), ROOF_TILE, [0.1, 0.05, 0.44]),
      ];
    case 'ruined':
    default:
      // A rubble heap on a scorched plinth: nothing left to defend.
      return [
        p(box(0.8, 0.1, 0.8), STONE, [0, 0.05, 0]),
        p(cylinder(0.4, 0.4, 0.012, 10), SOOT, [0, 0.106, 0], undefined, undefined, false),
        p(rock(0.13), PLASTER, [0, 0.16, 0], undefined, [1.4, 0.6, 1.2]),
        p(rock(0.09), PALE_STONE, [-0.2, 0.13, 0.15]),
        p(rock(0.08), ROOF_TILE, [0.18, 0.13, -0.12]),
        p(rock(0.07), PLASTER, [0.22, 0.11, 0.22]),
        p(box(0.07, 0.24, 0.07), TIMBER, [-0.29, 0.22, -0.29], [0, 0, 0.3]),
        p(cone(0.25, 0.12, 4), ROOF_TILE, [0.05, 0.27, 0.1], [0.6, 0.3, 0.9]),
        p(ball(0.07, 7, 5), DARK_SMOKE, [-0.05, 0.42, -0.05]),
      ];
  }
}

function pavilionFlag(flag: StructureFlag): TokenPart[] {
  if (flag === 'none') return [];
  const pole = p(cylinder(0.016, 0.016, 0.62, 5), TIMBER, [-0.34, 0.43, -0.34]);
  if (flag === 'alert') {
    return [
      pole,
      p(cone(0.09, 0.22, 3), ALERT, [-0.235, 0.66, -0.34], [0, 0, -HALF_TURN], [1, 1, 0.3]),
    ];
  }
  return [
    pole,
    p(box(0.2, 0.16, 0.02), SAFE, [-0.235, 0.64, -0.34]),
    p(gem(0.04), GOLD, [-0.34, 0.76, -0.34]),
  ];
}

// --- Mini-boss gate --------------------------------------------------------

/** Locked until its turn, sealed while the guard holds it, open once taken. */
export type GateState = 'locked' | 'sealed' | 'open';

export function gateStateFor(status: CampaignObjectiveStatus): GateState {
  if (status === 'complete') return 'open';
  if (status === 'active') return 'sealed';
  return 'locked';
}

function gateFrame(timber: string): TokenPart[] {
  return [
    p(box(0.11, 0.72, 0.11), timber, [-0.36, 0.36, 0]),
    p(box(0.11, 0.72, 0.11), timber, [0.36, 0.36, 0]),
    p(box(0.96, 0.08, 0.14), timber, [0, 0.74, 0]),
    p(box(1.0, 0.04, 0.18), DARK, [0, 0.8, 0]),
    p(box(0.72, 0.06, 0.08), timber, [0, 0.12, 0]),
  ];
}

const bars = () => [-0.24, -0.12, 0, 0.12, 0.24].map((x) => (
  p(cylinder(0.02, 0.02, 0.58, 5), IRON, [x, 0.43, 0])
));

const GATE_PARTS: Record<GateState, () => TokenPart[]> = {
  // Barred and padlocked, in weathered grey wood.
  locked: () => [
    ...gateFrame('#6b6259'),
    ...bars(),
    p(box(0.14, 0.12, 0.05), IRON, [0, 0.4, 0.04]),
    p(ring(0.04, 0.013, 4, 10), IRON, [0, 0.48, 0.04], undefined, undefined, false),
  ],
  // Barred with a red diamond seal and red lamps: the guard holds it.
  sealed: () => [
    ...gateFrame(TIMBER),
    ...bars(),
    p(box(0.22, 0.22, 0.03), DANGER, [0, 0.42, 0.05], [0, 0, Math.PI / 4]),
    p(box(0.09, 0.09, 0.035), DARK, [0, 0.42, 0.06], [0, 0, Math.PI / 4], undefined, false),
    p(ball(0.055, 8, 6), DANGER, [-0.36, 0.86, 0]),
    p(ball(0.055, 8, 6), DANGER, [0.36, 0.86, 0]),
  ],
  // The bars are gone; green lamps and a hanging green cloth.
  open: () => [
    ...gateFrame(TIMBER),
    p(box(0.34, 0.09, 0.02), SAFE, [0, 0.65, 0.06]),
    p(ball(0.055, 8, 6), SAFE, [-0.36, 0.86, 0]),
    p(ball(0.055, 8, 6), SAFE, [0.36, 0.86, 0]),
  ],
};

// --- Boss arena gate -------------------------------------------------------

export type ArenaState = 'sealed' | 'open';

function standingStones(cap: (x: number, z: number) => TokenPart): TokenPart[] {
  return [0, 1, 2, 3, 4, 5].flatMap((index) => {
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.sin(angle) * 0.42;
    const z = Math.cos(angle) * 0.42;
    return [p(box(0.09, 0.32, 0.09), PALE_STONE, [x, 0.21, z], [0, angle, 0]), cap(x, z)];
  });
}

const ARENA_PARTS: Record<ArenaState, () => TokenPart[]> = {
  // A ring of standing stones round a seal crossed shut.
  sealed: () => [
    p(cylinder(0.5, 0.52, 0.05, 12), '#78716c', [0, 0.025, 0]),
    ...standingStones((x, z) => p(cone(0.07, 0.08, 4), '#57534e', [x, 0.41, z])),
    p(cylinder(0.24, 0.24, 0.04, 12), '#e7e5e4', [0, 0.07, 0]),
    p(box(0.42, 0.04, 0.07), DARK, [0, 0.105, 0], [0, Math.PI / 4, 0]),
    p(box(0.42, 0.04, 0.07), DARK, [0, 0.105, 0], [0, -Math.PI / 4, 0]),
  ],
  // The cross is gone: a glowing ring round a dark opening, lit stones.
  open: () => [
    p(cylinder(0.5, 0.52, 0.05, 12), '#78716c', [0, 0.025, 0]),
    ...standingStones((x, z) => p(gem(0.065), '#fb923c', [x, 0.43, z])),
    p(cylinder(0.18, 0.18, 0.02, 12), '#431407', [0, 0.06, 0], undefined, undefined, false),
    p(ring(0.23, 0.04, 5, 18), '#fb923c', [0, 0.085, 0], [HALF_TURN, 0, 0]),
  ],
};

// --- Shared models ---------------------------------------------------------

export type ObjectiveModel = InkedToken & { material: THREE.MeshToonMaterial };

const MODELS = new Map<string, ObjectiveModel>();

function model(key: string, parts: () => TokenPart[]): ObjectiveModel {
  let found = MODELS.get(key);
  if (!found) {
    found = { ...buildInkedToken(parts()), material: tokenToonMaterial() };
    MODELS.set(key, found);
  }
  return found;
}

export function rescueModel(state: RescueState): ObjectiveModel {
  return model(`rescue:${state}`, RESCUE_PARTS[state]);
}

export function structureModel(damage: StructureDamage, flag: StructureFlag): ObjectiveModel {
  // A ruin flies no pennant.
  const shown = damage === 'ruined' ? 'none' : flag;
  return model(`structure:${damage}:${shown}`, () => [...pavilionBody(damage), ...pavilionFlag(shown)]);
}

export function gateModel(state: GateState): ObjectiveModel {
  return model(`gate:${state}`, GATE_PARTS[state]);
}

export function arenaModel(state: ArenaState): ObjectiveModel {
  return model(`arena:${state}`, ARENA_PARTS[state]);
}

/** Every variant, so tests (and a curious reader) can walk them all. */
export function allObjectiveModels(): Record<string, ObjectiveModel> {
  const all: Record<string, ObjectiveModel> = {};
  (['waiting', 'safe'] as RescueState[]).forEach((state) => {
    all[`rescue:${state}`] = rescueModel(state);
  });
  STRUCTURE_DAMAGE_STATES.forEach((damage) => (['none', 'alert', 'secured'] as StructureFlag[])
    .forEach((flag) => { all[`structure:${damage}:${flag}`] = structureModel(damage, flag); }));
  (['locked', 'sealed', 'open'] as GateState[]).forEach((state) => {
    all[`gate:${state}`] = gateModel(state);
  });
  (['sealed', 'open'] as ArenaState[]).forEach((state) => {
    all[`arena:${state}`] = arenaModel(state);
  });
  return all;
}

// --- Floor rings -------------------------------------------------------------

export const OBJECTIVE_RING_GEOMETRY = new THREE.RingGeometry(0.3, 0.52, 28).rotateX(-Math.PI / 2);
export const ARENA_RING_GEOMETRY = new THREE.RingGeometry(0.54, 0.7, 36).rotateX(-Math.PI / 2);

export type RingTone = 'waiting' | 'safe' | 'locked' | 'alert' | 'danger';

const RING_COLORS: Record<RingTone, string> = {
  waiting: ALERT,
  safe: SAFE,
  locked: '#94a3b8',
  alert: GOLD,
  danger: DANGER,
};

export const OBJECTIVE_RING_MATERIALS = Object.fromEntries(
  (Object.keys(RING_COLORS) as RingTone[]).map((tone) => [tone, new THREE.MeshBasicMaterial({
    color: RING_COLORS[tone], transparent: true, opacity: 0.55, depthWrite: false,
  })])
) as Record<RingTone, THREE.MeshBasicMaterial>;

export const OBJECTIVE_HIGH_CONTRAST: readonly HighContrastOverride[] = (
  Object.values(OBJECTIVE_RING_MATERIALS).map((material) => ({ material, opacity: 0.9 }))
);

// --- Idle motion -------------------------------------------------------------

export type ObjectivePose = { lift: number; yaw: number };

/**
 * A waiting villager shuffles and turns a little; an open arena seal turns
 * slowly. Everything else stands still, and reduced motion holds every
 * objective still. Writes into `out` (no allocation per frame).
 */
export function sampleObjectiveIdle(
  motion: 'villager' | 'arena' | 'none',
  seconds: number,
  phase: number,
  reducedMotion: boolean,
  out: ObjectivePose
): ObjectivePose {
  const pose = out;
  pose.lift = 0;
  pose.yaw = 0;
  if (reducedMotion || motion === 'none') return pose;
  if (motion === 'villager') {
    pose.lift = Math.abs(Math.sin(seconds * 3.2 + phase)) * 0.03;
    pose.yaw = Math.sin(seconds * 1.3 + phase) * 0.22;
  } else {
    pose.yaw = (seconds * 0.35) % (Math.PI * 2);
  }
  return pose;
}
