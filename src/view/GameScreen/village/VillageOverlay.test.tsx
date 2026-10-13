import React from 'react';
import { vi } from 'vitest';
import {
  cleanup, fireEvent, render, screen, within,
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../../theme/InstructionsTheme';
import { createInitialState } from '../../../engine/initialState';
import { loadCampaignMapRows, parseMapRows } from '../../../engine/mapLoader';
import type { GameConfig, GameEngineState } from '../../../engine/types';
import { createEngineStore } from '../../../hooks/engineStore';
import { createVillageRuntime } from '../../../engine/villageSquare';
import { CAMPAIGN_STAGE_LAYOUTS } from '../../../content/campaignLayouts';
import type {
  VillageInteractable, VillageSquareRuntimeState, VillageVisitConfig,
} from '../../../content/villageSquare';
import { loadStoryProgress, saveStoryProgress } from '../../../story/progress';
import { VillageOverlay } from './VillageOverlay';

// Hand-built match states: the reducer for the square's actions is agent
// v1's, so these tests check what the overlays show and what they send.

function leafState(options: {
  village?: VillageVisitConfig;
  runtime?: VillageSquareRuntimeState;
  packed?: GameConfig['loadout'];
  secrets?: string[];
} = {}): GameEngineState {
  const state = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['deidara'],
    map: parseMapRows(loadCampaignMapRows('hiddenLeaf')),
    seed: 21,
    ...(options.village ? { village: options.village } : {}),
    ...(options.packed ? { loadout: options.packed } : {}),
  });
  // The visit's runtime as the engine builds it at INIT, unless given.
  const village = options.runtime ?? createVillageRuntime(state.config);
  return {
    ...state,
    campaign: {
      ...state.campaign!,
      ...(village ? { village } : {}),
      ...(options.secrets ? { discoveredSecrets: options.secrets } : {}),
    },
  };
}

function prop(id: string): VillageInteractable {
  return CAMPAIGN_STAGE_LAYOUTS.hiddenLeaf.square.interactables.find((item) => item.id === id)!;
}

function open(state: GameEngineState, id: string, solo = true) {
  const store = createEngineStore();
  store.publish(state);
  const dispatch = vi.fn();
  const onClose = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <VillageOverlay
        store={store}
        item={prop(id)}
        playerId="player1"
        dispatch={solo ? dispatch : undefined}
        onClose={onClose}
        closeOnEscape={!solo}
      />
    </ThemeProvider>
  );
  return { dispatch, onClose, dialog: screen.getByRole('dialog') };
}

const visit = (changes: Partial<VillageVisitConfig> = {}): VillageVisitConfig => ({
  reputationTier: 'stranger', embers: 60, offeredRequestIds: ['leaf-tea-tins'], ...changes,
});

