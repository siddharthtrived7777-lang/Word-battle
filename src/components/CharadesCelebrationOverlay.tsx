import React from 'react';
import { motion } from 'motion/react';
import { Award, Film, Home, Play, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { CharadesRoomState } from '../types/charades';
import { Language } from '../types/game';
import { t } from '../data/i18n';

interface CharadesCelebrationOverlayProps {
  lang: Language;
  room: CharadesRoomState;
  isHost: boolean;
  onConfigureNextRound: () => void;
  onBackToLobby: () => void;
  onRestartMatch: () => void;
}

const CONFETTI_PIECES = [
  { left: '8%', delay: 0, color: '#F59E0B' },
  { left: '16%', delay: 0.2, color: '#EC4899' },
  { left: '25%', delay: 0.1, color: '#10B981' },
  { left: '34%', delay: 0.35, color: '#FDE68A' },
  { left: '44%', delay: 0.05, color: '#F43F5E' },
  { left: '54%', delay: 0.25, color: '#38BDF8' },
  { left: '64%', delay: 0.15, color: '#F59E0B' },
  { left: '74%', delay: 0.3, color: '#A855F7' },
  { left: '84%', delay: 0.08, color: '#10B981' },
  { left: '92%', delay: 0.22, color: '#FB7185' },
];

export const CharadesCelebrationOverlay: React.FC<CharadesCelebrationOverlayProps> = ({
  lang,
  room,
  isHost,
  onConfigureNextRound,
  onBackToLobby,
  onRestartMatch,
}) => {
  const revealed = room.revealedMovie;
  if (!revealed) return null;

  const isGuessed = revealed.outcome === 'guessed';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#351133] via-[#1C0D2C] to-[#11081F] border-2 border-amber-400/50 p-6 sm:p-8 shadow-2xl text-center space-y-6">
      {/* Confetti burst when guessed */}
      {isGuessed && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI_PIECES.map((piece, idx) => (
            <motion.span
              key={idx}
              initial={{ y: -20, opacity: 0, rotate: 0 }}
              animate={{
                y: ['0%', '420%'],
                opacity: [0, 1, 1, 0],
                rotate: [0, idx % 2 === 0 ? 220 : -220],
              }}
              transition={{
                duration: 2.6,
                delay: piece.delay,
                repeat: Infinity,
                repeatDelay: 1.4,
                ease: 'easeOut',
              }}
              style={{ left: piece.left, backgroundColor: piece.color }}
              className="absolute top-0 w-2.5 h-4 rounded-sm"
            />
          ))}
        </div>
      )}

      <div className="relative z-10 space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-600 text-slate-950 shadow-xl shadow-amber-500/30 mx-auto">
          {isGuessed ? <Trophy className="w-8 h-8" /> : <Film className="w-8 h-8" />}
        </div>

        <p className="text-xs sm:text-sm font-display font-extrabold tracking-widest uppercase text-amber-300 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>
            {isGuessed
              ? t(lang, 'dcMovieGuessedBanner')
              : t(lang, 'dcMovieRevealedBanner')}
          </span>
          <Sparkles className="w-4 h-4" />
        </p>

        <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight text-balance">
          {revealed.title}
        </h2>

        <p className="text-xs sm:text-sm text-amber-200/80">
          {revealed.category} · {revealed.language} · {revealed.difficulty}
        </p>

        {isGuessed && revealed.winnerName && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-sm font-semibold">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>
              {lang === 'hi'
                ? `पॉइंट मिला: ${revealed.winnerName}`
                : `Point Awarded to ${revealed.winnerName}`}
            </span>
          </div>
        )}
      </div>

      {/* Current Standings */}
      <div className="relative z-10 rounded-2xl bg-black/35 border border-white/10 p-4 max-w-xl mx-auto">
        <p className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider mb-3">
          {lang === 'hi' ? 'स्कोरबोर्ड' : 'Scoreboard'}
        </p>
        {room.mode === 'team' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-rose-500/15 border border-rose-400/30 p-3">
              <p className="text-xs text-rose-200 font-semibold truncate">{room.teamNames.A}</p>
              <p className="font-display font-mono-nums text-2xl font-extrabold text-white mt-0.5">
                {room.scores.teamA}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/15 border border-amber-400/30 p-3">
              <p className="text-xs text-amber-200 font-semibold truncate">{room.teamNames.B}</p>
              <p className="font-display font-mono-nums text-2xl font-extrabold text-white mt-0.5">
                {room.scores.teamB}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2.5">
            {room.playerIds.map((pid) => {
              const player = room.players[pid];
              if (!player) return null;
              return (
                <div
                  key={pid}
                  className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center gap-2"
                >
                  <span className="text-amber-50 font-semibold">{player.name}</span>
                  <span className="font-mono-nums font-bold text-amber-400">
                    {room.scores.players[pid] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Host Next Round Actions */}
      <div className="relative z-10 pt-2">
        {isHost ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              type="button"
              onClick={onConfigureNextRound}
              className="min-h-[48px] px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-105 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t(lang, 'dcNextRound')}</span>
            </button>

            <button
              type="button"
              onClick={onBackToLobby}
              className="min-h-[48px] px-5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-amber-50 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>{t(lang, 'dcBackToLobby')}</span>
            </button>

            <button
              type="button"
              onClick={onRestartMatch}
              className="min-h-[48px] px-5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t(lang, 'dcRestartMatch')}</span>
            </button>
          </div>
        ) : (
          <p className="text-sm text-amber-200/80 font-medium">
            {lang === 'hi'
              ? 'होस्ट अगले राउंड की तैयारी कर रहे हैं...'
              : 'Waiting for host to set up the next round...'}
          </p>
        )}
      </div>
    </div>
  );
};
