import { useMemo } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

/**
 * BlurText — adapted from reactbits.dev (MIT).
 * Reveals text word-by-word (or letter-by-letter) with a blur-in + lift,
 * staggered on scroll-into-view. Uses the framer-motion already bundled.
 * Under prefers-reduced-motion the text renders instantly, fully legible.
 */
interface BlurTextProps {
  text: string;
  /** Per-item stagger in ms. */
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
}

export default function BlurText({
  text,
  delay = 80,
  className = '',
  animateBy = 'words',
  direction = 'top',
}: BlurTextProps) {
  const reduceMotion = useReducedMotion();
  const segments = useMemo(
    () => (animateBy === 'words' ? text.split(' ') : text.split('')),
    [text, animateBy],
  );

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  const fromY = direction === 'top' ? -16 : 16;
  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: delay / 1000 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: fromY, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.span
      className={className}
      style={{ display: 'inline-block' }}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      aria-label={text}
    >
      {segments.map((seg, i) => (
        <motion.span
          key={`${seg}-${i}`}
          variants={item}
          aria-hidden="true"
          style={{ display: 'inline-block', willChange: 'transform, filter' }}
        >
          {seg}
          {animateBy === 'words' && i < segments.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.span>
  );
}
