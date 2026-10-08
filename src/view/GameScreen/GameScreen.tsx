/* eslint-disable max-len */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SettingsIcon from '@mui/icons-material/Settings';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Tooltip } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  KeyBindings,
  DEFAULT_KEY_BINDINGS,
  arrowKeySymbols,
  normalizeKeyBindings,
} from '../../constants/props';
import { RoundResultDialog } from './RoundResultDialog';
import { ResultTone } from './RoundResultDialog.styles';
import SettingsScreen from './SettingsScreen/SettingsScreen';
import ModifyControlsDialog from './SettingsScreen/ModifyControlsDialog';
import { GameScene3D } from './GameScene3D';
import { GameHUD } from './GameHUD';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameConfig, loadMapFromStorage } from '../../engine';
import { DEFAULT_CHARACTER_ID, DEFAULT_STAGE_ID, GameMode } from '../../content';
import { completeCampaignStage, recordCampaignDiscoveries } from '../../story/progress';
import {
  GameSceneContainer,
  TopControls,
  LoadingMessage,
  GameBackground,
  ControlButton,
  PauseOverlay,
  PauseMenuCard,
  PauseMenuTitle,
  PauseMenuActions,
  PauseMenuButton,
  ControlsGuide,
  ControlsGuideHeader,
  ControlsDismissButton,
  ControlRows,
  ControlRow,
  CountdownOverlay,
  FeedbackCaption,
} from './GameScreen.styles';
import {
  loadGamePreferences,
  saveGamePreferences,
} from './gamePreferences';
import { useGameFeedback } from './useGameFeedback';

const CONTROLS_GUIDE_SEEN_KEY = 'shinobiControlsGuideSeen';

function loadStoredKeyBindings(): KeyBindings {
  try {
    const stored = localStorage.getItem('playerKeyBindings');
    return normalizeKeyBindings(stored ? JSON.parse(stored) : DEFAULT_KEY_BINDINGS);
  } catch {
    return normalizeKeyBindings(DEFAULT_KEY_BINDINGS);
  }
}

