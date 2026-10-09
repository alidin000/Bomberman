import {
  CampaignLoadout,
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
    timedPowerUps = { ...timedPowerUps };
    players.forEach((player) => {
      timedPowerUps[player.id] = [
        ...(timedPowerUps[player.id] ?? []).filter((timed) => timed.power !== 'Invincibility'),
        {
          power: 'Invincibility',
          ticksRemaining: effects.startingGuardMs,
          // Worn from the start, not picked up: no pickup flash.
          flashTicksRemaining: 0,
        },
      ];
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
