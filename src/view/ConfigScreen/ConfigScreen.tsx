/* eslint-disable react/no-array-index-key */
import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Info from '@mui/icons-material/Info';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  StyledDialog,
  StepContent,
  SetupOptions,
  SetupOption,
  ModeToggleText,
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
  SectionTitle,
  SelectionGrid,
  SelectionCard,
  CardHeader,
  CardMeta,
  LockBadge,
  SelectedMark,
  StagePreview,
  StagePreviewImage,
  CharacterPortrait,
  CharacterPortraitImage,
  CampaignRoute,
  CampaignRouteCard,
  RouteStatusBadge,
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
import { launchGame, loadStoredKeyBindings, readLastLocalSetup } from './launchGame';
import { moveFocusWithArrows } from './menuNavigation';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.png';
import GreatWarStage from '../../assets/great-shinobi-war-stage.png';
import {
  CHARACTER_DEFINITIONS,
  CAMPAIGN_VILLAGES,
  CharacterId,
  DEFAULT_CHARACTER_ID,
  GameMode,
  STAGE_DEFINITIONS,
  StageId,
  getBossDefinition,
  getCampaignMission,
  getStageDefinition,
} from '../../content';
import {
  loadStoryProgress,
  STORY_UPGRADES,
  StoryUpgradeId,
} from '../../story/progress';
import { DifficultySelector } from './DifficultySelector';

type KeyErrors = {
  [key: string]: boolean;
};

const GAME_MODES: {
  id: GameMode;
  title: string;
  description: string;
  disabled?: boolean;
}[] = [
  {
    id: 'solo',
    title: 'Solo Campaign',
    description: '1 player · missions',
  },
  {
    id: 'local',
    title: 'Local Arena',
    description: '2–3 players · one keyboard',
  },
  {
    id: 'onlinePreview',
    title: 'Online Rooms',
    description: 'Coming soon',
    disabled: true,
  },
];

// Which campaign village unlocks each shinobi, for the locked-card hint.
const UNLOCKED_BY = new Map(CAMPAIGN_VILLAGES
  .filter((village) => village.rewardCharacter)
  .map((village): [CharacterId, string] => [
    village.rewardCharacter as CharacterId,
    village.villageName,
  ]));

const STAGE_PREVIEW_POSITIONS: Record<StageId, string> = {
  hiddenLeaf: '0% 0%',
  hiddenSand: '50% 0%',
  hiddenMist: '100% 0%',
  hiddenCloud: '0% 100%',
  hiddenStone: '50% 100%',
  akatsukiHideout: '100% 100%',
  greatShinobiWar: '50% 100%',
};

const CHARACTER_POSITIONS: Record<CharacterId, string> = {
  deidara: '0% 0%',
  naruto: '20% 0%',
  sasuke: '40% 0%',
  gaara: '60% 0%',
  minato: '80% 0%',
  itachi: '100% 0%',
};

function formatKeyLabel(key: string): string {
  return arrowKeySymbols[key] || key.toUpperCase();
}

const MOVEMENT_KEY_AREAS = ['up', 'left', 'down', 'right'] as const;

