import type { CampaignPuzzleDefinition } from '../content/campaignMissions';
import type { DifficultyId } from './difficulty';
import { TICK_MS } from './constants';
import { positionsTouch } from './grid';
import {
  CampaignObjectiveState,
  CampaignPuzzleElementState,
  CampaignPuzzleState,
  ExplosionCell,
  GameEngineState,
  PlayerState,
} from './types';

/**
 * Route puzzles: one objective step per village, between the defense and the
 * mini boss gate. Players solve them with the ordinary verbs only: walking
 * onto a piece, catching it in a blast, or walking a carried piece to its
 * socket. Everything here is a pure function of serializable state; timers
 * are engine-tick deadlines, so the state changes only when something
 * happens (a step, a blast, a timer running out), never just because time
 * passed.
 *
 * No puzzle can lock itself: lit pieces stay lit, timed pieces re-arm on
 * their own, levers form an invertible system, a wrong order resets to the
 * start, and a dropped keystone returns to its bed.
 */

// A ninja stands on a piece once this close to its cell centre: the body
// is clearly on the tile, so brushing past a corner does not count.
export const PUZZLE_STEP_DISTANCE = 0.45;
// Keystones are lifted from a little further, like a rescue.
export const PUZZLE_PICKUP_DISTANCE = 0.6;
// How long a puzzle notice replaces the objective hint (3 s).
export const PUZZLE_NOTICE_TICKS = 60;

type PuzzleContext = {
  tick: number;
  players: PlayerState[];
  explosions: ExplosionCell[];
  lives?: number;
};

const msToTicks = (ms: number) => Math.max(1, Math.ceil(ms / TICK_MS));

// Array.map that hands back the input when nothing changed.
function mapUnchanged<T>(items: T[], update: (item: T, index: number) => T): T[] {
  let changed = false;
  const next = items.map((item, index) => {
    const result = update(item, index);
    if (result !== item) changed = true;
    return result;
  });
  return changed ? next : items;
}

function steppedOn(context: PuzzleContext, piece: CampaignPuzzleElementState): boolean {
  return context.players.some((player) => (
    player.alive && positionsTouch(player, piece, PUZZLE_STEP_DISTANCE)
  ));
}

function blasted(context: PuzzleContext, piece: CampaignPuzzleElementState): boolean {
  return context.explosions.some((cell) => cell.x === piece.x && cell.y === piece.y);
}

function withPressed(
  piece: CampaignPuzzleElementState,
  pressed: boolean
): CampaignPuzzleElementState {
  return !!piece.pressed === pressed ? piece : { ...piece, pressed };
}

function withNotice(
  puzzle: CampaignPuzzleState,
  notice: string,
  tick: number,
  setback = true,
  ticks = PUZZLE_NOTICE_TICKS
): CampaignPuzzleState {
  return {
    ...puzzle,
    notice,
    noticeUntilTick: tick + ticks,
    setbacks: puzzle.setbacks + (setback ? 1 : 0),
  };
}

function withElements(
  puzzle: CampaignPuzzleState,
  elements: CampaignPuzzleElementState[]
): CampaignPuzzleState {
  return elements === puzzle.elements ? puzzle : { ...puzzle, elements };
}

// --- Progress ----------------------------------------------------------------

function pairIds(puzzle: CampaignPuzzleState): number[] {
  const pairs: number[] = [];
  puzzle.elements.forEach((piece) => {
    if (piece.pair !== undefined && !pairs.includes(piece.pair)) pairs.push(piece.pair);
  });
  return pairs;
}

// A ward pair is sealed once both are struck and their timers dropped.
function pairSealed(puzzle: CampaignPuzzleState, pair: number): boolean {
  return puzzle.elements
    .filter((piece) => piece.pair === pair)
    .every((piece) => piece.on && piece.untilTick === undefined);
}

