import React, { useEffect, useRef, useState } from 'react';
import { Check, SkipForward } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { t } from '../data/i18n';
import { getSortedPlayers } from '../utils/gameLogic';
import { getInitials } from '../components/Avatar';
import { soundFx } from '../utils/soundFx';

const TURN_DURATION_SEC = 30;

interface DiscussionScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  onAdvanceTurn: () => void;
  onForceVoting: () => void;
}

export const DiscussionScreen: React.FC<DiscussionScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  onAdvanceTurn,
  onForceVoting,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(TURN_DURATION_SEC);
  const autoAdvancedTurnRef = useRef<string>('');

  const roundConfig = room.roundConfig;
  if (!roundConfig) return null;

  const sortedPlayers = getSortedPlayers(room.players);
  const activeSpeakerId = roundConfig.turnOrder[roundConfig.currentTurnIndex];
  const activeSpeaker = room.players[activeSpeakerId];
  const activePlayerNumber =
    Math.max(
      0,
      sortedPlayers.findIndex((p) => p.id === activeSpeakerId)
    ) + 1;

  const isMyTurn = activeSpeakerId === myId;
  const isHost = room.hostId === myId;
  const isSpeakerLive = Boolean(speakingIds[activeSpeakerId]);

  useEffect(() => {
    soundFx.turnChange();
  }, [activeSpeakerId, roundConfig.currentRound]);

  useEffect(() => {
    const turnKey = `${roundConfig.currentRound}_${roundConfig.currentTurnIndex}_${roundConfig.turnStartedAt}`;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - roundConfig.turnStartedAt) / 1000);
      const remaining = Math.max(0, TURN_DURATION_SEC - elapsed);
      setSecondsLeft(remaining);

      if (remaining === 0 && autoAdvancedTurnRef.current !== turnKey) {
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

  const progressRatio = Math.max(0, Math.min(1, secondsLeft / TURN_DURATION_SEC));
  const timerDanger = secondsLeft <= 7;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="flex flex-col items-center text-center py-2 sm:py-4 space-y-5">
      {/* Round Indicator */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-blue-200/20 text-xs font-bold tracking-wide text-sky-100 font-mono-nums">
        <span>
          {t(lang, 'roundOf')} {roundConfig.currentRound} {t(lang, 'ofWord')}{' '}
          {room.settings.rounds}
        </span>
      </div>

      {/* Countdown Timer Ring + Active Speaker Turn Visual */}
      <div className="relative flex items-center justify-center w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 124 124" aria-hidden="true">
          <circle
            cx="62"
            cy="62"
            r={radius}
            stroke="rgba(191, 219, 254, 0.16)"
            strokeWidth="7"
            fill="rgba(11, 27, 82, 0.45)"
          />
          <circle
            cx="62"
            cy="62"
            r={radius}
            stroke={timerDanger ? '#FDA4AF' : '#7DD3FC'}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-200 ease-linear"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono-nums text-4xl font-extrabold leading-none ${
              timerDanger ? 'text-rose-200' : 'text-white'
            }`}
          >
            {secondsLeft}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-100/75 mt-1">
            {t(lang, 'secondsLeft')}
          </span>
        </div>
      </div>

      {/* Turn Indicator Banner (Never reveals secret word) */}
      {activeSpeaker && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5 bg-white/10 border border-blue-200/20 rounded-2xl px-3.5 py-2">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold shrink-0 ${
                isSpeakerLive
                  ? 'speaking-glow ring-2 ring-emerald-400'
                  : 'ring-2 ring-sky-300/80'
              }`}
              style={{
                backgroundColor: activeSpeaker.avatar.color || '#F59E0B',
              }}
            >
              <span className="text-xs font-extrabold text-slate-950">
                {getInitials(activeSpeaker.name)}
              </span>
            </div>

            <div className="text-left min-w-0">
              <div className="text-sm sm:text-base font-display font-bold text-white leading-tight">
                {t(lang, 'playerPrefix')} {activePlayerNumber} {t(lang, 'isDescribing')}
              </div>
              <div className="text-xs font-semibold text-sky-200 truncate">
                {activeSpeaker.name}
              </div>
            </div>
          </div>

          {isMyTurn && (
            <p className="text-xs sm:text-sm font-semibold text-emerald-300">
              {t(lang, 'yourTurnBanner')}
            </p>
          )}
        </div>
      )}

      {/* Turn & Host Controls */}
      {(isMyTurn || isHost) && (
        <div className="w-full max-w-sm space-y-2.5 pt-1">
          {isMyTurn && (
            <button
              type="button"
              onClick={() => {
                soundFx.click();
                onAdvanceTurn();
              }}
              className="w-full min-h-[50px] px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-[#07184A] font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-400/20 transition-all active:scale-[0.98]"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>{t(lang, 'doneSpeaking')}</span>
            </button>
          )}

          {isHost && !isMyTurn && (
            <button
              type="button"
              onClick={onAdvanceTurn}
              className="w-full min-h-[46px] px-5 rounded-2xl bg-white/12 hover:bg-white/20 border border-blue-200/20 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
              <span>{t(lang, 'skipTurn')}</span>
            </button>
          )}

          {isHost && (
            <button
              type="button"
              onClick={onForceVoting}
              className="w-full min-h-[42px] px-4 rounded-xl bg-transparent hover:bg-white/10 text-blue-100/80 hover:text-white text-xs font-semibold transition-colors"
            >
              {t(lang, 'proceedToVoting')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
