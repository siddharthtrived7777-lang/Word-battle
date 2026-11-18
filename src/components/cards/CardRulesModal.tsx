import React from 'react';
import { X, BookOpen, CheckCircle2, Sliders } from 'lucide-react';
import type { CardGameId } from '../../types/cardGames';
import { CARD_GAMES_INFO } from '../../data/cardGamesInfo';

interface CardRulesModalProps {
  gameId: CardGameId | null;
  onClose: () => void;
  onPlayGame?: (gameId: CardGameId) => void;
}

export const CardRulesModal: React.FC<CardRulesModalProps> = ({
  gameId,
  onClose,
  onPlayGame,
}) => {
  if (!gameId) return null;
  const info = CARD_GAMES_INFO[gameId];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-rules-title"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto bg-[#FAF7F0] text-[#1A1D1B] border border-[#D9CEB8] rounded-t-3xl sm:rounded-3xl shadow-2xl">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#FAF7F0]/95 backdrop-blur-md border-b border-[#D9CEB8] px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#173326] text-[#FAF7F0] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div className="min-w-0">
              <h2 id="card-rules-title" className="font-display text-xl font-bold text-[#1A1D1B] truncate">
                {info.name} — Rules
              </h2>
              <p className="text-xs text-[#5B5449]">
                {info.playersLabel} · {info.deckType}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-[#EFE8DA] hover:bg-[#E4DAC7] text-[#3B281E] flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-sm leading-relaxed">
          <div className="p-4 rounded-2xl bg-[#F2ECE0] border border-[#DFD4C0]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6D5A3D] mb-1">
              Objective
            </p>
            <p className="text-[#1A1D1B] font-medium">{info.rulesDetails.objective}</p>
          </div>

          <div>
            <h3 className="font-display font-bold text-[#173326] text-base mb-1.5">Setup</h3>
            <p className="text-[#454038]">{info.rulesDetails.setup}</p>
          </div>

          <div>
            <h3 className="font-display font-bold text-[#173326] text-base mb-2">How a Turn Works</h3>
            <ul className="space-y-2">
              {info.rulesDetails.gameplay.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[#3B3730]">
                  <span className="font-mono-nums text-xs font-bold text-[#173326] bg-[#E8DFCE] w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-[#173326] text-[#FAF7F0]">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-[#C5A059]" />
              <h3 className="font-display font-bold text-sm uppercase tracking-wider text-[#E6D7B7]">
                Winning
              </h3>
            </div>
            <p className="text-sm text-[#EDE6D8]">{info.rulesDetails.winning}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-[#6D5A3D]" />
              <h3 className="font-display font-bold text-[#173326] text-base">
                Configurable Lobby Variants
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-[#454038]">
              {info.rulesDetails.variants.map((v, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#C5A059] font-bold">·</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#D9CEB8] bg-[#F4EDE0] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl border border-[#C8BBA4] bg-[#FAF7F0] hover:bg-[#EFE8DA] text-[#3B281E] font-semibold text-sm transition-colors"
          >
            Close
          </button>
          {onPlayGame && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onPlayGame(gameId);
              }}
              className="min-h-[44px] px-6 rounded-xl bg-[#173326] hover:bg-[#1E4231] text-[#FAF7F0] font-display font-bold text-sm transition-colors"
            >
              Play {info.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
