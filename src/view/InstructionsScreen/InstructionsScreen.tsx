/* eslint-disable object-curly-newline, max-len */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShieldIcon from '@mui/icons-material/Shield';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  InstructionsBackground,
  StyledDialog,
  StyledDialogTitle,
  StyledDialogContent,
  DialogActions,
  BackButton,
  ManualIntro,
  ManualHero,
  ManualHeroTitle,
  ManualHeroMeta,
  ManualPill,
  ManualLayout,
  ManualNav,
  ManualNavLink,
  ManualRuleGrid,
  ManualRuleCard,
  ManualRuleHeader,
  ManualGrid,
  ManualSection,
  ManualSectionTitle,
  ManualList,
  ManualItem,
  ManualBadge,
  ManualFlow,
  ManualFlowStep,
  ManualDiagram,
  ManualLegend,
  DiagramCell,
  CharacterManualGrid,
  CharacterManualCard,
} from './InstructionsScreen.styles';
import {
  CHARACTER_DEFINITIONS,
  CAMPAIGN_FLOW_STEPS,
  CAMPAIGN_VILLAGES,
  STAGE_DEFINITIONS,
  getBossDefinition,
} from '../../content';
import { getCharacterPowerLoadout } from '../../content/characterPowerups';

const LOCAL_BEASTS = [
  'Leaf: Rogue Genin, Rogue Chunin, Training Clone.',
  'Sand: Puppet Scout, Scorpion Puppet, Sand Ninja.',
  'Mist: Mist Ninja, Water Clone, Hunter Ninja.',
  'Cloud: Lightning Ninja, Thunder Hawk, Cloud Samurai.',
  'Akatsuki: White Zetsu, Crow Swarm, Akatsuki Cultist.',
];

const QUICK_RULES = [
  {
    step: '01',
    title: 'Pick A Mode',
    body: 'Campaign is a solo village mission with objectives and a boss. Local arena is a couch match where the last living shinobi wins the round.',
    Icon: AutoStoriesIcon,
  },
  {
    step: '02',
    title: 'Control Space',
    body: 'Move through lanes, plant bombs, break boxes, collect power-ups, and use cover or ultimates to shape safe routes.',
    Icon: GpsFixedIcon,
  },
  {
    step: '03',
    title: 'Read Warnings',
    body: 'Enemy and boss attacks show warning markers first. Leave the marked tile before the hazard becomes active.',
    Icon: WarningAmberIcon,
  },
  {
    step: '04',
    title: 'Finish The Objective',
    body: 'Campaign stages end after village objectives open the boss arena and the tailed-beast boss is sealed.',
    Icon: ShieldIcon,
  },
];

const BOMB_RULES = [
  'Bomb blasts hit the bomb cell and extend in four straight lines until blocked by walls or range.',
  'Boxes break after explosions and can reveal power-ups, secrets, or Zetsu ambushes in campaign.',
  'Bombs can chain-trigger other bombs, so one blast can start a larger delayed pattern.',
  'After planting a bomb, its owner may move out of that cell, but cannot move back into or through it without Ghost.',
  'Ghost is the intentional exception: it lets you phase through bombs, walls, boxes, and cover until the timer ends.',
];

const CAMPAIGN_RULES = [
  'Reach the marked mission targets first. Some stages use rescues, shrines, seals, bridges, or towers.',
  'Protect the village structure during defense objectives. If its HP reaches zero, the mission fails.',
  'Defeat the mini-boss guard before the boss gate can complete.',
  'After all objectives are complete, enter the boss arena and defeat the stage boss to unlock the next route reward.',
  'Fog of war hides unexplored campaign tiles. Visible cells update around players; visited cells stay remembered.',
];

const COMBAT_RULES = [
  'Normal enemies and Zetsu only chase or attack after detecting a nearby player.',
  'Zetsu have shorter awareness than shinobi patrols, while mini-boss guards detect a wider local area.',
  'Tailed-beast bosses are the exception: once their arena starts, they pressure the whole arena.',
  'Death messages name the cause, such as a specific bomb, enemy, boss attack, or failed phase escape.',
];

const POWER_RULES = [
  'Power-ups from boxes improve bomb count, blast range, movement, shields, manual detonation, cover, or character-specific abilities.',
  'Manual bombs require a detonation power-up and can be triggered with the configured detonate key.',
  'Cover creates a temporary blocker in front of you. It can protect space, but it can also be destroyed by blasts.',
  'Gaara and Itachi each have one passive survival save. After it triggers, that passive is spent.',
];

const MANUAL_NAV = [
  ['#basics', 'Basics'],
  ['#bombs', 'Bombs'],
  ['#campaign', 'Campaign'],
  ['#enemies', 'Enemies'],
  ['#reference', 'Reference'],
];

type BombDiagramKind = 'blast' | 'bomb' | 'wall';

function getBombDiagramKind(marker: string): BombDiagramKind | undefined {
  switch (marker) {
    case 'B':
      return 'bomb';
    case 'X':
      return 'blast';
    case 'W':
      return 'wall';
    default:
      return undefined;
  }
}

