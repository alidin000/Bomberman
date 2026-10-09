import React from 'react';

/**
 * The "Stage scenery" setting inside the canvas (GamePreferences.scenery).
 * Decorative extras that a weak device can do without follow it: today the
 * off-grid landmarks (StageLandmarks). Whatever follows it must keep the
 * same shader programs either way (reuse a program already in the scene,
 * or warm it in ShaderWarmup whatever the setting), so that flipping it
 * under the pause menu never compiles mid-match.
 */
export const SceneryContext = React.createContext(true);

export function useScenery(): boolean {
  return React.useContext(SceneryContext);
}
