import React, { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}

const idFmt = (decimals: number) =>
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const CountUp: React.FC<CountUpProps> = ({ value, decimals = 0, duration = 2, className }) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduced || (prev.current === 0 && value !== 0)) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduced]);

  return <span className={className}>{idFmt(decimals).format(display)}</span>;
};