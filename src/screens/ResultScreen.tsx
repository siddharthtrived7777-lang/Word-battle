import React, { useEffect } from 'react';
import { Trophy, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { getCategoryLabel, getPairById } from '../data/wordPairs';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { getSortedPlayers } from '../utils/gameLogic';
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

  const scoreboard = [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 space-y-5">
      {/* Winner Banner */}
      <div
        className={`rounded-3xl p-6 text-center border ${
          crewWon
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-rose-500/10 border-rose-500/30'
        }`}
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 bg-[#0B0F17]/60">
          {crewWon ? (
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-7 h-7 text-rose-400" />
          )}
        </div>
        <h1 className="font-display text-3xl font-extrabold text-white">
          {crewWon ? t(lang, 'crewWins') : t(lang, 'imposterWins')}
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          {crewWon ? t(lang, 'crewWinsSub') : t(lang, 'imposterWinsSub')}
        </p>
      </div>

      {/* Imposter & Both Words Reveal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5">
          <p className="text-xs font-semibold text-rose-400 mb-3">
            {imposterPlayers.length > 1 ? t(lang, 'theImpostersWere') : t(lang, 'theImposterWas')}
          </p>
          <div className="space-y-3">
            {imposterPlayers.map((imp) => (
              <div key={imp.id} className="flex items-center gap-3">
                <Avatar
                  name={imp.name}
                  avatar={imp.avatar}
                  size="lg"
                  isSpeaking={Boolean(speakingIds[imp.id])}
                  isMuted={imp.isMuted}
                />
                <div className="min-w-0">
                  <div className="font-display text-xl font-bold text-white truncate">
                    {imp.name}
                  </div>
                  <div className="text-xs text-slate-400">{categoryName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 grid grid-cols-2 gap-4 items-center">
          <div className="p-4 rounded-2xl bg-[#0B0F17]">
            <div className="text-xs font-semibold text-emerald-400 mb-1">
              {t(lang, 'majorityWordLabel')}
            </div>
            <div className="font-display text-xl font-extrabold text-white break-words">
              {majorityWord}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#0B0F17]">
            <div className="text-xs font-semibold text-rose-400 mb-1">
              {t(lang, 'imposterWordLabel')}
            </div>
            <div className="font-display text-xl font-extrabold text-white break-words">
              {imposterWord}
            </div>
          </div>
        </div>
      </div>

      {/* Vote Breakdown & Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Votes */}
        <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5">
          <h2 className="font-display text-base font-bold text-white mb-3">
            {t(lang, 'voteBreakdown')}
          </h2>
          <div className="space-y-2.5">
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
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#0B0F17]/80"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {p.name}
                      </span>
                      {isImp && (
                        <span className="text-xs font-semibold text-rose-400">
                          · Imposter
                        </span>
                      )}
                    </div>
                    {voters.length > 0 && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        ← {voters.join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="font-mono-nums text-sm font-bold text-amber-400 shrink-0">
                    {count} {count === 1 ? t(lang, 'voteUnit') : t(lang, 'votesUnit')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cumulative Scoreboard */}
        <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="font-display text-base font-bold text-white">
              {t(lang, 'scoreboardTitle')}
            </h2>
          </div>
          <div className="space-y-2.5">
            {scoreboard.map((p, idx) => {
              const gained = outcome.pointsAwarded[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#0B0F17]/80"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono-nums text-xs font-bold text-slate-500 w-4">
                      {idx + 1}.
                    </span>
                    <Avatar
                      name={p.name}
                      avatar={p.avatar}
                      size="sm"
                      isSpeaking={Boolean(speakingIds[p.id])}
                      isMuted={p.isMuted}
                    />
                    <span className="text-sm font-semibold text-white truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {gained > 0 && (
                      <span className="font-mono-nums text-xs font-bold text-emerald-400">
                        +{gained}
                      </span>
                    )}
                    <span className="font-mono-nums text-sm font-bold text-amber-300">
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
          className="w-full min-h-[56px] px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
        >
          <RotateCcw className="w-5 h-5 stroke-[2.5]" />
          <span>{t(lang, 'playAgain')}</span>
        </button>
      ) : (
        <div className="p-4 rounded-2xl bg-[#151C2C] border border-slate-800/80 text-center text-sm text-slate-400 font-medium">
          {t(lang, 'waitingHostPlayAgain')}
        </div>
      )}
    </div>
  );
};
