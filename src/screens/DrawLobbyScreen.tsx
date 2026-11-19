import React, { useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  LogOut,
  Mic,
  MicOff,
  Play,
  Sliders,
  Users,
} from 'lucide-react';
import type { Language } from '../types/game';
import type { DrawRoomState, DrawSettings, DrawWordPackId } from '../types/drawGuess';
import { DRAW_WORD_PACK_META } from '../data/drawWords';
import { Avatar } from '../components/Avatar';
import { t } from '../data/i18n';

interface DrawLobbyScreenProps {
  lang: Language;
  room: DrawRoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  voiceEnabled: boolean;
  micStatus: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  isMuted: boolean;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onUpdateSettings: (settings: DrawSettings) => Promise<void>;
  onStartGame: () => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  errorMsg: string | null;
}

const PACK_ORDER: DrawWordPackId[] = ['all', 'desi', 'animals', 'food', 'objects', 'adventure'];

export const DrawLobbyScreen: React.FC<DrawLobbyScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  voiceEnabled,
  micStatus,
  isMuted,
  onToggleVoice,
  onToggleMute,
  onUpdateSettings,
  onStartGame,
  onLeaveRoom,
  errorMsg,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [starting, setStarting] = useState(false);

  const isHost = room.hostId === myId;
  const players = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)
  );
  const canStart = isHost && players.length >= 2;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.search = `?draw=${room.code}`;
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleStart = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    try {
      await onStartGame();
    } finally {
      setStarting(false);
    }
  };

  const updateField = <K extends keyof DrawSettings>(key: K, value: DrawSettings[K]) => {
    if (!isHost) return;
    void onUpdateSettings({ ...room.settings, [key]: value });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Top Room Code Strip */}
      <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400">
            {t(lang, 'dgTitle')} · {t(lang, 'roomCode')}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-[0.22em] text-white tabular-nums">
              {room.code}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? t(lang, 'copied') : t(lang, 'copyCode')}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? t(lang, 'copied') : t(lang, 'shareLink')}</span>
          </button>

          {voiceEnabled ? (
            <button
              type="button"
              onClick={onToggleMute}
              className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                isMuted
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
              }`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? t(lang, 'muted') : t(lang, 'micOn')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleVoice}
              disabled={micStatus === 'requesting'}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t(lang, 'dgJoinVoice')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void onLeaveRoom()}
            className="min-h-[42px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t(lang, 'leaveRoom')}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm font-medium"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Players Roster */}
        <div className="lg:col-span-5 bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>{t(lang, 'playersTitle')}</span>
            </h2>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {players.length} / 10
            </span>
          </div>

          <div className="space-y-2.5">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-[#0B0F17] border border-slate-800/90"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={p.name}
                    avatar={p.avatar}
                    size="sm"
                    isHost={p.id === room.hostId}
                    isSpeaking={Boolean(speakingIds[p.id])}
                    isMuted={p.isMuted}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {p.name}
                      {p.id === myId ? ` (${t(lang, 'youLabel')})` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {p.id === room.hostId ? t(lang, 'hostLabel') : t(lang, 'readyLabel')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {players.length < 2 && (
            <p className="text-xs text-amber-300 leading-relaxed pt-1">
              {t(lang, 'dgNeedTwoPlayers')}
            </p>
          )}
        </div>

        {/* Studio Settings + Start Button */}
        <div className="lg:col-span-7 bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>{t(lang, 'gameSettings')}</span>
            </h2>
            {!isHost && (
              <span className="text-xs text-slate-400">{t(lang, 'hostControlsHint')}</span>
            )}
          </div>

          {/* Rounds & Draw Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                {t(lang, 'roundsLabel')}
              </span>
              <div className="grid grid-cols-4 gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
                {([2, 3, 4, 5] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={!isHost}
                    onClick={() => updateField('rounds', r)}
                    className={`min-h-[38px] rounded-lg font-mono text-xs font-bold tabular-nums transition-colors ${
                      room.settings.rounds === r
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-400 hover:text-white disabled:hover:text-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                {t(lang, 'dgDrawTimeLabel')}
              </span>
              <div className="grid grid-cols-3 gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
                {([60, 80, 100] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={!isHost}
                    onClick={() => updateField('drawTimeSec', sec)}
                    className={`min-h-[38px] rounded-lg font-mono text-xs font-bold tabular-nums transition-colors ${
                      room.settings.drawTimeSec === sec
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-400 hover:text-white disabled:hover:text-slate-400'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Word Pack Picker */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              {t(lang, 'dgWordPacksLabel')}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PACK_ORDER.map((packId) => {
                const meta = DRAW_WORD_PACK_META[packId];
                const selected = room.settings.wordPack === packId;
                return (
                  <button
                    key={packId}
                    type="button"
                    disabled={!isHost}
                    onClick={() => updateField('wordPack', packId)}
                    className={`text-left p-3 rounded-2xl border transition-colors ${
                      selected
                        ? 'bg-indigo-500/15 border-indigo-400 text-white'
                        : 'bg-[#0B0F17] border-slate-800 text-slate-300 hover:border-slate-700 disabled:hover:border-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">
                      {lang === 'hi' ? meta.labelHi : meta.labelEn}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {lang === 'hi' ? meta.descHi : meta.descEn}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Letter Hints Toggle */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <p className="text-sm font-semibold text-white">{t(lang, 'dgHintsToggle')}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t(lang, 'dgHintsDesc')}</p>
            </div>
            <button
              type="button"
              disabled={!isHost}
              onClick={() => updateField('hintsEnabled', !room.settings.hintsEnabled)}
              className={`min-h-[38px] px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                room.settings.hintsEnabled
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                  : 'bg-[#0B0F17] border border-slate-700 text-slate-400'
              }`}
            >
              {room.settings.hintsEnabled ? t(lang, 'pcOn') : t(lang, 'pcOff')}
            </button>
          </div>

          {/* Start Action */}
          <div className="pt-2">
            {isHost ? (
              <button
                type="button"
                disabled={!canStart || starting}
                onClick={() => void handleStart()}
                className="w-full min-h-[52px] px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 whitespace-nowrap transition-all active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{starting ? t(lang, 'starting') : t(lang, 'startGame')}</span>
              </button>
            ) : (
              <div className="w-full min-h-[52px] px-5 rounded-2xl bg-[#0B0F17] border border-slate-800 text-slate-300 text-sm font-medium flex items-center justify-center">
                {t(lang, 'waitingForHost')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