function countProgress(puzzle: CampaignPuzzleState): { progress: number; total: number } {
  const { elements } = puzzle;
  switch (puzzle.kind) {
    case 'toggle': {
      const spans = elements.filter((piece) => piece.role === 'span');
      return { progress: spans.filter((piece) => piece.on).length, total: spans.length };
    }
    case 'carry': {
      const stones = elements.filter((piece) => piece.role === 'keystone');
      return { progress: stones.filter((piece) => piece.on).length, total: stones.length };
    }
    case 'pairs': {
      const pairs = pairIds(puzzle);
      return {
        progress: pairs.filter((pair) => pairSealed(puzzle, pair)).length,
        total: pairs.length,
      };
    }
    default:
      return { progress: elements.filter((piece) => piece.on).length, total: elements.length };
  }
}

function withProgress(puzzle: CampaignPuzzleState): CampaignPuzzleState {
  const { progress, total } = countProgress(puzzle);
  const solved = total > 0 && progress >= total;
  if (progress === puzzle.progress && total === puzzle.total && solved === puzzle.solved) {
    return puzzle;
  }
  return solved
    ? {
      ...puzzle, progress, total, solved, notice: undefined, noticeUntilTick: undefined,
    }
    : {
      ...puzzle, progress, total, solved,
    };
}

export function createPuzzleState(
  definition: CampaignPuzzleDefinition,
  difficulty: DifficultyId,
  lives?: number
): CampaignPuzzleState {
  return withProgress({
    kind: definition.kind,
    unit: definition.unit,
    rule: definition.rule,
    ruleShort: definition.ruleShort,
    tuning: definition.tuning[difficulty] ?? {},
    elements: definition.elements.map((piece) => ({ ...piece, on: false })),
    progress: -1,
    total: 0,
    solved: false,
    setbacks: 0,
    livesSeen: lives,
  });
}

// --- Rules per kind ------------------------------------------------------------

type PuzzleRule = (puzzle: CampaignPuzzleState, context: PuzzleContext) => CampaignPuzzleState;

// Blast every lantern once.
const kindle: PuzzleRule = (puzzle, context) => {
  if (context.explosions.length === 0) return puzzle;
  return withElements(puzzle, mapUnchanged(puzzle.elements, (piece) => (
    !piece.on && blasted(context, piece) ? { ...piece, on: true } : piece
  )));
};

// Blast every pylon; each re-ties itself `windowMs` after it fell.
const topple: PuzzleRule = (puzzle, context) => {
  const windowTicks = msToTicks(puzzle.tuning.windowMs ?? 12000);
  let retied: CampaignPuzzleElementState | null = null;
  const elements = mapUnchanged(puzzle.elements, (piece) => {
    if (piece.on && piece.untilTick !== undefined && context.tick >= piece.untilTick) {
      // A flame still on it knocks it straight back down.
      if (blasted(context, piece)) return { ...piece, untilTick: context.tick + windowTicks };
      retied = piece;
      return { ...piece, on: false, untilTick: undefined };
    }
    if (!piece.on && blasted(context, piece)) {
      return { ...piece, on: true, untilTick: context.tick + windowTicks };
    }
    return piece;
  });
  const next = withElements(puzzle, elements);
  const fallen = retied as CampaignPuzzleElementState | null;
  return fallen
    ? withNotice(next, `The ${fallen.label} re-tied its strings. Topple all three together.`, context.tick)
    : next;
};

// Step on levers; each flips its spans. Hard drops every span after
// `pullLimit` pulls without a solution.
const toggle: PuzzleRule = (puzzle, context) => {
  const flips: Record<string, boolean> = {};
  let pulls = puzzle.pulls ?? 0;
  let elements = mapUnchanged(puzzle.elements, (piece) => {
    if (piece.role !== 'lever') return piece;
    const pressed = steppedOn(context, piece);
    if (pressed && !piece.pressed) {
      pulls += 1;
      (piece.flips ?? []).forEach((id) => { flips[id] = !flips[id]; });
    }
    return withPressed(piece, pressed);
  });
  elements = mapUnchanged(elements, (piece) => (
    piece.role === 'span' && flips[piece.id] ? { ...piece, on: !piece.on } : piece
  ));
  let next = withElements(puzzle, elements);
  if (pulls !== (puzzle.pulls ?? 0)) next = { ...next, pulls };
  const limit = puzzle.tuning.pullLimit;
  const raised = elements.filter((piece) => piece.role === 'span' && piece.on).length;
  const spans = elements.filter((piece) => piece.role === 'span').length;
  if (limit && pulls >= limit && raised < spans) {
    next = withNotice({
      ...next,
      pulls: 0,
      elements: elements.map((piece) => (
        piece.role === 'span' && piece.on ? { ...piece, on: false } : piece
      )),
    }, `The tide rose and dropped every span. You have ${limit} pulls per tide.`, context.tick);
  }
  return next;
};

