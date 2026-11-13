import React from 'react';
import { Mic, MicOff, AlertCircle, RefreshCw } from 'lucide-react';
import { Language, Player } from '../types/game';
import { t } from '../data/i18n';
import { MicPermissionState } from '../hooks/useVoiceChat';

interface VoiceBarProps {
  lang: Language;
  micStatus: MicPermissionState;
  isMuted: boolean;
  isSpeaking: boolean;
  onToggleMute: () => void;
  onRetryMic: () => void;
  speakingNames: string[];
  players: Player[];
}

export const VoiceBar: React.FC<VoiceBarProps> = ({
  lang,
  micStatus,
  isMuted,
  isSpeaking,
  onToggleMute,
  onRetryMic,
  speakingNames,
}) => {
  const hasPermissionIssue = micStatus === 'denied' || micStatus === 'unavailable';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0F1521]/95 backdrop-blur-md border-t border-slate-800/90">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {hasPermissionIssue ? (
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                {micStatus === 'denied' ? t(lang, 'micDenied') : t(lang, 'micUnavailable')}
              </p>
            </div>
            <button
              type="button"
              onClick={onRetryMic}
              className="min-h-[44px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors active:scale-[0.98]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t(lang, 'retryMic')}</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`text-xs font-medium truncate ${
                  speakingNames.length > 0 ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {speakingNames.length > 0
                  ? `${t(lang, 'speakingNow')}: ${speakingNames.join(', ')}`
                  : isMuted
                    ? t(lang, 'micMuted')
                    : t(lang, 'voiceConnected')}
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              className={`min-h-[46px] px-5 rounded-2xl font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-[0.97] ${
                isMuted
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25'
                  : isSpeaking
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {isMuted ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>{t(lang, 'tapToUnmute')}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>{t(lang, 'tapToMute')}</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
