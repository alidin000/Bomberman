import React from "react";
import { Routes, Route } from "react-router-dom";
import { WelcomeScreen } from "./view/WelcomeScreen/WelcomeScreen";
import { ConfigScreen } from "./view/ConfigScreen/ConfigScreen";
import { GameWindow } from "./view/GameWindow/GameWindow";
import { InstructionsScreen } from './view/InstructionsScreen/InstructionsScreen';
import { GameScreen } from './view/GameScreen/GameScreen'; // Import the GameScreen component
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/InstructionsTheme';
import './App.css';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/" element={<WelcomeScreen onStart={() => console.log('Game started!')} />} />
        <Route path="/config" element={<ConfigScreen />} />
        <Route path="/instructions" element={<InstructionsScreen />} />
        <Route path="/game" element={<GameScreen />} /> {/* Route for the GameScreen component */}
        <Route path="/game-window" element={<GameWindow />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
