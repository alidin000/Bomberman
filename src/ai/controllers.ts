import type { GameConfig, PlayerSlotController } from '../engine/types';

export type CpuLevelId = 'easy' | 'normal' | 'hard';

export const SLOT_CONTROLLERS: readonly PlayerSlotController[] = [
  'human',
  'cpu-easy',
  'cpu-normal',
  'cpu-hard',
];

const CPU_LEVEL_IDS: Partial<Record<PlayerSlotController, CpuLevelId>> = {
  'cpu-easy': 'easy',
  'cpu-normal': 'normal',
  'cpu-hard': 'hard',
};

const CONTROLLER_LABELS: Record<PlayerSlotController, string> = {
  human: 'Human',
  'cpu-easy': 'CPU Easy',
  'cpu-normal': 'CPU Normal',
  'cpu-hard': 'CPU Hard',
};

type ControllerConfig = Pick<GameConfig, 'mode' | 'controllers'> | null | undefined;

/** Who plays a slot. The campaign, and any slot a config leaves out, is human. */
export function getSlotController(config: ControllerConfig, slot: number): PlayerSlotController {
  if (!config || config.mode === 'solo') return 'human';
  return config.controllers?.[slot] ?? 'human';
}

export function isCpuSlot(config: ControllerConfig, slot: number): boolean {
  return getSlotController(config, slot) !== 'human';
}

export function getCpuLevelId(controller: PlayerSlotController | undefined): CpuLevelId | null {
  return (controller && CPU_LEVEL_IDS[controller]) ?? null;
}

export function getControllerLabel(controller: PlayerSlotController): string {
  return CONTROLLER_LABELS[controller];
}

/**
 * Validates stored per-slot controllers for `count` players: unknown entries
 * become human, and at least one slot always stays human. Returns undefined
 * when every slot is human, so all-human setups store and replay as before.
 */
export function normalizeControllers(
  value: unknown,
  count: number
): PlayerSlotController[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const controllers = Array.from({ length: count }, (_, slot): PlayerSlotController => (
    SLOT_CONTROLLERS.includes(value[slot]) ? value[slot] : 'human'
  ));
  if (controllers.every((controller) => controller !== 'human')) controllers[0] = 'human';
  return controllers.some((controller) => controller !== 'human') ? controllers : undefined;
}