// Step on the shrines in their order. A wrong one resets the order, except
// on Story, where it is ignored. Hard gives the whole order a time limit.
const sequence: PuzzleRule = (puzzle, context) => {
  let next = puzzle;
  const unring = (pieces: CampaignPuzzleElementState[]) => pieces.map((piece) => (
    piece.on ? { ...piece, on: false } : piece
  ));
  if (next.deadlineTick !== undefined && context.tick >= next.deadlineTick) {
    const seconds = Math.round((next.tuning.limitMs ?? 0) / 1000);
    next = withNotice(
      { ...next, elements: unring(next.elements), deadlineTick: undefined },
      `The bells fell silent. Ring all ${next.elements.length} within ${seconds} s.`,
      context.tick
    );
  }
  const elements = next.elements.slice();
  let changed = false;
  let { deadlineTick } = next;
  let notice: { text: string; setback: boolean } | null = null;
  const ordered = [...elements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (let index = 0; index < elements.length; index += 1) {
    const piece = elements[index];
    const pressed = steppedOn(context, piece);
    if (pressed !== !!piece.pressed) {
      elements[index] = { ...piece, pressed };
      changed = true;
    }
    if (pressed && !piece.pressed && !piece.on) {
      const lit = elements.filter((item) => item.on).length;
      const expected = ordered[lit];
      if (expected && expected.id === piece.id) {
        elements[index] = { ...elements[index], on: true };
        if (lit === 0 && next.tuning.limitMs) {
          deadlineTick = context.tick + msToTicks(next.tuning.limitMs);
        }
      } else if (next.tuning.forgiveWrong) {
        notice = { text: `That is ${piece.label}. Ring ${expected?.label ?? 'the next bell'} next.`, setback: false };
      } else {
        for (let other = 0; other < elements.length; other += 1) {
          if (elements[other].on) elements[other] = { ...elements[other], on: false };
        }
        deadlineTick = undefined;
        notice = {
          text: `${piece.label} rang out of order. The bells fell silent: start again from ${ordered[0]?.label ?? 'the first'}.`,
          setback: true,
        };
      }
      changed = true;
    }
  }
  if (changed) next = { ...next, elements };
  if (deadlineTick !== next.deadlineTick) next = { ...next, deadlineTick };
  return notice ? withNotice(next, notice.text, context.tick, notice.setback) : next;
};

// Walk over keystones to lift them (up to `carryLimit`), walk onto the cairn
// to set them. A fall drops what was carried back to its bed, except on Story.
const carry: PuzzleRule = (puzzle, context) => {
  let next = puzzle;
  let { elements } = puzzle;
  if (
    context.lives !== undefined
    && next.livesSeen !== undefined
    && context.lives < next.livesSeen
  ) {
    let dropped = false;
    if (!next.tuning.keepCarriedOnFall) {
      elements = mapUnchanged(elements, (piece) => {
        if (!piece.carriedBy) return piece;
        dropped = true;
        return { ...piece, carriedBy: undefined };
      });
    }
    next = { ...withElements(next, elements), livesSeen: context.lives };
    if (dropped) {
      // Outlasts the regroup notice (FALL_NOTICE_TICKS), which shows first.
      next = withNotice(
        next,
        'The keystones you carried rolled back to their beds.',
        context.tick,
        true,
        PUZZLE_NOTICE_TICKS * 2
      );
    }
  } else if (context.lives !== next.livesSeen) {
    next = { ...next, livesSeen: context.lives };
  }

  const limit = next.tuning.carryLimit ?? 1;
  let lifted: CampaignPuzzleElementState[] | null = null;
  for (let index = 0; index < elements.length; index += 1) {
    const piece = elements[index];
    if (piece.role === 'keystone' && !piece.on && !piece.carriedBy) {
      const current = lifted ?? elements;
      const lifter = context.players.find((player) => (
        player.alive
        && positionsTouch(player, piece, PUZZLE_PICKUP_DISTANCE)
        && current.filter((item) => item.carriedBy === player.id).length < limit
      ));
      if (lifter) {
        lifted = lifted ?? elements.slice();
        lifted[index] = { ...piece, carriedBy: lifter.id };
      }
    }
  }
  if (lifted) elements = lifted;
  const cairn = elements.find((piece) => piece.role === 'cairn');
  if (cairn) {
    const setters = new Set(context.players
      .filter((player) => player.alive && positionsTouch(player, cairn, PUZZLE_PICKUP_DISTANCE))
      .map((player) => player.id));
    if (setters.size > 0) {
      elements = mapUnchanged(elements, (piece) => (
        piece.carriedBy && setters.has(piece.carriedBy)
          ? { ...piece, carriedBy: undefined, on: true }
          : piece
      ));
    }
  }
  return withElements(next, elements);
};

// Blast both wards of a pair within `windowMs`; a lone struck ward relights.
const pairs: PuzzleRule = (puzzle, context) => {
  const windowTicks = msToTicks(puzzle.tuning.windowMs ?? 3000);
  let relit: CampaignPuzzleElementState | null = null;
  let elements = mapUnchanged(puzzle.elements, (piece) => {
    if (piece.on && piece.untilTick === undefined) return piece;
    if (piece.on && piece.untilTick !== undefined && context.tick >= piece.untilTick) {
      relit = piece;
      return { ...piece, on: false, untilTick: undefined };
    }
    if (!piece.on && blasted(context, piece)) {
      return { ...piece, on: true, untilTick: context.tick + windowTicks };
    }
    return piece;
  });
  pairIds(puzzle).forEach((pair) => {
    const both = elements.filter((piece) => piece.pair === pair);
    if (both.every((piece) => piece.on) && both.some((piece) => piece.untilTick !== undefined)) {
      elements = elements.map((piece) => (
        piece.pair === pair ? { ...piece, untilTick: undefined } : piece
      ));
    }
  });
  const next = withElements(puzzle, elements);
  const lone = relit as CampaignPuzzleElementState | null;
  return lone
    ? withNotice(next, `The ${lone.label} relit before its twin was struck. Hit both together.`, context.tick)
    : next;
};

// Step on beacons to light them; each burns for `windowMs`.
const relay: PuzzleRule = (puzzle, context) => {
  const burnTicks = msToTicks(puzzle.tuning.windowMs ?? 30000);
  let burnt: CampaignPuzzleElementState | null = null;
  const elements = mapUnchanged(puzzle.elements, (piece) => {
    let next = piece;
    const pressed = steppedOn(context, piece);
    if (pressed && !piece.pressed) {
      next = { ...next, on: true, untilTick: context.tick + burnTicks };
    } else if (next.on && next.untilTick !== undefined && context.tick >= next.untilTick) {
      burnt = next;
      next = { ...next, on: false, untilTick: undefined };
    }
    return withPressed(next, pressed);
  });
  const next = withElements(puzzle, elements);
  const out = burnt as CampaignPuzzleElementState | null;
  return out
    ? withNotice(next, `The ${out.label} burned out. Keep all four burning together.`, context.tick)
    : next;
};

const RULES: Record<CampaignPuzzleState['kind'], PuzzleRule> = {
  kindle, topple, toggle, sequence, carry, pairs, relay,
};

function timerDue(puzzle: CampaignPuzzleState, tick: number): boolean {
  if (puzzle.deadlineTick !== undefined && tick >= puzzle.deadlineTick) return true;
  if (puzzle.notice !== undefined && tick >= (puzzle.noticeUntilTick ?? 0)) return true;
  const { elements } = puzzle;
  for (let index = 0; index < elements.length; index += 1) {
    const { untilTick } = elements[index];
    if (untilTick !== undefined && tick >= untilTick) return true;
  }
  return false;
}

// Pieces that react to being stepped on.
const STEPPED_ROLES: ReadonlySet<string> = new Set(['lever', 'shrine', 'beacon']);

// Most steps and ticks touch no piece: answer that without building anything.
function isQuiet(puzzle: CampaignPuzzleState, context: PuzzleContext): boolean {
  if (timerDue(puzzle, context.tick)) return false;
  const { elements } = puzzle;
  switch (puzzle.kind) {
    case 'kindle':
    case 'topple':
    case 'pairs':
      return context.explosions.length === 0;
    case 'carry':
      if (context.lives !== puzzle.livesSeen) return false;
      for (let index = 0; index < elements.length; index += 1) {
        const piece = elements[index];
        for (let p = 0; p < context.players.length; p += 1) {
          const player = context.players[p];
          if (player.alive && positionsTouch(player, piece, PUZZLE_PICKUP_DISTANCE)) return false;
        }
      }
      return true;
    default:
      for (let index = 0; index < elements.length; index += 1) {
        const piece = elements[index];
        if (STEPPED_ROLES.has(piece.role) && !!piece.pressed !== steppedOn(context, piece)) {
          return false;
        }
      }
      return true;
  }
}

/** One step of a puzzle: the same object back when nothing changed. */
export function advancePuzzle(
  puzzle: CampaignPuzzleState,
  context: PuzzleContext
): CampaignPuzzleState {
  if (puzzle.solved || isQuiet(puzzle, context)) return puzzle;
  let next = puzzle;
  if (next.notice && context.tick >= (next.noticeUntilTick ?? 0)) {
    next = { ...next, notice: undefined, noticeUntilTick: undefined };
  }
  next = RULES[next.kind](next, context);
  return next === puzzle ? puzzle : withProgress(next);
}

/** The objective-loop hook: advances an active puzzle objective. */
export function updatePuzzleObjective(
  state: GameEngineState,
  objective: CampaignObjectiveState
): CampaignObjectiveState {
  if (objective.kind !== 'puzzle' || objective.status !== 'active' || !objective.puzzle) {
    return objective;
  }
  const puzzle = advancePuzzle(objective.puzzle, {
    tick: state.tick,
    players: state.players,
    explosions: state.explosions,
    lives: state.campaign?.livesRemaining,
  });
  if (puzzle === objective.puzzle) return objective;
  return {
    ...objective,
    puzzle,
    current: puzzle.progress,
    target: puzzle.total,
    status: puzzle.solved ? 'complete' : objective.status,
  };
}

// --- Hints and copy -------------------------------------------------------------

/** The next shrine in a sequence puzzle. */
export function nextSequencePiece(
  puzzle: CampaignPuzzleState
): CampaignPuzzleElementState | undefined {
  const ordered = [...puzzle.elements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return ordered.find((piece) => !piece.on);
}

/**
 * The fewest levers that raise every span from the spans' current state
 * (a toggle puzzle is a small linear system over on/off, so trying every
 * lever set is cheap: 2^levers).
 */
export function toggleSolution(puzzle: CampaignPuzzleState): string[] {
  const levers = puzzle.elements.filter((piece) => piece.role === 'lever');
  const spans = puzzle.elements.filter((piece) => piece.role === 'span');
  let best: string[] | null = null;
  for (let mask = 0; mask < 2 ** levers.length; mask += 1) {
    const chosen = levers.filter((_, index) => Math.floor(mask / 2 ** index) % 2 === 1);
    const solves = spans.every((span) => {
      const flipsHere = chosen.filter((lever) => lever.flips?.includes(span.id)).length;
      return span.on !== (flipsHere % 2 === 1);
    });
    if (solves && (!best || chosen.length < best.length)) best = chosen.map((lever) => lever.id);
  }
  return best ?? [];
}

/** Pieces the Story hint points at (empty unless the tuning shows hints). */
export function puzzleHighlights(puzzle: CampaignPuzzleState): string[] {
  if (!puzzle.tuning.showNext || puzzle.solved) return [];
  const { elements } = puzzle;
  switch (puzzle.kind) {
    case 'toggle':
      return toggleSolution(puzzle);
    case 'sequence': {
      const next = nextSequencePiece(puzzle);
      return next ? [next.id] : [];
    }
    case 'carry': {
      const carrying = elements.some((piece) => piece.carriedBy);
      return elements
        .filter((piece) => (carrying
          ? piece.role === 'cairn'
          : piece.role === 'keystone' && !piece.on))
        .map((piece) => piece.id);
    }
    case 'pairs':
      return elements
        .filter((piece) => piece.untilTick !== undefined || !piece.on)
        .map((piece) => piece.id);
    default:
      return elements.filter((piece) => !piece.on).map((piece) => piece.id);
  }
}

function labels(puzzle: CampaignPuzzleState, ids: string[]): string {
  return ids
    .map((id) => puzzle.elements.find((piece) => piece.id === id)?.label ?? id)
    .join(', ');
}

/** The HUD's objective detail ("Shrines 2/4 · ring them in order, I to IV"). */
export function describePuzzleProgress(puzzle: CampaignPuzzleState): {
  line: string;
  short: string;
} {
  const count = `${puzzle.progress}/${puzzle.total}`;
  if (puzzle.solved) {
    return { line: `${puzzle.unit} ${count} · done`, short: count };
  }
  const extras: string[] = [];
  const { tuning } = puzzle;
  if (puzzle.kind === 'carry') {
    const carrying = puzzle.elements.filter((piece) => piece.carriedBy).length;
    if (carrying > 0) extras.push(`carrying ${carrying}`);
    else if ((tuning.carryLimit ?? 1) < puzzle.total) {
      extras.push(`${tuning.carryLimit ?? 1} at a time`);
    }
  }
  if (puzzle.kind === 'toggle' && tuning.pullLimit) {
    extras.push(`${tuning.pullLimit - (puzzle.pulls ?? 0)} pulls before the tide`);
  }
  if (puzzle.kind === 'sequence' && tuning.limitMs) {
    extras.push(`within ${Math.round(tuning.limitMs / 1000)} s`);
  }
  if (puzzle.kind === 'topple' || puzzle.kind === 'relay' || puzzle.kind === 'pairs') {
    // Whole seconds, or one decimal under ten (1.5 s).
    const seconds = Number(((tuning.windowMs ?? 0) / 1000).toFixed(1));
    if (seconds > 0) {
      const timing = {
        topple: `they re-tie after ${seconds} s`,
        relay: `each burns ${seconds} s`,
        pairs: `${seconds} s apart at most`,
      }[puzzle.kind];
      extras.push(timing);
    }
  }
  if (tuning.showNext) {
    if (puzzle.kind === 'sequence') {
      const next = nextSequencePiece(puzzle);
      if (next) extras.push(`next: ${next.label}`);
    }
    if (puzzle.kind === 'toggle') extras.push(`step on ${labels(puzzle, toggleSolution(puzzle))}`);
    if (puzzle.kind === 'pairs') extras.push('a bomb midway reaches both');
    if (puzzle.kind === 'topple') extras.push('a bomb between two hits both');
  }
  return {
    line: [`${puzzle.unit} ${count}`, puzzle.rule, ...extras].join(' · '),
    short: `${count} · ${puzzle.ruleShort}`,
  };
}

/** What the campaign message says while the puzzle is the active objective. */
export function puzzleMessage(objective: CampaignObjectiveState): string {
  return objective.puzzle?.notice ?? objective.description;
}
