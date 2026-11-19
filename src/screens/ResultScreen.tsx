import React, { useEffect } from 'react';
import { Trophy, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { getCategoryLabel, getPairById } from '../data/wordPairs';
import { t } from '../data/i18n';
import { getSortedPlayers } from '../utils/gameLogic';
import { getInitials } from '../components/Avatar';
import { soundFx } from '../utils/soundFx';

interface ResultScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  onPlayAgain: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  onPlayAgain,
}) => {
  const outcome = room.outcome;
  const roundConfig = room.roundConfig;

  useEffect(() => {
    if (!outcome) return;
    if (outcome.winner === 'crew') {
      soundFx.winCrew();
    } else {
      soundFx.winImposter();
    }
  }, [outcome]);

  if (!outcome || !roundConfig) return null;

  const pair = getPairById(roundConfig.pairId);
  const majorityWord = pair ? pair[lang][roundConfig.majorityWordIndex] : '—';
  const imposterWord = pair ? pair[lang][roundConfig.imposterWordIndex] : '—';
  const categoryName = getCategoryLabel(roundConfig.category, lang);

  const players = getSortedPlayers(room.players);
  const imposterPlayers = roundConfig.imposterIds
    .map((id) => room.players[id])
    .filter(Boolean);
  const isHost = room.hostId === myId;
  const crewWon = outcome.winner === 'crew';

  const scoreboard = [...players].sort(
    (a, b) => b.score - a.score || a.joinedAt - b.joinedAt
  );

  return (
    <div className="space-y-4">
      {/* Winner Banner */}
      <div
        className={`rounded-2xl p-4 sm:p-5 text-center border ${
          crewWon
            ? 'bg-emerald-400/15 border-emerald-300/35'
            : 'bg-rose-500/20 border-rose-300/35'
        }`}
      >
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 bg-[#091A54]/60">
          {crewWon ? (
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-200" />
          )}
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {crewWon ? t(lang, 'crewWins') : t(lang, 'imposterWins')}
        </h1>
        <p className="text-xs sm:text-sm text-blue-100/85 mt-0.5">
          {crewWon ? t(lang, 'crewWinsSub') : t(lang, 'imposterWinsSub')}
        </p>
      </div>

      {/* Imposter & Both Words Reveal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#0E246E]/55 border border-blue-200/18 rounded-2xl p-4">
          <p className="text-xs font-semibold text-rose-200 mb-2.5">
            {imposterPlayers.length > 1
              ? t(lang, 'theImpostersWere')
              : t(lang, 'theImposterWas')}
          </p>
          <div className="space-y-2.5">
            {imposterPlayers.map((imp) => (
              <div key={imp.id} className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-display font-bold shrink-0 ${
                    speakingIds[imp.id]
                      ? 'speaking-glow ring-2 ring-emerald-400'
                      : 'ring-2 ring-rose-300/60'
                  }`}
                  style={{
                    backgroundColor: imp.avatar.color || '#F59E0B',
                  }}
                >
                  <span className="text-sm font-extrabold text-slate-950">
                    {getInitials(imp.name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold text-white truncate">
                    {imp.name}
                  </div>
                  <div className="text-xs text-blue-100/70">{categoryName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0E246E]/55 border border-blue-200/18 rounded-2xl p-3 grid grid-cols-2 gap-2.5 items-stretch">
          <div className="p-3 rounded-xl bg-white/8 flex flex-col justify-center">
            <div className="text-[11px] font-semibold text-emerald-300 mb-0.5">
              {t(lang, 'majorityWordLabel')}
            </div>
            <div className="font-display text-lg font-extrabold text-white break-words">
              {majorityWord}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/8 flex flex-col justify-center">
            <div className="text-[11px] font-semibold text-rose-200 mb-0.5">
              {t(lang, 'imposterWordLabel')}
            </div>
            <div className="font-display text-lg font-extrabold text-white break-words">
              {imposterWord}
            </div>
          </div>
        </div>
      </div>

      {/* Vote Breakdown & Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#0E246E]/55 border border-blue-200/18 rounded-2xl p-4">
          <h2 className="font-display text-sm font-bold text-white mb-2.5">
            {t(lang, 'voteBreakdown')}
          </h2>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {players.map((p) => {
              const count = outcome.voteCounts[p.id] ?? 0;
              const voters = Object.entries(room.votes ?? {})
                .filter(([, targetId]) => targetId === p.id)
                .map(([voterId]) => room.players[voterId]?.name)
                .filter(Boolean);
              const isImp = roundConfig.imposterIds.includes(p.id);

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/8"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        {p.name}
                      </span>
                      {isImp && (
                        <span className="text-[11px] font-semibold text-rose-200 shrink-0">
                          · Imposter
                        </span>
                      )}
                    </div>
                    {voters.length > 0 && (
                      <div className="text-[11px] text-blue-100/75 truncate">
                        ← {voters.join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="font-mono-nums text-xs font-bold text-sky-200 shrink-0">
                    {count} {count === 1 ? t(lang, 'voteUnit') : t(lang, 'votesUnit')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#0E246E]/55 border border-blue-200/18 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Trophy className="w-4 h-4 text-amber-300" />
            <h2 className="font-display text-sm font-bold text-white">
              {t(lang, 'scoreboardTitle')}
            </h2>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {scoreboard.map((p, idx) => {
              const gained = outcome.pointsAwarded[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/8"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-nums text-xs font-bold text-blue-200/70 w-4">
                      {idx + 1}.
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-white truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {gained > 0 && (
                      <span className="font-mono-nums text-xs font-bold text-emerald-300">
                        +{gained}
                      </span>
                    )}
                    <span className="font-mono-nums text-xs sm:text-sm font-bold text-sky-200">
                      {p.score} {t(lang, 'pointsUnit')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Play Again CTA */}
      {isHost ? (
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full min-h-[50px] px-6 rounded-2xl bg-white hover:bg-sky-100 text-[#07184A] font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4 stroke-[2.5]" />
          <span>{t(lang, 'playAgain')}</span>
        </button>
      ) : (
        <div className="p-3.5 rounded-2xl bg-[#0E246E]/55 border border-blue-200/15 text-center text-xs sm:text-sm text-blue-100/85 font-medium">
          {t(lang, 'waitingHostPlayAgain')}
        </div>
      )}
    </div>
  );
};
