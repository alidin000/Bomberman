// Test-only: an engine state must hold no bomb or hazard id the match would
// mint again. Ids come from the entityIds counters, so a hand-built one
// numbered past its counter (or two sharing an id) collides with a later one,
// and explodeBombs and the view key them by id. setupTests.ts checks every
// reducer call; withBomb adds a fixture bomb that passes.
import { EntityIdFamily, NO_ENTITY_IDS, mintEntityId } from './entityIds';
import type { GameAction } from './actions';
import { BombState, GameEngineState } from './types';

type Reducer = (state: GameEngineState | null, action: GameAction) => GameEngineState | null;

// 'bomb-', 'hazard-', 'monster-hazard-': what mintEntityId puts before the number.
const PREFIXES = (Object.keys(NO_ENTITY_IDS) as EntityIdFamily[]).map((family) => ({
  family,
  prefix: mintEntityId(NO_ENTITY_IDS, family)[0].slice(0, -1),
}));

/** Why each live bomb or hazard id in `state` could be minted again. */
function reusableEntityIds(state: GameEngineState | null): string[] {
  if (!state) return [];
  const counters = state.entityIds ?? NO_ENTITY_IDS;
  return [state.bombs, state.hazards].flatMap((live) => {
    const seen = new Set<string>();
    return live.flatMap(({ id }) => {
      if (seen.has(id)) return [`${id} is live twice`];
      seen.add(id);
      const match = PREFIXES.find(({ prefix }) => id.startsWith(prefix));
      if (!match) return [];
      const number = Number(id.slice(match.prefix.length));
      return Number.isInteger(number) && number > counters[match.family]
        ? [`${id} is past the ${match.family} counter (${counters[match.family]})`]
        : [];
    });
  });
}

function expectFresh(state: GameEngineState | null): GameEngineState | null {
  const reusable = reusableEntityIds(state);
  if (reusable.length > 0) {
    throw new Error(`State holds ids the match would mint again: ${reusable.join('; ')}. `
      + 'Add fixture bombs with withBomb, or number fixtures with '
      + 'mintEntityId(state.entityIds, family) and keep the counters it returns.');
  }
  return state;
}

/** `state` plus a lit bomb numbered from its counter, as a dropped bomb would be. */
export function withBomb(
  state: GameEngineState,
  bomb: (id: string) => BombState
): GameEngineState {
  const [id, entityIds] = mintEntityId(state.entityIds, 'bomb');
  return { ...state, bombs: [...state.bombs, bomb(id)], entityIds };
}

/** `reducer`, throwing on any state it takes or returns that holds such an id. */
export function checkingEntityIds(reducer: Reducer): Reducer {
  return (state, action) => expectFresh(reducer(expectFresh(state), action));
}
