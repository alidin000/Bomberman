import { GameEngineState, MonsterState } from '../engine/types';
import {
  ENEMY_GLIDE_MS,
  createMotionStore,
  monsterMotionId,
  recordTickMotion,
  samplePosition,
} from './motionStore';

function withMonsters(monsters: Pick<MonsterState, 'id' | 'x' | 'y'>[]): GameEngineState {
  return { players: [], monsters, boss: null } as unknown as GameEngineState;
}

describe('motion store: removed monsters', () => {
  it('keeps drawing a monster killed mid-glide where it was, not at its last cell', () => {
    const store = createMotionStore();
    const standing = withMonsters([{ id: 'm1', x: 5, y: 5 }]);
    const stepped = withMonsters([{ id: 'm1', x: 6, y: 5 }]);
    recordTickMotion(store, standing, stepped, 0, 50);
    store.simTimeMs = ENEMY_GLIDE_MS / 2;
    const drawn = samplePosition(store, monsterMotionId('m1'), 6, 5);
    expect(drawn.x).toBeCloseTo(5.5, 5);

    // Killed this tick. Its mesh still holds the last simulated cell (6, 5)
    // until React unmounts it, so the store must not fall back to that.
    recordTickMotion(store, stepped, withMonsters([]), store.simTimeMs, 50);
    store.simTimeMs += 16;
    expect(samplePosition(store, monsterMotionId('m1'), 6, 5)).toEqual(drawn);
  });

  it('draws a later spawn that reuses the id at its own cell', () => {
    const store = createMotionStore();
    const standing = withMonsters([{ id: 'm1', x: 5, y: 5 }]);
    const stepped = withMonsters([{ id: 'm1', x: 6, y: 5 }]);
    recordTickMotion(store, standing, stepped, 0, 50);
    store.simTimeMs = 100;
    recordTickMotion(store, stepped, withMonsters([]), 100, 50);
    recordTickMotion(store, withMonsters([]), withMonsters([{ id: 'm1', x: 20, y: 9 }]), 150, 50);
    store.simTimeMs = 160;
    expect(samplePosition(store, monsterMotionId('m1'), 20, 9)).toEqual({ x: 20, y: 9 });
  });
});
