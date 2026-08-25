import React, { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * P11-2a：数字滚动动画（count-up）。
 * - 首次挂载从 0 滚到目标值；数值变化时从旧值滚到新值
 * - 支持小数位与千分位格式化
 * - respects prefers-reduced-motion（直接显示最终值）
 */
export const AnimatedNumber: React.FC<{
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}> = ({ value, duration = 0.9, decimals = 0, className, suffix = '' }) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const prev = useRef(0);

  useEffect(() => {
    if (reduced) {
      prev.current = value;
      setDisplay(value);
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

  const formatted = display.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {formatted}
      {suffix}
    </span>
  );
};
