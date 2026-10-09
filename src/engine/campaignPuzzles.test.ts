import { gameReducer } from './reducer';
import {
  advancePuzzle, describePuzzleProgress, toggleSolution,
} from './campaignPuzzles';
import {
  bombCells,
  calm,
  campaignState,
  piece,
  puzzleObjective,
  reachPuzzle,
  setPlayer,
  solvePuzzle,
  stageMap,
  stepOnto,
  tick,
  walkOnto,
} from './campaignPuzzles.testutil';
import { CAMPAIGN_PUZZLE_LAYOUTS, getCampaignMission, getCampaignPuzzle } from '../content/campaignMissions';
import { STAGE_DEFINITIONS } from '../content';
import { CharacterId, StageId } from '../content/types';
import { PLAYER_SPAWNS } from './constants';
import { CampaignPuzzleState, GameEngineState, Point } from './types';

const STAGES = STAGE_DEFINITIONS.map((stage) => stage.id);

function miniBossOf(state: GameEngineState) {
  return state.campaign!.objectives.find((objective) => objective.kind === 'miniBoss')!;
}

function kill(state: GameEngineState): GameEngineState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player, alive: false, deathReason: 'Naruto was caught by a patrol.',
    })),
  };
}

function waitTicks(state: GameEngineState, ms: number): GameEngineState {
  let next = state;
  for (let elapsed = 0; elapsed < ms; elapsed += 50) next = calm(tick(next));
  return next;
}

function cellOf(point: Point): string {
  return `${point.x},${point.y}`;
}

describe('route puzzle content', () => {
  it('puts one distinct puzzle between the defense and the mini boss gate in every village', () => {
    const kinds = new Set<string>();
    const names = new Set<string>();
    STAGES.forEach((stageId) => {
      const mission = getCampaignMission(stageId)!;
      const [rescue, defense, puzzle, miniBoss] = mission.objectives;
      expect([rescue.kind, defense.kind, puzzle.kind, miniBoss.kind])
        .toEqual(['rescue', 'defense', 'puzzle', 'miniBoss']);
      expect(puzzle.requires).toEqual([defense.id]);
      expect(miniBoss.requires).toEqual([puzzle.id]);
      kinds.add(puzzle.puzzle!.kind);
      names.add(puzzle.puzzle!.name);
    });
    expect(kinds.size).toBe(STAGES.length);
    expect(names.size).toBe(STAGES.length);
  });

  it.each(STAGES)('%s: stands every piece on open, reachable floor clear of the other objectives', (stageId) => {
    const map = stageMap(stageId);
    const mission = getCampaignMission(stageId)!;
    const puzzle = getCampaignPuzzle(stageId);
    expect(puzzle.elements).toHaveLength(CAMPAIGN_PUZZLE_LAYOUTS[stageId].cells.length);
    const reserved = new Set([
      ...PLAYER_SPAWNS.slice(0, 1),
      ...mission.objectives.flatMap((objective) => objective.targets ?? []),
      ...mission.objectives
        .filter((objective) => objective.kind !== 'puzzle' && objective.x !== undefined)
        .map((objective) => ({ x: objective.x!, y: objective.y! })),
      mission.bossArena,
      ...mission.spawnPoints,
      ...mission.hiddenAreas,
    ].map(cellOf));
    // Walls never move; crates can always be blasted away.
    const reachable = new Set<string>([cellOf(PLAYER_SPAWNS[0])]);
    const queue: Point[] = [PLAYER_SPAWNS[0]];
    for (let index = 0; index < queue.length; index += 1) {
      const { x, y } = queue[index];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const next = { x: x + dx, y: y + dy };
        if (map[next.y]?.[next.x] !== undefined && map[next.y][next.x] !== 'Wall'
          && !reachable.has(cellOf(next))) {
          reachable.add(cellOf(next));
          queue.push(next);
        }
      });
    }
    const cells = puzzle.elements.map(cellOf);
    expect(new Set(cells).size).toBe(cells.length);
    puzzle.elements.forEach((item) => {
      expect({ id: item.id, cell: map[item.y]?.[item.x] }).toEqual({ id: item.id, cell: 'Empty' });
      expect({ id: item.id, reachable: reachable.has(cellOf(item)) })
        .toEqual({ id: item.id, reachable: true });
      expect({ id: item.id, reserved: reserved.has(cellOf(item)) })
        .toEqual({ id: item.id, reserved: false });
      // Someone can walk onto it from an open side.
      const openSides = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .filter(([dx, dy]) => map[item.y + dy]?.[item.x + dx] === 'Empty');
      expect({ id: item.id, open: openSides.length > 0 }).toEqual({ id: item.id, open: true });
    });
    if (puzzle.kind === 'pairs') {
      // Wards of a pair share a line, four apart, open floor between: a bomb
      // in the middle with a range of two reaches both.
      const pairs = new Set(puzzle.elements.map((item) => item.pair));
      pairs.forEach((pair) => {
        const [a, b] = puzzle.elements.filter((item) => item.pair === pair);
        expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(4);
        expect(a.x === b.x || a.y === b.y).toBe(true);
        for (let step = 1; step < 4; step += 1) {
          const x = a.x + Math.sign(b.x - a.x) * step;
          const y = a.y + Math.sign(b.y - a.y) * step;
          expect(map[y][x]).toBe('Empty');
        }
      });
    }
  });
});

