import React from 'react';
import { ArrowLeft, LogOut, Volume2, VolumeX } from 'lucide-react';
import { Language } from '../types/game';
import { t } from '../data/i18n';

interface TopBarProps {
  lang: Language;
  onToggleLang: () => void;
  title?: string;
  subtitle?: string;
  roomCode?: string;
  onLeaveRoom?: () => void;
  onBackToHub?: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  lang,
  onToggleLang,
  title,
  subtitle,
  roomCode,
  onLeaveRoom,
  onBackToHub,
  sfxEnabled,
  onToggleSfx,
}) => {
  return (
    <header className="sticky top-0 z-30 h-14 bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between gap-4">
        {/* Zone 1: Brand wordmark + optional Back to Hub */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackToHub && !roomCode && (
            <button
              type="button"
              onClick={onBackToHub}
              className="min-h-[36px] px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              aria-label={t(lang, 'backToHub')}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(lang, 'backToHub')}</span>
            </button>
          )}
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            {title ?? t(lang, 'appTitle')}
          </span>
        </div>

        {/* Zone 2: Concise single-line room code when active */}
        {roomCode ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap shrink-0">
            <span>{t(lang, 'roomCode')}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums text-sm font-bold text-amber-400 tracking-wider">
              {roomCode}
            </span>
          </div>
        ) : (
          <div className="hidden sm:block text-xs text-slate-400 truncate">
            {subtitle ?? t(lang, 'tagline')}
          </div>
        )}

        {/* Zone 3: Language + Sound + Leave */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSfx}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition-colors"
            aria-label={sfxEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          >
            {sfxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            type="button"
            onClick={onToggleLang}
            className="min-h-[40px] px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-100 whitespace-nowrap shrink-0 transition-colors border border-slate-700/60"
          >
            {lang === 'en' ? 'EN / हिं' : 'हिं / EN'}
          </button>

          {onLeaveRoom && (
            <button
              type="button"
              onClick={onLeaveRoom}
              className="min-h-[40px] px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(lang, 'leaveRoom')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
