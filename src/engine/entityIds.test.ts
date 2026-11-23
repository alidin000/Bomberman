import { NO_ENTITY_IDS, mintEntityId } from './entityIds';

describe('entity id minting', () => {
  it('mintEntityId is pure and per family', () => {
    const [firstBomb, afterBomb] = mintEntityId(undefined, 'bomb');
    expect(firstBomb).toBe('bomb-1');
    expect(afterBomb).toEqual({ bomb: 1, bossHazard: 0, monsterHazard: 0 });

    const [secondBomb, afterSecond] = mintEntityId(afterBomb, 'bomb');
    const [bossHazard, afterBoss] = mintEntityId(afterSecond, 'bossHazard');
    const [enemyHazard, afterEnemy] = mintEntityId(afterBoss, 'monsterHazard');
    expect([secondBomb, bossHazard, enemyHazard])
      .toEqual(['bomb-2', 'hazard-1', 'monster-hazard-1']);
    expect(afterEnemy).toEqual({ bomb: 2, bossHazard: 1, monsterHazard: 1 });

    // The counters it was given never change: the same input mints the same id.
    expect(afterBomb).toEqual({ bomb: 1, bossHazard: 0, monsterHazard: 0 });
    expect(mintEntityId(afterBomb, 'bomb')[0]).toBe('bomb-2');
    expect(NO_ENTITY_IDS).toEqual({ bomb: 0, bossHazard: 0, monsterHazard: 0 });
    expect(mintEntityId(NO_ENTITY_IDS, 'monsterHazard')[0]).toBe('monster-hazard-1');
  });
});