describe('route puzzles through the reducer', () => {
  it.each(STAGES)('%s: keeps the mini boss gate sealed until scripted play solves the puzzle', (stageId) => {
    let state = reachPuzzle(campaignState(stageId));
    expect(state.campaign!.missionStep).toBe('puzzle');
    expect(miniBossOf(state).status).toBe('locked');
    expect(state.monsters.some((monster) => monster.id === miniBossOf(state).miniBossGuardId))
      .toBe(false);
    expect(state.campaign!.message).toBe(puzzleObjective(state).description);

    state = solvePuzzle(state);

    expect(puzzleObjective(state)).toMatchObject({ status: 'complete' });
    expect(puzzleObjective(state).current).toBe(puzzleObjective(state).target);
    expect(miniBossOf(state).status).toBe('active');
    expect(state.campaign!.missionStep).toBe('miniBoss');
    expect(state.monsters.some((monster) => monster.id === miniBossOf(state).miniBossGuardId))
      .toBe(true);
  });

  it('ignores the pieces while the puzzle is still locked behind the defense', () => {
    let state = calm(campaignState('hiddenLeaf'));
    const lantern = getCampaignPuzzle('hiddenLeaf').elements[0];
    state = bombCells(state, [lantern]);
    expect(piece(state, lantern.id).on).toBe(false);
  });

  it('keeps the campaign object when a step reaches no piece', () => {
    const state = setPlayer(reachPuzzle(campaignState('hiddenCloud')), { x: 22, y: 12 });
    const next = gameReducer(state, { type: 'MOVE', playerId: state.players[0].id, direction: 'left' })!;
    expect(next.players[0].x).toBeLessThan(22);
    expect(next.campaign).toBe(state.campaign);
  });

  it('leaves the puzzle state untouched on ticks while a timer runs', () => {
    let state = reachPuzzle(campaignState('hiddenSand', 'normal'));
    state = bombCells(state, [piece(state, 'hiddenSand-pylon-west')]);
    for (let elapsed = 0; elapsed < 5000; elapsed += 50) {
      const next = calm(tick(state));
      expect(puzzleObjective(next).puzzle).toBe(puzzleObjective(state).puzzle);
      state = next;
    }
    expect(piece(state, 'hiddenSand-pylon-west').on).toBe(true);
  });

  it('replays a serialized mid-puzzle state to the same result', () => {
    let state = reachPuzzle(campaignState('hiddenCloud'));
    state = stepOnto(state, piece(state, 'hiddenCloud-bell-1'));
    const copy = JSON.parse(JSON.stringify(state)) as GameEngineState;
    const finish = (from: GameEngineState) => solvePuzzle(from).campaign!.objectives;
    expect(finish(copy)).toEqual(finish(state));
  });
});

describe('thunderbell order (sequence)', () => {
  const ring = (state: GameEngineState, order: number) => (
    stepOnto(state, piece(state, `hiddenCloud-bell-${order}`))
  );

  it('resets every bell when one rings out of order, then solves from the start', () => {
    let state = reachPuzzle(campaignState('hiddenCloud', 'normal'));
    state = ring(ring(state, 1), 2);
    expect(puzzleObjective(state).current).toBe(2);

    state = ring(state, 4);

    expect(puzzleObjective(state).current).toBe(0);
    expect(puzzleObjective(state).puzzle!.elements.every((item) => !item.on)).toBe(true);
    expect(state.campaign!.message).toContain('out of order');
    [1, 2, 3, 4].forEach((order) => { state = ring(state, order); });
    expect(puzzleObjective(state).status).toBe('complete');
  });

  it('forgives a wrong bell on Story and names the next one', () => {
    let state = reachPuzzle(campaignState('hiddenCloud', 'story'));
    state = ring(ring(state, 1), 3);
    expect(puzzleObjective(state).current).toBe(1);
    expect(state.campaign!.message).toBe('That is Bell III. Ring Bell II next.');
    expect(describePuzzleProgress(puzzleObjective(state).puzzle!).line).toContain('next: Bell II');
  });

  it('silences the bells on Hard when the order takes longer than its limit', () => {
    let state = reachPuzzle(campaignState('hiddenCloud', 'hard'));
    state = ring(ring(state, 1), 2);
    state = waitTicks(state, 44000);
    expect(puzzleObjective(state).current).toBe(2);
    state = waitTicks(state, 1500);
    expect(puzzleObjective(state).current).toBe(0);
    expect(state.campaign!.message).toContain('within 45 s');
  });

  it('keeps the rung bells across a lost life', () => {
    let state = reachPuzzle(campaignState('hiddenCloud', 'normal'));
    state = ring(ring(state, 1), 2);
    state = tick(kill(state));
    expect(state.players[0].alive).toBe(true);
    expect(state.campaign!.livesRemaining).toBe(2);
    expect(puzzleObjective(state).current).toBe(2);
    state = ring(ring(state, 3), 4);
    expect(puzzleObjective(state).status).toBe('complete');
  });
});

