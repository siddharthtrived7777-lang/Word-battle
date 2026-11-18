import React from 'react';
import type { UnoCard, UnoChosenColor } from '../../types/cardGames';

interface UnoCardViewProps {
  card?: UnoCard | null;
  activeColor?: UnoChosenColor;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  playable?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-14 h-20 rounded-xl text-xs',
  md: 'w-[68px] h-[100px] sm:w-[76px] sm:h-[112px] rounded-xl text-sm',
  lg: 'w-24 h-36 sm:w-28 sm:h-40 rounded-2xl text-base',
};

const COLOR_STYLES: Record<
  UnoChosenColor | 'wild',
  { bg: string; border: string; text: string }
> = {
  red: { bg: 'bg-[#9E352B]', border: 'border-[#E6C7BA]', text: 'text-[#9E352B]' },
  blue: { bg: 'bg-[#28577A]', border: 'border-[#BBD2E3]', text: 'text-[#28577A]' },
  green: { bg: 'bg-[#2A6646]', border: 'border-[#BDDEC9]', text: 'text-[#2A6646]' },
  yellow: { bg: 'bg-[#B38629]', border: 'border-[#EFE2B8]', text: 'text-[#8C6414]' },
  wild: { bg: 'bg-[#1D221F]', border: 'border-[#C5A059]/70', text: 'text-[#1D221F]' },
};

function valueLabel(val: UnoCard['value']): string {
  switch (val) {
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw2':
      return '+2';
    case 'wild':
      return 'W';
    case 'wild4':
      return '+4';
    default:
      return val;
  }
}

export const UnoCardView: React.FC<UnoCardViewProps> = ({
  card,
  activeColor,
  faceDown = false,
  size = 'md',
  playable = false,
  disabled = false,
  onClick,
  className = '',
}) => {
  const interactive = Boolean(onClick) && !disabled;

  if (faceDown || !card) {
    const back = (
      <div
        className={`${SIZE_CLASSES[size]} relative overflow-hidden select-none bg-[#18221D] border border-[#C5A059]/50 shadow-md flex items-center justify-center transition-all ${
          interactive ? 'cursor-pointer hover:-translate-y-1.5 active:scale-95' : ''
        } ${className}`}
      >
        <div className="w-[74%] h-[58%] rounded-[48%] -rotate-12 bg-[#9E352B]/85 border border-[#FAF7F0]/35 flex items-center justify-center">
          <span className="font-display font-extrabold tracking-widest text-[10px] text-[#FAF7F0]">
            UNO
          </span>
        </div>
      </div>
    );

    if (interactive) {
      return (
        <button type="button" onClick={onClick} aria-label="Draw UNO card" className="focus:outline-none">
          {back}
        </button>
      );
    }
    return back;
  }

  const displayColor =
    card.color === 'wild' && activeColor ? activeColor : card.color;
  const palette = COLOR_STYLES[displayColor];
  const sym = valueLabel(card.value);

  const face = (
    <div
      className={`${SIZE_CLASSES[size]} relative select-none ${palette.bg} border-2 border-[#FAF7F0] shadow-[0_5px_14px_rgba(0,0,0,0.32)] p-1.5 sm:p-2 flex flex-col justify-between transition-all ${
        playable
          ? '-translate-y-1.5 ring-2 ring-[#C5A059] shadow-[0_8px_18px_rgba(197,160,89,0.28)]'
          : ''
      } ${disabled ? 'opacity-50' : ''} ${
        interactive ? 'cursor-pointer hover:-translate-y-2.5 active:scale-95' : ''
      } ${className}`}
    >
      {/* Top-left corner index */}
      <span className="font-mono-nums font-extrabold leading-none text-[#FAF7F0] drop-shadow-sm self-start">
        {sym}
      </span>

      {/* Geometric ivory center medallion (original artwork) */}
      <div className="flex items-center justify-center my-auto">
        <div className="w-[76%] aspect-[4/5] rounded-[46%] -rotate-12 bg-[#FAF7F0]/95 border border-black/10 flex items-center justify-center shadow-inner">
          {card.value === 'wild' || card.value === 'wild4' ? (
            <div className="flex flex-col items-center rotate-12">
              <div className="grid grid-cols-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border border-black/15">
                <div className="bg-[#9E352B]" />
                <div className="bg-[#28577A]" />
                <div className="bg-[#B38629]" />
                <div className="bg-[#2A6646]" />
              </div>
              {card.value === 'wild4' && (
                <span className="font-mono-nums font-black text-[11px] text-[#1D221F] mt-0.5">
                  +4
                </span>
              )}
            </div>
          ) : (
            <span
              className={`rotate-12 font-display font-black leading-none ${palette.text} ${
                size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
              }`}
            >
              {sym}
            </span>
          )}
        </div>
      </div>

      {/* Bottom-right corner index */}
      <span className="font-mono-nums font-extrabold leading-none text-[#FAF7F0] drop-shadow-sm self-end rotate-180">
        {sym}
      </span>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${card.color} ${card.value}`}
        className="focus:outline-none shrink-0"
      >
        {face}
      </button>
    );
  }

  return face;
};
