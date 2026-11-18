import React from 'react';
import { ArrowRight, Clapperboard, Film, LogIn, LogOut, Sparkles, Users } from 'lucide-react';
import { User } from 'firebase/auth';
import { Language, PlayerAvatar } from '../types/game';
import { t } from '../data/i18n';
import { AVATAR_COLORS, AVATAR_EMOJIS, Avatar } from '../components/Avatar';
import { isFirestoreConfigured } from '../firebase';

interface GameHubScreenProps {
  lang: Language;
  playerName: string;
  setPlayerName: (name: string) => void;
  avatar: PlayerAvatar;
  setAvatar: (avatar: PlayerAvatar) => void;
  authReady: boolean;
  authUser: User | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  signingIn: boolean;
  errorMsg: string | null;
  onSelectWordBattle: () => void;
  onSelectGuessAnimal: () => void;
  onSelectDumbCharades: () => void;
}

export const GameHubScreen: React.FC<GameHubScreenProps> = ({
  lang,
  playerName,
  setPlayerName,
  avatar,
  setAvatar,
  authReady,
  authUser,
  onSignIn,
  onSignOut,
  signingIn,
  errorMsg,
  onSelectWordBattle,
  onSelectGuessAnimal,
  onSelectDumbCharades,
}) => {
  const firestoreEnabled = isFirestoreConfigured();
  const needsAuth = firestoreEnabled && !authUser;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Header & Player Profile Strip */}
      <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
              {t(lang, 'hubTitle')}
            </h1>
            <p className="text-sm sm:text-base text-slate-400 mt-1.5 leading-snug max-w-xl">
              {t(lang, 'hubSubtitle')}
            </p>
          </div>

          {firestoreEnabled && authReady && (
            <div className="shrink-0">
              {authUser ? (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0B0F17] border border-slate-800">
                  <Avatar name={playerName || authUser.displayName || 'Player'} avatar={avatar} size="sm" />
                  <span className="text-xs text-slate-300 truncate max-w-[160px]">
                    {t(lang, 'signedInAs')} ·{' '}
                    <span className="text-emerald-400 font-semibold">
                      {authUser.displayName || 'Google'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="min-h-[38px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t(lang, 'signOut')}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={onSignIn}
                  className="min-h-[48px] px-5 rounded-2xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg whitespace-nowrap shrink-0 transition-all active:scale-[0.98]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{signingIn ? t(lang, 'signingIn') : t(lang, 'signInWithGoogle')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Shared Name & Avatar Setup */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-5 flex items-center gap-3.5">
            <Avatar name={playerName || 'Player'} avatar={avatar} size="lg" />
            <div className="flex-1 min-w-0">
              <label
                htmlFor="hub-player-name"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                {t(lang, 'yourName')}
              </label>
              <input
                id="hub-player-name"
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t(lang, 'namePlaceholder')}
                className="w-full h-11 px-3.5 rounded-xl bg-[#0B0F17] border border-slate-700/80 text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          </div>

          <div className="md:col-span-7">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">{t(lang, 'chooseAvatar')}</span>
              <div className="inline-flex items-center p-0.5 rounded-xl bg-[#0B0F17] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAvatar({ ...avatar, type: 'emoji' })}
                  className={`min-h-[30px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                    avatar.type === 'emoji'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t(lang, 'emojiMode')}
                </button>
                <button
                  type="button"
                  onClick={() => setAvatar({ ...avatar, type: 'initials' })}
                  className={`min-h-[30px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                    avatar.type === 'initials'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t(lang, 'initialsMode')}
                </button>
              </div>
            </div>

            {avatar.type === 'emoji' ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {AVATAR_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setAvatar({ ...avatar, emoji: em })}
                    className={`min-h-[42px] min-w-[42px] rounded-xl text-lg flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                      avatar.emoji === em
                        ? 'bg-amber-500/20 ring-2 ring-amber-400'
                        : 'bg-[#0B0F17] hover:bg-slate-800'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {AVATAR_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setAvatar({ ...avatar, color: col })}
                    className={`min-h-[42px] min-w-[42px] rounded-xl shrink-0 transition-all active:scale-95 ${
                      avatar.color === col ? 'ring-2 ring-white scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col }}
                    aria-label={`Color ${col}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {needsAuth && (
          <p className="mt-4 text-xs text-amber-300 font-medium">{t(lang, 'hubSignInHint')}</p>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium"
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Three Game Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Word Battle */}
        <article className="bg-[#151C2C] border border-slate-800/90 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-3xl">
                🕵️
              </div>
              <span className="text-xs font-medium text-slate-400">
                {t(lang, 'wbCardBadgeUpdated')}
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl font-extrabold text-white tracking-tight">
                {t(lang, 'appTitle')}
              </h2>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {t(lang, 'tagline')}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              <span>2–10 {t(lang, 'playersCount')}</span>
            </span>
            <button
              type="button"
              onClick={onSelectWordBattle}
              className="min-h-[48px] px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-[0.98]"
            >
              <span>{t(lang, 'playNow')}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </article>

        {/* Card 2: Guess the Animal (Bright & Friendly Palette) */}
        <article className="bg-gradient-to-br from-[#FFFDF7] to-[#FEF3C7] border-2 border-amber-300 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6 text-slate-900 shadow-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-3xl">
                🦒
              </div>
              <span className="text-xs font-semibold text-amber-900">
                {t(lang, 'gtaCardBadge')}
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
                {t(lang, 'gtaTitle')}
              </h2>
              <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                {t(lang, 'gtaDesc')}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-amber-200/80 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>30 {lang === 'hi' ? 'जानवर · 2 खिलाड़ी' : 'Animals · 2 Players'}</span>
            </span>
            <button
              type="button"
              onClick={onSelectGuessAnimal}
              className="min-h-[48px] px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 shadow-md transition-all active:scale-[0.98]"
            >
              <span>{t(lang, 'playNow')}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </article>

        {/* Card 3: Bollywood Dumb Charades (Placed AFTER Guess the Animal) */}
        <article className="md:col-span-2 lg:col-span-1 group relative overflow-hidden bg-gradient-to-br from-[#340E33] via-[#1C0B2E] to-[#11071E] border border-amber-400/45 hover:border-amber-300 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6 shadow-2xl transition-all duration-300 hover:-translate-y-1">
          {/* Spotlight & subtle film sparkle */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-amber-400/20 blur-3xl group-hover:bg-amber-400/30 transition-colors"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -left-16 w-48 h-48 rounded-full bg-rose-600/20 blur-3xl"
          />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Clapperboard className="w-7 h-7" />
              </div>
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" />
                <span>{t(lang, 'dcBadge')}</span>
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl font-black text-white tracking-tight">
                🎬 {t(lang, 'dcTitle')}
              </h2>
              <p className="text-sm text-amber-100/85 mt-2 leading-relaxed">
                {t(lang, 'dcSubtitle')}
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-amber-200/85 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              <span>2–10 {t(lang, 'playersCount')}</span>
            </span>
            <button
              type="button"
              onClick={onSelectDumbCharades}
              className="min-h-[48px] px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-105 text-slate-950 font-display font-extrabold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
            >
              <span>{t(lang, 'playNow')}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </article>
      </div>
    </div>
  );
};
