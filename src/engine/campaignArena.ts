import { GameEngineState } from './types';

/**
 * A boss arena walled into the stage map keeps its gate cells as walls until
 * the mini boss gate is cleared. Then the gates open (once per attempt: a
 * restart rebuilds the map from the stage with them shut again).
 */
export function openBossArenaGates(state: GameEngineState): GameEngineState {
  const arena = state.campaign?.bossArena;
  if (!arena?.unlocked || !arena.gates?.length) return state;
  if (arena.gates.every((gate) => state.map[gate.y]?.[gate.x] !== 'Wall')) return state;
  const map = state.map.map((row, y) => (
    arena.gates?.some((gate) => gate.y === y) ? [...row] : row
  ));
  arena.gates.forEach((gate) => {
    if (map[gate.y]?.[gate.x] === 'Wall') map[gate.y][gate.x] = 'Empty';
  });
  return { ...state, map };
}
