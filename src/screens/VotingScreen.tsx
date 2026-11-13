import React, { useState } from 'react';
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Language, RoomState } from '../types/game';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { getSortedPlayers } from '../utils/gameLogic';
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
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {t(lang, 'votingTitle')}
        </h1>
        <p className="text-sm text-slate-400">{t(lang, 'votingSubtitle')}</p>
        <div className="pt-1 font-mono-nums text-sm font-bold text-amber-400">
          {voteCount} / {players.length} {t(lang, 'votesProgress')}
        </div>
      </div>

      {/* Suspect Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((p) => {
          const isMe = p.id === myId;
          const isChosen = myLockedVote ? myLockedVote === p.id : selectedId === p.id;
          const hasVoted = Boolean(room.votes?.[p.id]);

          return (
            <button
              key={p.id}
              type="button"
              disabled={isMe || Boolean(myLockedVote)}
              onClick={() => {
                soundFx.click();
                setSelectedId(p.id);
              }}
              className={`min-h-[72px] p-4 rounded-2xl flex items-center justify-between gap-3 text-left transition-all ${
                isChosen
                  ? 'bg-rose-500/20 ring-2 ring-rose-400'
                  : isMe
                    ? 'bg-[#151C2C]/50 opacity-50 cursor-not-allowed'
                    : 'bg-[#151C2C] hover:bg-slate-800/80 border border-slate-800/80 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  name={p.name}
                  avatar={p.avatar}
                  size="md"
                  isSpeaking={Boolean(speakingIds[p.id])}
                  isMuted={p.isMuted}
                  isHost={p.id === room.hostId}
                />
                <div className="min-w-0">
                  <div className="text-base font-bold text-white truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {isMe
                      ? t(lang, 'cannotVoteSelf')
                      : hasVoted
                        ? t(lang, 'voteLocked')
                        : t(lang, 'selectSuspect')}
                  </div>
                </div>
              </div>

              {isChosen && <CheckCircle2 className="w-5 h-5 text-rose-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Confirm Vote / Host Early Reveal */}
      <div className="space-y-3">
        {myLockedVote ? (
          <div className="w-full min-h-[54px] px-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-display font-bold text-base flex items-center justify-center gap-2">
            <Lock className="w-5 h-5" />
            <span>{t(lang, 'voteLocked')}</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={!selectedId}
            onClick={handleLockVote}
            className="w-full min-h-[54px] px-6 rounded-2xl bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all active:scale-[0.98]"
          >
            <Lock className="w-5 h-5" />
            <span>{t(lang, 'confirmVote')}</span>
          </button>
        )}

        {isHost && voteCount < players.length && (
          <button
            type="button"
            onClick={onForceRevealResults}
            className="w-full min-h-[44px] px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>{t(lang, 'revealResultsNow')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