const BOMB_MARKERS = [
  '', '', 'X', '', '',
  '', '', 'X', '', '',
  'X', 'X', 'B', 'X', 'X',
  '', '', 'X', '', '',
  '', '', 'W', '', '',
];

const BOMB_DIAGRAM = BOMB_MARKERS.map((marker, index) => ({
  id: `cell-${Math.floor(index / 5)}-${index % 5}`,
  marker,
  kind: getBombDiagramKind(marker),
}));

export const InstructionsScreen = () => {
  const navigate = useNavigate();
  const handleClose = () => navigate('/');
  const stages = STAGE_DEFINITIONS.filter((stage) => stage.implemented);
  const bosses = stages
    .map((stage) => (stage.bossId ? getBossDefinition(stage.bossId) : null))
    .filter((boss): boss is ReturnType<typeof getBossDefinition> => Boolean(boss));

  return (
    <InstructionsBackground>
      <StyledDialog
        open
        onClose={handleClose}
        aria-labelledby="customized-dialog-title"
      >
        <StyledDialogTitle id="customized-dialog-title">
          Shinobi Field Manual
        </StyledDialogTitle>
        <StyledDialogContent dividers>
          <ManualHero>
            <ManualHeroTitle>
              <strong>Read this before the next run</strong>
              <p>
                A compact field guide for winning rounds, escaping bombs, reading enemy warnings,
                and finishing campaign objectives without guessing what the game expects.
              </p>
            </ManualHeroTitle>
            <ManualHeroMeta>
              <ManualPill>
                <SportsEsportsIcon fontSize="small" />
                Local rounds
              </ManualPill>
              <ManualPill>
                <VisibilityIcon fontSize="small" />
                Fog campaign
              </ManualPill>
              <ManualPill>
                <LocalFireDepartmentIcon fontSize="small" />
                Boss hazards
              </ManualPill>
            </ManualHeroMeta>
          </ManualHero>

          <ManualIntro>
            Start with the four-step loop. Use the guide rail to jump to the detailed rule you need mid-match.
          </ManualIntro>

          <ManualLayout>
            <ManualNav aria-label="Manual sections">
              {MANUAL_NAV.map(([href, label]) => (
                <ManualNavLink key={href} href={href}>{label}</ManualNavLink>
              ))}
            </ManualNav>

            <div>
              <ManualRuleGrid id="basics">
                {QUICK_RULES.map((rule) => {
                  const { Icon } = rule;
                  return (
                    <ManualRuleCard key={rule.step}>
                      <ManualRuleHeader>
                        <span>{rule.step}</span>
                        <Icon fontSize="small" />
                      </ManualRuleHeader>
                      <strong>{rule.title}</strong>
                      <p>{rule.body}</p>
                    </ManualRuleCard>
                  );
                })}
              </ManualRuleGrid>

              <ManualGrid>
                <ManualSection>
                  <ManualSectionTitle>Win Conditions</ManualSectionTitle>
                  <ManualList>
                    <ManualItem>
                      <ManualBadge>Campaign</ManualBadge>
                      Complete village objectives, open the boss arena, and seal the boss. Victory saves route progress and rewards.
                    </ManualItem>
                    <ManualItem>
                      <ManualBadge>Local</ManualBadge>
                      Survive the other players. The last living player wins the round; tied final scores end the match in a draw.
                    </ManualItem>
                    <ManualItem>
                      <ManualBadge>Online</ManualBadge>
                      Online rooms are visible as future groundwork and are not playable yet.
                    </ManualItem>
                  </ManualList>
                </ManualSection>

                <ManualSection>
                  <ManualSectionTitle>Controls</ManualSectionTitle>
                  <ManualList>
                    <ManualItem>
                      <ManualBadge>Move</ManualBadge>
                      Use the four configured movement keys.
                    </ManualItem>
                    <ManualItem>
                      <ManualBadge>Bomb</ManualBadge>
                      Plants your basic bomb.
                    </ManualItem>
                    <ManualItem>
                      <ManualBadge>Det</ManualBadge>
                      Triggers manual bombs after picking up a release/tag power-up.
                    </ManualItem>
                    <ManualItem>
                      <ManualBadge>Ult</ManualBadge>
                      Spends the charged ultimate.
                    </ManualItem>
                    <ManualItem>
                      <ManualBadge>Cover</ManualBadge>
                      Places a cover tile ahead after picking up a barrier power-up.
                    </ManualItem>
                    <ManualItem>
                      <ManualBadge>Pause</ManualBadge>
                      Use the top-right controls for pause, restart, and key edits.
                    </ManualItem>
                  </ManualList>
                </ManualSection>

                <ManualSection wide id="bombs">
                  <ManualSectionTitle>Bomb Rules</ManualSectionTitle>
                  <ManualDiagram aria-label="Bomb blast pattern">
                    {BOMB_DIAGRAM.map((cell) => (
                      <DiagramCell
                        key={cell.id}
                        kind={cell.kind}
                      >
                        {cell.marker}
                      </DiagramCell>
                    ))}
                  </ManualDiagram>
                  <ManualLegend aria-label="Bomb diagram legend">
                    <span>
                      <strong>B</strong>
                      Bomb
                    </span>
                    <span>
                      <strong>X</strong>
                      Blast path
                    </span>
                    <span>
                      <strong>W</strong>
                      Wall stops fire
                    </span>
                  </ManualLegend>
                  <ManualList compact>
                    {BOMB_RULES.map((rule) => (
                      <ManualItem key={rule}>{rule}</ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection wide id="campaign">
                  <ManualSectionTitle>Campaign Rules</ManualSectionTitle>
                  <ManualFlow>
                    {CAMPAIGN_FLOW_STEPS.map((step, index) => (
                      <ManualFlowStep key={step.id}>
                        <strong>
                          Step
                          {' '}
                          {index + 1}
                        </strong>
                        <span>{step.label}</span>
                      </ManualFlowStep>
                    ))}
                  </ManualFlow>
                  <ManualList compact>
                    {CAMPAIGN_RULES.map((rule) => (
                      <ManualItem key={rule}>{rule}</ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection id="enemies">
                  <ManualSectionTitle>Enemy Rules</ManualSectionTitle>
                  <ManualList>
                    {COMBAT_RULES.map((rule) => (
                      <ManualItem key={rule}>{rule}</ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection>
                  <ManualSectionTitle>Power-Up Rules</ManualSectionTitle>
                  <ManualList>
                    {POWER_RULES.map((rule) => (
                      <ManualItem key={rule}>{rule}</ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection wide id="reference">
                  <ManualSectionTitle>Playable Shinobi</ManualSectionTitle>
                  <CharacterManualGrid>
                    {CHARACTER_DEFINITIONS.filter((character) => character.implemented).map((character) => (
                      <CharacterManualCard key={character.id} color={character.secondaryColor}>
                        <strong>{character.name}</strong>
                        <span>{character.basicBomb}</span>
                        <span>{character.ultimate}</span>
                        <small>{character.passive}</small>
                        <p>{character.description}</p>
                      </CharacterManualCard>
                    ))}
                  </CharacterManualGrid>
                </ManualSection>

                <ManualSection>
                  <ManualSectionTitle>Story Bosses</ManualSectionTitle>
                  <ManualList>
                    {bosses.map((boss) => (
                      <ManualItem key={boss.id}>
                        <ManualBadge>
                          {boss.tails}
                          {' '}
                          tail
                        </ManualBadge>
                        {boss.name}
                        {' '}
                        casts
                        {' '}
                        {boss.attacks.join(' / ')}
                        .
                      </ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection wide>
                  <ManualSectionTitle>Campaign Route</ManualSectionTitle>
                  <ManualList compact>
                    {CAMPAIGN_VILLAGES.map((village) => (
                      <ManualItem key={village.stageId}>
                        <ManualBadge>
                          {village.order}
                          {' '}
                          {village.villageName}
                        </ManualBadge>
                        Mini:
                        {' '}
                        {village.miniBoss}
                        {' '}
                        · Boss:
                        {' '}
                        {village.villageBoss}
                        {' '}
                        · Reward:
                        {' '}
                        {village.reward}
                      </ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection>
                  <ManualSectionTitle>Local Enemies</ManualSectionTitle>
                  <ManualList>
                    {LOCAL_BEASTS.map((beast) => (
                      <ManualItem key={beast}>{beast}</ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection>
                  <ManualSectionTitle>Fog of War</ManualSectionTitle>
                  <ManualList>
                    {CHARACTER_DEFINITIONS.filter((character) => character.implemented).map((character) => (
                      <ManualItem key={`${character.id}-vision`}>
                        <ManualBadge>
                          Vision
                          {' '}
                          {character.visionRadius}
                        </ManualBadge>
                        {character.name}
                        {' '}
                        reveals nearby campaign tiles; visited cells stay mapped in shadow.
                      </ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>

                <ManualSection wide>
                  <ManualSectionTitle>Character Power-Ups</ManualSectionTitle>
                  <ManualList compact>
                    {CHARACTER_DEFINITIONS.filter((character) => character.implemented).map((character) => (
                      <ManualItem key={`${character.id}-powerups`}>
                        <ManualBadge>{character.name}</ManualBadge>
                        {getCharacterPowerLoadout(character.id).map((powerUp) => (
                          <span key={powerUp.power}>
                            <strong>{powerUp.label}</strong>
                            {': '}
                            {powerUp.effect}
                            {' '}
                          </span>
                        ))}
                      </ManualItem>
                    ))}
                  </ManualList>
                </ManualSection>
              </ManualGrid>
            </div>
          </ManualLayout>
        </StyledDialogContent>
        <DialogActions>
          <BackButton type="button" onClick={handleClose}>
            <SportsEsportsIcon fontSize="small" />
            Back to Arena
          </BackButton>
        </DialogActions>
      </StyledDialog>
    </InstructionsBackground>
  );
};
