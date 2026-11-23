import React, { useMemo } from 'react';
import type { ArenaAttribution, ArenaMapEntry, ArenaMapId } from '../../content/arenaMaps';
import { cityPreview } from './cityPreview';
import {
  CreditLine,
  LoadingCityCard,
  LoadingCityMap,
  OverviewCount,
  OverviewPlate,
  OverviewSkipButton,
  PreviewSvg,
} from './CityArena.styles';

/** A city map from above (grid and mask): decorative, its card names it. */
export function CityMapPreview({ id }: { id: ArenaMapId }) {
  const preview = useMemo(() => cityPreview(id), [id]);
  if (!preview) return null;
  return (
    <PreviewSvg
      viewBox={`0 0 ${preview.width} ${preview.height}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      data-city-preview={id}
    >
      {preview.layers.map((layer) => (
        <path key={layer.key} d={layer.d} fill={layer.color} />
      ))}
    </PreviewSvg>
  );
}

/**
 * A map's credit: "© OpenStreetMap contributors", linked to the OSM
 * copyright page where a link may go (never inside a button), with the link
 * to the map's published data and method beside it, then any further credit
 * such as the Chain Bridge's designer.
 */
export function ArenaCredit({
  attribution,
  linked = true,
}: {
  attribution: ArenaAttribution;
  // eslint-disable-next-line react/require-default-props -- defaulted in the signature
  linked?: boolean;
}) {
  return (
    <>
      <CreditLine>
        {linked ? (
          <>
            <a href={attribution.href} target="_blank" rel="noopener noreferrer">
              {attribution.text}
            </a>
            {' · '}
            <a href={attribution.source.href} target="_blank" rel="noopener noreferrer">
              {attribution.source.text}
            </a>
          </>
        ) : attribution.text}
      </CreditLine>
      {attribution.credits.map((credit) => (
        <CreditLine key={credit}>{credit}</CreditLine>
      ))}
    </>
  );
}

/** What a city match shows while it loads: its name, its map and its credit. */
export function CityLoadingCard({ entry }: { entry: ArenaMapEntry }) {
  return (
    <LoadingCityCard data-city-loading={entry.id}>
      <strong>{entry.name}</strong>
      <LoadingCityMap>
        <CityMapPreview id={entry.id} />
      </LoadingCityMap>
      {entry.attribution && <ArenaCredit attribution={entry.attribution} />}
    </LoadingCityCard>
  );
}

/**
 * The plate at the foot of a city's round-start overview: the countdown
 * (moved here so nothing covers the board), the city's name, its credit on
 * one line and a Skip button. Any key, pad button or touch skips too
 * (GameScreen). With the HUD hidden it keeps only the countdown and the OSM
 * credit the map image needs: a name-free view of the map, as the playtest's
 * naming step asks, which a designer's credit would give away too.
 */
export function CityOverviewPlate({
  entry,
  countdown,
  named,
  bottom,
  onSkip,
}: {
  entry: ArenaMapEntry;
  countdown: string;
  named: boolean;
  /** Its distance from the screen's bottom edge, in px. */
  bottom: number;
  onSkip: () => void;
}) {
  const { attribution } = entry;
  const credit = attribution && (named
    ? [attribution.text, ...attribution.credits].join(' · ')
    : attribution.text);
  return (
    <OverviewPlate role="group" aria-label="map overview" style={{ bottom }}>
      {countdown && <OverviewCount aria-label="round countdown">{countdown}</OverviewCount>}
      <div>
        {named && <strong>{entry.name}</strong>}
        {credit && <CreditLine>{credit}</CreditLine>}
      </div>
      {named && (
        <OverviewSkipButton variant="outlined" size="small" onClick={onSkip}>
          Skip overview
        </OverviewSkipButton>
      )}
    </OverviewPlate>
  );
}
