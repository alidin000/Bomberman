import React from 'react';
import styled from '@emotion/styled';
import { WaveLineModel } from './waveCopy';

// The defense's wave line in the mission panel: "Wave 2/4 · in 0:12", and
// under it where the marked wave comes from. A held wave keeps a dashed
// edge and the word "held", so the state never rests on colour alone.

const LABEL = '0.75rem';

const WaveRow = styled('div', {
  shouldForwardProp: (prop) => prop !== 'held',
})<{ held: boolean }>(({ held }) => ({
  display: 'grid',
  gap: 2,
  marginTop: 6,
  padding: '4px 6px',
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '1px solid rgba(33,29,26,0.3)',
  borderLeft: `4px ${held ? 'dashed' : 'solid'} ${held ? 'var(--anime-vermilion)' : 'var(--anime-teal)'}`,
  '& > div': {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    minWidth: 0,
  },
  '& strong': {
    fontSize: '0.8rem',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  '& b': {
    marginLeft: 'auto',
    fontSize: '0.92rem',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  '& small': {
    overflow: 'hidden',
    color: 'var(--anime-line)',
    fontSize: LABEL,
    lineHeight: 1.2,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}));

// Three chevrons: waves rolling in. Inherits the text colour.
const WaveGlyph = () => (
  <svg viewBox="0 0 18 12" width="16" height="11" aria-hidden focusable="false">
    <path d="M1 1l4 5-4 5M7 1l4 5-4 5M13 1l4 5-4 5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

export const WaveLine = React.memo(({ model }: { model: WaveLineModel }) => (
  // role="timer" is aria-live="off": the countdown is not read every second;
  // the marks and holds are captioned instead.
  <WaveRow held={model.held} role="timer" aria-label="defense waves">
    <div>
      <WaveGlyph />
      <strong>{model.label}</strong>
      <b>{model.value}</b>
    </div>
    {model.note && <small>{model.note}</small>}
  </WaveRow>
), (prev, next) => prev.model.label === next.model.label
  && prev.model.value === next.model.value
  && prev.model.note === next.model.note
  && prev.model.held === next.model.held);
WaveLine.displayName = 'WaveLine';
