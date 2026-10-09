import { useEffect, useState } from 'react';

export type ViewportSize = { width: number; height: number };

function readViewport(): ViewportSize {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** The window size, updated on resize only (never per frame). */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState(readViewport);
  useEffect(() => {
    const onResize = () => {
      const next = readViewport();
      setSize((current) => (
        current.width === next.width && current.height === next.height ? current : next
      ));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}
