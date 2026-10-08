/* eslint-disable object-curly-newline, comma-dangle */
import React from 'react';
import { Typography } from '@mui/material';
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
  PlayerCards,
  PlayerCardPaper,
  PowerChips,
  PlayerHeader,
  PlayerAvatar,
  PlayerStatusRibbon,
  PlayerStats,
  PowerBadge,
  PickupNotes,
  PickupNote,
  PickupNoteTitle,
  StatPill,
  HudRight,
  MonsterPaper,
  MonsterChips,
  MonsterBadge,
  UltimateProgress,
  BossPaper,
  AbilityPanel,
  AbilityRow,
  ObjectivePaper,
  ObjectiveList,
  ObjectiveItem,
  ObjectiveMeta,
  ObjectiveStatusBadge,
  ObjectiveProgress,
  CampaignEventBanner,
  IntelGrid,
  IntelPill,
} from './GameHUD.styles';
import { getCharacterDefinition } from '../../content';
import { getCharacterPowerTheme } from '../../content/characterPowerups';
import { loadStoryProgress } from '../../story/progress';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import { CharacterId } from '../../content/types';

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
  playerNumber: number;
  characterId: CharacterId;
  name: string;
  color: string;
  alive: boolean;
  deathReason?: string;
  bombsLeft: number;
  maxBombs: number;
  bombRange: number;
  ultimateCharge: number;
  activePowers: Power[];
  pickups: { id: string; power: Power }[];
};

function toPlayerCardModel(
  state: GameEngineState,
  player: GameEngineState['players'][0],
  playerNumber: number,
): PlayerCardModel {
  return {
    playerNumber,
    characterId: player.characterId,
    name: player.name,
    color: player.color,
    alive: player.alive,
    deathReason: player.deathReason,
    // Naruto's clone and ultimate bombs can put more out than the base limit.
    bombsLeft: Math.max(0, player.maxBombs - player.activeBombs),
    maxBombs: player.maxBombs,
    bombRange: player.bombRange,
    ultimateCharge: player.ultimateCharge,
    activePowers: Array.from(new Set(player.powerUps)).filter(
      (p) => isPowerUpActive(state, player.id, p)
        || !['Ghost', 'Invincibility'].includes(p),
    ),
    pickups: state.pickupMessages
      .filter((message) => message.playerId === player.id)
      .slice(-2)
      .map((message) => ({ id: message.id, power: message.power })),
  };
}