describe('marionette pylons (topple)', () => {
  it('re-ties a lone toppled pylon after its window, sooner on Hard', () => {
    const retieAfter = (difficulty: 'normal' | 'hard') => {
      let state = reachPuzzle(campaignState('hiddenSand', difficulty));
      state = bombCells(state, [piece(state, 'hiddenSand-pylon-west')]);
      expect(piece(state, 'hiddenSand-pylon-west').on).toBe(true);
      let waited = 0;
      while (piece(state, 'hiddenSand-pylon-west').on && waited < 30000) {
        state = calm(tick(state));
        waited += 50;
      }
      expect(state.campaign!.message).toContain('re-tied its strings');
      return waited;
    };
    const normal = retieAfter('normal');
    const hard = retieAfter('hard');
    expect(normal).toBeGreaterThan(10000);
    expect(hard).toBeLessThan(normal);
  });
});

describe('twin paper wards (pairs)', () => {
  const CHARACTERS: CharacterId[] = ['deidara', 'naruto', 'sasuke', 'gaara', 'minato', 'itachi'];

  it.each(CHARACTERS)('lets %s seal a pair with one bomb midway between the wards', (character) => {
    let state = reachPuzzle(campaignState('akatsukiHideout', 'hard', character));
    state = bombCells(state, [{ x: 25, y: 2 }]);
    expect(puzzleObjective(state).current).toBe(1);
  });

  it('names the strike window on the objective line, tightest on Hard', () => {
    const line = (difficulty: 'story' | 'hard') => describePuzzleProgress(
      puzzleObjective(reachPuzzle(campaignState('akatsukiHideout', difficulty))).puzzle!
    ).line;
    expect(line('hard')).toBe('Ward pairs 0/2 · strike both wards of a pair together · 1.5 s apart at most');
    expect(line('story')).toContain('6 s apart at most · a bomb midway reaches both');
  });

  it('relights a lone struck ward once the window passes', () => {
    let state = reachPuzzle(campaignState('akatsukiHideout', 'normal', 'naruto'));
    // Naruto's range of two does not reach the twin four cells away.
    state = bombCells(state, [piece(state, 'akatsukiHideout-ward-moon-west')]);
    expect(piece(state, 'akatsukiHideout-ward-moon-west').on).toBe(true);
    expect(piece(state, 'akatsukiHideout-ward-moon-east').on).toBe(false);
    state = waitTicks(state, 3600);
    expect(piece(state, 'akatsukiHideout-ward-moon-west').on).toBe(false);
    expect(puzzleObjective(state).current).toBe(0);
    expect(state.campaign!.message).toContain('relit before its twin');
  });
});

describe('tide lock levers (toggle)', () => {
  it('undoes a lever by stepping on it again', () => {
    let state = reachPuzzle(campaignState('hiddenMist'));
    const lever = piece(state, 'hiddenMist-lever-ab');
    state = stepOnto(state, lever);
    expect(puzzleObjective(state).current).toBe(2);
    state = stepOnto(state, lever);
    expect(puzzleObjective(state).current).toBe(0);
  });

  it('can raise every span from any span state, so no pull order locks it', () => {
    const base = puzzleObjective(reachPuzzle(campaignState('hiddenMist'))).puzzle!;
    const spans = base.elements.filter((item) => item.role === 'span');
    for (let mask = 0; mask < 2 ** spans.length; mask += 1) {
      const puzzle: CampaignPuzzleState = {
        ...base,
        elements: base.elements.map((item) => {
          const index = spans.findIndex((span) => span.id === item.id);
          return index >= 0 ? { ...item, on: Math.floor(mask / 2 ** index) % 2 === 1 } : item;
        }),
      };
      const pulls = toggleSolution(puzzle);
      let solved = puzzle;
      pulls.forEach((id, step) => {
        const lever = solved.elements.find((item) => item.id === id)!;
        const players = [{ alive: true, x: lever.x, y: lever.y }] as GameEngineState['players'];
        solved = advancePuzzle(solved, { tick: step * 2, players, explosions: [] });
        solved = advancePuzzle(solved, { tick: step * 2 + 1, players: [], explosions: [] });
      });
      const raised = solved.elements.filter((item) => item.role === 'span' && item.on).length;
      expect({ mask, raised }).toEqual({ mask, raised: spans.length });
    }
  });

  it('drops every span on Hard after six pulls without a solution', () => {
    let state = reachPuzzle(campaignState('hiddenMist', 'hard'));
    const ab = piece(state, 'hiddenMist-lever-ab');
    for (let pull = 0; pull < 5; pull += 1) state = stepOnto(state, ab);
    expect(puzzleObjective(state).current).toBe(2);
    state = stepOnto(state, ab);
    expect(puzzleObjective(state).current).toBe(0);
    expect(state.campaign!.message).toContain('The tide rose');
    state = solvePuzzle(state);
    expect(puzzleObjective(state).status).toBe('complete');
  });
});

