import React, { useState } from 'react';
import { Check, Copy, LogOut, Mic, MicOff, Play, Users } from 'lucide-react';
import { Language } from '../types/game';
import { AnimalRoomState } from '../types/animalGame';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { MicPermissionState } from '../hooks/useVoiceChat';

interface GuessAnimalLobbyScreenProps {
  lang: Language;
  room: AnimalRoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  voiceEnabled: boolean;
  micStatus: MicPermissionState;
  isMuted: boolean;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onStartMatch: () => Promise<void>;
  onExit: () => Promise<void>;
}

export const GuessAnimalLobbyScreen: React.FC<GuessAnimalLobbyScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  voiceEnabled,
  micStatus,
  isMuted,
  onToggleVoice,
  onToggleMute,
  onStartMatch,
  onExit,
}) => {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const isHost = room.hostId === myId;
  const playersList = room.playerIds
    .map((id) => room.players[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const canStart = isHost && playersList.length === 2;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleStart = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    try {
      await onStartMatch();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      <div className="bg-[#FFFDF7] text-slate-900 border-2 border-amber-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Header & Exit */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">
              {t(lang, 'gtaLobbyTitle')}
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 font-mono-nums">
              {t(lang, 'gtaPlayersSlots')} · {playersList.length} / 2
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="min-h-[44px] px-4 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t(lang, 'gtaExitBtn')}</span>
          </button>
        </div>

        {/* Room Code Card */}
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <span className="text-xs font-bold text-amber-800 block">
              {t(lang, 'roomCode')}
            </span>
            <span className="font-mono-nums text-3xl sm:text-4xl font-extrabold tracking-[0.22em] text-slate-900">
              {room.code}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[48px] px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? t(lang, 'copied') : t(lang, 'copyCode')}</span>
          </button>
        </div>

        {/* 2 Player Slots */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map((slotIdx) => {
            const player = playersList[slotIdx];
            if (!player) {
              return (
                <div
                  key={`empty-${slotIdx}`}
                  className="min-h-[84px] p-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center gap-3 text-slate-500"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-200 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-slate-400" />
                  </div>
                  <span className="text-xs font-semibold leading-snug">
                    {t(lang, 'gtaWaitingOpponent')}
                  </span>
                </div>
              );
            }

            const isMe = player.id === myId;
            return (
              <div
                key={player.id}
                className={`min-h-[84px] p-4 rounded-2xl border-2 flex items-center gap-3 ${
                  isMe ? 'bg-emerald-50 border-emerald-300' : 'bg-sky-50 border-sky-200'
                }`}
              >
                <Avatar
                  name={player.name}
                  avatar={player.avatar}
                  size="md"
                  isSpeaking={Boolean(speakingIds[player.id])}
                  isMuted={player.isMuted}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-base text-slate-900 truncate">
                    {player.name}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    {player.isHost ? t(lang, 'hostLabel') : lang === 'hi' ? 'खिलाड़ी 2' : 'Player 2'}
                    {isMe ? ` · ${t(lang, 'youLabel')}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Optional Voice Toggle */}
        <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs font-medium text-slate-600">
            {t(lang, 'gtaVoiceOptionalHint')}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {voiceEnabled && micStatus === 'granted' && (
              <button
                type="button"
                onClick={onToggleMute}
                className={`min-h-[42px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  isMuted
                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMuted ? t(lang, 'micMuted') : t(lang, 'micOn')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleVoice}
              className={`min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                voiceEnabled
                  ? 'bg-slate-800 text-white hover:bg-slate-700'
                  : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              {voiceEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>{voiceEnabled ? t(lang, 'gtaVoiceOff') : t(lang, 'gtaEnableVoice')}</span>
            </button>
          </div>
        </div>

        {/* Start Action */}
        {isHost ? (
          <div className="space-y-2">
            <p className="text-xs text-center font-semibold text-slate-600">
              {playersList.length === 2 ? t(lang, 'gtaReadyToStart') : t(lang, 'gtaWaitingOpponent')}
            </p>
            <button
              type="button"
              disabled={!canStart || starting}
              onClick={handleStart}
              className="w-full min-h-[56px] px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-[0.98]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{t(lang, 'gtaStartMatch')}</span>
            </button>
          </div>
        ) : (
          <div className="py-3 text-center text-sm font-semibold text-amber-800 bg-amber-50 rounded-2xl border border-amber-200">
            {t(lang, 'gtaWaitingHostStart')}
          </div>
        )}
      </div>
    </div>
  );
};
