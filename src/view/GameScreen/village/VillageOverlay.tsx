import React, {
  useMemo, useRef, useState,
} from 'react';
import { Button, DialogContent, DialogTitle } from '@mui/material';
import type { GameAction } from '../../../engine/actions';
import type { GameEngineState } from '../../../engine/types';
import { EngineSelector, EngineStore, useEngineSelector } from '../../../hooks/engineStore';
import { getStageDefinition } from '../../../content';
import { formatEmbers } from '../../../content/hubShop';
import {
  CODEX_EXPLAINER, HUB_MERCHANT, getHubVillage,
} from '../../../content/hubVillages';
import { HUB_LORE_HINTS } from '../../../content/hubLore';
import { getVillageRequest } from '../../../content/villageRequests';
import type { VillageInteractable } from '../../../content/villageSquare';
import { loadStoryProgress } from '../../../story/progress';
import { squareKindOpen } from '../../../input/villageInteract';
import {
  RovingTabStops, keepRovingStopOnFocus, moveFocusWithArrows,
} from '../../ConfigScreen/menuNavigation';
import {
  AskedLine,
  ChoiceList,
  CodexEntry,
  CodexList,
  EmberBalance,
  EmberGlyph,
  HubAnnouncer,
  ItemText,
  MerchantLine,
  ShopHeading,
  ShopList,
  ShopRow,
  SpokenLine,
} from '../../HubScreen/HubScreen.styles';
import {
  BriefingList,
  ClosedNote,
  OverlayActions,
  OverlayLead,
  PriceWas,
  RequestMeta,
  RoleLine,
  VillageDialog,
} from './VillageOverlay.styles';
import {
  boardRows,
  gateBriefing,
  shrineModel,
  squareTalk,
  stallModel,
} from './villageCopy';

export interface VillageOverlayProps {
  store: EngineStore;
  item: VillageInteractable;
  playerId: string;
  // Solo only: takes ACCEPT_REQUEST and CAMPAIGN_PURCHASE (the match is
  // paused). Online rooms pass none: clients cannot send those actions.
  // eslint-disable-next-line react/require-default-props -- absent online
  dispatch?: (action: GameAction) => void;
  onClose: () => void;
  // The solo screen's own Escape handler closes it (pad B and Start too);
  // elsewhere the dialog closes itself on Escape.
  closeOnEscape: boolean;
}

// Only what the overlays read; it is paused in solo, so this rarely changes.
const selectSquareState: EngineSelector<GameEngineState | null> = (state, previous) => {
  if (!state?.campaign) return null;
  if (
    previous?.campaign
    && previous.config === state.config
    && previous.campaign.village === state.campaign.village
    && previous.campaign.discoveredSecrets === state.campaign.discoveredSecrets
    && previous.campaign.objectives === state.campaign.objectives
    && previous.campaign.livesRemaining === state.campaign.livesRemaining
  ) return previous;
  return state;
};

const TITLES: Record<VillageInteractable['kind'], string> = {
  villager: 'Villager',
  board: 'Request Board',
  shop: `${HUB_MERCHANT.name}'s Stall`,
  shrine: 'Codex Shrine',
  gate: 'Village Gate',
};

