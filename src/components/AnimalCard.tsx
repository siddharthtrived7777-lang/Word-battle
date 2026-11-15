import React from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { AnimalDef } from '../types/animalGame';
import { Language } from '../types/game';

interface AnimalArtworkProps {
  animal: AnimalDef;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Original illustrated badge artwork for each animal so trait clues
 * (stripes, color, horns, tusks, fins, shell) match how the card looks.
 */
export const AnimalArtwork: React.FC<AnimalArtworkProps> = ({ animal, size = 'md' }) => {
  const iconCls =
    size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12';
  const emojiCls =
    size === 'lg'
      ? 'text-4xl sm:text-5xl'
      : size === 'sm'
        ? 'text-xl'
        : 'text-2xl sm:text-3xl';

  // Custom illustrated SVG portraits for animals whose traits need exact visual cues
  switch (animal.id) {
    case 'bongo':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* Spiral horns */}
          <path d="M22 20 C16 10, 20 5, 25 8" fill="none" stroke="#451A03" strokeWidth="3" strokeLinecap="round" />
          <path d="M42 20 C48 10, 44 5, 39 8" fill="none" stroke="#451A03" strokeWidth="3" strokeLinecap="round" />
          {/* Ears */}
          <ellipse cx="18" cy="24" rx="5" ry="3" fill="#9A3412" transform="rotate(-25 18 24)" />
          <ellipse cx="46" cy="24" rx="5" ry="3" fill="#9A3412" transform="rotate(25 46 24)" />
          {/* Chestnut body & head */}
          <ellipse cx="32" cy="44" rx="15" ry="12" fill="#B45309" />
          <circle cx="32" cy="26" r="10" fill="#C2410C" />
          {/* Vertical white stripes */}
          <path d="M24 37 L24 51 M29 35 L29 53 M35 35 L35 53 M40 37 L40 51" stroke="#FFFBEB" strokeWidth="2.2" strokeLinecap="round" />
          {/* Eyes & snout */}
          <circle cx="28" cy="24" r="1.7" fill="#0F172A" />
          <circle cx="36" cy="24" r="1.7" fill="#0F172A" />
          <ellipse cx="32" cy="30" rx="4.5" ry="3" fill="#FDE68A" />
          <circle cx="30.5" cy="30" r="1" fill="#451A03" />
          <circle cx="33.5" cy="30" r="1" fill="#451A03" />
        </svg>
      );

