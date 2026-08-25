import type { Transition, Variants } from 'framer-motion';

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
  mass: 0.85,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 26,
  mass: 0.7,
};

export const easeOutExpo = [0.22, 1, 0.36, 1] as const;

/** 带左右方向的页面切换（侧栏顺序） */
export const pageSlideVariants = (dir: number): Variants => ({
  initial: {
    opacity: 0,
    x: dir > 0 ? 28 : -28,
    y: 8,
  },
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    // 不设 filter —— 任何 filter 值（含 blur(0px)）都会创建 backdrop-root，
    // 导致子元素 backdrop-filter 采样断裂 → liquid-glass 蒙版发黑
    transition: { duration: 0.4, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    x: dir > 0 ? -22 : 22,
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
});

/** 顶栏标题切换 */
export const titleVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.16 },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.035, duration: 0.28, ease: easeOutExpo },
  }),
};
