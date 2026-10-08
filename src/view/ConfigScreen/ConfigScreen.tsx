/* eslint-disable react/no-array-index-key */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DialogTitle,
  DialogContent,
  Typography,
  Stepper,
  Step,
  StepButton,
  StepLabel,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Info from '@mui/icons-material/Info';
import {
  StyledDialog,
  StepContent,
  Row,
  CenteredButtonContainer,
  KeyConfigInput,
  PlayerControlsRow,
  ControlsLabel,
  MovementKeysGrid,
  MovementKeyCell,
  KeyHint,
  SummaryStrip,
  SummaryItem,
  ActionKeysGrid,
  ActionKeyCell,
  ActionKeyName,
  ConfigIntro,
  SectionTitle,
  SelectionGrid,
  SelectionCard,
  CardHeader,
  ColorOrb,
  CardMeta,
  ModeGrid,
  StagePreview,
  StagePreviewImage,
  AbilityLine,
  CharacterPortrait,
  CharacterPortraitImage,
  LoadoutGrid,
  LoadoutKey,
  LoadoutRow,
  CampaignRoute,
  CampaignRouteCard,
  RouteStatusBadge,
  FlowStepStrip,
  FlowStepPill,
  MissionBriefing,
  MissionBriefingPreview,
  MissionBriefingDetails,
  MissionObjectiveList,
  MissionObjectiveItem,
  MissionActionRow,
} from './ConfigScreen.styles';
import { WelcomeContainer } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  ACTION_BINDING_LABELS,
  MOVEMENT_BINDING_LABELS,
  KeyBindings,
  arrowKeySymbols,
  DEFAULT_KEY_BINDINGS,
  normalizeKeyBindings,
} from '../../constants/props';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.png';
import {
  CHARACTER_DEFINITIONS,
  CAMPAIGN_FLOW_STEPS,
  CAMPAIGN_VILLAGES,
  CampaignObjectiveDefinition,
  CharacterId,
  DEFAULT_CHARACTER_ID,
  GameMode,
  STAGE_DEFINITIONS,
  StageId,
  getBossDefinition,
  getCampaignVillage,
  getCampaignMission,
  getStageDefinition,
} from '../../content';
import {
  loadStoryProgress,
  selectStoryLoadout,
  STORY_UPGRADES,
  StoryUpgradeId,
} from '../../story/progress';
import { fetchMapFromFile } from '../../engine';

type KeyErrors = {
  [key: string]: boolean;
};

const SINGLE_MATCH_ROUNDS = '1';

const GAME_MODES: {
  id: GameMode;
  title: string;
  description: string;
  disabled?: boolean;
}[] = [
  {
    id: 'solo',
    title: 'Solo Boss',
    description: 'Face the first tailed beast in a focused arena trial.',
  },
  {
    id: 'local',
    title: 'Local Arena',
    description: 'Couch battle for two or three shinobi loadouts.',
  },
  {
    id: 'onlinePreview',
    title: 'Online Rooms',
    description: 'Planned multiplayer flow, not enabled yet.',
    disabled: true,
  },
];

const STAGE_PREVIEW_POSITIONS: Record<StageId, string> = {
  hiddenLeaf: '0% 0%',
  hiddenSand: '50% 0%',
  hiddenMist: '100% 0%',
  hiddenCloud: '0% 100%',
  hiddenStone: '50% 100%',
  akatsukiHideout: '100% 100%',
  greatShinobiWar: '50% 50%',
};

const CHARACTER_POSITIONS: Record<CharacterId, string> = {
  deidara: '0% 0%',
  naruto: '20% 0%',
  sasuke: '40% 0%',
  gaara: '60% 0%',
  minato: '80% 0%',
  itachi: '100% 0%',
};

function loadStoredKeyBindings(): KeyBindings {
  const stored = localStorage.getItem('playerKeyBindings');
  if (!stored) return normalizeKeyBindings(DEFAULT_KEY_BINDINGS);
  try {
    return normalizeKeyBindings(JSON.parse(stored));
  } catch {
    return normalizeKeyBindings(DEFAULT_KEY_BINDINGS);
  }
}

function formatKeyLabel(key: string): string {
  return arrowKeySymbols[key] || key.toUpperCase();
}

const MOVEMENT_KEY_AREAS = ['up', 'left', 'down', 'right'] as const;

