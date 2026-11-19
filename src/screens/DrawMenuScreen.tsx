import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, LogIn, Palette, Plus, RotateCcw, Users } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Language } from '../types/game';
import type { DrawRoomState } from '../types/drawGuess';
import { t } from '../data/i18n';
import { isFirestoreConfigured } from '../firebase';

interface DrawMenuScreenProps {
  lang: Language;
  playerName: string;
  initialJoinCode?: string;
  authReady: boolean;
  authUser: User | null;
  signingIn: boolean;
  onSignIn: () => Promise<void>;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onBack: () => void;
  rejoinRoom: DrawRoomState | null;
  onRejoin: (code: string) => Promise<void>;
  onDismissRejoin: () => void;
  errorMsg: string | null;
  loadingAction: 'create' | 'join' | 'rejoin' | null;
}

export const DrawMenuScreen: React.FC<DrawMenuScreenProps> = ({
  lang,
  playerName,
  initialJoinCode = '',
  authReady,
  authUser,
  signingIn,
  onSignIn,
  onCreateRoom,
  onJoinRoom,
  onBack,
  rejoinRoom,
  onRejoin,
  onDismissRejoin,
  errorMsg,
  loadingAction,
}) => {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const firestoreEnabled = isFirestoreConfigured();
  const needsAuth = firestoreEnabled && !authUser;
  const busy = loadingAction !== null;

  const handleSubmitJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    void onJoinRoom(joinCode);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] px-3.5 rounded-xl bg-[#151C2C] hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t(lang, 'backToHub')}</span>
        </button>

        <span className="text-xs text-slate-400">
          {playerName.trim() ? `${t(lang, 'yourName')}: ${playerName.trim()}` : t(lang, 'dgMetaLine')}
        </span>
      </div>

      {/* Rejoin Active Room Banner */}
      {rejoinRoom && !needsAuth && (
        <div className="bg-[#151C2C] border border-indigo-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-300">
              {t(lang, 'dgRejoinAvailable')}
            </p>
            <p className="text-sm text-slate-200 mt-0.5">
              {t(lang, 'roomCode')}: <span className="font-mono font-bold text-white">{rejoinRoom.code}</span>
              {' · '}
              <span className="tabular-nums">{rejoinRoom.playerIds.length}</span> {t(lang, 'playersCount')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRejoin(rejoinRoom.code)}
              className="min-h-[42px] px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-display font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{loadingAction === 'rejoin' ? t(lang, 'joining') : t(lang, 'rejoinRoom')}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDismissRejoin}
              className="min-h-[42px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              {t(lang, 'dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Action Card */}
        <div className="lg:col-span-7 bg-[#151C2C] border border-slate-800/80 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-400/35 text-indigo-300 flex items-center justify-center shrink-0">
              <Palette className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
                {t(lang, 'dgTitle')}
              </h1>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                {t(lang, 'dgSubtitle')}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                2–10 {t(lang, 'playersCount')} · {t(lang, 'dgMetaLine')}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm space-y-1"
            >
              <p className="font-semibold">{errorMsg}</p>
              <p className="text-xs text-rose-200/80">
                {t(lang, 'dgErrorHint')}
              </p>
            </div>
          )}

          {needsAuth ? (
            <div className="p-5 rounded-2xl bg-[#0B0F17] border border-slate-800 space-y-3">
              <p className="text-sm text-slate-300">{t(lang, 'hubSignInHint')}</p>
              <button
                type="button"
                disabled={signingIn || !authReady}
                onClick={() => void onSignIn()}
                className="min-h-[48px] px-5 rounded-2xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-950 font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" />
                <span>{signingIn ? t(lang, 'signingIn') : t(lang, 'signInWithGoogle')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCreateRoom()}
                className="w-full min-h-[52px] px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 whitespace-nowrap transition-all active:scale-[0.98]"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>{loadingAction === 'create' ? t(lang, 'creating') : t(lang, 'createRoom')}</span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-slate-800" />
                <span className="px-3 text-xs text-slate-500 font-medium">{t(lang, 'orJoinWithCode')}</span>
                <div className="flex-1 border-t border-slate-800" />
              </div>

              <form onSubmit={handleSubmitJoin} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  maxLength={5}
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))
                  }
                  placeholder={t(lang, 'roomCodePlaceholder')}
                  className="flex-1 h-12 px-4 rounded-2xl bg-[#0B0F17] border border-slate-700/80 text-white placeholder:text-slate-500 font-mono text-base font-bold tracking-[0.22em] uppercase focus:outline-none focus:border-indigo-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={busy || joinCode.trim().length < 5}
                  className="min-h-[48px] px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-display font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-[0.98]"
                >
                  <span>{loadingAction === 'join' ? t(lang, 'joining') : t(lang, 'joinBtn')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Rules & Word Packs Card */}
        <div className="lg:col-span-5 bg-[#151C2C] border border-slate-800/80 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">{t(lang, 'howToPlay')}</h2>
            <span className="text-xs text-indigo-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>2–10</span>
            </span>
          </div>

          <ol className="space-y-3.5 text-sm text-slate-300 leading-relaxed">
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-indigo-400 mt-0.5 tabular-nums">01.</span>
              <span>{t(lang, 'dgRule1')}</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-indigo-400 mt-0.5 tabular-nums">02.</span>
              <span>{t(lang, 'dgRule2')}</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-indigo-400 mt-0.5 tabular-nums">03.</span>
              <span>{t(lang, 'dgRule3')}</span>
            </li>
          </ol>

          <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
            <span className="text-slate-200 font-semibold">{t(lang, 'dgWordPacksLabel')}:</span>{' '}
            Desi &amp; India · Animals &amp; Nature · Food &amp; Treats · Everyday Objects · Actions &amp; Adventure
          </div>
        </div>
      </div>
    </div>
  );
};
