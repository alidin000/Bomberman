/* eslint-disable object-curly-newline, comma-dangle */
import React from 'react';
import {
  CampaignObjectiveState,
  CampaignObjectiveStatus,
  GameEngineState,
  MonsterKind,
} from '../../engine/types';
import { Power } from '../../model/gameItem';
import { isPowerUpActive } from '../../engine/players';
import { getRoundTimeRemainingMs, isSuddenDeathMode } from '../../engine/suddenDeath';
import { describePuzzleProgress } from '../../engine/campaignPuzzles';
import {
  HudRoot,
  MissionStrip,
  MissionStatus,
  MissionNode,
  ClockNode,
  SuddenDeathCell,
  PhoneSuddenDeathBanner,
  PlayerCards,
  PlayerCardPaper,
  PowerChips,
  PlayerHeader,
  PlayerAvatar,
  PlayerIdentity,
  SlotBadge,
  CardMeta,
  WinPips,
  Pip,
  CpuBadge,
  PlayerStats,
  PowerBadge,
  PickupNote,
  StatCell,
  UltimateCell,
  UltimateProgress,
  OutNote,
  MonsterBadge,
  BossPaper,
  BossProgress,
  HudRight,
  ObjectivePaper,
  ObjectiveList,
  ObjectiveItem,
  ObjectiveMeta,
  ObjectiveStatusBadge,
  ObjectiveProgress,
  CampaignEventBanner,
  CampaignMessage,
  IntelLine,
  PatrolLine,
  MissionLine,
  MissionLineProgress,
} from './GameHUD.styles';
import { getCharacterDefinition } from '../../content';
import { getCharacterPowerTheme } from '../../content/characterPowerups';
import { loadStoryProgress } from '../../story/progress';
import RosterBoard from '../../assets/ninja-bomber-roster-hud.webp';
import { CharacterId } from '../../content/types';
import { playerSlotColor, playerSlotLabel, playerSlotTextColor } from './playerSlots';
import { HudLayout, hudLayout, hudZoom } from './scene/cameraFraming';
import { useViewportSize } from './useViewportSize';
import {
  cpuLevelLabel,
  deathNote,
  firstToText,
  isVersus,
  suddenDeathCue,
  SuddenDeathCue,
  winsBySlot,
  winsNeeded,
} from './matchCopy';

const CHARACTER_POSITIONS: Record<CharacterId, string> = {
  deidara: '0% 0%',
  naruto: '20% 0%',
  sasuke: '40% 0%',
  gaara: '60% 0%',
  minato: '80% 0%',
  itachi: '100% 0%',
};

const POWER_LABELS: Record<Power, string> = {
  AddBomb: 'Bomb capacity',
  BlastRangeUp: 'Blast radius',
  Detonator: 'Detonation Tag',
  RollerSkate: 'Movement boost',
  Invincibility: 'Shield',
  Ghost: 'Phase survival',
  Obstacle: 'Placeable cover',
  ClaySpider: 'Clay Spider',
  Rasengan: 'Rasengan',
  Sharingan: 'Sharingan',
  FTGKunai: 'FTG Kunai',
  CrowFeather: 'Crow Feather',
  SandArmor: 'Sand Armor',
  ChakraScroll: 'Chakra Scroll',
  CharacterFragment: 'Fragment',
};

const MONSTER_BADGE_COLORS: Record<MonsterKind, string> = {
  basic: '#f97316',
  smart: '#d6a45d',
  ghost: '#38bdf8',
  fork: '#a855f7',
};

const OBJECTIVE_STATUS_LABELS: Record<CampaignObjectiveStatus, string> = {
  active: 'Active',
  complete: 'Done',
  failed: 'Failed',
  locked: 'Locked',
};

// Local Arena mirrors the shared keyboard: P1 (W A S D) on the left, P3
// (U H J K, the middle keys) in the middle, P2 (the arrows) on the right.
const CARD_ORDER = [0, 2, 1];