describe('rally beacons (relay)', () => {
  it('lets a beacon burn out, and solves once all four burn together', () => {
    let state = reachPuzzle(campaignState('greatShinobiWar', 'normal'));
    state = stepOnto(state, piece(state, 'greatShinobiWar-beacon-north'));
    state = waitTicks(state, 34100);
    expect(piece(state, 'greatShinobiWar-beacon-north').on).toBe(false);
    expect(state.campaign!.message).toContain('burned out');
    state = solvePuzzle(state);
    expect(puzzleObjective(state).status).toBe('complete');
  });
});

describe('cairn keystones (carry)', () => {
  const stone = (state: GameEngineState, id: string) => piece(state, `hiddenStone-keystone-${id}`);
  const cairn = (state: GameEngineState) => piece(state, 'hiddenStone-cairn');

  it('carries only as many as the difficulty allows', () => {
    let state = reachPuzzle(campaignState('hiddenStone', 'hard'));
    state = stepOnto(stepOnto(state, stone(state, 'north')), stone(state, 'south'));
    expect(stone(state, 'north').carriedBy).toBe('player1');
    expect(stone(state, 'south').carriedBy).toBeUndefined();
    state = stepOnto(state, cairn(state));
    expect(puzzleObjective(state).current).toBe(1);
  });

  it('keeps set keystones and returns carried ones to their beds after a fall', () => {
    let state = reachPuzzle(campaignState('hiddenStone', 'normal'));
    state = stepOnto(stepOnto(state, stone(state, 'north')), cairn(state));
    state = stepOnto(state, stone(state, 'south'));
    expect(stone(state, 'south').carriedBy).toBe('player1');

    state = calm(tick(kill(state)));
    state = calm(tick(state));

    expect(state.campaign!.livesRemaining).toBe(2);
    expect(puzzleObjective(state).current).toBe(1);
    expect(stone(state, 'south').carriedBy).toBeUndefined();
    // Said once the regroup notice has had its turn.
    state = waitTicks(state, 3200);
    expect(state.campaign!.message).toContain('rolled back');
    state = solvePuzzle(state);
    expect(puzzleObjective(state).status).toBe('complete');
  });

  it('lets Story keep what it carries through a fall', () => {
    let state = reachPuzzle(campaignState('hiddenStone', 'story'));
    state = stepOnto(state, stone(state, 'south'));
    state = calm(tick(kill(state)));
    state = calm(tick(state));
    expect(state.campaign!.livesRemaining).toBe(4);
    expect(stone(state, 'south').carriedBy).toBe('player1');
  });
});

describe('no softlock', () => {
  function withoutCrates(state: GameEngineState): GameEngineState {
    return {
      ...state,
      map: state.map.map((row) => row.map((cell) => (cell === 'Box' ? 'Empty' : cell))),
    };
  }

  it.each(STAGES)('%s: stays solvable once every crate is destroyed', (stageId) => {
    const state = solvePuzzle(withoutCrates(reachPuzzle(campaignState(stageId))));
    expect(puzzleObjective(state).status).toBe('complete');
  });

  it.each(STAGES)('%s: stays solvable after a fall and a regroup mid-puzzle', (stageId: StageId) => {
    let state = reachPuzzle(campaignState(stageId, 'normal'));
    // Some progress first, where the puzzle has a first step to take.
    const first = puzzleObjective(state).puzzle!.elements[0];
    if (first.role === 'lantern' || first.role === 'pylon') state = bombCells(state, [first]);
    else if (first.role !== 'ward') state = walkOnto(state, first);
    state = calm(tick(kill(state)));
    expect(state.players[0].alive).toBe(true);
    expect(state.campaign!.livesRemaining).toBe(2);
    state = solvePuzzle(state);
    expect(puzzleObjective(state).status).toBe('complete');
    expect(miniBossOf(state).status).toBe('active');
  });
});
