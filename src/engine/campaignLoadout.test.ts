import { readFileSync } from 'node:fs';
import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { isPowerUpActive } from './players';
import { cellKey } from './fogOfWar';
import { REGROUP_GRACE_MS } from './campaignLives';
import { GameConfig, GameEngineState } from './types';
import { StageId } from '../content/types';
import type { CampaignLoadout } from '../content/hubShop';
import { INVINCIBILITY_POWER_MS } from './constants';
import { DifficultyId } from './difficulty';

function stageMap(stageId: StageId) {
  return parseMapRows(readFileSync(`public/maps/${stageId}.txt`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split('')));
}

function soloConfig(
  loadout?: CampaignLoadout,
  difficulty: DifficultyId = 'hard',
  stageId: StageId = 'hiddenLeaf'
): GameConfig {
  return {
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: stageId,
    stageId,
    selectedCharacters: ['deidara'],
    map: stageMap(stageId),
    difficulty,
    seed: 4242,
    ...(loadout ? { loadout } : {}),
  };
}

function tick(state: GameEngineState, deltaMs = 50): GameEngineState {
  return gameReducer(state, { type: 'TICK', deltaMs })!;
}

function live(state: GameEngineState): GameEngineState {
  return { ...state, roundStartTicksRemaining: 0, monsters: [] };
}

function kill(state: GameEngineState): GameEngineState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player, alive: false, deathReason: 'Deidara was caught by ANBU.',
    })),
  };
}

const FULL_PACK: CampaignLoadout = {
  consumables: ['paperWard', 'blastPowder', 'secondWind'],
  upgrades: { satchelStrap: 2, regroupDrill: 2, lanternOil: 1 },
};