type GameHUDProps = {
  state: GameEngineState;
};

type GameHUDRootProps = GameHUDProps & {
  scale: number;
};

// The engine publishes a new state every 50 ms tick (and on every move), but
// the HUD shows values that change a few times per second at most. Each panel
// below renders from a small plain-data model and is memoised on that model,
// so a tick that changes nothing visible skips the React + emotion work.
function sameModel<T>(prev: T, next: T): boolean {
  return JSON.stringify(prev) === JSON.stringify(next);
}

// Small original glyphs that stand in for the old BOMBS / BLAST / ULT words.
// They inherit the text colour and carry no text of their own.
const BombGlyph = () => (
  <svg viewBox="0 0 18 18" aria-hidden focusable="false">
    <circle cx="8" cy="11" r="6" fill="currentColor" />
    <path d="M11.5 6.5 14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M15.5 1.5v2M14.5 2.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const BlastGlyph = () => (
  <svg viewBox="0 0 18 18" aria-hidden focusable="false">
    <path
      d="M9 0.8 10.6 6 15.8 3.2 12.6 8 17.4 9 12.6 10.6 15.8 15 10.6 12.4 9 17.2 7.4 12.4 2.2 15 5.4 10.6 0.6 9 5.4 8 2.2 3.2 7.4 6Z"
      fill="currentColor"
    />
  </svg>
);

const StarGlyph = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 18 18" aria-hidden focusable="false">
    <path
      d="M9 1.2 11.3 6.3 16.8 6.8 12.6 10.5 13.9 16 9 13.1 4.1 16 5.4 10.5 1.2 6.8 6.7 6.3Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const LockGlyph = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 18 18" aria-hidden focusable="false">
    <path
      d={open ? 'M5 8V5.5a4 4 0 0 1 7.6-1.8' : 'M5 8V5.5a4 4 0 0 1 8 0V8'}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <rect x="3" y="8" width="12" height="9" rx="1" fill="currentColor" />
  </svg>
);

type PlayerCardModel = {
  slot: number;
  characterId: CharacterId;
  name: string;
  alive: boolean;
  // "Normal" for a CPU slot; null for a human.
  cpuLevel: string | null;
  // Three cards share a phone's width: the badge reads "CPU" alone there
  // (the card's label keeps the level).
  compactBadge: boolean;
  // Round wins and the wins that take the match; no pips for one round.
  wins: number;
  winsNeeded: number | null;
  outNote: string;
  bombsLeft: number;
  maxBombs: number;
  bombRange: number;
  ultimateCharge: number;
  activePowers: Power[];
  // Only the newest pickup: the note explains what the power just did.
  pickup: { id: string; power: Power } | null;
};

function toPlayerCardModel(
  state: GameEngineState,
  player: GameEngineState['players'][0],
  slot: number,
  wins: number,
  layout: HudLayout,
): PlayerCardModel {
  const latestPickup = state.pickupMessages
    .filter((message) => message.playerId === player.id)
    .slice(-1)[0];
  const versus = isVersus(state);
  return {
    slot,
    characterId: player.characterId,
    name: player.name,
    alive: player.alive,
    cpuLevel: cpuLevelLabel(state, slot),
    compactBadge: layout === 'phone' && state.players.length >= 3,
    wins,
    winsNeeded: versus && state.totalRounds > 1 ? winsNeeded(state.totalRounds) : null,
    outNote: player.alive ? '' : (deathNote(state, player) || player.deathReason || ''),
    // Naruto's clone and ultimate bombs can put more out than the base limit.
    bombsLeft: Math.max(0, player.maxBombs - player.activeBombs),
    maxBombs: player.maxBombs,
    bombRange: player.bombRange,
    ultimateCharge: Math.round(player.ultimateCharge),
    activePowers: Array.from(new Set(player.powerUps)).filter(
      (p) => isPowerUpActive(state, player.id, p)
        || !['Ghost', 'Invincibility'].includes(p),
    ),
    pickup: latestPickup ? { id: latestPickup.id, power: latestPickup.power } : null,
  };
}

