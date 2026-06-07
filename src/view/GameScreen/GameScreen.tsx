/* eslint-disable max-len */
import React, { useEffect, useMemo, useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useParams } from 'react-router-dom';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';
import { KeyBindings, DEFAULT_KEY_BINDINGS } from '../../constants/props';
import { RoundResultDialog } from './RoundResultDialog';
import SettingsScreen from './SettingsScreen/SettingsScreen';
import ModifyControlsDialog from './SettingsScreen/ModifyControlsDialog';
import { GameScene3D } from './GameScene3D';
import { GameHUD } from './GameHUD';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameConfig, loadMapFromStorage } from '../../engine';
import { DEFAULT_CHARACTER_ID, DEFAULT_STAGE_ID, GameMode } from '../../content';
import { completeBossReward } from '../../story/progress';
import {
  GameSceneContainer,
  TopControls,
  LoadingMessage,
  GameBackground,
  ControlButton,
  PauseOverlay,
  GameHint,
} from './GameScreen.styles';

export const GameScreen = () => {
  const { numOfPlayers, numOfRounds, selectedMap } = useParams();
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(DEFAULT_KEY_BINDINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModifyingControls, setIsModifyingControls] = useState(false);

  const config = useMemo<GameConfig | null>(() => {
    if (!numOfPlayers || !numOfRounds || !selectedMap) return null;
    const storedSetup = localStorage.getItem('gameSetup');
    const setup = storedSetup ? JSON.parse(storedSetup) : {};
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

  useEffect(() => {
    const stored = localStorage.getItem('playerKeyBindings');
    if (stored) {
      setKeyBindings(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (
      state?.config.mode === 'solo'
      && state.phase === 'game_over'
      && state.boss
      && state.boss.health <= 0
    ) {
      completeBossReward(state.boss.id, 'gaara', 'hiddenCloud');
    }
  }, [state?.phase, state?.boss, state?.config.mode]);

  const isPaused = state?.paused ?? false;
  const dialogOpen = state?.phase === 'round_end' || state?.phase === 'game_over';

  const handleTogglePause = () => {
    if (isPaused) resume();
    else pause();
  };

  const handleCloseDialog = () => {
    dismissDialog();
  };

  if (!state) {
    return (
      <StyledBackground>
        <LoadingMessage>Loading game...</LoadingMessage>
      </StyledBackground>
    );
  }

  return (
    <GameBackground>
      <GameHUD state={state} />
      <TopControls>
        <ControlButton onClick={handleTogglePause}>
          {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
        </ControlButton>
        <ControlButton
          onClick={() => {
            setIsSettingsOpen(true);
            pause();
          }}
        >
          <SettingsIcon />
        </ControlButton>
      </TopControls>
      <GameSceneContainer>
        <GameScene3D state={state} />
      </GameSceneContainer>
      {isPaused && !dialogOpen && !isSettingsOpen && !isModifyingControls && (
        <PauseOverlay>Paused</PauseOverlay>
      )}
      <GameHint>
        Move, bait boss abilities, dodge warning seals, and punish with bombs or ultimates.
      </GameHint>
      <RoundResultDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        resultMessage={state.resultMessage}
        isGameOver={state.phase === 'game_over'}
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
          setIsModifyingControls(true);
          pause();
        }}
      />
      <ModifyControlsDialog
        isOpen={isModifyingControls}
        onClose={() => {
          setIsModifyingControls(false);
          resume();
        }}
        onSave={() => {
          setIsModifyingControls(false);
          resume();
        }}
        keyBindings={keyBindings}
        numOfPlayers={String(numOfPlayers)}
      />
    </GameBackground>
  );
};
