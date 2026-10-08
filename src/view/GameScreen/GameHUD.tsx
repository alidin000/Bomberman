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

function PlayerCard({
  player,
  playerNumber,
  state,
}: {
  player: GameEngineState['players'][0];
  playerNumber: number;
  state: GameEngineState;
}) {
  const activePowers = Array.from(new Set(player.powerUps)).filter(
    (p) => isPowerUpActive(state, player.id, p)
      || !['Ghost', 'Invincibility'].includes(p),
  );
  const pickupMessages = state.pickupMessages
    .filter((message) => message.playerId === player.id)
    .slice(-2);
  const character = getCharacterDefinition(player.characterId);

  return (
    <PlayerCardPaper alive={player.alive} color={player.color}>
      <PlayerHeader>
        <PlayerAvatar
          color={player.color}
          image={RosterBoard}
          imagePosition={CHARACTER_POSITIONS[player.characterId]}
          role="img"
          aria-label={`${character.name} portrait`}
        />
        <div>
          <Typography variant="subtitle1" fontWeight="bold" color="#f8fafc">
            {`P${playerNumber} · ${character.name || player.name}`}
          </Typography>
          <Typography variant="caption" color={player.alive ? '#86efac' : '#fca5a5'}>
            {player.alive ? character.title : 'Sealed'}
          </Typography>
          <PlayerStatusRibbon alive={player.alive} color={player.color}>
            {player.alive ? 'Ready' : 'Sealed'}
          </PlayerStatusRibbon>
          {!player.alive && player.deathReason && (
            <Typography variant="caption" display="block" color="#fecaca">
              {player.deathReason}
            </Typography>
          )}
        </div>
      </PlayerHeader>
      <PlayerStats>
        <StatPill>
          Bombs
          {' '}
          {player.maxBombs - player.activeBombs}
          /
          {player.maxBombs}
        </StatPill>
        <StatPill>
          Blast
          {' '}
          {player.bombRange}
        </StatPill>
        <StatPill>
          Vision
          {' '}
          {character.visionRadius}
        </StatPill>
      </PlayerStats>
      <PowerChips>
        {activePowers.map((power) => {
          const theme = getCharacterPowerTheme(player.characterId, power);
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
      {pickupMessages.length > 0 && (
        <PickupNotes>
          {pickupMessages.map((message) => {
            const theme = getCharacterPowerTheme(player.characterId, message.power);
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
        value={player.ultimateCharge}
      />
    </PlayerCardPaper>
  );
}

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

function MissionSummary({ state }: GameHUDProps) {
  const alivePlayers = state.players.filter((player) => player.alive).length;
  const threatCount = state.monsters.length + (state.boss && state.boss.health > 0 ? 1 : 0);

  return (
    <MissionStrip aria-label="match status">
      <MissionStatus>
        <strong>{getMissionStatus(state)}</strong>
        <span>{getMissionTitle(state)}</span>
      </MissionStatus>
      <MissionNode>
        <span>Squad</span>
        <strong>
          {alivePlayers}
          /
          {state.players.length}
        </strong>
      </MissionNode>
      <MissionNode>
        <span>Threats</span>
        <strong>{threatCount}</strong>
      </MissionNode>
      <MissionNode>
        <span>Gate</span>
        <strong>{getGateStatus(state)}</strong>
      </MissionNode>
    </MissionStrip>
  );
}

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

function CampaignSummary({ state }: GameHUDProps) {
  const storyProgress = React.useMemo(() => loadStoryProgress(), [
    state.campaign?.stageId,
    state.campaign?.discoveredSecrets.length,
    state.phase,
  ]);
  if (!state.campaign) return null;
  const { event, stageId } = state.campaign;
  const stageReputation = storyProgress.reputation[stageId] ?? 0;
  const fragmentCount = Object.values(storyProgress.fragments).reduce(
    (sum, count) => sum + (count ?? 0),
    0
  );

  return (
    <ObjectivePaper elevation={4}>
      <Typography variant="overline" fontWeight="bold" letterSpacing={0}>
        {state.campaign.title}
      </Typography>
      <Typography variant="caption" display="block" color="#d1fae5">
        {state.campaign.message}
      </Typography>
      {event && (
        <CampaignEventBanner color={event.color}>
          <Typography variant="caption" display="block" fontWeight="bold">
            {event.name}
          </Typography>
          <Typography variant="caption" color="#e5e7eb">
            {event.effectLabel}
          </Typography>
        </CampaignEventBanner>
      )}
      <IntelGrid>
        <IntelPill>
          <strong>{stageReputation}</strong>
          Reputation
        </IntelPill>
        <IntelPill>
          <strong>
            {state.campaign.discoveredSecrets.length}
            /
            {state.campaign.hiddenAreas.length}
          </strong>
          Secrets
        </IntelPill>
        <IntelPill>
          <strong>{fragmentCount}</strong>
          Fragments
        </IntelPill>
      </IntelGrid>
      <ObjectiveList>
        {state.campaign.objectives.map((objective) => (
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
              value={getObjectiveProgress(objective)}
            />
            <Typography variant="caption" color="#e5e7eb">
              {formatObjectiveDetail(objective)}
            </Typography>
          </ObjectiveItem>
        ))}
      </ObjectiveList>
      <Typography
        variant="caption"
        color={state.campaign.bossUnlocked ? '#86efac' : '#cbd5e1'}
        display="block"
        marginTop={1}
      >
        {state.campaign.bossGateLabel}
        {' '}
        ·
        {' '}
        {state.campaign.bossUnlocked ? 'Open' : 'Sealed'}
      </Typography>
    </ObjectivePaper>
  );
}

function BossSummary({ state }: GameHUDProps) {
  if (!state.boss) return null;
  const health = (state.boss.health / state.boss.maxHealth) * 100;

  return (
    <BossPaper elevation={4} color={state.boss.color}>
      <Typography variant="overline" fontWeight="bold" letterSpacing={0} display="block">
        {state.boss.name}
      </Typography>
      <UltimateProgress
        aria-label={`${state.boss.name} health`}
        variant="determinate"
        value={health}
      />
      <Typography variant="caption" display="block" color="#e5e7eb">
        Phase
        {' '}
        {state.boss.phase}
        {' '}
        ·
        {' '}
        {state.boss.tails}
        {' '}
        tail chakra
        {' '}
        ·
        {' '}
        {state.boss.health}
        /
        {state.boss.maxHealth}
        {' '}
        HP
      </Typography>
      <Typography variant="caption" display="block" color="warning.light">
        {state.boss.currentAbility}
        {' '}
        ·
        {' '}
        {state.hazards.length}
        {' '}
        danger zones
      </Typography>
    </BossPaper>
  );
}

function MonsterSummary({ state }: GameHUDProps) {
  const counts = state.monsters.reduce<
    Record<string, { count: number; kind: MonsterKind }>
  >((acc, monster) => {
    const current = acc[monster.name] ?? { count: 0, kind: monster.kind };
    acc[monster.name] = { ...current, count: current.count + 1 };
    return acc;
  }, {});

  return (
    <MonsterPaper elevation={4}>
      <Typography variant="subtitle2" fontWeight="bold">
        Enemy Patrols
        {' '}
        ·
        {' '}
        {state.monsters.length}
        {' '}
        roaming
      </Typography>
      <MonsterChips>
        {Object.entries(counts).map(([name, data]) => (
          <MonsterBadge key={name} color={MONSTER_BADGE_COLORS[data.kind]}>
            {name}
            {' '}
            x
            {data.count}
          </MonsterBadge>
        ))}
      </MonsterChips>
    </MonsterPaper>
  );
}

export function GameHUD({ state, scale }: GameHUDRootProps) {
  return (
    <HudRoot hudScale={scale}>
      <MissionSummary state={state} />
      <PlayerCards>
        {state.players.map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            playerNumber={index + 1}
            state={state}
          />
        ))}
      </PlayerCards>
      <BossSummary state={state} />
      <HudRight>
        <CampaignSummary state={state} />
        <MonsterSummary state={state} />
      </HudRight>
    </HudRoot>
  );
}
