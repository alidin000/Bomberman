import React, { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/InstructionsTheme';
import './App.css';
import { WelcomeScreen } from './view/WelcomeScreen/WelcomeScreen';
import { ConfigScreen } from './view/ConfigScreen/ConfigScreen';
import { InstructionsScreen } from './view/InstructionsScreen/InstructionsScreen';
import { DojoScreen } from './view/DojoScreen/DojoScreen';
import { GameSettingsProvider } from './contexts/GameSettingsContext';
import { MenuPad } from './input/MenuPad';
import { TouchMode } from './input/TouchMode';
import {
  dojoRoomChunk,
  gameScreenChunk,
  hubScreenChunk,
  lazyScreen,
  usePrefetchGameScreen,
  usePrefetchGameScreenWhenIdle,
  usePrefetchHubScreen,
} from './view/routeChunks';

// The match (three.js, the scene, the HUD) is about 255 KB gzip that the menus
// never run, so it loads on demand. The menus start the download early.
const GameScreen = lazyScreen(gameScreenChunk, 'GameScreen');
const DojoRoomScreen = lazyScreen(dojoRoomChunk, 'DojoRoomScreen');
const HubScreen = lazyScreen(hubScreenChunk, 'HubScreen');

// Quick Play skips the Mission Deck, so the title screen fetches the match
// once it is idle; the Mission Deck fetches it as soon as it opens.
const PrefetchGameWhenIdle = () => {
  usePrefetchGameScreenWhenIdle();
  return null;
};
const PrefetchGame = () => {
  usePrefetchGameScreen();
  return null;
};
// The dojo's room list fetches the room screen (and the match it runs).
const PrefetchDojoRoom = () => {
  useEffect(() => {
    dojoRoomChunk.prefetch();
  }, []);
  return null;
};
const PrefetchHub = () => {
  usePrefetchHubScreen();
  return null;
};

const gameLoading = (
  <div
    role="status"
    style={{
      minHeight: '100dvh',
      paddingTop: 32,
      color: 'var(--anime-paper-light)',
      background: 'var(--anime-night)',
      textAlign: 'center',
      fontSize: '1.1rem',
    }}
  >
    Loading game...
  </div>
);

export function App() {
  return (
    <GameSettingsProvider>
      <ThemeProvider theme={theme}>
        {/* Gamepads drive every screen's menus and dialogs. */}
        <MenuPad />
        {/* Touch controls on touch screens, until a keyboard or pad is used. */}
        <TouchMode />
        <Routes>
          <Route
            path="/"
            element={(
              <>
                <PrefetchGameWhenIdle />
                <WelcomeScreen />
              </>
            )}
          />
          <Route
            path="/config"
            element={(
              <>
                <PrefetchGame />
                <PrefetchHub />
                <ConfigScreen />
              </>
            )}
          />
          <Route path="/instructions" element={<InstructionsScreen />} />
          <Route
            path="/dojo"
            element={(
              <>
                <PrefetchDojoRoom />
                <DojoScreen />
              </>
            )}
          />
          <Route
            path="/dojo/:roomId"
            element={<Suspense fallback={gameLoading}><DojoRoomScreen /></Suspense>}
          />
          <Route
            path="/hub/:stageId"
            element={(
              <>
                <PrefetchGame />
                <Suspense fallback={gameLoading}><HubScreen /></Suspense>
              </>
            )}
          />
          <Route
            path="/game/:numOfPlayers/:numOfRounds/:selectedMap"
            element={<Suspense fallback={gameLoading}><GameScreen /></Suspense>}
          />
        </Routes>
      </ThemeProvider>
    </GameSettingsProvider>
  );
}
