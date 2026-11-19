import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CharadesReactionEvent } from '../types/charades';

interface CharadesReactionOverlayProps {
  reactions: CharadesReactionEvent[];
  /**
   * 'tile' renders directly inside/near a specific player's video tile.
   * 'corner' renders reactions from off-stage guessers cleanly near the stage corner.
   */
  variant?: 'tile' | 'corner';
}

const FLOATING_HEARTS = [
  { id: 0, dx: -34, dy: -68, scale: 0.72, delay: 0.05, rotate: -14 },
  { id: 1, dx: 30, dy: -76, scale: 0.8, delay: 0.12, rotate: 16 },
  { id: 2, dx: -20, dy: -102, scale: 0.58, delay: 0.22, rotate: -8 },
  { id: 3, dx: 24, dy: -110, scale: 0.62, delay: 0.28, rotate: 12 },
  { id: 4, dx: -4, dy: -124, scale: 0.5, delay: 0.35, rotate: -4 },
  { id: 5, dx: 40, dy: -54, scale: 0.52, delay: 0.18, rotate: 20 },
];

const THUMB_SPARKLES = [
  { id: 0, dx: -32, dy: -22, delay: 0.08, color: '#FDE68A' },
  { id: 1, dx: 34, dy: -26, delay: 0.12, color: '#FBBF24' },
  { id: 2, dx: -26, dy: 14, delay: 0.16, color: '#34D399' },
  { id: 3, dx: 32, dy: 12, delay: 0.14, color: '#FDE68A' },
  { id: 4, dx: 0, dy: -38, delay: 0.1, color: '#F59E0B' },
  { id: 5, dx: 18, dy: -40, delay: 0.2, color: '#FB7185' },
];

const PEACE_SPARKS = [
  { id: 0, dx: -26, dy: -56, delay: 0.08 },
  { id: 1, dx: 28, dy: -64, delay: 0.16 },
  { id: 2, dx: -10, dy: -82, delay: 0.24 },
];

