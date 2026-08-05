import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';

/** 全局可点按钮默认微动效：hover 上浮、press 缩放 */
export const MotionButton = React.forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<'button'> & { className?: string }
>(({ className, children, ...props }, ref) => (
  <motion.button
    ref={ref}
    whileHover={{ y: -1, scale: 1.02 }}
    whileTap={{ scale: 0.96 }}
    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
    className={clsx(className)}
    {...props}
  >
    {children}
  </motion.button>
));

MotionButton.displayName = 'MotionButton';