describe('village square overlays', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists the visit\'s requests on the board and accepts one', () => {
    const { dispatch, dialog } = open(leafState({
      village: visit({ reputationTier: 'known', offeredRequestIds: ['leaf-tea-tins', 'leaf-old-logs'] }),
      runtime: {
        requests: [{
          id: 'leaf-old-logs', status: 'accepted', progress: 1, target: 4,
        }],
        purchases: [],
        embersSpent: 0,
      },
    }), 'board');
    expect(within(dialog).getByRole('heading', { name: 'Request Board' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Old Hobb · +10 Embers · +2 reputation');
    // Taken already: its progress, and no second accept.
    const logs = within(dialog).getByRole('button', { name: 'Rotten Training Logs: Accepted · 1/4' });
    fireEvent.click(logs);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept: Lost Tea Tins' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'leaf-tea-tins' });
  });

  it('sells at the stall price, once per mission counting the pack, within the Embers left', () => {
    const { dispatch, dialog } = open(leafState({
      // Trusted: a fifth off. Visit Embers 60, 15 spent: 45 left.
      village: visit({ reputationTier: 'trusted', embers: 60 }),
      packed: { consumables: ['paperWard'] },
      runtime: { requests: [], purchases: ['lodestone'], embersSpent: 15 },
    }), 'shop');
    expect(within(dialog).getByLabelText('45 Embers to spend')).toBeInTheDocument();
    // Focus starts on the first item that can still be bought.
    expect(within(dialog).getByRole('button', { name: 'Buy · 20: Blast Powder, 20 Embers' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Packed: Paper Ward, 10 Embers' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByRole('button', { name: 'Bought: Lodestone Charm, 10 Embers' })).toHaveAttribute('aria-disabled', 'true');
    // Second Wind is 50, discounted to 40: affordable exactly.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buy · 40: Second Wind Knot, 40 Embers' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'CAMPAIGN_PURCHASE', playerId: 'player1', itemId: 'secondWind' });
    expect(dialog).toHaveTextContent('Bought Second Wind Knot. 5 Embers left.');
  });

  it('refuses a Paper Ward while Ghost is worn, as the engine does', () => {
    const state = leafState({ village: visit() });
    const ghost = {
      ...state,
      players: state.players.map((player) => ({ ...player, powerUps: [...player.powerUps, 'Ghost' as const] })),
    };
    const { dispatch, dialog } = open(ghost, 'shop');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buy · 15: Paper Ward, 15 Embers' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('Paper Ward: Not while Ghost is worn');
  });

  it('says how short the Embers are and sends nothing', () => {
    const { dispatch, dialog } = open(leafState({ village: visit({ embers: 20 }) }), 'shop');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buy · 50: Second Wind Knot, 50 Embers' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('Second Wind Knot: Need 30 Embers more.');
  });

  it('keeps the stall and the board closed in a co-op square, and still talks', () => {
    const coop = leafState();
    const stall = open(coop, 'shop', false);
    expect(stall.dialog).toHaveTextContent('The stall sells on solo missions only.');
    expect(within(stall.dialog).queryByRole('button', { name: /^Buy/ })).not.toBeInTheDocument();
    cleanup();
    const board = open(coop, 'board', false);
    expect(board.dialog).toHaveTextContent('The board takes requests on solo missions only.');
  });

  it('talks through a villager\'s branch, mentions their request, and says goodbye', () => {
    const { onClose, dialog } = open(leafState({ village: visit() }), 'villager-a');
    expect(within(dialog).getByRole('heading', { name: 'Wren' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('The woods past the gate are crawling tonight.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anything hidden nearby?' }));
    expect(dialog).toHaveTextContent('You: Anything hidden nearby?');
    expect(dialog).toHaveTextContent('bricked up by the north wall');
    // Wren's own request (Known) is not offered this visit; Hobb's is.
    expect(within(dialog).queryByRole('button', { name: 'Need a hand?' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Goodbye' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('changes a villager\'s words as the story moves on, and Tamsin brings the news', () => {
    saveStoryProgress({ ...loadStoryProgress(), completedStages: ['hiddenLeaf', 'hiddenSand'] });
    const hobb = open(leafState({ village: visit() }), 'villager-b');
    expect(hobb.dialog).toHaveTextContent('paid for her tea with sand village coin');
    fireEvent.click(within(hobb.dialog).getByRole('button', { name: 'Need a hand?' }));
    expect(hobb.dialog).toHaveTextContent('It is pinned on the board: “Lost Tea Tins”.');
    cleanup();

    const tamsin = open(leafState({ village: visit({ reputationTier: 'known' }) }), 'villager-wanderer');
    expect(within(tamsin.dialog).getByRole('heading', { name: 'Tamsin' })).toBeInTheDocument();
    fireEvent.click(within(tamsin.dialog).getByRole('button', { name: 'Any news from the road?' }));
    expect(tamsin.dialog).toHaveTextContent('Two villages cleared.');
  });

  it('explains the Codex at the shrine, with this village\'s entries and the total', () => {
    saveStoryProgress({ ...loadStoryProgress(), discoveredSecrets: ['hiddenSand-scroll-cache'] });
    const { dialog } = open(leafState({ secrets: ['hiddenLeaf-scroll-cache'] }), 'shrine', false);
    expect(dialog).toHaveTextContent('The Codex is lore you uncover by finding a village\'s secrets.');
    // Found this mission counts at once; the sand cache counts in the total.
    expect(dialog).toHaveTextContent('This village · 1 of 3 found');
    expect(dialog).toHaveTextContent('2 of 21 in every village');
    expect(dialog).toHaveTextContent("The Gatewarden's Ledger");
    expect(within(dialog).getAllByRole('heading', { name: 'Still hidden' })).toHaveLength(2);
  });

  it('briefs the mission at the gate and heads out', () => {
    const { onClose, dialog } = open(leafState({
      village: visit(),
      runtime: {
        requests: [{
          id: 'leaf-tea-tins', status: 'accepted', progress: 0, target: 3,
        }],
        purchases: [],
        embersSpent: 0,
      },
    }), 'gate');
    const objectives = within(dialog).getByRole('list', { name: 'mission objectives' });
    expect(within(objectives).getAllByRole('listitem').length).toBeGreaterThan(1);
    expect(dialog).toHaveTextContent('Requests taken: Lost Tea Tins');
    const headOut = within(dialog).getByRole('button', { name: 'Head out' });
    expect(headOut).toHaveFocus();
    fireEvent.click(headOut);
    expect(onClose).toHaveBeenCalled();
  });
});
