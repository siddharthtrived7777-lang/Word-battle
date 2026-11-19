import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { getCategoryLabel, getPairById } from '../data/wordPairs';
import { t } from '../data/i18n';
import { getSortedPlayers } from '../utils/gameLogic';
import { soundFx } from '../utils/soundFx';

interface RoleRevealScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  onMarkReady: () => void;
  onForceStartDiscussion: () => void;
}

export const RoleRevealScreen: React.FC<RoleRevealScreenProps> = ({
  lang,
  room,
  myId,
  onMarkReady,
  onForceStartDiscussion,
}) => {
  const [isHolding, setIsHolding] = useState(false);

  const roundConfig = room.roundConfig;
  if (!roundConfig) return null;

  const pair = getPairById(roundConfig.pairId);
  const isImposter = roundConfig.imposterIds.includes(myId);
  const wordIndex = isImposter
    ? roundConfig.imposterWordIndex
    : roundConfig.majorityWordIndex;
  const myWord = pair ? pair[lang][wordIndex] : '—';
  const categoryName = getCategoryLabel(roundConfig.category, lang);

  const players = getSortedPlayers(room.players);
  const readyCount = players.filter((p) => p.readyForDiscussion).length;
  const me = room.players[myId];
  const isReady = Boolean(me?.readyForDiscussion);
  const isHost = room.hostId === myId;

  const startHold = () => {
    setIsHolding(true);
    soundFx.reveal();
  };

  const stopHold = () => {
    setIsHolding(false);
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-sky-200">
          <span>
            {t(lang, 'categoryPrefix')}: {categoryName}
          </span>
          <span aria-hidden="true" className="text-blue-200/40">
            ·
          </span>
          <span className="font-mono-nums text-emerald-300">
            {readyCount} / {players.length} {t(lang, 'playersReady')}
          </span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {t(lang, 'revealTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-blue-100/80">{t(lang, 'revealSubtitle')}</p>
      </div>

      {/* Private Hold-to-Reveal Card */}
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        className={`w-full max-w-md min-h-[168px] rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 select-none touch-none transition-all duration-150 ${
          isHolding
            ? 'bg-white text-[#081A52] scale-[0.99] shadow-2xl'
            : 'bg-[#0E246E]/60 border-2 border-dashed border-blue-200/35 hover:border-sky-300/75 text-white'
        }`}
      >
        {isHolding ? (
          <>
            <Eye className="w-5 h-5 opacity-75" />
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">
              {t(lang, 'yourWordLabel')}
            </span>
            <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">
              {myWord}
            </span>
            <span className="text-xs font-medium opacity-70">{t(lang, 'keepHolding')}</span>
          </>
        ) : (
          <>
            <EyeOff className="w-7 h-7 text-sky-200" />
            <span className="font-display text-lg font-bold text-white">
              {t(lang, 'holdToReveal')}
            </span>
          </>
        )}
      </button>

      <p className="text-xs text-blue-100/75 max-w-md leading-relaxed">
        {t(lang, 'noRoleHint')}
      </p>

      <div className="w-full max-w-md space-y-2.5 pt-1">
        <button
          type="button"
          disabled={isReady}
          onClick={onMarkReady}
          className={`w-full min-h-[50px] px-6 rounded-2xl font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            isReady
              ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/40 cursor-default'
              : 'bg-emerald-400 hover:bg-emerald-300 text-[#07184A] shadow-lg shadow-emerald-400/20'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>{isReady ? t(lang, 'readyDone') : t(lang, 'readyBtn')}</span>
        </button>

        {isHost && readyCount < players.length && (
          <button
            type="button"
            onClick={onForceStartDiscussion}
            className="w-full min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/18 text-blue-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>{t(lang, 'startDiscussionNow')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
