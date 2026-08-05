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

/** 主导航页面切换 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 18,
    scale: 0.985,
    filter: 'blur(10px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.42,
      ease: easeOutExpo,
      opacity: { duration: 0.35 },
      filter: { duration: 0.4 },
    },
  },
  exit: {
    opacity: 0,
    y: -14,
    scale: 0.99,
    filter: 'blur(8px)',
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 1, 1],
    },
  },
};

/** 带左右方向的页面切换（侧栏顺序） */
export const pageSlideVariants = (dir: number): Variants => ({
  initial: {
    opacity: 0,
    x: dir > 0 ? 28 : -28,
    y: 8,
    filter: 'blur(8px)',
  },
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    x: dir > 0 ? -22 : 22,
    filter: 'blur(6px)',
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
});

/** 页内子视图 / Tab 切换 */
export const viewVariants: Variants = {
  initial: { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.34, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(4px)',
    transition: { duration: 0.18 },
  },
};

/** 顶栏标题切换 */
export const titleVariants: Variants = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.32, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: 'blur(3px)',
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

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.15 } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.32, ease: easeOutExpo },
  },
};
