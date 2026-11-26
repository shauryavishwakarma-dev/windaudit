import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface PageTransitionProps {
  activePage: string;
  resetScrollOnChange?: boolean;
  children: React.ReactNode;
}

const CINEMATIC_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const PageTransition: React.FC<PageTransitionProps> = ({
  activePage,
  resetScrollOnChange = true,
  children
}) => {
  const [showVeil, setShowVeil] = useState(false);
  const prevPageRef = useRef<string>(activePage);

  useEffect(() => {
    if (prevPageRef.current === activePage) return;
    prevPageRef.current = activePage;

    if (resetScrollOnChange && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }

    setShowVeil(true);
    const timer = window.setTimeout(() => {
      setShowVeil(false);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [activePage, resetScrollOnChange]);

  return (
    <div className="relative">
      {/* Subtle 250ms transition veil + top accent sweep on page change */}
      <AnimatePresence>
        {showVeil && (
          <>
            <motion.div
              key={`veil-${activePage}`}
              aria-hidden="true"
              initial={{ opacity: 0.24 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-none fixed inset-0 z-40 bg-slate-900/20 dark:bg-slate-950/35"
            />
            <motion.div
              key={`sweep-${activePage}`}
              aria-hidden="true"
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 1, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: CINEMATIC_EASE }}
              className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-[#0F62FE] dark:bg-sky-400"
            />
          </>
        )}
      </AnimatePresence>

      {/* Weighted cinematic page view entrance & exit */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activePage}
          initial={{
            opacity: 0,
            y: 14,
            scale: 0.985,
            filter: 'blur(4px)'
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)'
          }}
          exit={{
            opacity: 0,
            y: -8,
            scale: 0.99,
            filter: 'blur(2px)'
          }}
          transition={{
            duration: 0.44,
            ease: CINEMATIC_EASE
          }}
          style={{ willChange: 'transform, opacity, filter' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
