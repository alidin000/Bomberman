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
  PlayerCards,
  PlayerCardPaper,
  PowerChips,
  PlayerHeader,
  PlayerAvatar,
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
} from './GameHUD.styles';
import { getCharacterDefinition } from '../../content';
import { getCharacterPowerTheme } from '../../content/characterPowerups';

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

function PlayerCard({
  player,
  state,
}: {
  player: GameEngineState['players'][0];
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
        <PlayerAvatar color={player.color} />
        <div>
          <Typography variant="subtitle1" fontWeight="bold" color="#f8fafc">
            {character.name || player.name}
          </Typography>
          <Typography variant="caption" color={player.alive ? '#86efac' : '#fca5a5'}>
            {player.alive ? character.title : 'Sealed'}
          </Typography>
        </div>
      </PlayerHeader>
      <PlayerStats>
        <StatPill>
          Clay
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
      <UltimateProgress variant="determinate" value={player.ultimateCharge} />
    </PlayerCardPaper>
  );
}

function getObjectiveProgress(objective: CampaignObjectiveState): number {
  if (objective.target <= 0) return 0;
  return Math.min(100, Math.max(0, (objective.current / objective.target) * 100));
}

function formatObjectiveDetail(objective: CampaignObjectiveState): string {
  if (objective.kind === 'rescue') {
    return `${objective.current}/${objective.target} villagers rescued`;
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
  if (!state.campaign) return null;

  return (
    <ObjectivePaper elevation={4}>
      <Typography variant="overline" fontWeight="bold" letterSpacing="0.12em">
        {state.campaign.title}
      </Typography>
      <Typography variant="caption" display="block" color="#d1fae5">
        {state.campaign.message}
      </Typography>
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
      <Typography variant="overline" fontWeight="bold" letterSpacing="0.12em" display="block">
        {state.boss.name}
      </Typography>
      <UltimateProgress variant="determinate" value={health} />
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
        Chakra Beasts
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

export function GameHUD({ state }: GameHUDProps) {
  return (
    <HudRoot>
      <PlayerCards>
        {state.players.map((player) => (
          <PlayerCard key={player.id} player={player} state={state} />
        ))}
      </PlayerCards>
      <HudRight>
        <CampaignSummary state={state} />
        <BossSummary state={state} />
        <MonsterSummary state={state} />
      </HudRight>
    </HudRoot>
  );
}
