import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  locale?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

/**
 * Smooth GSAP tabular numeric tween for KPI cards & telemetry counters.
 * Honors prefers-reduced-motion cleanly and guards against NaN/Infinity.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  locale = 'en-IN',
  prefix = '',
  suffix = '',
  duration = 0.42,
  className = ''
}) => {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(safeTarget);
  const proxyRef = useRef<{ val: number }>({ val: safeTarget });

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || Math.abs(proxyRef.current.val - safeTarget) < 1e-4) {
      proxyRef.current.val = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    const tween = gsap.to(proxyRef.current, {
      val: safeTarget,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplayValue(proxyRef.current.val);
      },
      onComplete: () => {
        proxyRef.current.val = safeTarget;
        setDisplayValue(safeTarget);
      }
    });

    return () => {
      tween.kill();
    };
  }, [safeTarget, duration]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString(locale);

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