export const ConfigScreen = () => {
  const initialStoryProgress = useMemo(() => loadStoryProgress(), []);
  // Reopen the deck on the last local battle setup, if that was the last match.
  const lastLocalSetup = useMemo(() => readLastLocalSetup(), []);
  const [activeStep, setActiveStep] = useState(0);
  const [mode, setMode] = useState<GameMode>(lastLocalSetup ? 'local' : 'solo');
  const [numOfPlayers, setNumOfPlayers] = useState(
    lastLocalSetup ? String(lastLocalSetup.characters.length) : '1'
  );
  const [selectedStage, setSelectedStage] = useState<StageId>(
    lastLocalSetup?.stageId ?? initialStoryProgress.lastStage
  );
  const [selectedCharacters, setSelectedCharacters] = useState<CharacterId[]>(
    lastLocalSetup?.characters ?? [initialStoryProgress.lastCharacter ?? DEFAULT_CHARACTER_ID]
  );
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

  // Escape goes back one step (or home from the first step), like a game menu.
  // Clicks on the backdrop are ignored so a stray click keeps the setup.
  const handleDialogClose = (_event: object, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick') return;
    if (activeStep > 0) handleBack();
    else handleCancel();
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
    const progress = await launchGame({
      mode: nextMode,
      stageId,
      characters,
      upgrade,
      players,
      keyBindings: playerKeyBindings,
      storyProgress,
    }, navigate);
    if (progress) setStoryProgress(progress);
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
      {player < activePlayerCount && <Divider style={{ margin: '16px 0' }} />}
    </React.Fragment>
  );

  useEffect(() => {
    setStoryProgress(loadStoryProgress());
  }, []);

  // Each step opens at its top, not at the previous step's scroll position.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeStep]);

  const steps = mode === 'solo'
    ? ['Mission', 'Upgrade', 'Controls']
    : ['Setup', 'Controls'];
  const optionalSteps = mode === 'solo' ? ['Upgrade', 'Controls'] : ['Controls'];
  const hasKeyConflicts = Object.keys(keyErrors).length > 0;
  // "Continue Campaign" only differs from "Deploy Mission" once the player has
  // picked another village, shinobi or upgrade than the saved run.
  const showContinueCampaign = mode === 'solo' && (
    selectedStage !== storyProgress.lastStage
    || (selectedCharacters[0] ?? DEFAULT_CHARACTER_ID)
      !== (storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID)
    || selectedUpgrade !== storyProgress.selectedUpgrade
  );

  return (
    <WelcomeContainer
      sx={{
        backgroundImage: `url(${StageAtlas})`,
        backgroundSize: '300% auto',
        backgroundPosition: '0% 0%',
        backgroundRepeat: 'no-repeat',
        '@media (max-width: 560px)': {
          backgroundSize: 'auto 200%',
        },
      }}
    >
      <StyledDialog open aria-labelledby="config-dialog-title" onClose={handleDialogClose}>
        <DialogTitle id="config-dialog-title">
          {activeStep === 0 && 'Mission Deck'}
          {activeStep === 1 && mode === 'solo' && 'Upgrade Arsenal'}
          {((activeStep === 1 && mode === 'local') || activeStep === 2)
            && 'Key Bindings'}
        </DialogTitle>
        <DialogContent ref={contentRef} onKeyDown={moveFocusWithArrows}>
          <Stepper activeStep={activeStep} nonLinear>
            {steps.map((label, index) => {
              const optional = optionalSteps.includes(label)
                ? <Typography variant="caption">Optional</Typography>
                : undefined;
              return (
                <Step key={label} completed={index < activeStep}>
                  {index < activeStep ? (
                    <StepButton onClick={() => setActiveStep(index)} optional={optional}>
                      {label}
                    </StepButton>
                  ) : (
                    <StepLabel optional={optional}>{label}</StepLabel>
                  )}
                </Step>
              );
            })}
          </Stepper>
          {activeStep === 0 && (
            <StepContent>
              <SectionTitle variant="subtitle2">Mode</SectionTitle>
              <ToggleButtonGroup
                value={mode}
                exclusive
                fullWidth
                onChange={(_event, nextMode: GameMode | null) => {
                  if (nextMode) handleModeSelect(nextMode);
                }}
                aria-label="game mode"
              >
                {GAME_MODES.map((item) => (
                  <ToggleButton
                    key={item.id}
                    value={item.id}
                    disabled={item.disabled}
                  >
                    <ModeToggleText>
                      <span>{item.title}</span>
                      {' '}
                      <small>{item.description}</small>
                    </ModeToggleText>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              {/*
                Match options for the chosen mode. Add new pre-match options (for
                example a difficulty selector) here as another SetupOption; the
                row hides itself while it is empty.
              */}
              <SetupOptions>
                {mode === 'local' && (
                  <SetupOption>
                    <Typography variant="h6" component="span">Shinobi Count:</Typography>
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
                  </SetupOption>
                )}
              </SetupOptions>

              {mode === 'solo' && selectedMission && (
                <MissionBriefing accent={selectedStageDefinition.palette.accent}>
                  <MissionBriefingPreview>
                    <StagePreviewImage
                      image={StageAtlas}
                      role="img"
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
                        </MissionObjectiveItem>
                      ))}
                    </MissionObjectiveList>
                    <MissionActionRow>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<PlayArrowIcon />}
                        onClick={handleStartSelectedMission}
                      >
                        Deploy Mission
                      </Button>
                      {showContinueCampaign && (
                        <Button variant="outlined" size="large" onClick={handleContinueCampaign}>
                          Continue Campaign
                        </Button>
                      )}
                    </MissionActionRow>
                  </MissionBriefingDetails>
                </MissionBriefing>
              )}

              {mode === 'solo' && (
                <>
                  <SectionTitle variant="subtitle2">Campaign Route</SectionTitle>
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
                          aria-describedby={`route-status-${village.stageId}`}
                          aria-pressed={selectedStage === village.stageId}
                        >
                          <RouteStatusBadge id={`route-status-${village.stageId}`} accent={accent}>
                            {locked && <LockOutlinedIcon aria-hidden="true" />}
                            {village.order}
                            {' '}
                            ·
                            {' '}
                            {status}
                          </RouteStatusBadge>
                          {selectedStage === village.stageId && <SelectedMark aria-hidden="true">✓</SelectedMark>}
                          <Typography component="span" variant="subtitle2" fontWeight="bold" sx={{ mt: 1, display: 'block' }}>
                            {village.villageName}
                          </Typography>
                        </CampaignRouteCard>
                      );
                    })}
                  </CampaignRoute>
                  <DifficultySelector />
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
                        aria-describedby={`stage-mechanic-${item.id}`}
                        aria-pressed={selectedStage === item.id}
                      >
                        {selectedStage === item.id && <SelectedMark aria-hidden="true">✓</SelectedMark>}
                        <StagePreview>
                          <StagePreviewImage
                            image={item.id === 'greatShinobiWar' ? GreatWarStage : StageAtlas}
                            aria-hidden="true"
                            standalone={item.id === 'greatShinobiWar'}
                            backgroundPosition={item.id === 'greatShinobiWar'
                              ? 'center'
                              : STAGE_PREVIEW_POSITIONS[item.id]}
                          />
                        </StagePreview>
                        <CardHeader>
                          <div>
                            <Typography component="span" variant="subtitle2" fontWeight="bold">{item.name}</Typography>
                            <CardMeta id={`stage-mechanic-${item.id}`} variant="caption">{item.mechanic}</CardMeta>
                          </div>
                        </CardHeader>
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
                  <SelectionGrid className={mode === 'local' ? 'compact' : undefined}>
                    {CHARACTER_DEFINITIONS.map((character) => {
                      const locked = mode === 'solo'
                        && !storyProgress.unlockedCharacters.includes(character.id);
                      const selected = selectedCharacters[playerIndex] === character.id;
                      const unlockedBy = UNLOCKED_BY.get(character.id);
                      return (
                        <SelectionCard
                          key={`${playerIndex}-${character.id}`}
                          type="button"
                          selected={selected}
                          accent={character.secondaryColor}
                          disabled={locked}
                          onClick={() => handleCharacterSelect(playerIndex, character.id)}
                          aria-label={`${character.name} player ${playerIndex + 1}${locked ? ', locked' : ''}`}
                          aria-pressed={selected}
                        >
                          {selected && <SelectedMark aria-hidden="true">{`P${playerIndex + 1} ✓`}</SelectedMark>}
                          <CharacterPortrait className={`card-art${mode === 'local' ? ' compact' : ''}`}>
                            <CharacterPortraitImage
                              image={RosterBoard}
                              aria-hidden="true"
                              backgroundPosition={CHARACTER_POSITIONS[character.id]}
                            />
                          </CharacterPortrait>
                          <CardHeader>
                            <div>
                              <Typography component="span" variant="subtitle2" fontWeight="bold">{character.name}</Typography>
                              <CardMeta variant="caption">{character.title}</CardMeta>
                            </div>
                          </CardHeader>
                          {locked && (
                            <LockBadge>
                              <LockOutlinedIcon aria-hidden="true" />
                              <span>Locked</span>
                              {unlockedBy && <small>{`Clear ${unlockedBy}`}</small>}
                            </LockBadge>
                          )}
                        </SelectionCard>
                      );
                    })}
                  </SelectionGrid>
                </div>
              ))}

              {mode === 'local' && hasKeyConflicts && (
                <Typography variant="body2" color="error" align="center" sx={{ mt: 2 }}>
                  Two players share a key. Open Next to fix the controls.
                </Typography>
              )}
              <CenteredButtonContainer>
                <Button variant="text" size="large" onClick={handleCancel}>Cancel</Button>
                <Button variant="outlined" size="large" onClick={handleStoryNext}>Next</Button>
                {mode === 'local' && (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrowIcon />}
                    onClick={handlePlay}
                    disabled={hasKeyConflicts}
                  >
                    Start Battle
                  </Button>
                )}
              </CenteredButtonContainer>
            </StepContent>
          )}
          {activeStep === 1 && mode === 'solo' && (
            <StepContent>
              <SectionTitle variant="subtitle2">Upgrade Arsenal</SectionTitle>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                Pick one story upgrade for this mission run.
              </Typography>
              <SelectionGrid>
                {STORY_UPGRADES.map((upgrade) => {
                  const unlocked = storyProgress.unlockedUpgrades.includes(upgrade.id);
                  const selected = selectedUpgrade === upgrade.id;
                  return (
                    <SelectionCard
                      key={upgrade.id}
                      type="button"
                      selected={selected}
                      accent="#f59e0b"
                      disabled={!unlocked}
                      onClick={() => unlocked && setSelectedUpgrade(upgrade.id)}
                      aria-label={upgrade.name}
                      aria-describedby={`upgrade-meta-${upgrade.id}${unlocked ? '' : ` upgrade-lock-${upgrade.id}`}`}
                      aria-pressed={selected}
                    >
                      {selected && <SelectedMark aria-hidden="true">✓</SelectedMark>}
                      <Typography component="span" variant="subtitle2" fontWeight="bold">
                        {upgrade.name}
                      </Typography>
                      <CardMeta id={`upgrade-meta-${upgrade.id}`} variant="caption">{upgrade.description}</CardMeta>
                      {!unlocked && (
                        <LockBadge id={`upgrade-lock-${upgrade.id}`}>
                          <LockOutlinedIcon aria-hidden="true" />
                          <span>Locked</span>
                        </LockBadge>
                      )}
                    </SelectionCard>
                  );
                })}
              </SelectionGrid>
              <CenteredButtonContainer>
                <Button variant="text" size="large" onClick={handleBack}>Back</Button>
                <Button variant="outlined" size="large" onClick={handleNext}>Next</Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  onClick={handlePlay}
                  disabled={hasKeyConflicts}
                >
                  Start Mission
                </Button>
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
              {hasKeyConflicts && (
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
                <Button variant="text" size="large" onClick={handleBack}>Back</Button>
                <Button variant="outlined" size="large" onClick={handleResetBindings}>Reset Keys</Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  onClick={handlePlay}
                  disabled={hasKeyConflicts}
                >
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
