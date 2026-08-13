import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { pageSlideVariants, titleVariants } from '@/lib/motion';

/** 页内子视图切换（月/周/日、设置 Tab 等）— 更明显的横向滑动 */
export const ViewTransition: React.FC<{
  viewKey: string | number;
  direction?: number;
  children: React.ReactNode;
  className?: string;
}> = ({ viewKey, direction = 1, children, className }) => (
  <div className={className} style={{ position: 'relative' }}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={String(viewKey)}
        initial={{
          opacity: 0,
          x: direction >= 0 ? 32 : -32,
          y: 6,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.38,
            ease: [0.22, 1, 0.36, 1],
          },
        }}
        exit={{
          opacity: 0,
          x: direction >= 0 ? -28 : 28,
          scale: 0.99,
          transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  </div>
);

/** 主导航页面切换（带方向） */
export const RouteTransition: React.FC<{
  routeKey: string;
  direction?: number;
  children: React.ReactNode;
  className?: string;
}> = ({ routeKey, direction = 1, children, className }) => (
  <AnimatePresence mode="wait" custom={direction} initial={false}>
    <motion.div
      key={routeKey}
      custom={direction}
      variants={pageSlideVariants(direction)}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

/** 顶栏标题交叉淡入 */
export const TitleTransition: React.FC<{
  titleKey: string;
  children: React.ReactNode;
  className?: string;
}> = ({ titleKey, children, className }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={titleKey}
      variants={titleVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