// Compact card: slot badge and portrait for identity, the match score and
// who controls the slot, then the three numbers that matter mid-fight as
// glyph + digit (bombs ready, blast reach, ultimate). Static character text
// (title, bomb and ultimate names, vision) lives in the pause menu.
const PlayerCard = React.memo(({ model }: { model: PlayerCardModel }) => {
  const character = getCharacterDefinition(model.characterId);
  const slotLabel = playerSlotLabel(model.slot);
  const slotColor = playerSlotColor(model.slot);
  const displayName = character.name || model.name;
  const ultReady = model.ultimateCharge >= 100;
  const pickupTheme = model.pickup
    ? getCharacterPowerTheme(model.characterId, model.pickup.power)
    : null;
  const pips = model.winsNeeded;

  return (
    <PlayerCardPaper
      role="group"
      aria-label={`${slotLabel} ${displayName}${model.cpuLevel ? ` · CPU ${model.cpuLevel}` : ''}`}
      alive={model.alive}
      slotColor={slotColor}
      cardOrder={CARD_ORDER.indexOf(model.slot) >= 0 ? CARD_ORDER.indexOf(model.slot) : model.slot}
    >
      <PlayerHeader>
        <SlotBadge slotColor={slotColor} textColor={playerSlotTextColor(model.slot)} aria-hidden>
          {slotLabel}
        </SlotBadge>
        <PlayerAvatar
          image={RosterBoard}
          imagePosition={CHARACTER_POSITIONS[model.characterId]}
          role="img"
          aria-label={`${character.name} portrait`}
        />
        <PlayerIdentity>
          <strong>{displayName}</strong>
          {(pips !== null || model.cpuLevel) && (
            <CardMeta>
              {pips !== null && (
                <WinPips role="img" aria-label={`${model.wins} of ${pips} wins`}>
                  {Array.from({ length: pips }, (_, index) => (
                    <Pip key={index} filled={index < model.wins} />
                  ))}
                </WinPips>
              )}
              {model.cpuLevel && (
                <CpuBadge>
                  {model.compactBadge ? 'CPU' : `CPU · ${model.cpuLevel}`}
                </CpuBadge>
              )}
            </CardMeta>
          )}
          {model.alive ? (
            <PlayerStats>
              <StatCell role="img" aria-label={`Bombs ready ${model.bombsLeft} of ${model.maxBombs}`}>
                <BombGlyph />
                <strong>{`${model.bombsLeft}/${model.maxBombs}`}</strong>
              </StatCell>
              <StatCell role="img" aria-label={`Blast range ${model.bombRange}`}>
                <BlastGlyph />
                <strong>{model.bombRange}</strong>
              </StatCell>
              <UltimateCell ready={ultReady}>
                <StarGlyph filled={ultReady} />
                <UltimateProgress
                  aria-label={`${character.name} ultimate`}
                  aria-valuetext={ultReady ? 'Ready' : `${model.ultimateCharge}%`}
                  variant="determinate"
                  value={model.ultimateCharge}
                />
              </UltimateCell>
            </PlayerStats>
          ) : (
            <OutNote>
              <strong>Out</strong>
              {model.outNote && <span>{model.outNote}</span>}
            </OutNote>
          )}
        </PlayerIdentity>
      </PlayerHeader>
      {model.alive && model.activePowers.length > 0 && (
        <PowerChips>
          {model.activePowers.map((power) => {
            const theme = getCharacterPowerTheme(model.characterId, power);
            return (
              <PowerBadge
                key={power}
                color={theme.color}
                accent={theme.accent}
                title={`${POWER_LABELS[power]} · ${theme.label}`}
              >
                {theme.shortLabel}
              </PowerBadge>
            );
          })}
        </PowerChips>
      )}
      {model.alive && model.pickup && pickupTheme && (
        <PickupNote key={model.pickup.id} color={pickupTheme.color}>
          <strong>{pickupTheme.label}</strong>
          {' '}
          {pickupTheme.effect}
        </PickupNote>
      )}
    </PlayerCardPaper>
  );
}, (prev, next) => sameModel(prev.model, next.model));
PlayerCard.displayName = 'PlayerCard';