const ReactionGlyph: React.FC<{
  reaction: CharadesReactionEvent;
  reducedMotion: boolean;
}> = ({ reaction, reducedMotion }) => {
  if (reaction.gesture === 'heart') {
    return (
      <div className="relative flex flex-col items-center">
        {/* Surrounding smaller rising hearts */}
        {!reducedMotion &&
          FLOATING_HEARTS.map((h) => (
            <motion.span
              key={h.id}
              aria-hidden="true"
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.25, rotate: 0 }}
              animate={{
                opacity: [0, 0.95, 0.85, 0],
                x: [0, h.dx * 0.65, h.dx],
                y: [0, h.dy * 0.55, h.dy],
                scale: [0.3, h.scale, h.scale * 0.85],
                rotate: [0, h.rotate],
              }}
              transition={{
                duration: 2.0,
                delay: h.delay,
                ease: 'easeOut',
              }}
              className="absolute top-1 left-1/2 -translate-x-1/2 pointer-events-none select-none drop-shadow-[0_2px_8px_rgba(244,63,94,0.65)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FB7185">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </motion.span>
          ))}

        {/* Large main floating heart */}
        <motion.div
          initial={
            reducedMotion
              ? { opacity: 0, scale: 0.9 }
              : { opacity: 0, y: 12, scale: 0.4 }
          }
          animate={
            reducedMotion
              ? { opacity: [0, 1, 1, 0], scale: 1 }
              : {
                  opacity: [0, 1, 1, 0],
                  y: [12, -26, -68, -96],
                  scale: [0.4, 1.18, 1.0, 0.9],
                }
          }
          transition={{ duration: 2.35, ease: 'easeOut' }}
          className="drop-shadow-[0_6px_18px_rgba(244,63,94,0.75)] select-none"
        >
          <svg width="46" height="46" viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`heartGrad_${reaction.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="100%" stopColor="#E11D48" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#heartGrad_${reaction.id})`}
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
        </motion.div>
      </div>
    );
  }

  if (reaction.gesture === 'thumbs_up') {
    return (
      <div className="relative flex flex-col items-center">
        {/* Sparkle particles */}
        {!reducedMotion &&
          THUMB_SPARKLES.map((sp) => (
            <motion.span
              key={sp.id}
              aria-hidden="true"
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0.9, 0],
                x: [0, sp.dx],
                y: [0, sp.dy],
                scale: [0.2, 1.15, 0.4],
                rotate: [0, 90],
              }}
              transition={{ duration: 1.5, delay: sp.delay, ease: 'easeOut' }}
              className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none select-none"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill={sp.color}>
                <path d="M12 2L14.3 9.7L22 12L14.3 14.3L12 22L9.7 14.3L2 12L9.7 9.7L12 2Z" />
              </svg>
            </motion.span>
          ))}

        {/* Large popping & bouncing thumbs-up */}
        <motion.div
          initial={
            reducedMotion
              ? { opacity: 0, scale: 0.9 }
              : { opacity: 0, y: 10, scale: 0.35, rotate: -18 }
          }
          animate={
            reducedMotion
              ? { opacity: [0, 1, 1, 0], scale: 1 }
              : {
                  opacity: [0, 1, 1, 1, 0],
                  y: [10, -14, -18, -32, -52],
                  scale: [0.35, 1.24, 0.95, 1.08, 0.92],
                  rotate: [-18, 10, -4, 4, 0],
                }
          }
          transition={{ duration: 2.25, ease: 'easeOut' }}
          className="text-[42px] leading-none drop-shadow-[0_6px_18px_rgba(251,191,36,0.65)] select-none"
          role="img"
          aria-label="Thumbs up"
        >
          👍
        </motion.div>
      </div>
    );
  }

  // Peace sign ✌️
  return (
    <div className="relative flex flex-col items-center">
      {!reducedMotion &&
        PEACE_SPARKS.map((pk) => (
          <motion.span
            key={pk.id}
            aria-hidden="true"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 0.85, 0],
              x: [0, pk.dx],
              y: [0, pk.dy],
              scale: [0.4, 1, 0.6],
            }}
            transition={{ duration: 1.85, delay: pk.delay, ease: 'easeOut' }}
            className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.85)] pointer-events-none"
          />
        ))}

      <motion.div
        initial={
          reducedMotion
            ? { opacity: 0, scale: 0.9 }
            : { opacity: 0, y: 12, scale: 0.45, rotate: -14 }
        }
        animate={
          reducedMotion
            ? { opacity: [0, 1, 1, 0], scale: 1 }
            : {
                opacity: [0, 1, 1, 1, 0],
                y: [12, -20, -42, -64, -84],
                x: [0, -7, 7, -4, 0],
                scale: [0.45, 1.15, 1.04, 1.0, 0.9],
                rotate: [-14, 12, -8, 6, 0],
              }
        }
        transition={{ duration: 2.3, ease: 'easeOut' }}
        className="text-[42px] leading-none drop-shadow-[0_6px_18px_rgba(56,189,248,0.65)] select-none"
        role="img"
        aria-label="Peace sign"
      >
        ✌️
      </motion.div>
    </div>
  );
};

export const CharadesReactionOverlay: React.FC<CharadesReactionOverlayProps> = ({
  reactions,
  variant = 'tile',
}) => {
  const reducedMotion = Boolean(useReducedMotion());

  if (reactions.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className={
        variant === 'tile'
          ? 'pointer-events-none absolute inset-0 z-30 overflow-visible flex items-end justify-end p-3 pb-11'
          : 'pointer-events-none absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2'
      }
    >
      <AnimatePresence>
        {reactions.map((rx) => (
          <motion.div
            key={rx.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-1"
          >
            <ReactionGlyph reaction={rx} reducedMotion={reducedMotion} />
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -6] }}
              transition={{ duration: 2.3, ease: 'easeOut' }}
              className="px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/15 text-[11px] font-display font-bold text-white shadow-lg whitespace-nowrap max-w-[140px] truncate"
            >
              {rx.senderName}
            </motion.span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
