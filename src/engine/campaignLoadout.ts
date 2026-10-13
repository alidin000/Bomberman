import {
  CampaignLoadout,
  HubConsumableId,
  REGROUP_DRILL_MS_PER_RANK,
  STARTING_GUARD_MS,
  clampUpgradeRank,
  normalizePack,
} from '../content/hubShop';
import { GameConfig, GameEngineState } from './types';

/**
 * What a campaign loadout (hub consumables and upgrade ranks) does in the
 * match. Everything comes from `config.loadout`, so the same INIT always
 * builds the same state: there is no other store of these effects.
 */
export interface LoadoutEffects {
  bonusBombs: number;
  bonusRange: number;
  startingGuardMs: number;
  extraLives: number;
  // Pickups in the four cells beside a moving ninja are collected too.
  magnet: boolean;
  visionBonus: number;
  regroupGraceBonusMs: number;
}

export const NO_LOADOUT_EFFECTS: LoadoutEffects = Object.freeze({
  bonusBombs: 0,
  bonusRange: 0,
  startingGuardMs: 0,
  extraLives: 0,
  magnet: false,
  visionBonus: 0,
  regroupGraceBonusMs: 0,
});

// Pure memo: the same loadout object always resolves to the same effects.
const effectsCache = new WeakMap<CampaignLoadout, LoadoutEffects>();

function resolveLoadout(loadout: CampaignLoadout): LoadoutEffects {
  const upgrades = loadout.upgrades ?? {};
  // Caps hold here too: a hand-edited save or config cannot exceed them.
  const pack = normalizePack(loadout.consumables, upgrades);
  return {
    bonusBombs: pack.includes('fusePouch') ? 1 : 0,
    bonusRange: pack.includes('blastPowder') ? 1 : 0,
    startingGuardMs: pack.includes('paperWard') ? STARTING_GUARD_MS : 0,
    extraLives: pack.includes('secondWind') ? 1 : 0,
    magnet: pack.includes('lodestone'),
    visionBonus: clampUpgradeRank('lanternOil', upgrades.lanternOil),
    regroupGraceBonusMs: clampUpgradeRank('regroupDrill', upgrades.regroupDrill)
      * REGROUP_DRILL_MS_PER_RANK,
  };
}

/** Loadouts only exist in the solo campaign; versus never reads them. */
export function getLoadoutEffects(config: Pick<GameConfig, 'mode' | 'loadout'>): LoadoutEffects {
  const { loadout } = config;
  if (config.mode !== 'solo' || !loadout || typeof loadout !== 'object') {
    return NO_LOADOUT_EFFECTS;
  }
  let effects = effectsCache.get(loadout);
  if (!effects) {
    effects = resolveLoadout(loadout);
    effectsCache.set(loadout, effects);
  }
  return effects;
}

// A Paper Ward's Guard: a timed Guard worn, not picked up (no pickup flash).
function withGuard(
  timedPowerUps: GameEngineState['timedPowerUps'],
  playerId: string,
  ms: number
): GameEngineState['timedPowerUps'] {
  return {
    ...timedPowerUps,
    [playerId]: [
      ...(timedPowerUps[playerId] ?? []).filter((timed) => timed.power !== 'Invincibility'),
      { power: 'Invincibility', ticksRemaining: ms, flashTicksRemaining: 0 },
    ],
  };
}

/**
 * Applies the loadout to a freshly built match: bomb slots, blast range, the
 * starting guard (a timed Guard that only counts down once the round is
 * live) and the mission's lives.
 */
export function applyLoadoutAtInit(state: GameEngineState): GameEngineState {
  const effects = getLoadoutEffects(state.config);
  if (effects === NO_LOADOUT_EFFECTS) return state;
  const players = state.players.map((player) => {
    const guarded = effects.startingGuardMs > 0 && !player.powerUps.includes('Invincibility');
    return {
      ...player,
      maxBombs: player.maxBombs + effects.bonusBombs,
      bombRange: player.bombRange + effects.bonusRange,
      powerUps: guarded ? [...player.powerUps, 'Invincibility' as const] : player.powerUps,
    };
  });
  let { timedPowerUps } = state;
  if (effects.startingGuardMs > 0) {
    players.forEach((player) => {
      timedPowerUps = withGuard(timedPowerUps, player.id, effects.startingGuardMs);
    });
  }
  const campaign = state.campaign && effects.extraLives > 0
    ? {
      ...state.campaign,
      livesRemaining: (state.campaign.livesRemaining ?? 1) + effects.extraLives,
      livesTotal: (state.campaign.livesTotal ?? 1) + effects.extraLives,
    }
    : state.campaign;
  return {
    ...state,
    players,
    timedPowerUps,
    campaign,
  };
}

/**
 * Consumables last one mission attempt: a retry or restart builds the next
 * attempt from the same config without them. Upgrades are permanent and stay.
 */
export function withoutConsumables(config: GameConfig): GameConfig {
  if (!config.loadout?.consumables || config.loadout.consumables.length === 0) return config;
  return { ...config, loadout: { ...config.loadout, consumables: [] } };
}

/** The Lodestone Charm pulls pickups in: packed in the hub or bought at the stall. */
export function hasLodestone(state: Pick<GameEngineState, 'config' | 'campaign'>): boolean {
  return getLoadoutEffects(state.config).magnet
    || !!state.campaign?.village?.purchases.includes('lodestone');
}

/**
 * A consumable bought at the village square's stall, applied at once with
 * the same effects as packing it: Paper Ward a Guard from now, Blast Powder
 * +1 range, Fuse Pouch +1 bomb slot, Second Wind +1 life; the Lodestone works
 * from the purchase record (hasLodestone). Null when it cannot take effect:
 * a Guard is refused while Ghost is worn, like a Guard pickup.
 */
export function applyStallConsumable(
  state: GameEngineState,
  playerId: string,
  id: HubConsumableId
): GameEngineState | null {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return null;
  const update = (change: Partial<typeof player>) => state.players.map((item) => (
    item.id === playerId ? { ...item, ...change } : item
  ));
  switch (id) {
    case 'fusePouch':
      return { ...state, players: update({ maxBombs: player.maxBombs + 1 }) };
    case 'blastPowder':
      return { ...state, players: update({ bombRange: player.bombRange + 1 }) };
    case 'paperWard': {
      const ghost = player.powerUps.includes('Ghost')
        || (state.timedPowerUps[playerId] ?? []).some((timed) => timed.power === 'Ghost');
      if (ghost) return null;
      return {
        ...state,
        players: update({
          powerUps: [...player.powerUps.filter((power) => power !== 'Invincibility'), 'Invincibility'],
        }),
        timedPowerUps: withGuard(state.timedPowerUps, playerId, STARTING_GUARD_MS),
      };
    }
    case 'secondWind':
      return state.campaign
        ? {
          ...state,
          campaign: {
            ...state.campaign,
            livesRemaining: (state.campaign.livesRemaining ?? 1) + 1,
            livesTotal: (state.campaign.livesTotal ?? 1) + 1,
          },
        }
        : null;
    case 'lodestone':
      return state;
    default:
      return null;
  }
}
