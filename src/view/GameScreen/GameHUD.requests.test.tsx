import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { GameHUD } from './GameHUD';
import { createInitialState } from '../../engine/initialState';
import { loadCampaignMapRows, parseMapRows } from '../../engine/mapLoader';
import type { CampaignRequestState } from '../../content/villageSquare';

// Requests taken at the village board, as the engine tracks them (built by
// hand here: the square's reducer is agent v1's).
function missionWith(requests: CampaignRequestState[]) {
  const state = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['deidara'],
    map: parseMapRows(loadCampaignMapRows('hiddenLeaf')),
    village: { reputationTier: 'trusted', embers: 0, offeredRequestIds: ['leaf-tea-tins', 'leaf-clean-run'] },
  });
  return {
    ...state,
    campaign: { ...state.campaign!, village: { requests, purchases: [], embersSpent: 0 } },
  };
}

function renderHud(state: ReturnType<typeof missionWith>) {
  return render(<ThemeProvider theme={theme}><GameHUD state={state} scale={100} /></ThemeProvider>);
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

const taken: CampaignRequestState[] = [
  {
    id: 'leaf-tea-tins', status: 'accepted', progress: 1, target: 3,
  },
  {
    id: 'leaf-clean-run', status: 'failed', progress: 0, target: 1,
  },
];

describe('the HUD request tracker', () => {
  it('lists taken requests with their progress under the objectives', () => {
    setViewport(1366, 768);
    renderHud(missionWith(taken));
    const panel = screen.getByLabelText('mission objectives');
    const tracker = within(panel).getByLabelText('village requests');
    expect(tracker).toHaveTextContent('Lost Tea Tins1/3');
    expect(tracker).toHaveTextContent('Not One FallFailed');
  });

  it('fits the request count into the one mission line on a phone', () => {
    setViewport(390, 844);
    renderHud(missionWith(taken));
    const line = screen.getByLabelText('mission objective');
    expect(within(line).getByLabelText('village request')).toHaveTextContent('Req 1/3');
    expect(screen.queryByLabelText('village requests')).not.toBeInTheDocument();
  });
});
