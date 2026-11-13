import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { getCategoryLabel, getPairById } from '../data/wordPairs';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { getSortedPlayers } from '../utils/gameLogic';
import { soundFx } from '../utils/soundFx';

interface RoleRevealScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  onMarkReady: () => void;
  onForceStartDiscussion: () => void;
}

export const RoleRevealScreen: React.FC<RoleRevealScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
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
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {t(lang, 'revealTitle')}
        </h1>
        <p className="text-sm text-slate-400">{t(lang, 'revealSubtitle')}</p>
      </div>

      {/* Hold-to-Reveal Card */}
      <div className="bg-[#151C2C] border border-slate-800/90 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center">
        <div className="text-xs font-semibold text-amber-400 mb-4">
          {t(lang, 'categoryPrefix')}: {categoryName}
        </div>

        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-full max-w-md min-h-[190px] rounded-3xl p-6 flex flex-col items-center justify-center gap-3 select-none touch-none transition-all duration-150 ${
            isHolding
              ? 'bg-amber-500 text-slate-950 scale-[0.99] shadow-2xl shadow-amber-500/25'
              : 'bg-[#0B0F17] border-2 border-dashed border-slate-700 hover:border-amber-400/70 text-slate-200'
          }`}
        >
          {isHolding ? (
            <>
              <Eye className="w-6 h-6 opacity-80" />
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                {t(lang, 'yourWordLabel')}
              </span>
              <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">
                {myWord}
              </span>
              <span className="text-xs font-medium opacity-75 mt-1">
                {t(lang, 'keepHolding')}
              </span>
            </>
          ) : (
            <>
              <EyeOff className="w-8 h-8 text-amber-400" />
              <span className="font-display text-lg font-bold text-white">
                {t(lang, 'holdToReveal')}
              </span>
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 mt-5 max-w-md leading-relaxed">
          {t(lang, 'noRoleHint')}
        </p>

        <div className="w-full max-w-md mt-6 space-y-3">
          <button
            type="button"
            disabled={isReady}
            onClick={onMarkReady}
            className={`w-full min-h-[54px] px-6 rounded-2xl font-display font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              isReady
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isReady ? t(lang, 'readyDone') : t(lang, 'readyBtn')}</span>
          </button>

          {isHost && readyCount < players.length && (
            <button
              type="button"
              onClick={onForceStartDiscussion}
              className="w-full min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{t(lang, 'startDiscussionNow')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Player Ready Strip */}
      <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-slate-400">
            {t(lang, 'playersCount')}
          </span>
          <span className="font-mono-nums text-xs font-bold text-emerald-400">
            {readyCount} / {players.length} {t(lang, 'playersReady')}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${
                p.readyForDiscussion ? 'bg-emerald-500/10' : 'bg-[#0B0F17]/70'
              }`}
            >
              <Avatar
                name={p.name}
                avatar={p.avatar}
                size="sm"
                isSpeaking={Boolean(speakingIds[p.id])}
                isMuted={p.isMuted}
              />
              <span className="text-xs font-semibold text-slate-200 max-w-[90px] truncate">
                {p.name}
              </span>
              {p.readyForDiscussion && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
