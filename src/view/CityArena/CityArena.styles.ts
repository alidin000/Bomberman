import styled from '@emotion/styled';
import { Button } from '@mui/material';
import { radius, space, textStyles } from '../../theme/tokens';

/** The top-down map: square cells, scaled to whatever frame holds it. */
export const PreviewSvg = styled.svg`
  display: block;
  width: 100%;
  height: 100%;
`;

/**
 * A city's name, map and credit while its match loads: centred over the
 * arena skeleton (GameScreen.styles LoadingScreen).
 */
export const LoadingCityCard = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space[75]}px;
  width: min(280px, calc(100% - ${space[600]}px));
  padding: ${space[200]}px;
  color: var(--anime-paper-light);
  text-align: center;
  background: var(--anime-night);
  border: 2px solid var(--anime-paper-light);
  border-radius: var(--radius);
  transform: translate(-50%, -50%);

  & strong {
    ${textStyles.heading7}
  }
`;

/** The city's map, square, in a paper frame. */
export const LoadingCityMap = styled.div`
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid var(--anime-paper-light);
`;

/** The OSM credit (and any further credit) under a city's name. */
export const CreditLine = styled.span`
  ${textStyles.caption5}
  display: block;
  color: inherit;

  & a {
    color: inherit;
    text-decoration: underline;
  }

  & a:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

/**
 * The round-start overview's plate: the countdown, the city's name and credit
 * and a Skip button in one row at the foot of the screen (its `bottom` is set
 * where it is placed). The overview frames the board above the taller of
 * the bottom HUD band and a plate OVERVIEW_PLATE.heightPx tall: one line of
 * credits, which fits from about 860 px wide. A narrower screen wraps the
 * credits rather than cut them; phones frame the board above their touch
 * controls, which leaves the plate room to grow.
 */
export const OverviewPlate = styled.div`
  position: absolute;
  left: 50%;
  /* Over the HUD (10) and the touch controls (18), which change nothing and
     take nothing until GO (any touch ends the overview); under the top
     controls (20) and the pause menu (21). */
  z-index: 19;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${space[100]}px;
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100% - ${space[400]}px);
  padding: ${space[50]}px ${space[200]}px;
  color: var(--anime-paper-light);
  text-align: center;
  background: var(--anime-night);
  border: 2px solid var(--anime-paper-light);
  border-radius: var(--radius);
  transform: translateX(-50%);

  & > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  & > div > strong {
    ${textStyles.heading7}
  }
`;

/** The countdown in the plate while the overview runs: the beat's digit, small. */
export const OverviewCount = styled.strong`
  ${textStyles.heading5}
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 40px;
  height: 40px;
  padding: 0 ${space[75]}px;
  color: var(--anime-orange);
  background: var(--anime-ink);
  border: 2px solid var(--anime-orange);
  border-radius: ${radius.sm}px;
`;

export const OverviewSkipButton = styled(Button)`
  ${textStyles.buttonSm}
  color: var(--anime-paper-light);
  border-color: var(--anime-paper-light);

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;