const CLOCK_WARNING_MS = 15000;

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

type MissionModel = {
  layout: HudLayout;
  statusLabel: string;
  statusText: string;
  threatCount: number;
  // Only the formatted clock is part of the model, so it changes once a second.
  clock: { value: string; urgent: boolean; phoneLabel: string } | null;
  gateOpen: boolean;
  suddenDeath: SuddenDeathCue;
};

function toMissionModel(state: GameEngineState, layout: HudLayout): MissionModel {
  let clock: MissionModel['clock'] = null;
  if (isSuddenDeathMode(state)) {
    const remaining = getRoundTimeRemainingMs(state);
    clock = {
      value: formatClock(remaining),
      urgent: remaining <= CLOCK_WARNING_MS,
      phoneLabel: state.totalRounds > 1 ? `R${Math.min(state.round, state.totalRounds)}` : 'Time',
    };
  }
  const { campaign } = state;
  let statusLabel = `Round ${Math.min(state.round, state.totalRounds)}`;
  let statusText = firstToText(state.totalRounds);
  if (campaign) {
    statusLabel = campaign.missionStep === 'boss' ? 'Boss arena' : 'Village ops';
    if (campaign.missionResult === 'success') statusLabel = 'Secured';
    if (campaign.missionResult === 'failed') statusLabel = 'Compromised';
    statusText = campaign.villageName;
  }
  return {
    layout,
    statusLabel,
    statusText,
    threatCount: state.monsters.length + (state.boss && state.boss.health > 0 ? 1 : 0),
    clock,
    gateOpen: !!campaign?.bossUnlocked,
    suddenDeath: suddenDeathCue(state),
  };
}

// Versus: "Round 2 · First to 2", threats and the clock. In the last 5 s
// and during sudden death the first two cells become one striped banner.
// Phones keep only the clock cell (never truncated: it has the strip's
// whole width and drops its caption to "R2"); their banner sits at the
// bottom edge instead.
const MissionSummary = React.memo(({ model }: { model: MissionModel }) => {
  const phone = model.layout === 'phone';
  return (
    <>
      <MissionStrip aria-label="match status">
        {!phone && model.suddenDeath && (
          // Not a live region: the caption already announces the lead-in and
          // the start, and this text changes every second.
          <SuddenDeathCell>
            <span>{model.suddenDeath.detail}</span>
            <strong>{model.suddenDeath.title}</strong>
          </SuddenDeathCell>
        )}
        {!phone && !model.suddenDeath && (
          <>
            <MissionStatus>
              <strong>{model.statusLabel}</strong>
              <span>
                <span className="visually-hidden">{' · '}</span>
                {model.statusText}
              </span>
            </MissionStatus>
            <MissionNode>
              <span>Threats</span>
              <strong>{model.threatCount}</strong>
            </MissionNode>
          </>
        )}
        {model.clock ? (
          // role="timer" is implicitly aria-live="off": screen readers are not
          // read every second; the milestones are captioned instead.
          <ClockNode role="timer" aria-label="round clock" urgent={model.clock.urgent}>
            <span>{phone ? model.clock.phoneLabel : 'Time'}</span>
            <strong>{model.clock.value}</strong>
          </ClockNode>
        ) : (
          <ClockNode urgent={false} role="img" aria-label={model.gateOpen ? 'Gate open' : 'Gate locked'}>
            <span>Gate</span>
            <strong>
              <LockGlyph open={model.gateOpen} />
              {!phone && (model.gateOpen ? 'Open' : 'Locked')}
            </strong>
          </ClockNode>
        )}
      </MissionStrip>
      {phone && model.suddenDeath && (
        <PhoneSuddenDeathBanner aria-label="sudden death">
          <strong>{model.suddenDeath.title}</strong>
          <span>{model.suddenDeath.detail}</span>
        </PhoneSuddenDeathBanner>
      )}
    </>
  );
}, (prev, next) => sameModel(prev.model, next.model));
MissionSummary.displayName = 'MissionSummary';

