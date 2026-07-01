import { useEffect, useRef, useState } from 'react';

export default function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  const prev = useRef(0);

  useEffect(() => {
    const num = parseFloat(target) || 0;
    if (num === prev.current) return;
    const start = prev.current;
    const diff = num - start;
    const startTime = performance.now();

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setValue(current);
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        prev.current = num;
      }
    });

    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return value;
}
