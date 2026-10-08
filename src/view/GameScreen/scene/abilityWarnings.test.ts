import { readFileSync } from 'node:fs';
import { gameReducer } from '../../../engine/reducer';
import { createInitialState } from '../../../engine/initialState';
import { parseMapRows } from '../../../engine/mapLoader';
import { createShinobiEnemy } from '../../../engine/campaignEnemies';
import { cellKey } from '../../../engine/fogOfWar';
import { GameEngineState } from '../../../engine/types';
import { getVisibleAbilityWarnings } from './abilityWarnings';

function hiddenLeafMission(): GameEngineState {
  const map = parseMapRows(readFileSync('public/maps/hiddenLeaf.txt', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split('')));
  return {
    ...createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map,
      // Only Hard lets an enemy hidden in the fog start an ambush.
      difficulty: 'hard',
    }),
    roundStartTicksRemaining: 0,
  };
}

describe('ability warning markers', () => {
  it('shows a fogged Zetsu ambush warning on the tile it threatens', () => {
    const zetsu = createShinobiEnemy({
      archetype: 'whiteZetsu', x: 5, y: 1, id: 'zetsu',
    });
    let state: GameEngineState = {
      ...hiddenLeafMission(),
      monsters: [{ ...zetsu, abilityCooldown: 0, moveCooldown: 60000 }],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;
    const visible = new Set(state.fogOfWar.visible);
    const player = state.players[0];

    // The attacker stands in fog and a melee ambush leaves no hazard ring.
    expect(visible.has(cellKey(5, 1))).toBe(false);
    expect(state.hazards).toHaveLength(0);
    expect(state.monsters[0].abilityTarget).toEqual({ x: player.x, y: player.y });
    expect(getVisibleAbilityWarnings(state.monsters, visible).map((monster) => monster.id))
      .toEqual(['zetsu']);
  });

  it('skips enemies that are not warning or aim at unseen tiles', () => {
    const idle = createShinobiEnemy({
      archetype: 'whiteZetsu', x: 2, y: 2, id: 'idle',
    });
    const aimingAway = {
      ...createShinobiEnemy({
        archetype: 'whiteZetsu', x: 2, y: 2, id: 'away',
      }),
      abilityWarningTicks: 400,
      abilityTarget: { x: 9, y: 9 },
    };

    expect(getVisibleAbilityWarnings([idle, aimingAway], new Set([cellKey(2, 2)])))
      .toEqual([]);
  });
});