function getMissionObjectiveSummary(objective: CampaignObjectiveDefinition): string {
  if (objective.kind === 'rescue') {
    return `${objective.targetCount ?? objective.targets?.length ?? 0} mission targets`;
  }
  if (objective.kind === 'defense') {
    return `${Math.ceil((objective.durationMs ?? 0) / 1000)}s defense hold`;
  }
  return `Defeat ${objective.miniBossLabel ?? objective.label} at the gate`;
}

export const ConfigScreen = () => {
  const initialStoryProgress = useMemo(() => loadStoryProgress(), []);
  const [activeStep, setActiveStep] = useState(0);
  const [mode, setMode] = useState<GameMode>('solo');
  const [numOfPlayers, setNumOfPlayers] = useState('1');
  const [selectedStage, setSelectedStage] = useState<StageId>(
    initialStoryProgress.lastStage
  );
  const [selectedCharacters, setSelectedCharacters] = useState<CharacterId[]>([
    initialStoryProgress.lastCharacter ?? DEFAULT_CHARACTER_ID,
  ]);
  const [selectedUpgrade, setSelectedUpgrade] = useState<StoryUpgradeId>(
    initialStoryProgress.selectedUpgrade
  );
  const [playerKeyBindings, setPlayerKeyBindings] = useState<KeyBindings>(
    loadStoredKeyBindings
  );
  const navigate = useNavigate();
  const [keyErrors, setKeyErrors] = useState<KeyErrors>({});
  const [storyProgress, setStoryProgress] = useState(initialStoryProgress);

  const activePlayerCount = parseInt(numOfPlayers, 10);
  const currentCampaignVillage = useMemo(
    () => getCampaignVillage(storyProgress.lastStage),
    [storyProgress.lastStage]
  );
  const currentFlowLabel = CAMPAIGN_FLOW_STEPS.find(
    (step) => step.id === storyProgress.currentFlowStep
  )?.label ?? 'Exploration';
  const selectedStageDefinition = useMemo(
    () => getStageDefinition(selectedStage),
    [selectedStage]
  );
  const selectedMission = useMemo(
    () => getCampaignMission(selectedStage),
    [selectedStage]
  );
  const selectedBoss = useMemo(
    () => (
      selectedStageDefinition.bossId
        ? getBossDefinition(selectedStageDefinition.bossId)
        : null
    ),
    [selectedStageDefinition]
  );

  const handleModeSelect = (nextMode: GameMode) => {
    setMode(nextMode);
    if (nextMode === 'solo') {
      setNumOfPlayers('1');
      setSelectedStage((current) => (
        storyProgress.unlockedStages.includes(current)
          ? current
          : storyProgress.lastStage
      ));
      setSelectedCharacters((current) => {
        const currentCharacter = current[0] ?? DEFAULT_CHARACTER_ID;
        const lastCharacter = storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID;
        const fallbackCharacter = storyProgress.unlockedCharacters.includes(lastCharacter)
          ? lastCharacter
          : storyProgress.unlockedCharacters[0] ?? DEFAULT_CHARACTER_ID;
        return [storyProgress.unlockedCharacters.includes(currentCharacter)
          ? currentCharacter
          : fallbackCharacter];
      });
    } else {
      setNumOfPlayers('2');
      setSelectedCharacters((current) => [
        current[0] ?? DEFAULT_CHARACTER_ID,
        current[1] ?? 'naruto',
      ]);
    }
  };

  const handlePlayerCountChange = (newNumOfPlayers: string) => {
    if (!newNumOfPlayers) return;
    const count = parseInt(newNumOfPlayers, 10);
    setNumOfPlayers(newNumOfPlayers);
    setSelectedCharacters((current) => Array.from(
      { length: count },
      (_, index) => current[index] ?? CHARACTER_DEFINITIONS[index].id
    ));
  };

  const handleCharacterSelect = (playerIndex: number, characterId: CharacterId) => {
    setSelectedCharacters((current) => current.map((id, index) => (
      index === playerIndex ? characterId : id
    )));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleStoryNext = () => {
    handleNext();
  };

  const handleCancel = () => {
    navigate('/');
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleResetBindings = () => {
    setPlayerKeyBindings(normalizeKeyBindings(DEFAULT_KEY_BINDINGS));
    setKeyErrors({});
  };

  const startGame = async ({
    nextMode = mode,
    stageId = selectedStage,
    characters = selectedCharacters,
    upgrade = selectedUpgrade,
    players = numOfPlayers,
  }: {
    nextMode?: GameMode;
    stageId?: StageId;
    characters?: CharacterId[];
    upgrade?: StoryUpgradeId;
    players?: string;
  } = {}) => {
    const safeStageId = nextMode === 'solo' && !storyProgress.unlockedStages.includes(stageId)
      ? storyProgress.lastStage
      : stageId;
    const safeCharacters = nextMode === 'solo'
      ? characters.map((characterId) => (
        storyProgress.unlockedCharacters.includes(characterId)
          ? characterId
          : storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID
      ))
      : characters;
    const stageDefinition = getStageDefinition(safeStageId);
    const mapData = await fetchMapFromFile(stageDefinition.mapId);
    const characterId = safeCharacters[0] ?? DEFAULT_CHARACTER_ID;
    if (nextMode === 'solo') {
      const progress = selectStoryLoadout(
        characterId,
        stageDefinition.id,
        upgrade
      );
      setStoryProgress(progress);
    }
    localStorage.setItem('selectedMap', JSON.stringify(mapData));
    localStorage.setItem('playerKeyBindings', JSON.stringify(normalizeKeyBindings(playerKeyBindings)));
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: nextMode,
      stageId: stageDefinition.id,
      selectedCharacters: safeCharacters,
      selectedUpgrade: upgrade,
    }));
    navigate(`/game/${players}/${SINGLE_MATCH_ROUNDS}/${stageDefinition.mapId}`);
  };

  const handlePlay = async () => {
    await startGame();
  };

  const handleContinueCampaign = async () => {
    const characters = [storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID];
    setMode('solo');
    setNumOfPlayers('1');
    setSelectedStage(storyProgress.lastStage);
    setSelectedUpgrade(storyProgress.selectedUpgrade);
    setSelectedCharacters(characters);
    await startGame({
      nextMode: 'solo',
      stageId: storyProgress.lastStage,
      characters,
      upgrade: storyProgress.selectedUpgrade,
      players: '1',
    });
  };

  const handleStartSelectedMission = async () => {
    const characters = [selectedCharacters[0] ?? DEFAULT_CHARACTER_ID];
    setMode('solo');
    setNumOfPlayers('1');
    setSelectedCharacters(characters);
    await startGame({
      nextMode: 'solo',
      stageId: selectedStage,
      characters,
      upgrade: selectedUpgrade,
      players: '1',
    });
  };

  const handleKeyDown = (
    player: number,
    keyIndex: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === 'Tab' || event.key === 'Escape' || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Backspace' || key === 'Delete' || (key.length > 1 && !key.includes('Arrow'))) return;
    event.preventDefault();

    setPlayerKeyBindings((prevBindings) => ({
      ...prevBindings,
      [player]: prevBindings[player].map((k, idx) => (idx === keyIndex ? key : k)),
    }));
  };

  const validateInputs = () => {
    const newErrors: KeyErrors = {};
    const keyMap = new Map<string, string>();

    Object.values(playerKeyBindings)
      .slice(0, activePlayerCount).forEach((keys, playerIndex) => {
        keys.forEach((key, keyIndex) => {
          const keyId = `player${playerIndex + 1}-${keyIndex}`;
          if (keyMap.has(key)) {
            newErrors[keyId] = true;
            newErrors[keyMap.get(key)!] = true;
          } else {
            keyMap.set(key, keyId);
          }
        });
      });
    setKeyErrors(newErrors);
  };

  useEffect(() => {
    validateInputs();
  }, [activePlayerCount, playerKeyBindings]);

  const conflictKeyLabels = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(playerKeyBindings)
      .slice(0, activePlayerCount)
      .forEach((keys) => {
        keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
      });
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => formatKeyLabel(key));
  }, [activePlayerCount, playerKeyBindings]);

  const battleSummary = useMemo(() => {
    const modeTitle = GAME_MODES.find((item) => item.id === mode)?.title ?? mode;
    const squad = selectedCharacters
      .slice(0, activePlayerCount)
      .map((characterId, index) => {
        const character = CHARACTER_DEFINITIONS.find((item) => item.id === characterId);
        return {
          label: `P${index + 1}`,
          name: character?.name ?? characterId,
          accent: character?.secondaryColor ?? '#fbbf24',
        };
      });
    const upgrade = mode === 'solo'
      ? STORY_UPGRADES.find((item) => item.id === selectedUpgrade) ?? null
      : null;
    return { modeTitle, squad, upgrade };
  }, [activePlayerCount, mode, selectedCharacters, selectedUpgrade]);

  const renderKeyConfig = (player: number) => (
    <React.Fragment key={`player-config-${player}`}>
      <PlayerControlsRow numOfPlayers={numOfPlayers}>
        <ControlsLabel>
          {`Player ${player} Loadout Keys`}
        </ControlsLabel>
        <MovementKeysGrid>
          {MOVEMENT_BINDING_LABELS.map((label, keyIndex) => (
            <MovementKeyCell
              key={`player-${player}-key-${keyIndex}`}
              area={MOVEMENT_KEY_AREAS[keyIndex]}
            >
              <ActionKeyName>{label}</ActionKeyName>
              <KeyConfigInput
                aria-label={`player ${player} ${label.toLowerCase()} key`}
                value={formatKeyLabel(playerKeyBindings[player][keyIndex])}
                onKeyDown={(e) => handleKeyDown(player, keyIndex, e)}
                readOnly
                data-error={Boolean(keyErrors[`player${player}-${keyIndex}`])}
              />
            </MovementKeyCell>
          ))}
        </MovementKeysGrid>
        <ActionKeysGrid>
          {ACTION_BINDING_LABELS.map((label, index) => {
            const keyIndex = index + MOVEMENT_BINDING_LABELS.length;
            const key = playerKeyBindings[player][keyIndex];
            return (
              <ActionKeyCell key={`player-${player}-key-${keyIndex}`}>
                <ActionKeyName>{label}</ActionKeyName>
                <KeyConfigInput
                  aria-label={`player ${player} ${label.toLowerCase()} key`}
                  value={formatKeyLabel(key)}
                  onKeyDown={(e) => handleKeyDown(player, keyIndex, e)}
                  readOnly
                  data-error={Boolean(keyErrors[`player${player}-${keyIndex}`])}
                />
              </ActionKeyCell>
            );
          })}
        </ActionKeysGrid>
      </PlayerControlsRow>
      {player < activePlayerCount && <Divider style={{ margin: `${numOfPlayers === '2' ? '60px' : '20px'} 0` }} />}
    </React.Fragment>
  );

  useEffect(() => {
    setStoryProgress(loadStoryProgress());
  }, []);

  const steps = mode === 'solo'
    ? ['Mission', 'Upgrade', 'Controls']
    : ['Setup', 'Controls'];

  return (
    <WelcomeContainer>
      <StyledDialog open aria-labelledby="config-dialog-title">
        <DialogTitle id="config-dialog-title">
          {activeStep === 0 && 'Mission Deck'}
          {activeStep === 1 && mode === 'solo' && 'Upgrade Arsenal'}
          {((activeStep === 1 && mode === 'local') || activeStep === 2)
            && 'Key Bindings'}
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} nonLinear>
            {steps.map((label, index) => (
              <Step key={label} completed={index < activeStep}>
                {index < activeStep ? (
                  <StepButton onClick={() => setActiveStep(index)}>
                    {label}
                  </StepButton>
                ) : (
                  <StepLabel>{label}</StepLabel>
                )}
              </Step>
            ))}
          </Stepper>
          {activeStep === 0 && (
            <StepContent>
              {mode === 'solo' && selectedMission && (
                <MissionBriefing accent={selectedStageDefinition.palette.accent}>
                  <MissionBriefingPreview>
                    <StagePreviewImage
                      image={StageAtlas}
                      aria-label={`${selectedStageDefinition.name} mission preview`}
                      backgroundPosition={STAGE_PREVIEW_POSITIONS[selectedStageDefinition.id]}
                    />
                  </MissionBriefingPreview>
                  <MissionBriefingDetails>
                    <Typography variant="overline" fontWeight="bold">
                      {selectedMission.villageName}
                      {' '}
                      Campaign
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {selectedMission.title}
                    </Typography>
                    <CardMeta variant="body2">
                      Gate:
                      {' '}
                      {selectedMission.bossGateLabel}
                      {' '}
                      · Boss:
                      {' '}
                      {selectedBoss?.name ?? 'Village Boss'}
                    </CardMeta>
                    <MissionObjectiveList>
                      {selectedMission.objectives.map((objective) => (
                        <MissionObjectiveItem
                          key={objective.id}
                          accent={selectedStageDefinition.palette.accent}
                        >
                          <strong>{objective.label}</strong>
                          <span>{getMissionObjectiveSummary(objective)}</span>
                        </MissionObjectiveItem>
                      ))}
                    </MissionObjectiveList>
                    <MissionActionRow>
                      <Button variant="contained" size="small" onClick={handleStartSelectedMission}>
                        Deploy Mission
                      </Button>
                      <Button variant="contained" size="small" onClick={handleContinueCampaign}>
                        Continue Campaign
                      </Button>
                    </MissionActionRow>
                  </MissionBriefingDetails>
                </MissionBriefing>
              )}

              <SectionTitle variant="subtitle2">Mode</SectionTitle>
              <ModeGrid>
                {GAME_MODES.map((item) => (
                  <SelectionCard
                    key={item.id}
                    type="button"
                    selected={mode === item.id}
                    accent={item.id === 'solo' ? '#f59e0b' : '#60a5fa'}
                    disabled={item.disabled}
                    aria-pressed={mode === item.id}
                    onClick={() => !item.disabled && handleModeSelect(item.id)}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">{item.title}</Typography>
                    <CardMeta variant="caption">{item.description}</CardMeta>
                    {item.disabled && <Chip size="small" label="Future" />}
                  </SelectionCard>
                ))}
              </ModeGrid>

              {mode === 'solo' && (
                <>
                  <SectionTitle variant="subtitle2">Campaign Route</SectionTitle>
                  <ConfigIntro>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Continue:
                      {' '}
                      {currentCampaignVillage.villageName}
                    </Typography>
                    <CardMeta variant="body2">
                      Saved flow:
                      {' '}
                      {currentFlowLabel}
                      {' '}
                      · Reward:
                      {' '}
                      {currentCampaignVillage.reward}
                    </CardMeta>
                    <FlowStepStrip>
                      {CAMPAIGN_FLOW_STEPS.map((step) => (
                        <FlowStepPill
                          key={step.id}
                          active={storyProgress.currentFlowStep === step.id}
                        >
                          {step.label}
                        </FlowStepPill>
                      ))}
                    </FlowStepStrip>
                    <Button variant="contained" size="small" onClick={handleContinueCampaign}>
                      Continue Campaign
                    </Button>
                  </ConfigIntro>
                  <CampaignRoute>
                    {CAMPAIGN_VILLAGES.map((village) => {
                      const stageDefinition = STAGE_DEFINITIONS.find(
                        (item) => item.id === village.stageId
                      );
                      const accent = stageDefinition?.palette.accent ?? '#f59e0b';
                      const completed = storyProgress.completedStages.includes(village.stageId);
                      const active = storyProgress.lastStage === village.stageId;
                      const locked = mode === 'solo'
                        && !storyProgress.unlockedStages.includes(village.stageId);
                      let status = 'Unlocked';
                      if (completed) status = 'Cleared';
                      if (active) status = 'Current';
                      if (locked) status = 'Locked';
                      return (
                        <CampaignRouteCard
                          key={village.stageId}
                          type="button"
                          active={selectedStage === village.stageId}
                          completed={completed}
                          locked={locked}
                          accent={accent}
                          disabled={locked}
                          onClick={() => {
                            if (!locked) setSelectedStage(village.stageId);
                          }}
                          aria-label={`${village.villageName} campaign route`}
                          aria-pressed={selectedStage === village.stageId}
                        >
                          <RouteStatusBadge accent={accent}>
                            {village.order}
                            {' '}
                            ·
                            {' '}
                            {status}
                          </RouteStatusBadge>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>
                            {village.villageName}
                          </Typography>
                          <CardMeta variant="caption">
                            {village.theme}
                            {' '}
                            · Mini:
                            {' '}
                            {village.miniBoss}
                            {' '}
                            · Boss:
                            {' '}
                            {village.villageBoss}
                          </CardMeta>
                          <AbilityLine color={accent}>{village.reward}</AbilityLine>
                        </CampaignRouteCard>
                      );
                    })}
                  </CampaignRoute>
                </>
              )}

              {mode === 'local' && (
                <>
                  <SectionTitle variant="subtitle2">Stage</SectionTitle>
                  <SelectionGrid>
                    {STAGE_DEFINITIONS.map((item) => (
                      <SelectionCard
                        key={item.id}
                        type="button"
                        selected={selectedStage === item.id}
                        accent={item.palette.accent}
                        onClick={() => setSelectedStage(item.id)}
                        aria-label={item.name}
                        aria-pressed={selectedStage === item.id}
                      >
                        <StagePreview>
                          <StagePreviewImage
                            image={StageAtlas}
                            aria-label={`${item.name} arena preview`}
                            backgroundPosition={STAGE_PREVIEW_POSITIONS[item.id]}
                          />
                        </StagePreview>
                        <CardHeader>
                          <ColorOrb color={item.palette.accent} />
                          <div>
                            <Typography variant="subtitle2" fontWeight="bold">{item.name}</Typography>
                            <CardMeta variant="caption">{item.mechanic}</CardMeta>
                          </div>
                        </CardHeader>
                        {item.bossId && (
                          <AbilityLine color={item.palette.accent}>
                            Boss:
                            {' '}
                            {getBossDefinition(item.bossId).name}
                            {' '}
                            ·
                            {' '}
                            {getBossDefinition(item.bossId).attacks.join(' / ')}
                          </AbilityLine>
                        )}
                      </SelectionCard>
                    ))}
                  </SelectionGrid>
                </>
              )}

              <SectionTitle variant="subtitle2">Character Select</SectionTitle>
              {Array.from({ length: activePlayerCount }, (_, playerIndex) => (
                <div key={`player-select-${playerIndex}`}>
                  <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
                    Player
                    {' '}
                    {playerIndex + 1}
                  </Typography>
                  <SelectionGrid>
                    {CHARACTER_DEFINITIONS.map((character) => (
                      <SelectionCard
                        key={`${playerIndex}-${character.id}`}
                        type="button"
                        selected={selectedCharacters[playerIndex] === character.id}
                        accent={character.secondaryColor}
                        disabled={mode === 'solo'
                          && !storyProgress.unlockedCharacters.includes(character.id)}
                        onClick={() => handleCharacterSelect(playerIndex, character.id)}
                        aria-label={`${character.name} player ${playerIndex + 1}`}
                        aria-pressed={selectedCharacters[playerIndex] === character.id}
                      >
                        <CharacterPortrait>
                          <CharacterPortraitImage
                            image={RosterBoard}
                            aria-label={`${character.name} portrait`}
                            backgroundPosition={CHARACTER_POSITIONS[character.id]}
                          />
                        </CharacterPortrait>
                        <CardHeader>
                          <ColorOrb color={character.primaryColor} />
                          <div>
                            <Typography variant="subtitle2" fontWeight="bold">{character.name}</Typography>
                            <CardMeta variant="caption">{character.title}</CardMeta>
                          </div>
                        </CardHeader>
                        <LoadoutGrid>
                          <LoadoutRow color={character.secondaryColor}>
                            <LoadoutKey>Bomb</LoadoutKey>
                            <span>{character.basicBomb}</span>
                          </LoadoutRow>
                          <LoadoutRow color={character.secondaryColor}>
                            <LoadoutKey>Ult</LoadoutKey>
                            <span>{character.ultimate}</span>
                          </LoadoutRow>
                          <LoadoutRow color={character.secondaryColor}>
                            <LoadoutKey>Role</LoadoutKey>
                            <span>{character.passive}</span>
                          </LoadoutRow>
                        </LoadoutGrid>
                        <AbilityLine color={character.secondaryColor}>
                          {character.description}
                        </AbilityLine>
                        {mode === 'solo'
                          && !storyProgress.unlockedCharacters.includes(character.id)
                          && <Chip size="small" label="Locked" />}
                      </SelectionCard>
                    ))}
                  </SelectionGrid>
                </div>
              ))}

              {mode === 'local' && (
                <>
                  <Divider style={{ margin: '20px 0' }} />
                  <Row>
                    <Typography variant="h6">Shinobi Count:</Typography>
                    <ToggleButtonGroup
                      size="large"
                      value={numOfPlayers}
                      exclusive
                      onChange={(_e, newNumOfPlayers) => handlePlayerCountChange(newNumOfPlayers)}
                      aria-label="number of shinobi"
                    >
                      <ToggleButton value="2">2</ToggleButton>
                      <ToggleButton value="3">3</ToggleButton>
                    </ToggleButtonGroup>
                  </Row>
                </>
              )}

              <CenteredButtonContainer>
                <Button variant="contained" size="large" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" size="large" onClick={handleStoryNext}>Next</Button>
              </CenteredButtonContainer>
            </StepContent>
          )}
          {activeStep === 1 && mode === 'solo' && (
            <StepContent>
              <SectionTitle variant="subtitle2">Upgrade Arsenal</SectionTitle>
              <Typography variant="body2" color="text.secondary">
                Pick one story upgrade for this mission run.
              </Typography>
              <SelectionGrid>
                {STORY_UPGRADES.map((upgrade) => {
                  const unlocked = storyProgress.unlockedUpgrades.includes(upgrade.id);
                  return (
                    <SelectionCard
                      key={upgrade.id}
                      type="button"
                      selected={selectedUpgrade === upgrade.id}
                      accent="#f59e0b"
                      disabled={!unlocked}
                      onClick={() => unlocked && setSelectedUpgrade(upgrade.id)}
                      aria-label={upgrade.name}
                      aria-pressed={selectedUpgrade === upgrade.id}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        {upgrade.name}
                      </Typography>
                      <CardMeta variant="caption">{upgrade.description}</CardMeta>
                      <AbilityLine color="#f59e0b">{upgrade.effectLabel}</AbilityLine>
                      {!unlocked && <Chip size="small" label="Locked" />}
                    </SelectionCard>
                  );
                })}
              </SelectionGrid>
              <CenteredButtonContainer>
                <Button variant="contained" size="large" onClick={handleBack}>Back</Button>
                <Button variant="contained" size="large" onClick={handleNext}>Next</Button>
              </CenteredButtonContainer>
            </StepContent>
          )}
          {((activeStep === 1 && mode === 'local') || activeStep === 2) && (
            <StepContent>
              <SummaryStrip aria-label="battle plan summary">
                <SummaryItem accent="#fbbf24">
                  <span>Mode</span>
                  <strong>{battleSummary.modeTitle}</strong>
                </SummaryItem>
                <SummaryItem accent={selectedStageDefinition.palette.accent}>
                  <span>Stage</span>
                  <strong>{selectedStageDefinition.name}</strong>
                </SummaryItem>
                {battleSummary.squad.map((member) => (
                  <SummaryItem key={member.label} accent={member.accent}>
                    <span>{member.label}</span>
                    <strong>{member.name}</strong>
                  </SummaryItem>
                ))}
                {battleSummary.upgrade && (
                  <SummaryItem accent="#2dd4bf">
                    <span>Upgrade</span>
                    <strong>{battleSummary.upgrade.name}</strong>
                  </SummaryItem>
                )}
              </SummaryStrip>
              <KeyHint>
                Click a key tile, then press the new key to rebind it. Every key must be unique.
              </KeyHint>
              <div>
                {Array.from({ length: activePlayerCount }, (_, i) => renderKeyConfig(i + 1))}
              </div>
              {Object.keys(keyErrors).length > 0 && (
                <>
                  <Typography variant="body2" color="error" sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    <Info sx={{ mr: 1, fontSize: 'inherit' }} />
                    Please correct the highlighted key conflicts before proceeding.
                  </Typography>
                  {conflictKeyLabels.length > 0 && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      {`Duplicated keys: ${conflictKeyLabels.join(' · ')}`}
                    </Typography>
                  )}
                </>
              )}
              <CenteredButtonContainer>
                <Button variant="contained" size="large" onClick={handleBack}>Back</Button>
                <Button variant="outlined" size="large" onClick={handleResetBindings}>Reset Keys</Button>
                <Button variant="contained" size="large" onClick={handlePlay} disabled={Object.keys(keyErrors).length > 0}>
                  Play
                </Button>
              </CenteredButtonContainer>
            </StepContent>
          )}
        </DialogContent>
      </StyledDialog>
    </WelcomeContainer>
  );
};
