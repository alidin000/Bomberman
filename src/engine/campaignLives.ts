import { isPower } from '../model/gameItem';
import { PLAYER_SPAWNS } from './constants';
import { createDangerMap } from './monsters';
import { CampaignRuntimeState, GameEngineState, Point } from './types';

// After a fall the player is shielded this long at the checkpoint.
export const REGROUP_GRACE_MS = 2000;
// How long the "regrouped" notice replaces the objective hint.
export const FALL_NOTICE_TICKS = 60;
const CHECKPOINT_SEARCH_RADIUS = 8;
const CHECKPOINT_ENEMY_CLEARANCE = 2;

const STEPS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function livesLabel(lives: number): string {
  return `${lives} ${lives === 1 ? 'life' : 'lives'} left`;
}

// The last cleared objective is the checkpoint; before any, the entrance.
function getCheckpointAnchor(campaign: CampaignRuntimeState): { point: Point; label: string } {
  const cleared = campaign.objectives.filter((objective) => objective.status === 'complete');
  const last = cleared[cleared.length - 1];
  const district = campaign.districts.find((item) => item.id === last?.districtId);
  if (!last) {
    return { point: PLAYER_SPAWNS[0], label: campaign.districts[0]?.label ?? 'the entrance' };
  }
  const rescued = last.targets?.filter((target) => target.rescued) ?? [];
  const point = rescued.length > 0
    ? rescued[rescued.length - 1]
    : { x: last.x ?? PLAYER_SPAWNS[0].x, y: last.y ?? PLAYER_SPAWNS[0].y };
  return { point: { x: point.x, y: point.y }, label: district?.label ?? last.label };
}

function isOpenCell(state: GameEngineState, x: number, y: number): boolean {
  const cell = state.map[y]?.[x];
  return cell !== undefined && (cell === 'Empty' || isPower(cell));
}

// Nearest open cell to the anchor that no flame, hazard or bomb will reach
// and that no enemy stands next to.
function findCheckpointCell(state: GameEngineState, anchor: Point): Point {
  const danger = createDangerMap(state);
  const safe = (x: number, y: number) => !danger.has(`${x},${y}`)
    && state.monsters.every((monster) => (
      Math.abs(monster.x - x) + Math.abs(monster.y - y) > CHECKPOINT_ENEMY_CLEARANCE
    ));
  const queue: Point[] = [anchor];
  const seen = new Set([`${anchor.x},${anchor.y}`]);
  let fallback: Point | null = null;
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    const open = isOpenCell(state, point.x, point.y);
    if (open && safe(point.x, point.y)) return point;
    if (open && !fallback) fallback = point;
    if (Math.abs(point.x - anchor.x) + Math.abs(point.y - anchor.y) < CHECKPOINT_SEARCH_RADIUS) {
      STEPS.forEach((step) => {
        const next = { x: point.x + step.x, y: point.y + step.y };
        const key = `${next.x},${next.y}`;
        if (!seen.has(key) && state.map[next.y]?.[next.x] !== undefined
          && state.map[next.y][next.x] !== 'Wall') {
          seen.add(key);
          queue.push(next);
        }
      });
    }
  }
  return fallback ?? anchor;
}

/**
 * Campaign forgiveness: while the mission has lives left, a fallen player
 * regroups at the last cleared objective (shielded for a moment) instead of
 * failing the whole mission. Cleared objectives and boss damage are kept.
 */
export function regroupFallenPlayers(state: GameEngineState): GameEngineState {
  const { campaign } = state;
  if (!campaign || state.config.mode !== 'solo' || campaign.missionResult !== 'in_progress') {
    return state;
  }
  let lives = campaign.livesRemaining ?? 1;
  if (lives <= 1 || state.players.every((player) => player.alive)) return state;

  const anchor = getCheckpointAnchor(campaign);
  let notice = '';
  const players = state.players.map((player) => {
    if (player.alive || lives <= 1) return player;
    lives -= 1;
    const cell = findCheckpointCell(state, anchor.point);
    notice = `${player.deathReason ?? `${player.name} fell.`} Regrouped at ${anchor.label}: ${livesLabel(lives)}.`;
    return {
      ...player,
      x: cell.x,
      y: cell.y,
      alive: true,
      deathReason: undefined,
      survivalGraceMs: REGROUP_GRACE_MS,
    };
  });

  return {
    ...state,
    players,
    campaign: {
      ...campaign,
      livesRemaining: lives,
      fallNotice: notice,
      fallNoticeUntilTick: state.tick + FALL_NOTICE_TICKS,
      message: notice,
    },
  };
}
