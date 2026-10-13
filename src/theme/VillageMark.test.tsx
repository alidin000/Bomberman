import React from 'react';
import { render, screen } from '@testing-library/react';
import { VILLAGE_SYMBOLS, VillageSymbolId } from '../content/villageSymbols';
import { VillageMark, villageMarkImage } from './VillageMark';

const IDS = Object.keys(VILLAGE_SYMBOLS) as VillageSymbolId[];

describe('VillageMark', () => {
  it('draws each mark from the shared path data: lines as lines, the cloud as a solid, 忍 as text', () => {
    IDS.forEach((id) => {
      const mark = VILLAGE_SYMBOLS[id];
      const { unmount } = render(<VillageMark id={id} title={mark.name} />);
      const svg = screen.getByRole('img', { name: mark.name });
      expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
      const path = svg.querySelector('path');
      if (mark.mode === 'glyph') {
        expect(path).toBeNull();
        expect(svg.querySelector('text')).toHaveTextContent(mark.glyph ?? '');
      } else if (mark.mode === 'fill') {
        expect(path).toHaveAttribute('d', mark.d);
        expect(path).toHaveAttribute('fill', mark.color);
        expect(path).toHaveAttribute('stroke', '#ffffff');
      } else {
        expect(path).toHaveAttribute('d', mark.d);
        expect(path).toHaveAttribute('fill', 'none');
        expect(path).toHaveAttribute('stroke', mark.color);
        expect(path).toHaveAttribute('stroke-width', String(mark.strokeWidth));
      }
      unmount();
    });
  });

  it('is hidden from assistive tech without a title, since the name is in the text beside it', () => {
    const { container } = render(<VillageMark id="leaf" color="#fff8e7" />);
    expect(screen.queryByRole('img')).toBeNull();
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.querySelector('path')).toHaveAttribute('stroke', '#fff8e7');
  });

  it('turns a mark into a CSS background image with its colour and strength, and skips the glyph', () => {
    const image = villageMarkImage('sand', '#17120f', 0.3);
    expect(image).toMatch(/^url\("data:image\/svg\+xml,/);
    const svg = decodeURIComponent((image ?? '').slice('url("data:image/svg+xml,'.length, -2));
    expect(svg).toContain(`d='${VILLAGE_SYMBOLS.sand.d}'`);
    expect(svg).toContain("stroke='#17120f'");
    expect(svg).toContain("opacity='0.3'");
    // The Akatsuki cloud keeps its red whatever colour is asked for.
    expect(decodeURIComponent(villageMarkImage('akatsukiCloud', '#17120f') ?? '')).toContain("fill='#c4161c'");
    expect(villageMarkImage('alliance')).toBeNull();
  });
});
