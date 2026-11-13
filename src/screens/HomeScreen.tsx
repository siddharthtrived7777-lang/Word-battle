import React, { useState } from 'react';
import { Plus, ArrowRight, Database, Users, Mic, Eye } from 'lucide-react';
import { Language, PlayerAvatar } from '../types/game';
import { t } from '../data/i18n';
import { AVATAR_COLORS, AVATAR_EMOJIS, Avatar } from '../components/Avatar';
import { isFirebaseConfigured } from '../firebaseConfig';

interface HomeScreenProps {
  lang: Language;
  playerName: string;
  setPlayerName: (name: string) => void;
  avatar: PlayerAvatar;
  setAvatar: (avatar: PlayerAvatar) => void;
  initialJoinCode?: string;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onOpenFirebaseGuide: () => void;
  errorMsg: string | null;
  loadingAction: 'create' | 'join' | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  lang,
  playerName,
  setPlayerName,
  avatar,
  setAvatar,
  initialJoinCode = '',
  onCreateRoom,
  onJoinRoom,
  onOpenFirebaseGuide,
  errorMsg,
  loadingAction,
}) => {
  const [joinCode, setJoinCode] = useState(initialJoinCode);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoinRoom(joinCode);
  };

  const configured = isFirebaseConfigured();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Primary Column: Identity + Create/Join */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 sm:p-7">
            <div className="flex items-center gap-4 mb-6">
              <Avatar name={playerName || 'Player'} avatar={avatar} size="xl" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
                  {t(lang, 'appTitle')}
                </h1>
                <p className="text-sm text-slate-400 mt-1 leading-snug">
                  {t(lang, 'tagline')}
                </p>
              </div>
            </div>

            {/* Display Name */}
            <div className="mb-5">
              <label
                htmlFor="player-name-input"
                className="block text-xs font-semibold text-slate-300 mb-2"
              >
                {t(lang, 'yourName')}
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t(lang, 'namePlaceholder')}
                className="w-full h-12 px-4 rounded-2xl bg-[#0B0F17] border border-slate-700/80 text-white placeholder:text-slate-500 text-base font-medium focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            {/* Avatar Mode Switch + Selector */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-300">
                  {t(lang, 'chooseAvatar')}
                </span>
                <div className="inline-flex items-center p-1 rounded-xl bg-[#0B0F17] border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAvatar({ ...avatar, type: 'emoji' })}
                    className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors ${
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
                    className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors ${
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
                <div className="grid grid-cols-8 gap-2">
                  {AVATAR_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setAvatar({ ...avatar, emoji: em })}
                      className={`min-h-[44px] rounded-xl text-xl flex items-center justify-center transition-all active:scale-95 ${
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
                <div className="grid grid-cols-8 gap-2">
                  {AVATAR_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAvatar({ ...avatar, color: col })}
                      className={`min-h-[44px] rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                        avatar.color === col ? 'ring-2 ring-white scale-105' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col }}
                      aria-label={`Color ${col}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-4 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium"
              >
                {errorMsg}
              </div>
            )}

            {/* Primary CTA: Create Room */}
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={onCreateRoom}
              className="w-full min-h-[54px] px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>{t(lang, 'createRoom')}</span>
            </button>
          </div>

          {/* Join Existing Room Card */}
          <form
            onSubmit={handleJoinSubmit}
            className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 sm:p-6"
          >
            <label
              htmlFor="room-code-input"
              className="block text-sm font-display font-bold text-white mb-3"
            >
              {t(lang, 'joinRoom')}
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="room-code-input"
                type="text"
                maxLength={5}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder={t(lang, 'roomCodePlaceholder')}
                className="flex-1 h-13 px-4 rounded-2xl bg-[#0B0F17] border border-slate-700/80 font-mono-nums text-lg font-bold tracking-[0.22em] text-center sm:text-left uppercase text-white placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                type="submit"
                disabled={loadingAction !== null}
                className="min-h-[52px] px-6 rounded-2xl bg-slate-100 hover:bg-white disabled:opacity-60 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-[0.98]"
              >
                <span>{t(lang, 'joinBtn')}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: How to Play + Firebase RTDB Setup */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold text-white mb-4">
              {t(lang, 'howToPlay')}
            </h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{t(lang, 'rule1')}</p>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{t(lang, 'rule2')}</p>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{t(lang, 'rule3')}</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {configured ? t(lang, 'modeFirebaseRtdb') : t(lang, 'modeLocalWs')}
                <span aria-hidden="true"> · </span>
                3–10 {t(lang, 'playersCount').toLowerCase()}
              </span>
              <button
                type="button"
                onClick={onOpenFirebaseGuide}
                className="min-h-[40px] px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-amber-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{t(lang, 'firebaseGuideBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