function getObjectiveProgress(objective: CampaignObjectiveState): number {
  if (objective.target <= 0) return 0;
  return Math.min(100, Math.max(0, (objective.current / objective.target) * 100));
}

function formatObjectiveDetail(objective: CampaignObjectiveState): string {
  if (objective.kind === 'rescue') {
    return `${objective.current}/${objective.target} targets reached`;
  }

  if (objective.kind === 'puzzle' && objective.puzzle) {
    return describePuzzleProgress(objective.puzzle).line;
  }

  if (objective.kind === 'miniBoss') {
    if (objective.status === 'complete') {
      return `${objective.gateLabel ?? objective.label} opened`;
    }
    return `Defeat ${objective.miniBossLabel ?? objective.label} and reach the gate`;
  }

  const secondsRemaining = Math.ceil((objective.ticksRemaining ?? 0) / 1000);
  const structureHp = objective.structureHp ?? objective.structureMaxHp ?? 0;
  const structureMaxHp = objective.structureMaxHp ?? structureHp;
  return `${secondsRemaining}s hold · ${structureHp}/${structureMaxHp} HP`;
}

// The one-line form of the active objective's progress.
function formatObjectiveShort(objective: CampaignObjectiveState): string {
  if (objective.kind === 'defense') {
    return `${Math.ceil((objective.ticksRemaining ?? 0) / 1000)}s`;
  }
  if (objective.kind === 'puzzle' && objective.puzzle) {
    return describePuzzleProgress(objective.puzzle).short;
  }
  return `${objective.current}/${objective.target}`;
}

type CampaignModel = {
  title: string;
  lives: string | null;
  message: string;
  event: { name: string; effectLabel: string; color: string } | null;
  stageReputation: number;
  secretsFound: number;
  secretsTotal: number;
  fragmentCount: number;
  objectives: {
    id: string;
    label: string;
    status: CampaignObjectiveStatus;
    progress: number;
    detail: string;
  }[];
  patrols: { name: string; kind: MonsterKind; count: number }[];
};

function toPatrols(state: GameEngineState): CampaignModel['patrols'] {
  const counts = state.monsters.reduce<
    Record<string, { count: number; kind: MonsterKind }>
  >((acc, monster) => {
    const current = acc[monster.name] ?? { count: 0, kind: monster.kind };
    acc[monster.name] = { ...current, count: current.count + 1 };
    return acc;
  }, {});
  return Object.entries(counts).map(([name, data]) => ({ name, ...data }));
}

function livesText(campaign: NonNullable<GameEngineState['campaign']>): string | null {
  return campaign.livesTotal
    ? `${campaign.livesRemaining ?? campaign.livesTotal}/${campaign.livesTotal}`
    : null;
}

function toCampaignModel(
  state: GameEngineState,
  storyProgress: ReturnType<typeof loadStoryProgress>,
): CampaignModel | null {
  if (!state.campaign) return null;
  const { campaign } = state;
  return {
    title: campaign.title,
    lives: livesText(campaign),
    message: campaign.message,
    event: campaign.event
      ? {
        name: campaign.event.name,
        effectLabel: campaign.event.effectLabel,
        color: campaign.event.color,
      }
      : null,
    stageReputation: storyProgress.reputation[campaign.stageId] ?? 0,
    secretsFound: campaign.discoveredSecrets.length,
    secretsTotal: campaign.hiddenAreas.length,
    fragmentCount: Object.values(storyProgress.fragments).reduce(
      (sum: number, count) => sum + (count ?? 0),
      0
    ),
    objectives: campaign.objectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      status: objective.status,
      progress: getObjectiveProgress(objective),
      detail: formatObjectiveDetail(objective),
    })),
    patrols: toPatrols(state),
  };
}

