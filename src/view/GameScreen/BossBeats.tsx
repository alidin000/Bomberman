import React from 'react';
import styled from '@emotion/styled';
import { EngineStore, useEngineSelector } from '../../hooks/engineStore';
import { BeatLayer } from './MatchBeatOverlay.styles';
import { bottomPlateOffset } from './MatchBeatOverlay';
import { bossTitlePlacement, selectBossTitle } from './bossBeats';
import { hudInsets, hudLayout } from './scene/cameraFraming';
import { useViewportSize } from './useViewportSize';

// Static plates, like the countdown's: they appear and go, with no CSS
// animation (a per-frame style recalc) and no flash.
const TitlePlate = styled.div({
  maxWidth: 'min(100%, 520px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '10px 22px 12px',
  borderRadius: 2,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  border: '3px solid var(--anime-paper-light)',
  borderTop: '8px solid var(--anime-vermilion)',
  boxShadow: '6px 6px 0 var(--anime-vermilion)',
  textAlign: 'center',
  '& small': {
    fontSize: '0.78rem',
    fontWeight: 900,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--anime-mustard)',
  },
  '& strong': {
    fontSize: '2.2rem',
    fontWeight: 900,
    lineHeight: 1.05,
    textShadow: '3px 3px 0 var(--anime-vermilion)',
  },
  '& span': {
    fontSize: '0.92rem',
    fontWeight: 800,
    lineHeight: 1.25,
  },
  '& em': {
    marginTop: 2,
    fontSize: '0.75rem',
    fontStyle: 'normal',
    fontWeight: 800,
    opacity: 0.85,
  },
  '@media (max-height: 560px) and (min-width: 641px)': {
    padding: '6px 16px 8px',
    '& strong': { fontSize: '1.6rem' },
  },
  // Phones: compact, so it fits the top HUD band when it has to go there.
  '@media (max-width: 640px)': {
    padding: '6px 14px 8px',
    gap: 2,
    '& strong': { fontSize: '1.6rem' },
    '& span': { fontSize: '0.8rem' },
  },
});

/** The card's height in px, a little over its drawn height, for its placement. */
const TITLE_CARD_PX = { row: 160, phone: 140 };
/** Its top when it goes up: in the top HUD band, under the top controls. */
const TITLE_TOP_PX = 70;

/**
 * The boss's title card, while its entrance freezes the arena. The camera
 * aims just below the boss then, so the card sits above the bottom HUD band
 * and the caption, or, when a ninja would be drawn under it there, up in the
 * top HUD band (which it covers for the moment: the HUD shows nothing that
 * changes while the arena is frozen). On a short screen it goes over the top
 * strip. Screen readers hear the entrance from the caption ("Kurama enters
 * the arena"), so the card itself is hidden from them.
 */
export const BossTitleCard = React.memo(({
  store, hudScale,
}: { store: EngineStore; hudScale: number }) => {
  const title = useEngineSelector(store, selectBossTitle);
  const { width, height } = useViewportSize();
  if (!title.card) return null;
  const insets = hudInsets(hudScale, width, height);
  const h = Math.max(height, 1);
  // Above the caption ("Kurama enters the arena") as well as the bottom band.
  const bottom = bottomPlateOffset(width, height, insets.bottom);
  const cardPx = hudLayout(width, height) === 'phone' ? TITLE_CARD_PX.phone : TITLE_CARD_PX.row;
  const side = bossTitlePlacement(
    title.ninjaDepths,
    { top: TITLE_TOP_PX / h, bottom: bottom / h },
    cardPx / h
  );
  let place: React.CSSProperties = side === 'top' ? { top: TITLE_TOP_PX } : { bottom };
  if (hudLayout(width, height) === 'short') place = { top: 8 };
  return (
    <BeatLayer style={place} aria-hidden="true" data-testid="boss-title-card" data-side={side}>
      <TitlePlate>
        <small>Boss arena open</small>
        <strong>{title.name}</strong>
        <span>{title.line}</span>
        <em>Any action or Start skips</em>
      </TitlePlate>
    </BeatLayer>
  );
});
BossTitleCard.displayName = 'BossTitleCard';
