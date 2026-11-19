import React, { useState } from 'react';
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { t } from '../data/i18n';
import { getSortedPlayers } from '../utils/gameLogic';
import { getInitials } from '../components/Avatar';
import { soundFx } from '../utils/soundFx';

interface VotingScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  onCastVote: (targetId: string) => void;
  onForceRevealResults: () => void;
}

export const VotingScreen: React.FC<VotingScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  onCastVote,
  onForceRevealResults,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const players = getSortedPlayers(room.players);
  const myLockedVote = room.votes?.[myId] ?? null;
  const voteCount = Object.keys(room.votes ?? {}).filter((id) => room.players[id]).length;
  const isHost = room.hostId === myId;

  const handleLockVote = () => {
    if (!selectedId || myLockedVote) return;
    soundFx.voteLocked();
    onCastVote(selectedId);
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {t(lang, 'votingTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-blue-100/80">{t(lang, 'votingSubtitle')}</p>
        <div className="pt-0.5 font-mono-nums text-xs sm:text-sm font-bold text-sky-200">
          {voteCount} / {players.length} {t(lang, 'votesProgress')}
        </div>
      </div>

      {/* Suspect Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {players.map((p, idx) => {
          const isMe = p.id === myId;
          const isChosen = myLockedVote ? myLockedVote === p.id : selectedId === p.id;
          const hasVoted = Boolean(room.votes?.[p.id]);
          const isSpeaking = Boolean(speakingIds[p.id]);

          return (
            <button
              key={p.id}
              type="button"
              disabled={isMe || Boolean(myLockedVote)}
              onClick={() => {
                soundFx.click();
                setSelectedId(p.id);
              }}
              className={`min-h-[64px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all ${
                isChosen
                  ? 'bg-rose-500/25 ring-2 ring-rose-300 text-white'
                  : isMe
                    ? 'bg-[#0E246E]/35 opacity-50 cursor-not-allowed'
                    : 'bg-[#0E246E]/60 hover:bg-[#14308D]/75 border border-blue-200/18 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold ${
                      isSpeaking ? 'speaking-glow ring-2 ring-emerald-400' : 'ring-1 ring-blue-200/25'
                    }`}
                    style={{
                      backgroundColor: p.avatar.color || '#F59E0B',
                    }}
                  >
                    <span className="text-xs font-extrabold text-slate-950">
                      {getInitials(p.name)}
                    </span>
                  </div>
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#091A54] border border-blue-200/35 text-[9px] font-mono-nums font-bold text-white flex items-center justify-center">
                    {idx + 1}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{p.name}</div>
                  <div className="text-[11px] text-blue-100/75 truncate">
                    {isMe
                      ? t(lang, 'cannotVoteSelf')
                      : hasVoted
                        ? t(lang, 'voteLocked')
                        : t(lang, 'selectSuspect')}
                  </div>
                </div>
              </div>

              {isChosen && <CheckCircle2 className="w-5 h-5 text-rose-200 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Confirm Vote / Host Early Reveal */}
      <div className="space-y-2.5 pt-1">
        {myLockedVote ? (
          <div className="w-full min-h-[50px] px-6 rounded-2xl bg-emerald-400/20 border border-emerald-300/35 text-emerald-200 font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            <span>{t(lang, 'voteLocked')}</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={!selectedId}
            onClick={handleLockVote}
            className="w-full min-h-[50px] px-6 rounded-2xl bg-rose-500 hover:bg-rose-400 disabled:bg-white/10 disabled:text-blue-200/45 text-white font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition-all active:scale-[0.98]"
          >
            <Lock className="w-4 h-4" />
            <span>{t(lang, 'confirmVote')}</span>
          </button>
        )}

        {isHost && voteCount < players.length && (
          <button
            type="button"
            onClick={onForceRevealResults}
            className="w-full min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/18 text-blue-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>{t(lang, 'revealResultsNow')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