    case 'scarlet_ibis':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* Legs */}
          <path d="M28 44 L28 57 M35 44 L35 57" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round" />
          {/* Tail */}
          <path d="M14 38 L22 36 L17 44 Z" fill="#B91C1C" />
          {/* Bright scarlet body */}
          <ellipse cx="31" cy="36" rx="13" ry="9" fill="#EF4444" />
          <path d="M25 32 Q33 28 38 38 Q30 41 25 32 Z" fill="#DC2626" />
          {/* Neck & head */}
          <path d="M38 33 Q43 24 41 16" fill="none" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" />
          <circle cx="41" cy="16" r="6" fill="#EF4444" />
          {/* Long curved beak */}
          <path d="M46 15 Q56 17 58 26 Q53 20 45 18 Z" fill="#F87171" stroke="#991B1B" strokeWidth="1" />
          <circle cx="42" cy="15" r="1.5" fill="#0F172A" />
        </svg>
      );

    case 'walrus':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* Flippers */}
          <ellipse cx="18" cy="48" rx="7" ry="4" fill="#78350F" transform="rotate(-20 18 48)" />
          <ellipse cx="46" cy="48" rx="7" ry="4" fill="#78350F" transform="rotate(20 46 48)" />
          {/* Body */}
          <ellipse cx="32" cy="42" rx="16" ry="13" fill="#92400E" />
          {/* Head */}
          <circle cx="32" cy="26" r="12" fill="#A16207" />
          {/* Big ivory tusks */}
          <path d="M26 32 L24 46 L29 33 Z" fill="#FFFBEB" stroke="#D97706" strokeWidth="0.8" />
          <path d="M38 32 L40 46 L35 33 Z" fill="#FFFBEB" stroke="#D97706" strokeWidth="0.8" />
          {/* Whisker pad */}
          <ellipse cx="28" cy="30" rx="4.5" ry="3.5" fill="#FDE68A" />
          <ellipse cx="36" cy="30" rx="4.5" ry="3.5" fill="#FDE68A" />
          <circle cx="27" cy="22" r="1.7" fill="#0F172A" />
          <circle cx="37" cy="22" r="1.7" fill="#0F172A" />
        </svg>
      );

    case 'orca':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* Dorsal fin */}
          <path d="M29 22 L34 9 L38 22 Z" fill="#0F172A" />
          {/* Tail fluke */}
          <path d="M10 34 L19 37 L13 44 Z" fill="#0F172A" />
          {/* Black body */}
          <ellipse cx="34" cy="35" rx="18" ry="11" fill="#0F172A" />
          {/* White belly & eye patch */}
          <path d="M24 41 Q35 45 48 39 Q40 46 26 44 Z" fill="#FFFFFF" />
          <ellipse cx="42" cy="31" rx="4" ry="2.2" fill="#FFFFFF" transform="rotate(-15 42 31)" />
          {/* Side flipper */}
          <ellipse cx="34" cy="45" rx="6" ry="3" fill="#0F172A" transform="rotate(20 34 45)" />
          <circle cx="46" cy="33" r="1.3" fill="#FFFFFF" />
        </svg>
      );

    case 'clownfish':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* Tail */}
          <path d="M12 24 L22 32 L12 40 Z" fill="#EA580C" />
          {/* Top & bottom fins */}
          <path d="M27 21 Q33 14 39 21 Z" fill="#F97316" />
          <path d="M29 43 Q33 49 37 43 Z" fill="#F97316" />
          {/* Orange body */}
          <ellipse cx="35" cy="32" rx="16" ry="11" fill="#F97316" />
          {/* White stripes */}
          <path d="M27 23 Q25 32 27 41" fill="none" stroke="#FFFFFF" strokeWidth="3.5" />
          <path d="M36 21 Q34 32 36 43" fill="none" stroke="#FFFFFF" strokeWidth="3.5" />
          <circle cx="45" cy="30" r="1.8" fill="#0F172A" />
        </svg>
      );

    case 'goldfish':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* Flowing orange tail */}
          <path d="M10 22 Q20 32 10 42 Q18 35 24 32 Q18 29 10 22 Z" fill="#FB923C" />
          <path d="M28 21 Q34 14 40 22 Z" fill="#FB923C" />
          {/* Plain bright orange body */}
          <ellipse cx="36" cy="32" rx="15" ry="10.5" fill="#F97316" />
          <ellipse cx="38" cy="29" rx="7" ry="4" fill="#FDBA74" opacity="0.5" />
          <circle cx="45" cy="30" r="2" fill="#0F172A" />
        </svg>
      );

    case 'pigeon':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* Feet */}
          <path d="M29 45 L29 55 M35 45 L35 55" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" />
          {/* Tail */}
          <path d="M12 40 L22 36 L18 45 Z" fill="#64748B" />
          {/* Gray body */}
          <ellipse cx="32" cy="37" rx="13" ry="9" fill="#94A3B8" />
          <ellipse cx="30" cy="36" rx="8" ry="5" fill="#CBD5E1" />
          {/* Head & neck */}
          <circle cx="40" cy="23" r="7.5" fill="#64748B" />
          <path d="M46 22 L53 24 L46 26 Z" fill="#F59E0B" />
          <circle cx="42" cy="21.5" r="1.5" fill="#0F172A" />
        </svg>
      );

    case 'tortoise':
      return (
        <svg viewBox="0 0 64 64" className={iconCls} aria-hidden="true">
          {/* 4 sturdy legs & short tail */}
          <path d="M15 41 L11 43" stroke="#65A30D" strokeWidth="3" strokeLinecap="round" />
          <rect x="20" y="42" width="6" height="9" rx="2" fill="#65A30D" />
          <rect x="37" y="42" width="6" height="9" rx="2" fill="#65A30D" />
          {/* Head */}
          <circle cx="49" cy="38" r="5.5" fill="#84CC16" />
          <circle cx="51" cy="37" r="1.2" fill="#0F172A" />
          {/* Brown domed patterned shell */}
          <path d="M16 42 C16 24, 45 24, 45 42 Z" fill="#92400E" />
          <circle cx="26" cy="34" r="3.5" fill="#D97706" />
          <circle cx="35" cy="34" r="3.5" fill="#D97706" />
          <circle cx="30.5" cy="28" r="3" fill="#B45309" />
        </svg>
      );

    default:
      return (
        <span className={`${emojiCls} leading-none select-none`} aria-hidden="true">
          {animal.emoji}
        </span>
      );
  }
};

interface AnimalCardProps {
  animal: AnimalDef;
  lang: Language;
  flipped?: boolean;
  selected?: boolean;
  isSecret?: boolean;
  guessMode?: boolean;
  onClick: () => void;
}

export const AnimalCard: React.FC<AnimalCardProps> = ({
  animal,
  lang,
  flipped = false,
  selected = false,
  isSecret = false,
  guessMode = false,
  onClick,
}) => {
  const displayName = animal.name[lang];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={flipped || selected}
      className={`group relative w-full min-h-[76px] sm:min-h-[96px] rounded-2xl p-1.5 sm:p-2 flex flex-col items-center justify-between transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
        flipped
          ? 'bg-slate-200/85 border-2 border-slate-300 text-slate-500 opacity-65'
          : selected
            ? 'ring-3 ring-amber-500 shadow-md scale-[1.02]'
            : guessMode
              ? 'ring-2 ring-rose-400 hover:ring-rose-500 shadow-sm hover:-translate-y-0.5'
              : 'shadow-sm hover:-translate-y-0.5 hover:shadow-md'
      }`}
      style={
        flipped
          ? undefined
          : {
              backgroundColor: animal.cardBg,
              border: `2px solid ${selected ? '#F59E0B' : animal.cardBorder}`,
            }
      }
    >
      {/* Top indicator icon (check for selected, secret star, or restore icon when flipped) */}
      {selected && (
        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow">
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      )}
      {isSecret && !selected && (
        <span
          className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-white"
          title={lang === 'hi' ? 'आपका गुप्त जानवर' : 'Your Secret'}
        />
      )}

      {flipped ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-1">
          <div className="w-8 h-8 rounded-xl bg-slate-300/80 flex items-center justify-center text-slate-600">
            <RotateCcw className="w-4 h-4" />
          </div>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-500 line-through leading-tight text-center line-clamp-2 px-0.5">
            {displayName}
          </span>
        </div>
      ) : (
        <>
          {/* Habitat dot & artwork area */}
          <div className="flex-1 flex items-center justify-center w-full pt-0.5">
            <AnimalArtwork animal={animal} size="md" />
          </div>

          <span className="w-full text-center text-[11px] sm:text-xs font-bold text-slate-900 leading-tight truncate px-0.5 mt-1">
            {displayName}
          </span>
        </>
      )}
    </button>
  );
};
