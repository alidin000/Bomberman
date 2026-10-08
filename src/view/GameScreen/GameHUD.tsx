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
import {
  HudRoot,
  MissionStrip,
  MissionStatus,
  MissionNode,
  ClockNode,
  PlayerCards,
  PlayerCardPaper,
  PowerChips,
  PlayerHeader,
  PlayerAvatar,
  PlayerIdentity,
  SlotBadge,
  PlayerStats,
  PowerBadge,
  PickupNote,
  StatCell,
  UltimateCell,
  UltimateProgress,
  SealedNote,
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
} from './GameHUD.styles';
import { getCharacterDefinition } from '../../content';
import { getCharacterPowerTheme } from '../../content/characterPowerups';
import { loadStoryProgress } from '../../story/progress';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import { CharacterId } from '../../content/types';
import { playerSlotColor, playerSlotLabel, playerSlotTextColor } from './playerSlots';
import { isCpuSlot } from '../../ai/controllers';

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

type PlayerCardModel = {
  slot: number;
  cpu: boolean;
  characterId: CharacterId;
  name: string;
  alive: boolean;
  deathReason?: string;
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
): PlayerCardModel {
  const latestPickup = state.pickupMessages
    .filter((message) => message.playerId === player.id)
    .slice(-1)[0];
  return {
    slot,
    cpu: isCpuSlot(state.config, slot),
    characterId: player.characterId,
    name: player.name,
    alive: player.alive,
    deathReason: player.deathReason,
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

// Compact card: slot badge and portrait for identity, then the three numbers
// that matter mid-fight (bombs ready, blast reach, ultimate). Static character
// text (title, bomb and ultimate names, vision) lives in the pause menu.
const PlayerCard = React.memo(({ model }: { model: PlayerCardModel }) => {
  const character = getCharacterDefinition(model.characterId);
  const slotLabel = playerSlotLabel(model.slot);
  const slotColor = playerSlotColor(model.slot);
  const displayName = character.name || model.name;
  const ultReady = model.ultimateCharge >= 100;
  const pickupTheme = model.pickup
    ? getCharacterPowerTheme(model.characterId, model.pickup.power)
    : null;

  return (
    <PlayerCardPaper
      role="group"
      aria-label={`${slotLabel}${model.cpu ? ' · CPU' : ''} ${displayName}`}
      alive={model.alive}
      slotColor={slotColor}
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
          <strong>{model.cpu ? `${displayName} · CPU` : displayName}</strong>
          {model.alive ? (
            <PlayerStats>
              <StatCell>
                <span>Bombs</span>
                <strong>{`${model.bombsLeft}/${model.maxBombs}`}</strong>
              </StatCell>
              <StatCell>
                <span>Blast</span>
                <strong>{model.bombRange}</strong>
              </StatCell>
              <UltimateCell ready={ultReady}>
                <span>{ultReady ? 'Ult ready' : `Ult ${model.ultimateCharge}%`}</span>
                <UltimateProgress
                  aria-label={`${character.name} ultimate charge`}
                  variant="determinate"
                  value={model.ultimateCharge}
                />
              </UltimateCell>
            </PlayerStats>
          ) : (
            <SealedNote>
              <strong>Sealed</strong>
              {model.deathReason && <span>{model.deathReason}</span>}
            </SealedNote>
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

function getMissionTitle(state: GameEngineState): string {
  if (state.campaign) return state.campaign.villageName;
  return `Round ${Math.min(state.round, state.totalRounds)} of ${state.totalRounds}`;
}

function getMissionStatus(state: GameEngineState): string {
  if (state.campaign) {
    if (state.campaign.missionResult === 'success') return 'Secured';
    if (state.campaign.missionResult === 'failed') return 'Compromised';
    return state.campaign.missionStep === 'boss' ? 'Boss arena' : 'Village ops';
  }
  return state.phase === 'playing' ? 'Local arena' : 'Result';
}

function getGateStatus(state: GameEngineState): string {
  if (!state.campaign) return 'Arena';
  return state.campaign.bossUnlocked ? 'Open' : 'Sealed';
}

const CLOCK_WARNING_MS = 15000;

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

type MissionModel = {
  status: string;
  title: string;
  threatCount: number;
  // Only the formatted clock is part of the model, so it changes once a second.
  clock: { label: string; value: string; urgent: boolean } | null;
  gate: string;
};

function toMissionModel(state: GameEngineState): MissionModel {
  let clock: MissionModel['clock'] = null;
  if (isSuddenDeathMode(state)) {
    const remaining = getRoundTimeRemainingMs(state);
    clock = {
      label: remaining > 0 ? 'Clock' : 'Sudden death',
      value: remaining > 0 ? formatClock(remaining) : 'Walls closing',
      urgent: remaining <= CLOCK_WARNING_MS,
    };
  }
  return {
    status: getMissionStatus(state),
    title: getMissionTitle(state),
    threatCount: state.monsters.length + (state.boss && state.boss.health > 0 ? 1 : 0),
    clock,
    gate: getGateStatus(state),
  };
}

// Squad (alive/total) is gone: the player cards already show who is sealed.
// The clock is the largest number; in its last 15 s it inverts to a solid
// vermilion plate (shape + fill, not a pale tint) so urgency stays readable.
const MissionSummary = React.memo(({ model }: { model: MissionModel }) => (
  <MissionStrip aria-label="match status">
    <MissionStatus>
      <strong>{model.status}</strong>
      <span>{model.title}</span>
    </MissionStatus>
    <MissionNode>
      <span>Threats</span>
      <strong>{model.threatCount}</strong>
    </MissionNode>
    {model.clock ? (
      // role="timer" is implicitly aria-live="off": screen readers are not
      // read every second; the milestones are captioned instead.
      <ClockNode role="timer" aria-label="round clock" urgent={model.clock.urgent}>
        <span>{model.clock.label}</span>
        <strong>{model.clock.value}</strong>
      </ClockNode>
    ) : (
      <ClockNode urgent={false}>
        <span>Gate</span>
        <strong>{model.gate}</strong>
      </ClockNode>
    )}
  </MissionStrip>
), (prev, next) => sameModel(prev.model, next.model));
MissionSummary.displayName = 'MissionSummary';

function getObjectiveProgress(objective: CampaignObjectiveState): number {
  if (objective.target <= 0) return 0;
  return Math.min(100, Math.max(0, (objective.current / objective.target) * 100));
}

function formatObjectiveDetail(objective: CampaignObjectiveState): string {
  if (objective.kind === 'rescue') {
    return `${objective.current}/${objective.target} targets reached`;
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

function toCampaignModel(
  state: GameEngineState,
  storyProgress: ReturnType<typeof loadStoryProgress>,
): CampaignModel | null {
  if (!state.campaign) return null;
  const { campaign } = state;
  return {
    title: campaign.title,
    lives: campaign.livesTotal
      ? `${campaign.livesRemaining ?? campaign.livesTotal}/${campaign.livesTotal}`
      : null,
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

export function GameHUD({ state, scale }: GameHUDRootProps) {
  const storyProgress = React.useMemo(() => loadStoryProgress(), [
    state.campaign?.stageId,
    state.campaign?.discoveredSecrets.length,
    state.phase,
  ]);
  const campaignModel = toCampaignModel(state, storyProgress);
  const bossModel = toBossModel(state);

  return (
    <HudRoot hudScale={scale}>
      <MissionSummary model={toMissionModel(state)} />
      <PlayerCards>
        {state.players.map((player, index) => (
          <PlayerCard
            key={player.id}
            model={toPlayerCardModel(state, player, index)}
          />
        ))}
      </PlayerCards>
      {(bossModel || campaignModel) && (
        <HudRight>
          {bossModel && <BossSummary model={bossModel} />}
          {campaignModel && <CampaignSummary model={campaignModel} />}
        </HudRight>
      )}
    </HudRoot>
  );
}