function hasSeenControlsGuide(): boolean {
  try {
    return localStorage.getItem(CONTROLS_GUIDE_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadStoredGameSetup(): Partial<GameConfig> {
  try {
    const storedSetup = localStorage.getItem('gameSetup');
    return storedSetup ? JSON.parse(storedSetup) : {};
  } catch {
    return {};
  }
}

function formatKeyLabel(key: string): string {
  return arrowKeySymbols[key] ?? key.toUpperCase();
}

function formatMovementKeys(bindings: string[]): string {
  return [
    bindings[0],
    bindings[1],
    bindings[2],
    bindings[3],
  ].map(formatKeyLabel).join(' ');
}

export const GameScreen = () => {
  const { numOfPlayers, numOfRounds, selectedMap } = useParams();
  const navigate = useNavigate();
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(loadStoredKeyBindings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModifyingControls, setIsModifyingControls] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(() => !hasSeenControlsGuide());
  const [showHud, setShowHud] = useState(true);
  const [preferences, setPreferences] = useState(loadGamePreferences);
  const controlsGuidePausedGame = useRef(false);

  const config = useMemo<GameConfig | null>(() => {
    if (!numOfPlayers || !numOfRounds || !selectedMap) return null;
    const setup = loadStoredGameSetup();
    const players = parseInt(numOfPlayers, 10);
    return {
      mode: (setup.mode as GameMode | undefined) ?? 'local',
      numPlayers: players,
      totalRounds: parseInt(numOfRounds, 10),
      selectedMap,
      map: loadMapFromStorage(),
      stageId: setup.stageId ?? DEFAULT_STAGE_ID,
      selectedCharacters: setup.selectedCharacters
        ?? Array.from({ length: players }, () => DEFAULT_CHARACTER_ID),
      selectedUpgrade: setup.selectedUpgrade,
    };
  }, [numOfPlayers, numOfRounds, selectedMap]);

  const {
    state,
    pause,
    resume,
    restart,
    dismissDialog,
  } = useGameEngine(config, keyBindings);
  const feedback = useGameFeedback(state, preferences);

  const handlePreferencesChange = useCallback((nextPreferences: typeof preferences) => {
    setPreferences(nextPreferences);
    saveGamePreferences(nextPreferences);
  }, []);

  const bossHealth = state?.boss?.health;
  const bossId = state?.boss?.id;
  const gamePhase = state?.phase;
  const gameMode = state?.config.mode;
  const stageId = state?.config.stageId;
  const campaignStageId = state?.campaign?.stageId;
  const campaignSecretsKey = state?.campaign?.discoveredSecrets.join('|') ?? '';
  const leadCharacterId = state?.players[0]?.characterId;
  const rewardedStages = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      gameMode === 'solo'
      && gamePhase === 'game_over'
      && bossId
      && stageId
      && typeof bossHealth === 'number'
      && bossHealth <= 0
    ) {
      const rewardKey = `${stageId}:${bossId}`;
      if (!rewardedStages.current.has(rewardKey)) {
        rewardedStages.current.add(rewardKey);
        completeCampaignStage(stageId, bossId);
      }
    }
  }, [bossHealth, bossId, gameMode, gamePhase, stageId]);

  useEffect(() => {
    if (
      gameMode === 'solo'
      && campaignStageId
      && leadCharacterId
      && campaignSecretsKey.length > 0
    ) {
      recordCampaignDiscoveries(
        campaignStageId,
        leadCharacterId,
        campaignSecretsKey.split('|')
      );
    }
  }, [campaignSecretsKey, campaignStageId, gameMode, leadCharacterId]);

  const isPaused = state?.paused ?? false;
  const dialogOpen = state?.phase === 'round_end' || state?.phase === 'game_over';
  const resultTone = useMemo<ResultTone>(() => {
    if (!state || state.phase !== 'game_over' || state.config.mode !== 'solo') {
      return 'neutral';
    }
    const bossSealed = state.boss ? state.boss.health <= 0 : false;
    if (bossSealed || state.campaign?.missionResult === 'success') {
      return 'victory';
    }
    return 'defeat';
  }, [state]);
  const roundStartTicksRemaining = state?.roundStartTicksRemaining ?? 0;
  const countdownLabel = roundStartTicksRemaining > 0
    ? String(Math.ceil(roundStartTicksRemaining / 1000))
    : '';
  const parsedPlayerCount = Number(numOfPlayers ?? 1);
  const activePlayerCount = Number.isFinite(parsedPlayerCount)
    ? Math.max(1, parsedPlayerCount)
    : 1;
  const controlRows = useMemo(() => (
    Array.from({ length: activePlayerCount }, (_, index) => {
      const playerNumber = String(index + 1);
      const bindings = keyBindings[playerNumber] ?? DEFAULT_KEY_BINDINGS[playerNumber];
      return [
        { label: `P${playerNumber} move`, value: formatMovementKeys(bindings) },
        { label: `P${playerNumber} bomb`, value: formatKeyLabel(bindings[4]) },
        { label: `P${playerNumber} det`, value: formatKeyLabel(bindings[5]) },
        { label: `P${playerNumber} ult`, value: formatKeyLabel(bindings[6]) },
        { label: `P${playerNumber} cover`, value: formatKeyLabel(bindings[7]) },
      ];
    }).flat()
  ), [activePlayerCount, keyBindings]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) resume();
    else pause();
  }, [isPaused, pause, resume]);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
    pause();
  }, [pause]);

  const handleDismissControlsGuide = useCallback(() => {
    setShowControlsGuide(false);
    try {
      localStorage.setItem(CONTROLS_GUIDE_SEEN_KEY, 'true');
    } catch {
      // The guide can still close if storage is unavailable.
    }
    if (controlsGuidePausedGame.current) {
      controlsGuidePausedGame.current = false;
      resume();
    }
  }, [resume]);

  const handleShowControlsGuide = useCallback(() => {
    controlsGuidePausedGame.current = !isPaused;
    setShowControlsGuide(true);
    if (!isPaused) pause();
  }, [isPaused, pause]);

  useEffect(() => {
    if (
      showControlsGuide
      && !isPaused
      && !dialogOpen
      && !isSettingsOpen
      && !isModifyingControls
    ) {
      controlsGuidePausedGame.current = true;
      pause();
    }
  }, [
    dialogOpen,
    isModifyingControls,
    isPaused,
    isSettingsOpen,
    pause,
    showControlsGuide,
  ]);

  const handleQuitGame = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCloseDialog = () => {
    dismissDialog();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (dialogOpen) return;
      event.preventDefault();

      if (showControlsGuide) {
        handleDismissControlsGuide();
        return;
      }

      if (isModifyingControls) {
        setIsModifyingControls(false);
        resume();
        return;
      }

      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        resume();
        return;
      }

      handleTogglePause();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [
    dialogOpen,
    handleTogglePause,
    handleDismissControlsGuide,
    isModifyingControls,
    isSettingsOpen,
    resume,
    showControlsGuide,
  ]);

  if (!state) {
    return (
      <StyledBackground>
        <LoadingMessage>Loading game...</LoadingMessage>
      </StyledBackground>
    );
  }

  return (
    <GameBackground>
      {showHud && <GameHUD state={state} scale={preferences.hudScale} />}
      <TopControls>
        <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
          <ControlButton
            aria-label={isPaused ? 'resume game' : 'pause game'}
            onClick={showControlsGuide ? handleDismissControlsGuide : handleTogglePause}
          >
            {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
          </ControlButton>
        </Tooltip>
        <Tooltip title="Restart same setup">
          <ControlButton aria-label="restart same setup" onClick={restart}>
            <RestartAltIcon />
          </ControlButton>
        </Tooltip>
        <Tooltip title="Settings">
          <ControlButton
            aria-label="open settings"
            onClick={handleOpenSettings}
          >
            <SettingsIcon />
          </ControlButton>
        </Tooltip>
        <Tooltip title="Controls">
          <ControlButton
            aria-label="show controls"
            onClick={handleShowControlsGuide}
          >
            <KeyboardIcon />
          </ControlButton>
        </Tooltip>
        <Tooltip title={showHud ? 'Hide HUD' : 'Show HUD'}>
          <ControlButton
            aria-label={showHud ? 'hide HUD' : 'show HUD'}
            onClick={() => setShowHud((visible) => !visible)}
          >
            {showHud ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </ControlButton>
        </Tooltip>
      </TopControls>
      <GameSceneContainer>
        <GameScene3D
          state={state}
          preferences={preferences}
          impact={feedback.impact}
        />
      </GameSceneContainer>
      {feedback.caption && (
        <FeedbackCaption key={feedback.eventId} aria-live="polite" aria-atomic="true">
          {feedback.caption}
        </FeedbackCaption>
      )}
      {roundStartTicksRemaining > 0 && !isPaused && !dialogOpen && (
        <CountdownOverlay aria-label="round countdown">
          <strong>{countdownLabel}</strong>
        </CountdownOverlay>
      )}
      {showControlsGuide && !dialogOpen && !isSettingsOpen && !isModifyingControls && (
        <ControlsGuide aria-label="controls guide">
          <ControlsGuideHeader>
            <strong>Controls</strong>
            <ControlsDismissButton
              aria-label="hide controls guide"
              onClick={handleDismissControlsGuide}
            >
              <CloseIcon fontSize="small" />
            </ControlsDismissButton>
          </ControlsGuideHeader>
          <ControlRows>
            {controlRows.map((row) => (
              <ControlRow key={`${row.label}-${row.value}`}>
                <span>{row.label}</span>
                <kbd>{row.value}</kbd>
              </ControlRow>
            ))}
          </ControlRows>
        </ControlsGuide>
      )}
      {isPaused && !showControlsGuide && !dialogOpen && !isSettingsOpen && !isModifyingControls && (
        <PauseOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-menu-title"
        >
          <PauseMenuCard>
            <PauseMenuTitle id="pause-menu-title">
              <strong>Paused</strong>
              <span>ESC resumes. Review controls, restart, adjust settings, or leave the match.</span>
            </PauseMenuTitle>
            <PauseMenuActions>
              <PauseMenuButton
                autoFocus
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={resume}
              >
                Resume
              </PauseMenuButton>
              <PauseMenuButton
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={restart}
              >
                Restart
              </PauseMenuButton>
              <PauseMenuButton
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={handleOpenSettings}
              >
                Settings
              </PauseMenuButton>
              <PauseMenuButton
                variant="outlined"
                color="warning"
                startIcon={<ExitToAppIcon />}
                onClick={handleQuitGame}
              >
                Quit Game
              </PauseMenuButton>
            </PauseMenuActions>
            <ControlRows>
              {controlRows.map((row) => (
                <ControlRow key={`paused-${row.label}-${row.value}`}>
                  <span>{row.label}</span>
                  <kbd>{row.value}</kbd>
                </ControlRow>
              ))}
            </ControlRows>
          </PauseMenuCard>
        </PauseOverlay>
      )}
      <RoundResultDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onRestart={restart}
        resultMessage={state.resultMessage}
        isGameOver={state.phase === 'game_over'}
        tone={resultTone}
        state={state}
      />
      <SettingsScreen
        open={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          resume();
        }}
        onRestart={() => {
          restart();
          setIsSettingsOpen(false);
          resume();
        }}
        onModifyControls={() => {
          setIsSettingsOpen(false);
          setIsModifyingControls(true);
          pause();
        }}
        preferences={preferences}
        onPreferencesChange={handlePreferencesChange}
      />
      <ModifyControlsDialog
        isOpen={isModifyingControls}
        onClose={() => {
          setIsModifyingControls(false);
          resume();
        }}
        onSave={(nextBindings) => {
          const normalized = normalizeKeyBindings(nextBindings);
          setKeyBindings(normalized);
          localStorage.setItem('playerKeyBindings', JSON.stringify(normalized));
          setIsModifyingControls(false);
          resume();
        }}
        keyBindings={keyBindings}
        numOfPlayers={String(numOfPlayers)}
      />
    </GameBackground>
  );
};