const PlayerCard = React.memo(({ model }: { model: PlayerCardModel }) => {
  const character = getCharacterDefinition(model.characterId);

  return (
    <PlayerCardPaper alive={model.alive} color={model.color}>
      <PlayerHeader>
        <PlayerAvatar
          color={model.color}
          image={RosterBoard}
          imagePosition={CHARACTER_POSITIONS[model.characterId]}
          role="img"
          aria-label={`${character.name} portrait`}
        />
        <div>
          <Typography variant="subtitle1" fontWeight="bold" color="var(--anime-ink)">
            {`P${model.playerNumber} · ${character.name || model.name}`}
          </Typography>
          <Typography variant="caption" color={model.alive ? 'var(--anime-teal)' : '#8f2f26'}>
            {model.alive ? character.title : 'Sealed'}
          </Typography>
          <PlayerStatusRibbon alive={model.alive} color={model.color}>
            {model.alive ? 'Ready' : 'Sealed'}
          </PlayerStatusRibbon>
          {!model.alive && model.deathReason && (
            <Typography variant="caption" display="block" color="#8f2f26">
              {model.deathReason}
            </Typography>
          )}
        </div>
      </PlayerHeader>
      <PlayerStats>
        <StatPill>
          Bombs
          {' '}
          {model.bombsLeft}
          /
          {model.maxBombs}
        </StatPill>
        <StatPill>
          Blast
          {' '}
          {model.bombRange}
        </StatPill>
        <StatPill>
          Vision
          {' '}
          {character.visionRadius}
        </StatPill>
      </PlayerStats>
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
      {model.pickups.length > 0 && (
        <PickupNotes>
          {model.pickups.map((message) => {
            const theme = getCharacterPowerTheme(model.characterId, message.power);
            return (
              <PickupNote key={message.id} color={theme.color}>
                <PickupNoteTitle>{theme.label}</PickupNoteTitle>
                {theme.effect}
              </PickupNote>
            );
          })}
        </PickupNotes>
      )}
      <AbilityPanel color={character.secondaryColor}>
        <AbilityRow>
          <strong>Bomb</strong>
          <span>{character.basicBomb}</span>
        </AbilityRow>
        <AbilityRow>
          <strong>Ult</strong>
          <span>{character.ultimate}</span>
        </AbilityRow>
      </AbilityPanel>
      <UltimateProgress
        aria-label={`${character.name} ultimate charge`}
        variant="determinate"
        value={model.ultimateCharge}
      />
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
  alivePlayers: number;
  totalPlayers: number;
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
    alivePlayers: state.players.filter((player) => player.alive).length,
    totalPlayers: state.players.length,
    threatCount: state.monsters.length + (state.boss && state.boss.health > 0 ? 1 : 0),
    clock,
    gate: getGateStatus(state),
  };
}

const MissionSummary = React.memo(({ model }: { model: MissionModel }) => (
  <MissionStrip aria-label="match status">
    <MissionStatus>
      <strong>{model.status}</strong>
      <span>{model.title}</span>
    </MissionStatus>
    <MissionNode>
      <span>Squad</span>
      <strong>
        {model.alivePlayers}
        /
        {model.totalPlayers}
      </strong>
    </MissionNode>
    <MissionNode>
      <span>Threats</span>
      <strong>{model.threatCount}</strong>
    </MissionNode>
    {model.clock ? (
      <MissionNode
        aria-label="round clock"
        sx={model.clock.urgent ? { '& strong': { color: '#fca5a5' } } : undefined}
      >
        <span>{model.clock.label}</span>
        <strong>{model.clock.value}</strong>
      </MissionNode>
    ) : (
      <MissionNode>
        <span>Gate</span>
        <strong>{model.gate}</strong>
      </MissionNode>
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
  bossGateLabel: string;
  bossUnlocked: boolean;
};

function toCampaignModel(
  state: GameEngineState,
  storyProgress: ReturnType<typeof loadStoryProgress>,
): CampaignModel | null {
  if (!state.campaign) return null;
  const { campaign } = state;
  return {
    title: campaign.title,
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
    bossGateLabel: campaign.bossGateLabel,
    bossUnlocked: campaign.bossUnlocked,
  };
}

const CampaignSummary = React.memo(({ model }: { model: CampaignModel }) => (
  <ObjectivePaper elevation={4}>
    <Typography variant="overline" fontWeight="bold" letterSpacing={0}>
      {model.title}
    </Typography>
    <Typography variant="caption" display="block" color="var(--anime-line)">
      {model.message}
    </Typography>
    {model.event && (
      <CampaignEventBanner color={model.event.color}>
        <Typography variant="caption" display="block" fontWeight="bold">
          {model.event.name}
        </Typography>
        <Typography variant="caption" color="var(--anime-line)">
          {model.event.effectLabel}
        </Typography>
      </CampaignEventBanner>
    )}
    <IntelGrid>
      <IntelPill>
        <strong>{model.stageReputation}</strong>
        Reputation
      </IntelPill>
      <IntelPill>
        <strong>
          {model.secretsFound}
          /
          {model.secretsTotal}
        </strong>
        Secrets
      </IntelPill>
      <IntelPill>
        <strong>{model.fragmentCount}</strong>
        Fragments
      </IntelPill>
    </IntelGrid>
    <ObjectiveList>
      {model.objectives.map((objective) => (
        <ObjectiveItem key={objective.id}>
          <ObjectiveMeta>
            <Typography variant="subtitle2" fontWeight="bold">
              {objective.label}
            </Typography>
            <ObjectiveStatusBadge status={objective.status}>
              {OBJECTIVE_STATUS_LABELS[objective.status]}
            </ObjectiveStatusBadge>
          </ObjectiveMeta>
          <ObjectiveProgress
            aria-label={`${objective.label} progress`}
            variant="determinate"
            value={objective.progress}
          />
          <Typography variant="caption" color="var(--anime-line)">
            {objective.detail}
          </Typography>
        </ObjectiveItem>
      ))}
    </ObjectiveList>
    <Typography
      variant="caption"
      color={model.bossUnlocked ? 'var(--anime-teal)' : 'var(--anime-line)'}
      display="block"
      marginTop={1}
    >
      {model.bossGateLabel}
      {' '}
      ·
      {' '}
      {model.bossUnlocked ? 'Open' : 'Sealed'}
    </Typography>
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
    <BossPaper elevation={4} color={model.color}>
      <Typography variant="overline" fontWeight="bold" letterSpacing={0} display="block">
        {model.name}
      </Typography>
      <UltimateProgress
        aria-label={`${model.name} health`}
        variant="determinate"
        value={health}
      />
      <Typography variant="caption" display="block" color="var(--anime-line)">
        Phase
        {' '}
        {model.phase}
        {' '}
        ·
        {' '}
        {model.tails}
        {' '}
        tail chakra
        {' '}
        ·
        {' '}
        {model.health}
        /
        {model.maxHealth}
        {' '}
        HP
      </Typography>
      <Typography variant="caption" display="block" color="#8f2f26">
        {model.currentAbility}
        {' '}
        ·
        {' '}
        {model.hazardCount}
        {' '}
        danger zones
      </Typography>
    </BossPaper>
  );
}, (prev, next) => sameModel(prev.model, next.model));
BossSummary.displayName = 'BossSummary';

type MonsterModel = {
  roaming: number;
  groups: { name: string; kind: MonsterKind; count: number }[];
};

function toMonsterModel(state: GameEngineState): MonsterModel {
  const counts = state.monsters.reduce<
    Record<string, { count: number; kind: MonsterKind }>
  >((acc, monster) => {
    const current = acc[monster.name] ?? { count: 0, kind: monster.kind };
    acc[monster.name] = { ...current, count: current.count + 1 };
    return acc;
  }, {});
  return {
    roaming: state.monsters.length,
    groups: Object.entries(counts).map(([name, data]) => ({ name, ...data })),
  };
}

const MonsterSummary = React.memo(({ model }: { model: MonsterModel }) => (
  <MonsterPaper elevation={4}>
    <Typography variant="subtitle2" fontWeight="bold">
      Enemy Patrols
      {' '}
      ·
      {' '}
      {model.roaming}
      {' '}
      roaming
    </Typography>
    <MonsterChips>
      {model.groups.map((group) => (
        <MonsterBadge key={group.name} color={MONSTER_BADGE_COLORS[group.kind]}>
          {group.name}
          {' '}
          x
          {group.count}
        </MonsterBadge>
      ))}
    </MonsterChips>
  </MonsterPaper>
), (prev, next) => sameModel(prev.model, next.model));
MonsterSummary.displayName = 'MonsterSummary';

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
            model={toPlayerCardModel(state, player, index + 1)}
          />
        ))}
      </PlayerCards>
      {bossModel && <BossSummary model={bossModel} />}
      <HudRight>
        {campaignModel && <CampaignSummary model={campaignModel} />}
        <MonsterSummary model={toMonsterModel(state)} />
      </HudRight>
    </HudRoot>
  );
}