export const VillageOverlay = ({
  store, item, playerId, dispatch, onClose, closeOnEscape,
}: VillageOverlayProps) => {
  const state = useEngineSelector(store, selectSquareState);
  const contentRef = useRef<HTMLDivElement>(null);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Read once per visit to the prop: the story so far and the codex.
  const saved = useMemo(() => loadStoryProgress(), []);
  if (!state?.campaign) return null;
  const { stageId } = state.campaign;
  const { accent } = getStageDefinition(stageId).palette;
  const open = squareKindOpen(state, item.kind);
  const rows = boardRows(state);
  // A villager mentions their request while it is still up for taking.
  const talk = item.kind === 'villager'
    ? squareTalk(
      stageId,
      item.villagerId,
      saved.completedStages,
      rows.filter((row) => row.status === 'offered').map((row) => row.request)
    )
    : null;
  const title = talk ? talk.npc.name : TITLES[item.kind];
  const titleId = 'village-overlay-title';

  const renderTalk = () => {
    if (!talk) return null;
    const choice = talk.choices.find((option) => option.id === choiceId) ?? null;
    return (
      <>
        <RoleLine>{talk.npc.role}</RoleLine>
        {choice && <AskedLine>{`You: ${choice.prompt}`}</AskedLine>}
        <SpokenLine accent={accent}>{choice?.reply ?? talk.opening}</SpokenLine>
        <ChoiceList role="group" aria-label="replies" data-roving-group>
          {talk.choices
            .filter((option) => option.id !== choiceId)
            .map((option, index) => (
              <Button
                key={option.id}
                variant="outlined"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={index === 0}
                onClick={() => setChoiceId(option.id)}
              >
                {option.prompt}
              </Button>
            ))}
          <Button variant="text" onClick={onClose}>Goodbye</Button>
        </ChoiceList>
      </>
    );
  };

  const renderBoard = () => {
    if (!open || !dispatch) {
      return <ClosedNote>The board takes requests on solo missions only.</ClosedNote>;
    }
    if (rows.length === 0) {
      return (
        <ClosedNote>
          Nothing new is pinned up for you here. More requests go up as your standing grows.
        </ClosedNote>
      );
    }
    return (
      <>
        <OverlayLead>
          Accept any request and it is tracked through the mission. Rewards are paid when the
          mission is won.
        </OverlayLead>
        <ShopList aria-label="requests">
          {rows.map((row, index) => {
            const detailId = `village-request-${row.request.id}`;
            const accepted = row.status !== 'offered';
            return (
              <ShopRow key={row.request.id}>
                <ItemText id={detailId}>
                  <strong>{row.request.title}</strong>
                  <span>{row.request.description}</span>
                  <small>{`${row.giver} · ${row.reward}`}</small>
                  {accepted && <RequestMeta>{row.statusText}</RequestMeta>}
                </ItemText>
                <Button
                  variant="outlined"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={index === 0}
                  aria-disabled={accepted ? 'true' : undefined}
                  aria-describedby={detailId}
                  aria-label={accepted
                    ? `${row.request.title}: ${row.statusText}`
                    : `Accept: ${row.request.title}`}
                  onClick={() => {
                    if (accepted) return;
                    dispatch({ type: 'ACCEPT_REQUEST', playerId, requestId: row.request.id });
                    setAnnouncement(`Accepted ${row.request.title}.`);
                  }}
                >
                  {accepted ? 'Accepted' : 'Accept'}
                </Button>
              </ShopRow>
            );
          })}
        </ShopList>
      </>
    );
  };

  const renderStall = () => {
    const hub = getHubVillage(stageId);
    if (!open || !dispatch) {
      return (
        <>
          <MerchantLine>
            <strong>{`${HUB_MERCHANT.name}: `}</strong>
            {`“${hub.merchantLine}”`}
          </MerchantLine>
          <ClosedNote>The stall sells on solo missions only.</ClosedNote>
        </>
      );
    }
    const stall = stallModel(state, playerId);
    // Focus lands on the first item that can be bought.
    const firstBuy = stall.rows.findIndex((row) => !row.block);
    return (
      <>
        <MerchantLine>
          <strong>{`${HUB_MERCHANT.name}: `}</strong>
          {`“${hub.merchantLine}”`}
        </MerchantLine>
        <ShopHeading id="village-stall-heading">
          For this mission
          <EmberBalance as="span" aria-label={`${formatEmbers(stall.balance)} to spend`}>
            <EmberGlyph aria-hidden="true" />
            {formatEmbers(stall.balance)}
          </EmberBalance>
        </ShopHeading>
        <ShopList aria-labelledby="village-stall-heading">
          {stall.rows.map((row, index) => {
            const detailId = `village-stall-${row.id}`;
            const focusHere = index === firstBuy;
            let label = `Buy · ${row.price}`;
            let detail = '';
            if (row.block === 'owned') {
              label = row.packed ? 'Packed' : 'Bought';
              detail = row.packed ? 'Already packed for this mission.' : 'Bought this mission.';
            }
            if (row.block === 'ghost') detail = 'Not while Ghost is worn: a Guard will not take.';
            if (row.block === 'embers') detail = `Need ${formatEmbers(row.price - stall.balance)} more.`;
            return (
              <ShopRow key={row.id}>
                <ItemText id={detailId}>
                  <strong>{row.name}</strong>
                  <span>{row.effect}</span>
                  {row.price < row.basePrice && (
                    <small>
                      <PriceWas>{row.basePrice}</PriceWas>
                      {`${row.price} · a fifth off for a trusted friend`}
                    </small>
                  )}
                  {detail && <small>{detail}</small>}
                </ItemText>
                <Button
                  variant="outlined"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={focusHere}
                  aria-disabled={row.block ? 'true' : undefined}
                  aria-describedby={detailId}
                  aria-label={`${label}: ${row.name}, ${formatEmbers(row.price)}`}
                  onClick={() => {
                    if (row.block) {
                      if (detail) setAnnouncement(`${row.name}: ${detail}`);
                      return;
                    }
                    dispatch({ type: 'CAMPAIGN_PURCHASE', playerId, itemId: row.id });
                    setAnnouncement(`Bought ${row.name}. ${formatEmbers(stall.balance - row.price)} left.`);
                  }}
                >
                  {label}
                </Button>
              </ShopRow>
            );
          })}
        </ShopList>
      </>
    );
  };

  const renderShrine = () => {
    const shrine = shrineModel(stageId, [
      ...saved.discoveredSecrets, ...state.campaign!.discoveredSecrets,
    ]);
    return (
      <>
        <OverlayLead>
          {`${CODEX_EXPLAINER} This shrine keeps the village's three entries: crack its hidden walls to write them in.`}
        </OverlayLead>
        <ShopHeading as="p">
          {`This village · ${shrine.villageFound} of ${shrine.entries.length} found`}
          <span>{`${shrine.totalFound} of ${shrine.total} in every village`}</span>
        </ShopHeading>
        <CodexList aria-label="this village's codex">
          {shrine.entries.map(({ entry, found }) => (
            <CodexEntry key={entry.id} locked={!found} accent={accent}>
              <small>{HUB_LORE_HINTS[entry.kind]}</small>
              <h4>{found ? entry.title : 'Still hidden'}</h4>
              {found && <p>{entry.text}</p>}
            </CodexEntry>
          ))}
        </CodexList>
      </>
    );
  };

  const renderGate = () => {
    const briefing = gateBriefing(state);
    if (!briefing) return null;
    const tracked = (state.campaign?.village?.requests ?? [])
      .filter((request) => request.status === 'accepted')
      .map((request) => getVillageRequest(request.id)?.title)
      .filter(Boolean);
    return (
      <>
        <ShopHeading as="p">
          {briefing.title}
          {briefing.lives && <span>{`Lives ${briefing.lives}`}</span>}
        </ShopHeading>
        <BriefingList aria-label="mission objectives">
          {briefing.objectives.map((objective) => (
            <li key={objective.id} data-done={objective.done}>{objective.label}</li>
          ))}
          {briefing.boss && <li>{`Seal ${briefing.boss}`}</li>}
        </BriefingList>
        {tracked.length > 0 && <OverlayLead>{`Requests taken: ${tracked.join(' · ')}`}</OverlayLead>}
        <OverlayLead>The square is safe ground. Past the gate, nothing is.</OverlayLead>
      </>
    );
  };

  let body: React.ReactNode = null;
  if (item.kind === 'villager') body = renderTalk();
  if (item.kind === 'board') body = renderBoard();
  if (item.kind === 'shop') body = renderStall();
  if (item.kind === 'shrine') body = renderShrine();
  if (item.kind === 'gate') body = renderGate();
  const gate = item.kind === 'gate';
  // Where focus lands on arrival when no row or reply takes it.
  const closeFirst = gate || item.kind === 'shrine' || !open || !dispatch
    || (item.kind === 'board' && rows.length === 0)
    || (item.kind === 'shop' && stallModel(state, playerId).rows.every((row) => row.block));

  return (
    <VillageDialog
      open
      aria-labelledby={titleId}
      disableEscapeKeyDown={!closeOnEscape}
      onClose={(_event, reason) => {
        if (reason === 'escapeKeyDown') onClose();
      }}
      PaperProps={{ onKeyDown: moveFocusWithArrows, onFocus: keepRovingStopOnFocus }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent ref={contentRef}>
        {body}
        <HubAnnouncer role="status" aria-live="polite">{announcement}</HubAnnouncer>
        {item.kind !== 'villager' && (
          <OverlayActions>
            <Button
              variant={gate ? 'contained' : 'text'}
              // The gate's one job: head out, so it has focus on arrival.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={closeFirst}
              onClick={onClose}
            >
              {gate ? 'Head out' : 'Close'}
            </Button>
          </OverlayActions>
        )}
      </DialogContent>
      <RovingTabStops root={contentRef} />
    </VillageDialog>
  );
};
