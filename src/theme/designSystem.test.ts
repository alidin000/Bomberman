import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { radius, space } from './tokens';

/*
 * The design system (theme/tokens.ts, index.css) as a static check over the
 * UI's style sources: the menus, dialogs, HUD, global CSS and the static
 * first paint in index.html. The 3D scene, the drawn portraits and the
 * village marks are art with their own units, so they are not scanned.
 *
 * A line that breaks a rule on purpose (a selected tab's underline, a
 * divider between list rows) says why in a `design-system: allow <reason>`
 * comment on that line or the line above.
 */

type Violation = { file: string; line: number; rule: string; text: string };

const SOURCES = ['src/view', 'src/theme', 'src/input', 'src/App.tsx', 'src/index.css', 'src/App.css', 'index.html'];
const NOT_UI = [
  /\.test\.tsx?$/,
  /\.testutil\.tsx?$/,
  /^src\/view\/GameScreen\/scene\//,
  /^src\/view\/GameScreen\/GameScene3D/,
  /^src\/view\/portraits\//,
  /^src\/theme\/VillageMark\.tsx$/,
  // The tokens themselves.
  /^src\/theme\/tokens\.ts$/,
];
const STYLE_FILE = /(\.styles\.ts|\.css|\.html)$|^src\/theme\/[^/]+\.ts$/;

