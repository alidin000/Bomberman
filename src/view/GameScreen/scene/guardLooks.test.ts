import { CAST } from '../../../content/animeCast';
import { STAGE_DEFINITIONS } from '../../../content/stages';
import { StageId } from '../../../content/types';
import { GUARD_CAST } from './guardLooks';

const STAGES = STAGE_DEFINITIONS.map((stage) => stage.id as StageId);

// Figures and fit: cast/castFigures.test.ts.
describe('mini-boss guard looks', () => {
  it('casts each stage\'s guard as that village\'s canon mini-boss', () => {
    expect(Object.keys(GUARD_CAST).sort()).toEqual([...STAGES].sort());
    expect(new Set(Object.values(GUARD_CAST)).size).toBe(STAGES.length);
    expect(CAST[GUARD_CAST.hiddenLeaf].village).toBe('leaf');
    expect(CAST[GUARD_CAST.hiddenSand].village).toBe('sand');
    expect(CAST[GUARD_CAST.hiddenMist].village).toBe('mist');
    expect(CAST[GUARD_CAST.hiddenCloud].village).toBe('cloud');
    expect(CAST[GUARD_CAST.hiddenStone].village).toBe('stone');
    // The hideout and the war front: Akatsuki's Konan and the masked man.
    expect(CAST[GUARD_CAST.akatsukiHideout].look.outfit.style).toBe('akatsukiCloak');
    expect(CAST[GUARD_CAST.greatShinobiWar].look.face).toContain('spiralMask');
  });
});
