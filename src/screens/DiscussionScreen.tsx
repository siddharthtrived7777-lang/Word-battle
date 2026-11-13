import React, { useEffect, useRef, useState } from 'react';
import { Check, SkipForward, Send, Eye, MessageSquare } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { getCategoryLabel, getPairById } from '../data/wordPairs';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { soundFx } from '../utils/soundFx';

const TURN_DURATION_SEC = 30;

interface DiscussionScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  onAdvanceTurn: () => void;
  onSendClue: (text: string) => void;
  onForceVoting: () => void;
}

export const DiscussionScreen: React.FC<DiscussionScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  onAdvanceTurn,
  onSendClue,
  onForceVoting,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(TURN_DURATION_SEC);
  const [clueText, setClueText] = useState('');
  const [peeking, setPeeking] = useState(false);
  const autoAdvancedTurnRef = useRef<string>('');

  const roundConfig = room.roundConfig;
  if (!roundConfig) return null;

  const activeSpeakerId = roundConfig.turnOrder[roundConfig.currentTurnIndex];
  const activeSpeaker = room.players[activeSpeakerId];
  const isMyTurn = activeSpeakerId === myId;
  const isHost = room.hostId === myId;

  const pair = getPairById(roundConfig.pairId);
  const isImposter = roundConfig.imposterIds.includes(myId);
  const wordIndex = isImposter
    ? roundConfig.imposterWordIndex
    : roundConfig.majorityWordIndex;
  const myWord = pair ? pair[lang][wordIndex] : '—';
  const categoryName = getCategoryLabel(roundConfig.category, lang);

  // Play subtle chime when speaker changes
  useEffect(() => {
    soundFx.turnChange();
  }, [activeSpeakerId, roundConfig.currentRound]);

  // Synchronized 30s turn countdown
  useEffect(() => {
    const turnKey = `${roundConfig.currentRound}_${roundConfig.currentTurnIndex}_${roundConfig.turnStartedAt}`;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - roundConfig.turnStartedAt) / 1000);
      const remaining = Math.max(0, TURN_DURATION_SEC - elapsed);
      setSecondsLeft(remaining);

      if (remaining === 0 && autoAdvancedTurnRef.current !== turnKey) {
        // Active speaker (or host as fallback) triggers turn advance
        if (isMyTurn || isHost) {
          autoAdvancedTurnRef.current = turnKey;
          onAdvanceTurn();
        }
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [
    isHost,
    isMyTurn,
    onAdvanceTurn,
    roundConfig.currentRound,
    roundConfig.currentTurnIndex,
    roundConfig.turnStartedAt,
  ]);

  const handleClueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = clueText.trim();
    if (!trimmed) return;
    onSendClue(trimmed);
    setClueText('');
    soundFx.click();
  };

  const progressPct = Math.max(0, Math.min(100, (secondsLeft / TURN_DURATION_SEC) * 100));
  const timerDanger = secondsLeft <= 7;

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 pb-28 space-y-5">
      {/* Top Meta Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
          <span className="font-display font-bold text-white">
            {t(lang, 'roundOf')} {roundConfig.currentRound} {t(lang, 'ofWord')} {room.settings.rounds}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400">{categoryName}</span>
        </div>

        {/* Hold-to-peek reminder */}
        <button
          type="button"
          onPointerDown={() => setPeeking(true)}
          onPointerUp={() => setPeeking(false)}
          onPointerLeave={() => setPeeking(false)}
          onPointerCancel={() => setPeeking(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="min-h-[40px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 select-none touch-none transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span>{peeking ? myWord : t(lang, 'yourWordLabel')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Main: Current Speaker Spotlight + Controls */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-[#151C2C] border border-slate-800/90 rounded-3xl p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4 mb-5">
              <span className="text-xs font-semibold text-slate-400">
                {t(lang, 'currentTurn')}
              </span>
              <span
                className={`font-mono-nums text-2xl font-bold ${
                  timerDanger ? 'text-rose-400' : 'text-amber-400'
                }`}
              >
                {secondsLeft} {t(lang, 'secondsLeft')}
              </span>
            </div>

            {/* Timer Bar */}
            <div className="w-full h-2 rounded-full bg-[#0B0F17] overflow-hidden mb-6">
              <div
                className={`h-full transition-all duration-200 ${
                  timerDanger ? 'bg-rose-500' : 'bg-amber-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {activeSpeaker && (
              <div className="flex flex-col items-center text-center py-2">
                <Avatar
                  name={activeSpeaker.name}
                  avatar={activeSpeaker.avatar}
                  size="xl"
                  isSpeaking={Boolean(speakingIds[activeSpeaker.id])}
                  isMuted={activeSpeaker.isMuted}
                  isHost={activeSpeaker.id === room.hostId}
                  isActiveTurn
                />
                <h2 className="font-display text-2xl font-extrabold text-white mt-4">
                  {activeSpeaker.name}
                </h2>
                {isMyTurn && (
                  <p className="text-sm text-emerald-400 font-semibold mt-1">
                    {t(lang, 'yourTurnBanner')}
                  </p>
                )}
              </div>
            )}

            {/* Turn Controls */}
            <div className="mt-6 space-y-3">
              {isMyTurn && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.click();
                    onAdvanceTurn();
                  }}
                  className="w-full min-h-[54px] px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>{t(lang, 'doneSpeaking')}</span>
                </button>
              )}

              {isHost && !isMyTurn && (
                <button
                  type="button"
                  onClick={onAdvanceTurn}
                  className="w-full min-h-[48px] px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>{t(lang, 'skipTurn')}</span>
                </button>
              )}

              {isHost && (
                <button
                  type="button"
                  onClick={onForceVoting}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-transparent hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
                >
                  {t(lang, 'proceedToVoting')}
                </button>
              )}
            </div>
          </div>

          {/* Turn Order Strip */}
          <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 mb-3 px-1">
              {t(lang, 'turnOrderLabel')}
            </h3>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {roundConfig.turnOrder.map((pid, idx) => {
                const p = room.players[pid];
                if (!p) return null;
                const isCurrent = idx === roundConfig.currentTurnIndex;
                const isDone = idx < roundConfig.currentTurnIndex;
                return (
                  <div
                    key={pid}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0 transition-colors ${
                      isCurrent
                        ? 'bg-amber-500/15 ring-1 ring-amber-400/60'
                        : isDone
                          ? 'bg-[#0B0F17]/50 opacity-55'
                          : 'bg-[#0B0F17]/80'
                    }`}
                  >
                    <span className="font-mono-nums text-xs font-bold text-slate-500">
                      {idx + 1}
                    </span>
                    <Avatar
                      name={p.name}
                      avatar={p.avatar}
                      size="sm"
                      isSpeaking={Boolean(speakingIds[p.id])}
                      isMuted={p.isMuted}
                    />
                    <span className="text-xs font-semibold text-slate-200 max-w-[80px] truncate">
                      {p.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Optional Typed Clues */}
        <div className="lg:col-span-5 bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="font-display text-base font-bold text-white">
              {t(lang, 'clueFeedTitle')}
            </h3>
          </div>

          <form onSubmit={handleClueSubmit} className="flex gap-2 mb-4">
            <input
              type="text"
              maxLength={48}
              value={clueText}
              onChange={(e) => setClueText(e.target.value)}
              placeholder={t(lang, 'clueInputPlaceholder')}
              className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-[#0B0F17] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!clueText.trim()}
              className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t(lang, 'sendClue')}</span>
            </button>
          </form>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {room.clues.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                {t(lang, 'noCluesYet')}
              </p>
            ) : (
              [...room.clues].reverse().map((clue) => (
                <div
                  key={clue.id}
                  className="px-3.5 py-2.5 rounded-2xl bg-[#0B0F17]/80 flex items-baseline justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-amber-300">
                      {clue.playerName}
                    </span>
                    <span className="text-slate-600 mx-1.5" aria-hidden="true">·</span>
                    <span className="text-sm text-slate-100 break-words">{clue.text}</span>
                  </div>
                  <span className="font-mono-nums text-[11px] text-slate-500 shrink-0">
                    R{clue.round}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
