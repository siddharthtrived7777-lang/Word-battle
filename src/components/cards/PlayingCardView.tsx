import React from 'react';
import type { JokerCard, StandardCard } from '../../types/cardGames';

interface PlayingCardViewProps {
  card?: StandardCard | JokerCard | null;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  playable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-11 h-16 rounded-lg text-[11px]',
  sm: 'w-14 h-20 rounded-xl text-xs',
  md: 'w-16 h-24 sm:w-[74px] sm:h-[106px] rounded-xl text-sm',
  lg: 'w-24 h-36 sm:w-28 sm:h-40 rounded-2xl text-base',
};

function formatRank(rank: number): string {
  switch (rank) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return String(rank);
  }
}

function suitGlyph(suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
  }
}

export const PlayingCardView: React.FC<PlayingCardViewProps> = ({
  card,
  faceDown = false,
  size = 'md',
  playable = false,
  selected = false,
  disabled = false,
  label,
  onClick,
  className = '',
}) => {
  const interactive = Boolean(onClick) && !disabled;

  if (faceDown || !card) {
    const content = (
      <div
        className={`${SIZE_CLASSES[size]} relative overflow-hidden select-none bg-[#1B3A2B] border border-[#C5A059]/45 shadow-md flex items-center justify-center transition-all ${
          interactive
            ? 'cursor-pointer hover:-translate-y-1.5 hover:border-[#C5A059] active:scale-95'
            : ''
        } ${selected ? '-translate-y-2 ring-2 ring-[#C5A059]' : ''} ${className}`}
      >
        <div
          className="absolute inset-1.5 rounded-lg border border-[#C5A059]/30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(197,160,89,0.08) 0px, rgba(197,160,89,0.08) 4px, transparent 4px, transparent 8px)',
          }}
        />
        <div className="relative w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-[#C5A059]/40 bg-[#142A1F] flex items-center justify-center text-[#C5A059] text-[10px]">
          ✦
        </div>
        {label && (
          <span className="absolute bottom-1 right-1.5 font-mono-nums text-[9px] text-[#E6D7B7]/80">
            {label}
          </span>
        )}
      </div>
    );

    if (interactive) {
      return (
        <button
          type="button"
          onClick={onClick}
          aria-label={label || 'Hidden card'}
          className="focus:outline-none"
        >
          {content}
        </button>
      );
    }
    return content;
  }

  const isJoker = card.kind === 'joker';
  const isRed = !isJoker && (card.suit === 'hearts' || card.suit === 'diamonds');
  const inkClass = isJoker
    ? 'text-[#7A541C]'
    : isRed
      ? 'text-[#9F2929]'
      : 'text-[#1E2220]';

  const rankStr = isJoker ? '★' : formatRank(card.rank);
  const suitStr = isJoker ? 'JOKER' : suitGlyph(card.suit);

  const cardFace = (
    <div
      className={`${SIZE_CLASSES[size]} relative select-none bg-[#FAF7F0] border transition-all shadow-[0_4px_12px_rgba(0,0,0,0.28)] flex flex-col justify-between p-1.5 sm:p-2 ${
        selected
          ? '-translate-y-3 border-[#C5A059] ring-2 ring-[#C5A059]'
          : playable
            ? 'border-[#C5A059]/75 -translate-y-1 shadow-[0_6px_16px_rgba(197,160,89,0.2)]'
            : 'border-[#D9CEB8]'
      } ${disabled ? 'opacity-55' : ''} ${
        interactive ? 'cursor-pointer hover:-translate-y-2 active:scale-95' : ''
      } ${className}`}
    >
      {/* Top-left corner */}
      <div className={`flex flex-col items-center leading-none self-start ${inkClass}`}>
        <span className="font-mono-nums font-bold tracking-tight">{rankStr}</span>
        {!isJoker && <span className="text-[0.85em] mt-0.5">{suitStr}</span>}
      </div>

      {/* Center pip or court emblem */}
      <div className={`flex items-center justify-center ${inkClass}`}>
        {isJoker ? (
          <div className="flex flex-col items-center">
            <span className={size === 'lg' ? 'text-3xl' : 'text-xl'}>🃏</span>
            <span className="font-display text-[9px] font-bold tracking-widest uppercase mt-0.5">
              Joker
            </span>
          </div>
        ) : card.rank >= 11 || card.rank === 1 ? (
          <div className="flex flex-col items-center">
            <span
              className={`font-serif leading-none ${
                size === 'lg' ? 'text-4xl' : size === 'xs' ? 'text-base' : 'text-2xl'
              }`}
            >
              {suitStr}
            </span>
          </div>
        ) : (
          <span
            className={`font-serif leading-none opacity-90 ${
              size === 'lg' ? 'text-4xl' : size === 'xs' ? 'text-base' : 'text-2xl'
            }`}
          >
            {suitStr}
          </span>
        )}
      </div>

      {/* Bottom-right corner */}
      <div className={`flex flex-col items-center leading-none self-end rotate-180 ${inkClass}`}>
        <span className="font-mono-nums font-bold tracking-tight">{rankStr}</span>
        {!isJoker && <span className="text-[0.85em] mt-0.5">{suitStr}</span>}
      </div>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={isJoker ? 'Joker card' : `${rankStr} of ${card.suit}`}
        className="focus:outline-none shrink-0"
      >
        {cardFace}
      </button>
    );
  }

  return cardFace;
};
