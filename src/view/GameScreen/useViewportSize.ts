import { useEffect, useState } from 'react';

export type ViewportSize = { width: number; height: number };

export function readViewport(): ViewportSize {
  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
  };
}

/** The visible viewport size, updated on resize only (never per frame). */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState(readViewport);
  useEffect(() => {
    const onResize = () => {
      const next = readViewport();
      setSize((current) => (
        current.width === next.width && current.height === next.height ? current : next
      ));
    };
    const { visualViewport } = window;
    window.addEventListener('resize', onResize);
    visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);
  return size;
}