describe('campaign loadout from the village hub', () => {
  it('applies packed consumables at INIT from the config alone', () => {
    const base = gameReducer(null, { type: 'INIT', config: soloConfig() })!;
    const packed = gameReducer(null, { type: 'INIT', config: soloConfig(FULL_PACK) })!;
    const [ninja] = packed.players;

    expect(ninja.bombRange).toBe(base.players[0].bombRange + 1);
    expect(ninja.maxBombs).toBe(base.players[0].maxBombs);
    // Hard is one life; the Second Wind Knot makes it two for this mission.
    expect(base.campaign!.livesRemaining).toBe(1);
    expect(packed.campaign!.livesRemaining).toBe(2);
    expect(packed.campaign!.livesTotal).toBe(2);
    // The Paper Ward is a 15 s Guard that waits out the 3-2-1 countdown.
    expect(isPowerUpActive(packed, 'player1', 'Invincibility')).toBe(true);
    let state = packed;
    for (let ms = 0; ms < 3000; ms += 50) state = tick(state);
    expect(state.timedPowerUps.player1[0].ticksRemaining).toBe(INVINCIBILITY_POWER_MS);
    for (let ms = 0; ms < INVINCIBILITY_POWER_MS; ms += 50) {
      state = { ...tick(state), monsters: [] };
    }
    expect(isPowerUpActive(state, 'player1', 'Invincibility')).toBe(false);
  });

  it('spends consumables on one attempt: a retry or restart starts without them', () => {
    const packed = live(gameReducer(null, { type: 'INIT', config: soloConfig(FULL_PACK) })!);
    // Two falls end the two-life mission.
    const failed = tick(kill(tick(kill(packed))));
    expect(failed.phase).toBe('game_over');

    const retry = gameReducer(failed, { type: 'DISMISS_DIALOG' })!;
    const restart = gameReducer(packed, { type: 'RESTART' })!;
    [retry, restart].forEach((attempt) => {
      expect(attempt.config.loadout?.consumables).toEqual([]);
      expect(attempt.campaign!.livesRemaining).toBe(1);
      expect(attempt.players[0].bombRange).toBe(3);
      expect(isPowerUpActive(attempt, 'player1', 'Invincibility')).toBe(false);
      // Upgrades are permanent: they stay for the next attempt.
      expect(attempt.config.loadout?.upgrades).toEqual(FULL_PACK.upgrades);
    });
  });

  it('builds the exact base match with no purchases, and versus ignores loadouts', () => {
    const plain = createInitialState(soloConfig());
    const empty = createInitialState(soloConfig({ consumables: [], upgrades: {} }));
    // Only the config's own loadout field differs.
    expect({ ...empty, config: plain.config }).toEqual(plain);

    const versus = (loadout?: CampaignLoadout) => createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      map: stageMap('hiddenLeaf'),
      selectedCharacters: ['deidara', 'naruto'],
      seed: 7,
      ...(loadout ? { loadout } : {}),
    });
    expect(versus(FULL_PACK).players).toEqual(versus().players);
    expect(versus(FULL_PACK).timedPowerUps).toEqual({});
  });

  it('holds the caps even for a hand-edited config', () => {
    const state = createInitialState(soloConfig({
      // Five items with no Satchel Strap: only the first fits the pack.
      consumables: ['fusePouch', 'blastPowder', 'secondWind', 'paperWard', 'fusePouch'],
      upgrades: { lanternOil: 9, regroupDrill: -3 },
    }));
    const base = createInitialState(soloConfig());
    expect(state.players[0].maxBombs).toBe(base.players[0].maxBombs + 1);
    expect(state.players[0].bombRange).toBe(base.players[0].bombRange);
    expect(state.campaign!.livesRemaining).toBe(1);
    // Lantern Oil caps at one rank: one more cell of sight, not nine.
    const reach = (fog: GameEngineState) => Math.max(...fog.fogOfWar.visible
      .map((key) => Number(key.split(',')[0])));
    expect(reach(state)).toBe(reach(base) + 1);
  });

  it('lets the Lodestone Charm collect pickups beside a moving ninja', () => {
    const rows = [
      'WWWWWWW',
      'W     W',
      'W     W',
      'W     W',
      'WWWWWWW',
    ];
    const map = parseMapRows(rows.map((row) => row.split('')));
    const withPickup = (loadout?: CampaignLoadout): GameEngineState => {
      const state = live(createInitialState({
        ...soloConfig(loadout), map, selectedMap: 'magnet-room', stageId: 'hiddenLeaf',
      }));
      const next = state.map.map((row) => [...row]);
      next[2][3] = 'BlastRangeUp';
      return {
        ...state, map: next, campaign: null, boss: null,
      };
    };
    const step = (state: GameEngineState) => {
      let moved = state;
      for (let i = 0; i < 25; i += 1) {
        moved = gameReducer(moved, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
      }
      return moved;
    };

    // Walking along row 1 passes the pickup on row 2 without touching it.
    const plain = step(withPickup());
    expect(plain.map[2][3]).toBe('BlastRangeUp');
    const pulled = step(withPickup({ consumables: ['lodestone'] }));
    expect(pulled.map[2][3]).toBe('Empty');
    expect(pulled.players[0].bombRange).toBe(plain.players[0].bombRange + 1);
  });

  it('gives a longer guard after a fall with Regroup Drill', () => {
    const regroup = (loadout?: CampaignLoadout) => {
      const state = live(createInitialState(soloConfig(loadout, 'normal')));
      return tick(kill(state)).players[0].survivalGraceMs;
    };
    expect(regroup()).toBe(REGROUP_GRACE_MS);
    expect(regroup({ upgrades: { regroupDrill: 2 } })).toBe(REGROUP_GRACE_MS + 1500);
  });

  it('extends sight through the fog with Lantern Oil', () => {
    const sees = (loadout?: CampaignLoadout) => createInitialState(
      soloConfig(loadout, 'normal')
    ).fogOfWar.visible;
    // Deidara sees three cells; the oil shows the fourth.
    expect(sees()).not.toContain(cellKey(5, 1));
    expect(sees({ upgrades: { lanternOil: 1 } })).toContain(cellKey(5, 1));
  });
});
