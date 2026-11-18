import React, { useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Clapperboard,
  Film,
  LogIn,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Language } from '../types/game';
import { CharadesRoomState } from '../types/charades';
import { t } from '../data/i18n';
import { isFirestoreConfigured } from '../firebase';

interface CharadesMenuScreenProps {
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
  rejoinRoom: CharadesRoomState | null;
  onRejoin: (code: string) => Promise<void>;
  onDismissRejoin: () => void;
  errorMsg: string | null;
  loadingAction: 'create' | 'join' | 'rejoin' | null;
}

export const CharadesMenuScreen: React.FC<CharadesMenuScreenProps> = ({
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
  const needsAuth = firestoreEnabled && authReady && !authUser;

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoinRoom(joinCode);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="min-h-[44px] px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-100 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t(lang, 'backToHub')}</span>
      </button>

      {/* Rejoin Banner */}
      {rejoinRoom && (
        <div className="rounded-3xl bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-purple-500/20 border border-amber-400/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              {t(lang, 'dcRejoinTitle')}
            </p>
            <p className="font-display text-lg font-extrabold text-white">
              {t(lang, 'roomCode')}: <span className="font-mono-nums text-amber-300">{rejoinRoom.code}</span> ·{' '}
              <span className="text-sm font-medium text-amber-100/80">
                {rejoinRoom.playerIds.length} {t(lang, 'playersCount')}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loadingAction === 'rejoin'}
              onClick={() => onRejoin(rejoinRoom.code)}
              className="min-h-[44px] px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t(lang, 'dcRejoinBtn')}</span>
            </button>
            <button
              type="button"
              onClick={onDismissRejoin}
              className="min-h-[44px] px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-amber-100 text-xs font-semibold transition-colors"
            >
              {t(lang, 'gtaDismissRejoin')}
            </button>
          </div>
        </div>
      )}

      {/* Cinematic Bollywood Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2B0D2B] via-[#1A0B2B] to-[#11071F] border border-amber-500/35 p-6 sm:p-8 shadow-2xl space-y-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-rose-600/20 blur-3xl"
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Film className="w-4 h-4" />
              <span>{t(lang, 'dcBadge')}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight">
              🎬 {t(lang, 'dcMenuTitle')}
            </h1>
            <p className="text-sm sm:text-base text-amber-100/80 max-w-xl leading-relaxed">
              {t(lang, 'dcMenuDesc')}
            </p>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-600 text-slate-950 flex items-center justify-center shrink-0 shadow-xl shadow-amber-500/25">
            <Clapperboard className="w-8 h-8" />
          </div>
        </div>

        {/* Highlights row */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-black/30 border border-white/10 p-3.5 flex items-start gap-3">
            <Camera className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-sm text-white">
                {lang === 'hi' ? 'लाइव कैमरा स्टेज' : 'Live Video Stage'}
              </p>
              <p className="text-xs text-amber-100/65 mt-0.5">
                {lang === 'hi'
                  ? 'एक्टर को लाइव कैमरे पर एक्टिंग करते देखें'
                  : 'Watch actors perform live on front or rear camera'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-black/30 border border-white/10 p-3.5 flex items-start gap-3">
            <Mic className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-sm text-white">
                {lang === 'hi' ? 'लाइव वॉइस गेसिंग' : 'Real-Time Voice'}
              </p>
              <p className="text-xs text-amber-100/65 mt-0.5">
                {lang === 'hi'
                  ? 'बिना किसी टाइमर के बोलकर मूवी पहचानें'
                  : 'Shout out movie guesses live over group voice'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-black/30 border border-white/10 p-3.5 flex items-start gap-3">
            <Users className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-sm text-white">
                {lang === 'hi' ? 'टीम और सिंगल मोड' : 'Team & Individual'}
              </p>
              <p className="text-xs text-amber-100/65 mt-0.5">
                {lang === 'hi'
                  ? 'होस्ट अपनी मर्ज़ी से टीम और रोल चुनता है'
                  : 'Host manually picks teams, actors & movie givers'}
              </p>
            </div>
          </div>
        </div>

        {/* Auth Check */}
        {needsAuth && (
          <div className="relative z-10 rounded-2xl bg-amber-500/15 border border-amber-400/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-amber-100 font-medium">{t(lang, 'signInRequired')}</p>
            <button
              type="button"
              disabled={signingIn}
              onClick={onSignIn}
              className="min-h-[46px] px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>{signingIn ? t(lang, 'signingIn') : t(lang, 'signInWithGoogle')}</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="relative z-10 px-4 py-3 rounded-2xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-sm font-medium"
          >
            {errorMsg}
          </div>
        )}

        {/* Create or Join Actions */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="rounded-2xl bg-black/35 border border-amber-400/25 p-5 flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'नया रूम शुरू करें' : 'Host a Bollywood Party'}</span>
              </p>
              <p className="text-xs text-amber-100/70 mt-1">
                {lang === 'hi'
                  ? `आपका नाम: ${playerName.trim() || 'Player'}`
                  : `Playing as: ${playerName.trim() || 'Player'}`}
              </p>
            </div>

            <button
              type="button"
              disabled={needsAuth || loadingAction === 'create'}
              onClick={onCreateRoom}
              className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-105 disabled:opacity-50 text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {loadingAction === 'create'
                  ? lang === 'hi'
                    ? 'रूम बन रहा है...'
                    : 'Creating Room...'
                  : t(lang, 'dcCreateRoom')}
              </span>
            </button>
          </div>

          <form
            onSubmit={handleJoinSubmit}
            className="rounded-2xl bg-black/35 border border-white/15 p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <label
                htmlFor="charades-join-code"
                className="block text-xs font-semibold text-amber-200 mb-2"
              >
                {t(lang, 'dcJoinRoom')}
              </label>
              <input
                id="charades-join-code"
                type="text"
                maxLength={5}
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                placeholder={t(lang, 'roomCodePlaceholder')}
                className="w-full h-12 px-4 rounded-xl bg-[#0D0718] border border-white/20 text-center font-mono-nums text-lg font-bold tracking-[0.25em] text-amber-300 placeholder:text-amber-100/30 placeholder:tracking-normal focus:outline-none focus:border-amber-400 uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={needsAuth || joinCode.trim().length !== 5 || loadingAction === 'join'}
              className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 disabled:opacity-50 text-white font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
            >
              <span>
                {loadingAction === 'join'
                  ? lang === 'hi'
                    ? 'जुड़ रहे हैं...'
                    : 'Joining...'
                  : t(lang, 'joinBtn')}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