// One compact panel for the mission: the active objective gets its progress
// bar and detail, the rest collapse to one line. The boss gate state is in
// the match bar, and the patrol roster replaces the separate patrol panel.
const CampaignSummary = React.memo(({ model }: { model: CampaignModel }) => (
  <ObjectivePaper aria-label="mission objectives">
    <h2>
      {model.title}
      {model.lives && ` · Lives ${model.lives}`}
    </h2>
    <CampaignMessage>{model.message}</CampaignMessage>
    {model.event && (
      <CampaignEventBanner color={model.event.color}>
        <strong>{model.event.name}</strong>
        {' '}
        {model.event.effectLabel}
      </CampaignEventBanner>
    )}
    <ObjectiveList>
      {model.objectives.map((objective) => {
        const expanded = objective.status === 'active';
        return (
          <ObjectiveItem key={objective.id} status={objective.status}>
            <ObjectiveMeta>
              <strong>{objective.label}</strong>
              <ObjectiveStatusBadge status={objective.status}>
                {OBJECTIVE_STATUS_LABELS[objective.status]}
              </ObjectiveStatusBadge>
            </ObjectiveMeta>
            {expanded && (
              <>
                <ObjectiveProgress
                  aria-label={`${objective.label} progress`}
                  variant="determinate"
                  value={objective.progress}
                />
                <span>{objective.detail}</span>
              </>
            )}
          </ObjectiveItem>
        );
      })}
    </ObjectiveList>
    <IntelLine>
      <span>
        <strong>{model.stageReputation}</strong>
        {' '}
        Reputation
      </span>
      <span>
        <strong>{`${model.secretsFound}/${model.secretsTotal}`}</strong>
        {' '}
        Secrets
      </span>
      <span>
        <strong>{model.fragmentCount}</strong>
        {' '}
        Fragments
      </span>
    </IntelLine>
    {model.patrols.length > 0 && (
      <PatrolLine aria-label="enemy patrols">
        {model.patrols.map((group) => (
          <MonsterBadge key={group.name} color={MONSTER_BADGE_COLORS[group.kind]}>
            {`${group.name} ×${group.count}`}
          </MonsterBadge>
        ))}
      </PatrolLine>
    )}
  </ObjectivePaper>
), (prev, next) => sameModel(prev.model, next.model));
CampaignSummary.displayName = 'CampaignSummary';

type MissionLineModel = {
  label: string;
  progressText: string;
  progress: number;
  boss: boolean;
  lives: string | null;
};

function toMissionLineModel(state: GameEngineState): MissionLineModel | null {
  const { campaign, boss } = state;
  if (!campaign) return null;
  const lives = livesText(campaign);
  if (boss && boss.health > 0) {
    return {
      label: boss.name,
      progressText: `${boss.health}/${boss.maxHealth}`,
      progress: (boss.health / boss.maxHealth) * 100,
      boss: true,
      lives,
    };
  }
  const active = campaign.objectives.find((objective) => objective.status === 'active');
  if (!active) {
    return {
      label: campaign.bossUnlocked ? campaign.bossGateLabel || 'Gate open' : campaign.villageName,
      progressText: '',
      progress: 100,
      boss: false,
      lives,
    };
  }
  return {
    label: active.label,
    progressText: formatObjectiveShort(active),
    progress: getObjectiveProgress(active),
    boss: false,
    lives,
  };
}

