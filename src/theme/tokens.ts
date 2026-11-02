// The design system for the menus, dialogs and HUD. index.css holds the same
// values as CSS custom properties (and the text styles as classes); these are
// for the styled components and the MUI theme. The 3D scene does not use them.

/** Spacing steps: the only values for padding, margins, gaps and insets. */
export const space = {
  0: 0,
  25: 2,
  50: 4,
  75: 8,
  100: 12,
  200: 16,
  300: 24,
  400: 32,
  500: 40,
  600: 48,
  700: 64,
  800: 80,
  900: 96,
} as const;

/**
 * Corner radius steps (Tailwind's). Nested shapes less than 32 px apart take
 * the outer radius minus the gap, and stay square when that is 2 px or less.
 */
export const radius = {
  none: 0,
  sm: 2,
  base: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

/** The one motion curve: weighted, decelerating into place. */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Movement takes 500 ms, colour and opacity 300 ms, and nothing is under 200 ms. */
export const DURATION = { move: 500, fade: 300, min: 200 } as const;

/**
 * A transition list on the house curve: `moves` (transform) at the movement
 * duration and `fades` (colours, opacity) at the fade duration.
 */
export function transition(moves: readonly string[] = [], fades: readonly string[] = []): string {
  return [
    ...moves.map((property) => `${property} ${DURATION.move}ms ${EASE_OUT}`),
    ...fades.map((property) => `${property} ${DURATION.fade}ms ${EASE_OUT}`),
  ].join(', ');
}

/** Physical feedback while a control is held down. */
export const PRESSED = { transform: 'translateY(1px)' } as const;

const display = (size: string, lineHeight: string | number) => ({
  fontFamily: 'var(--font-display)',
  fontSize: `var(--text-${size})`,
  lineHeight,
  fontWeight: 400,
  letterSpacing: '0.04em',
});

const body = (size: string, weight: 400 | 500 | 600) => ({
  fontFamily: 'var(--font-body)',
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--leading-${size})`,
  fontWeight: weight,
});

const button = (size: string) => ({
  ...display(size, `var(--leading-${size})`),
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
});

/**
 * The named text styles, one per kind of text. Headings 1 to 5 and buttons
 * are the display face (one weight); the rest are Manrope.
 */
export const textStyles = {
  heading1: display('6xl', 1),
  heading2: display('5xl', 1),
  heading3: display('4xl', 'var(--leading-4xl)'),
  heading4: display('3xl', 'var(--leading-3xl)'),
  heading5: display('2xl', 'var(--leading-2xl)'),
  heading6: body('xl', 600),
  title1: body('xl', 500),
  title2: body('lg', 500),
  title3: body('base', 500),
  title4: body('sm', 500),
  title5: body('xs', 500),
  body1: body('base', 600),
  body2: body('base', 500),
  body3: body('base', 400),
  body4: body('sm', 600),
  body5: body('sm', 500),
  body6: body('sm', 400),
  buttonLg: button('lg'),
  buttonMd: button('base'),
  buttonSm: button('sm'),
  buttonXsm: button('xs'),
  caption1: body('sm', 500),
  caption2: body('sm', 400),
  caption3: body('xs', 600),
  caption4: body('xs', 500),
  caption5: body('xs', 400),
} as const;

export type TextStyleName = keyof typeof textStyles;