const SCALE_PX = new Set([12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96, 128]);
const SPACE_PX = new Set<number>(Object.values(space));
const RADIUS_PX = new Set<number>(Object.values(radius));
const WEIGHTS = new Set(['400', '500', '600', 'normal', 'inherit']);
// Colour and opacity may shift on hover; everything that moves is a transform.
const TRANSITION_PROPS = new Set([
  'transform', 'opacity', 'color', 'background-color', 'background', 'border-color',
  'box-shadow', 'filter', 'outline-color', 'fill', 'stroke', 'visibility',
]);
const HOUSE_CURVE = /var\(--ease-out\)|cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)|__I__|steps\(/;
const BROWSER_CURVE = /(?<![\w-])(ease|ease-in|ease-out|ease-in-out|linear)(?![\w-])/;
const ALLOW = /design-system: allow/;
// A length with a unit, or a bare 0 (a unitless number in CSS is no length).
const LENGTH = /(?<![\w.#-])(-?\d*\.?\d+)(px|rem)(?![\w%.])|(?<![\w.#-])(0)(?![\w%.])/g;
const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix\(|var\(--|transparent|currentColor|__I__/i;

function listSources(): string[] {
  return SOURCES.flatMap((source) => {
    if (/\.\w+$/.test(source)) return [source];
    return readdirSync(source, { recursive: true, encoding: 'utf8' })
      .map((name) => join(source, name).replace(/\\/g, '/'))
      .filter((path) => /\.(tsx?|css|html)$/.test(path));
  }).filter((path) => !NOT_UI.some((pattern) => pattern.test(path)))
    .filter((path) => STYLE_FILE.test(path) || path.endsWith('.tsx'));
}

/** Blank out comments, keeping every newline so line numbers hold. */
function stripComments(text: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/^\s*\/\/.*$/gm, blank);
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/** Split on a separator outside brackets and quotes. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  Array.from(text).forEach((char, index) => {
    if (quote) {
      if (char === quote) quote = '';
    } else if ('\'"`'.includes(char)) {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  });
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function toPx(amount: string, unit = 'px'): number {
  return Math.abs(Number(amount) * (unit === 'rem' ? 16 : 1));
}

function lengthsIn(value: string): number[] {
  return Array.from(value.matchAll(LENGTH)).map(([, amount = '0', unit]) => toPx(amount, unit));
}

/** Every gradient call in a value, as its argument list. */
function gradients(value: string): string[] {
  const found: string[] = [];
  const opener = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/g;
  let match = opener.exec(value);
  while (match) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (end < value.length && depth > 0) {
      if (value[end] === '(') depth += 1;
      if (value[end] === ')') depth -= 1;
      end += 1;
    }
    found.push(value.slice(match.index + match[0].length, end - 1));
    match = opener.exec(value);
  }
  return found;
}

/**
 * A gradient is flat when its colours never blend: one colour throughout,
 * or every stop starting exactly where the previous one ends (hard stops).
 */
function isFlatGradient(args: string): boolean {
  const stops = splitTopLevel(args, ',').filter((part) => COLOUR.test(part)).map((stop) => {
    // The colour is the first token, or a whole function call such as color-mix(…).
    let colour = stop.match(/^\S+/)?.[0] ?? stop;
    if (/^[a-z-]+\(/i.test(stop)) {
      let depth = 0;
      let end = 0;
      do {
        if (stop[end] === '(') depth += 1;
        if (stop[end] === ')') depth -= 1;
        end += 1;
      } while (end < stop.length && (depth > 0 || stop[end - 1] !== ')'));
      colour = stop.slice(0, end);
    }
    const positions = stop.slice(colour.length).trim().split(/\s+/).filter(Boolean)
      .map((position) => position.replace(/^0(%|px|deg)$/, '0'));
    return { colour, positions };
  });
  if (stops.every((stop) => stop.colour === stops[0].colour)) return true;
  return stops.every((stop, index) => {
    if (index === 0) return true;
    const previous = stops[index - 1].positions;
    // A stop placed at 0 is clamped to the one before it: a hard stop too.
    return stop.positions.length > 0
      && (stop.positions[0] === previous[previous.length - 1] || stop.positions[0] === '0');
  });
}

function isInsetStripe(shadow: string): boolean {
  if (!/\binset\b/.test(shadow)) return false;
  const [x = 0, y = 0, blur = 0, spread = 0] = Array.from(
    shadow.replace(/rgba?\([^)]*\)|#[0-9a-f]+/gi, '').matchAll(/(-?\d*\.?\d+)(px)?/g),
    ([, amount]) => Number(amount)
  );
  return (x !== 0) !== (y !== 0) && blur === 0 && spread === 0;
}

/**
 * A font size is on the scale when every literal size in it is a step. Sizes
 * computed from tokens (textStyles, a helper) cannot be read statically and
 * pass; fluid sizes (clamp, viewport units) never do.
 */
function fontSizeOk(value: string, source: string): boolean {
  const constant = /^[A-Za-z_]\w*$/.test(value)
    && source.match(new RegExp(`const ${value}\\s*=\\s*['"]([^'"]+)['"]`))?.[1];
  if (constant) return fontSizeOk(constant, source);
  if (/clamp\(|\d(vw|vh|vmin|vmax|dvh|svh)\b/.test(value)) return false;
  if (/^\d*\.?\d+$/.test(value)) return SCALE_PX.has(Number(value));
  return Array.from(value.matchAll(/(?<![\w.-])(\d*\.?\d+)(px|rem)\b/g))
    .every(([, amount, unit]) => SCALE_PX.has(toPx(amount, unit)));
}

/**
 * Check one declaration. `property` is kebab-case; interpolations in `value`
 * are already `__I__`. `source` is the whole file, for its string constants.
 */
function check(property: string, rawValue: string, source: string, styleFile: boolean): string[] {
  const value = rawValue.trim().replace(/;$/, '').replace(/^['"`]|['"`]$/g, '')
    .trim();
  const rules: string[] = [];
  const custom = property.startsWith('--');

  if (!/mask/.test(property) && !/background-clip/.test(property)
    && gradients(value).some((args) => !isFlatGradient(args))) {
    rules.push('colour fade');
  }
  if (custom) return rules;

  if (property === 'font-size' && !fontSizeOk(value, source)) rules.push('type scale');
  if (property === 'font-weight' && /^(\d+|bold|bolder|lighter)$/.test(value) && !WEIGHTS.has(value)) {
    rules.push('weight');
  }
  if (property === 'font') {
    const [weight] = value.split(/\s+/);
    if (/^\d+$/.test(weight) && !WEIGHTS.has(weight)) rules.push('weight');
  }
  if (property === 'font-style' && value === 'italic') rules.push('italic');

  const spacing = /^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(gap|row-gap|column-gap)$/;
  const offset = /^(inset|top|right|bottom|left)$/;
  if ((spacing.test(property) || (styleFile && offset.test(property)))
    && lengthsIn(value).some((px) => !SPACE_PX.has(px))) {
    rules.push('spacing');
  }
  if (property === 'border-radius' && lengthsIn(value).some((px) => !RADIUS_PX.has(px))) {
    rules.push('radius');
  }
  if (/^border-(top|right|bottom|left|inline|block)(-(start|end))?(-(width|style|color))?$/.test(property)
    && !/^(0|0px|none)$/.test(value)) {
    rules.push('one-sided border');
  }
  if (property === 'box-shadow' && splitTopLevel(value, ',').some(isInsetStripe)) {
    rules.push('one-sided border');
  }

  if (/^(transition|animation)(-duration|-timing-function)?$/.test(property) && !/^(none|unset|inherit)$/.test(value)) {
    if (/^transition\(/.test(value)) {
      const [moves = '', fades = ''] = Array.from(value.matchAll(/\[([^\]]*)\]/g), ([, list]) => list);
      const named = (list: string) => Array.from(list.matchAll(/['"]([\w-]+)['"]/g), ([, name]) => name);
      if (named(moves).some((name) => name !== 'transform')
        || named(fades).some((name) => !TRANSITION_PROPS.has(name) || name === 'transform')) {
        rules.push('animates layout');
      }
      return rules;
    }
    if (/^theme\.transitions\.create/.test(value)) return rules;
    if (BROWSER_CURVE.test(value)) rules.push('browser curve');
    const durations = Array.from(value.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)(?!\w)/g), ([, amount, unit]) => (
      Number(amount) * (unit === 's' ? 1000 : 1)
    ));
    if (durations.some((ms) => ms > 0.01 && ms < 200)) rules.push('short duration');
    if (!property.endsWith('-duration') && durations.length > 0 && !HOUSE_CURVE.test(value)
      && !property.endsWith('-timing-function')) {
      rules.push('no house curve');
    }
    if (property === 'transition') {
      const moved = splitTopLevel(value, ',').map((part) => part.split(/\s+/)[0]);
      if (moved.some((name) => !TRANSITION_PROPS.has(name) && name !== '__I__')) rules.push('animates layout');
    }
  }
  return rules;
}

// Token references read as their values: space[200] is 16px, radius.sm 2px.
const SPACE_TOKENS: Record<string, number> = space;
const RADIUS_TOKENS: Record<string, number> = radius;
const resolveTokens = (value: string) => value
  .replace(/\bspace\[(\d+)\]/g, (m, step) => (step in SPACE_TOKENS ? `${SPACE_TOKENS[step]}px` : m))
  .replace(/\bradius(?:\.(\w+)|\[['"](\w+)['"]\])/g, (m, a, b) => {
    const step = a ?? b;
    return step in RADIUS_TOKENS ? `${RADIUS_TOKENS[step]}px` : m;
  });

/** A value in an object: up to a comma, or the bracket that closes its object. */
function objectValue(text: string): string {
  let depth = 0;
  let quote = '';
  let end = 0;
  while (end < text.length) {
    const char = text[end];
    if (quote) {
      if (char === quote) quote = '';
    } else if ('\'"`'.includes(char)) {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      if (depth === 0) break;
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      break;
    }
    end += 1;
  }
  return text.slice(0, end).trim();
}

const kebab = (key: string) => key.replace(/^Webkit/, '-webkit-').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const SX_SPACING = /^(p|pt|pr|pb|pl|px|py|m|mt|mr|mb|ml|mx|my)$/;

/** Inside a frame of an `@keyframes` block that opens before `index`. */
function inKeyframeAt(css: string, index: number): boolean {
  const start = css.lastIndexOf('@keyframes', index);
  if (start < 0) return false;
  const between = css.slice(start, index);
  return (between.match(/\{/g)?.length ?? 0) - (between.match(/\}/g)?.length ?? 0) >= 2;
}

function scanCss(
  css: string,
  offsetLine: number,
  file: string,
  keyframes: boolean,
  lines: string[],
  source: string
): Violation[] {
  const found: Violation[] = [];
  const declaration = /(?<![\w-])(-{0,2}[a-z][a-z0-9-]*)\s*:\s*([^;{}]+)(?=[;}])/g;
  let match = declaration.exec(css);
  while (match) {
    const [, property, value] = match;
    const line = offsetLine + lineAt(css, match.index) - 1;
    const allowed = ALLOW.test(lines[line - 1] ?? '') || ALLOW.test(lines[line - 2] ?? '');
    const inKeyframes = keyframes || inKeyframeAt(css, match.index);
    const rules = check(property, value.replace(/\s+/g, ' '), source, true);
    if (inKeyframes && !['transform', 'opacity', 'visibility'].includes(property)) rules.push('animates layout');
    if (!allowed) {
      rules.forEach((rule) => found.push({
        file, line, rule, text: `${property}: ${value.trim()}`
      }));
    }
    match = declaration.exec(css);
  }
  return found;
}

/**
 * Read a template literal from just after its opening backtick. Returns the
 * index of the closing backtick and its CSS, with each `${…}` (nested
 * templates included) read as `__I__` and its newlines kept.
 */
function readTemplate(text: string, from: number): { end: number; css: string } {
  // A stack of open templates ('`') and interpolations (their brace depth).
  const stack: (string | number)[] = ['`'];
  let css = '';
  let index = from;
  while (index < text.length && stack.length > 0) {
    const char = text[index];
    const top = stack[stack.length - 1];
    const outermost = stack.length === 1;
    // Newlines inside an interpolation still count for line numbers.
    if (char === '\n' && !(top === '`' && outermost)) css += '\n';
    if (top === '`') {
      if (char === '\\') {
        if (outermost) css += text.slice(index, index + 2);
        index += 1;
      } else if (char === '`') {
        stack.pop();
      } else if (char === '$' && text[index + 1] === '{') {
        if (outermost) css += '__I__';
        stack.push(0);
        index += 1;
      } else if (outermost) {
        css += char;
      }
    } else if (char === '`') stack.push('`');
    else if (char === '{') stack[stack.length - 1] = (top as number) + 1;
    else if (char === '}' && top === 0) stack.pop();
    else if (char === '}') stack[stack.length - 1] = (top as number) - 1;
    index += 1;
  }
  return { end: index - 1, css };
}

/**
 * Where a tagged template's CSS starts: after `styled.x`, `styled(C, {…})`,
 * an optional `<Props>` generic, `css` or `keyframes`, and the backtick.
 * Returns -1 when the tag is not followed by a template.
 */
function templateStart(text: string, from: number): number {
  let index = from;
  const skipBalanced = (open: string, close: string) => {
    let depth = 0;
    do {
      if (text[index] === open) depth += 1;
      else if (text[index] === close && text[index - 1] !== '=') depth -= 1;
      index += 1;
    } while (index < text.length && depth > 0);
  };
  const member = /^\.\w+/.exec(text.slice(index));
  if (member) index += member[0].length;
  if (text[index] === '(') skipBalanced('(', ')');
  while (/\s/.test(text[index] ?? '')) index += 1;
  if (text[index] === '<') skipBalanced('<', '>');
  while (/\s/.test(text[index] ?? '')) index += 1;
  return text[index] === '`' ? index + 1 : -1;
}

/** Scan one source text; exported shape kept small so the fixture test can use it. */
function scan(file: string, source: string): Violation[] {
  const lines = source.split('\n');
  const text = stripComments(source);
  const styleFile = STYLE_FILE.test(file);
  // An interpolation reads as `__I__`, keeping its newlines.
  const interpolated = (css: string) => css.replace(/\$\{[^}]*\}/g, (m) => `__I__${m.replace(/[^\n]/g, '')}`);

  if (file.endsWith('.css')) return scanCss(text, 1, file, false, lines, text);
  if (file.endsWith('.html')) {
    return Array.from(text.matchAll(/<style>([\s\S]*?)<\/style>/g)).flatMap((block) => (
      scanCss(block[1], lineAt(text, block.index ?? 0), file, false, lines, text)
    ));
  }

  // Template-literal CSS (styled.x`…`, css`…`, keyframes`…`, nested ones
  // too), then blank it out so the object scan below only sees object styles.
  const found: Violation[] = [];
  let objects = text;
  Array.from(text.matchAll(/\b(styled|css|keyframes)\b/g)).forEach((tag) => {
    const start = templateStart(text, (tag.index ?? 0) + tag[0].length);
    if (start < 0) return;
    const { end, css } = readTemplate(text, start);
    found.push(...scanCss(css, lineAt(text, start), file, tag[1] === 'keyframes', lines, text));
    objects = objects.slice(0, start) + objects.slice(start, end).replace(/[^\n]/g, ' ') + objects.slice(end);
  });

  // Object styles: join a value that continues on the next lines (brackets
  // left open after its key, or `+` joins), then read each `key: value`.
  const physical = objects.split('\n');
  let index = 0;
  while (index < physical.length) {
    const startLine = index + 1;
    let logical = physical[index];
    const open = () => {
      const colon = logical.search(/['"\w]\s*:(?!:)/);
      const valuePart = colon < 0 ? '' : logical.slice(colon);
      return (valuePart.match(/[([]/g)?.length ?? 0) - (valuePart.match(/[)\]]/g)?.length ?? 0);
    };
    while (index + 1 < physical.length
      && (open() > 0 || /\+\s*$/.test(logical) || /^\s*\+/.test(physical[index + 1]))) {
      index += 1;
      logical += ` ${physical[index]}`;
    }
    index += 1;
    const joined = interpolated(logical.replace(/(['"`])\s*\+\s*(['"`])/g, ''));
    const key = /(?<![\w$.-])['"]?([a-zA-Z]+)['"]?\s*:\s*/g;
    let pair = key.exec(joined);
    while (pair) {
      const value = resolveTokens(objectValue(joined.slice(pair.index + pair[0].length)));
      const name = pair[1];
      const allowed = ALLOW.test(lines[startLine - 1] ?? '') || ALLOW.test(lines[startLine - 2] ?? '');
      let rules: string[] = [];
      if (SX_SPACING.test(name) && file.endsWith('.tsx')) {
        if (/^-?\d*\.?\d+$/.test(value.trim()) && !SPACE_PX.has(toPx(value.trim()) * 8)) rules.push('spacing');
      } else if (!SX_SPACING.test(name)) {
        const property = kebab(name);
        const numeric = /^-?\d*\.?\d+$/.test(value.trim()) ? `${value.trim()}px` : value;
        const lengthy = /^(padding|margin|gap|inset|top|right|bottom|left|border-radius|font-size)/.test(property);
        rules = check(property, lengthy ? numeric : value, text, styleFile);
      }
      if (!allowed) {
        rules.forEach((rule) => found.push({
          file, line: startLine, rule, text: `${name}: ${value.trim()}`
        }));
      }
      pair = key.exec(joined);
    }
  }
  return found;
}

const format = (v: Violation) => `${v.file}:${v.line} ${v.rule}: ${v.text}`;

describe('design system', () => {
  it('catches each kind of break, so a clean scan means something', () => {
    const fixture = [
      'export const Bad = styled(Box)({',
      "  fontSize: '0.86rem',",
      '  fontWeight: 900,',
      "  fontStyle: 'italic',",
      "  padding: '10px 20px',",
      '  borderRadius: 3,',
      "  borderLeft: '4px solid var(--anime-orange)',",
      "  background: 'linear-gradient(180deg, #000, #333)',",
      "  transition: 'width 150ms ease',",
      '});',
      'export const Fine = styled(Box)({',
      '  ...textStyles.body6,',
      "  padding: '8px 12px',",
      '  borderRadius: 4,',
      "  border: '2px solid var(--anime-ink)',",
      "  background: 'linear-gradient(#000 0 50%, #333 50% 100%)',",
      "  transition: transition(['transform'], ['background-color']),",
      '});',
    ].join('\n');
    const rules = scan('src/view/Fixture/Fixture.styles.ts', fixture).map((v) => `${v.line} ${v.rule}`);
    expect(rules).toEqual([
      '2 type scale',
      '3 weight',
      '4 italic',
      '5 spacing',
      '6 radius',
      '7 one-sided border',
      '8 colour fade',
      '9 browser curve',
      '9 short duration',
      '9 no house curve',
      '9 animates layout',
    ]);
  });

  it('holds across the menus, dialogs, HUD and global styles', () => {
    const files = listSources();
    // The scan must reach the real screens, not pass by reading nothing.
    expect(files.length).toBeGreaterThan(50);
    const violations = files.flatMap((file) => scan(file, readFileSync(file, 'utf8')));
    expect(violations.map(format)).toEqual([]);
  });
});