// Phones and short landscape screens: the mission in one line (the active
// objective, or the boss once it is out, its progress, and lives). The
// full list is in the pause menu.
const CampaignLine = React.memo(({ model }: { model: MissionLineModel }) => (
  <MissionLine aria-label="mission objective" boss={model.boss}>
    <div>
      <strong>{model.label}</strong>
      {model.progressText && <span>{model.progressText}</span>}
      {model.lives && <em>{`Lives ${model.lives}`}</em>}
    </div>
    <MissionLineProgress
      aria-label={`${model.label} ${model.boss ? 'health' : 'progress'}`}
      variant="determinate"
      value={model.progress}
      boss={model.boss}
    />
  </MissionLine>
), (prev, next) => sameModel(prev.model, next.model));
CampaignLine.displayName = 'CampaignLine';

type BossModel = {
  name: string;
  color: string;
  health: number;
  maxHealth: number;
  phase: number;
  tails: number;
  currentAbility: string;
  hazardCount: number;
};

function toBossModel(state: GameEngineState): BossModel | null {
  if (!state.boss) return null;
  return {
    name: state.boss.name,
    color: state.boss.color,
    health: state.boss.health,
    maxHealth: state.boss.maxHealth,
    phase: state.boss.phase,
    tails: state.boss.tails,
    currentAbility: state.boss.currentAbility,
    hazardCount: state.hazards.length,
  };
}

const BossSummary = React.memo(({ model }: { model: BossModel }) => {
  const health = (model.health / model.maxHealth) * 100;

  return (
    <BossPaper aria-label={`${model.name} boss status`} color={model.color}>
      <div>
        <strong>{model.name}</strong>
        <span>{`Phase ${model.phase} · ${model.tails} tail chakra`}</span>
        <strong>{`${model.health}/${model.maxHealth} HP`}</strong>
      </div>
      <BossProgress
        aria-label={`${model.name} health`}
        variant="determinate"
        value={health}
      />
      <span>{`${model.currentAbility} · ${model.hazardCount} danger zones`}</span>
    </BossPaper>
  );
}, (prev, next) => sameModel(prev.model, next.model));
BossSummary.displayName = 'BossSummary';

function useStoryProgress(state: GameEngineState) {
  return React.useMemo(() => loadStoryProgress(), [
    state.campaign?.stageId,
    state.campaign?.discoveredSecrets.length,
    state.phase,
  ]);
}

/** The full mission list, for the pause menu (the HUD shows one line on phones). */
export function PauseMissionDetails({ state }: GameHUDProps) {
  const campaignModel = toCampaignModel(state, useStoryProgress(state));
  return campaignModel ? <CampaignSummary model={campaignModel} /> : null;
}

export function GameHUD({ state, scale }: GameHUDRootProps) {
  const viewport = useViewportSize();
  const layout = hudLayout(viewport.width, viewport.height);
  const zoom = hudZoom(scale, viewport.width, viewport.height);
  const storyProgress = useStoryProgress(state);
  // Full panels where there is room; one line on phones and short screens.
  const compact = layout !== 'row';
  const campaignModel = compact ? null : toCampaignModel(state, storyProgress);
  const bossModel = compact ? null : toBossModel(state);
  const lineModel = compact ? toMissionLineModel(state) : null;
  const wins = winsBySlot(state);

  return (
    <HudRoot hudZoom={zoom}>
      {/* A Training Dojo room has no round or clock: its goal line takes this place. */}
      {state.config.mode !== 'training' && (
        <MissionSummary model={toMissionModel(state, layout)} />
      )}
      <PlayerCards>
        {state.players.map((player, index) => (
          <PlayerCard
            key={player.id}
            model={toPlayerCardModel(state, player, index, wins[index], layout)}
          />
        ))}
      </PlayerCards>
      {(bossModel || campaignModel) && (
        <HudRight>
          {bossModel && <BossSummary model={bossModel} />}
          {campaignModel && <CampaignSummary model={campaignModel} />}
        </HudRight>
      )}
      {lineModel && <CampaignLine model={lineModel} />}
    </HudRoot>
  );
}
