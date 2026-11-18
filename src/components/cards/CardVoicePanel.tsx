import React, { useState } from 'react';
import {
  Headphones,
  Mic,
  MicOff,
  RefreshCw,
  Users,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { MicPermissionState } from '../../hooks/useVoiceChat';
import type { CardPlayerPublic } from '../../types/cardGames';
import type { Language } from '../../types/game';
import { t } from '../../data/i18n';
import { Avatar } from '../Avatar';

interface CardVoicePanelProps {
  lang: Language;
  myId: string;
  players: CardPlayerPublic[];
  micStatus: MicPermissionState;
  isMuted: boolean;
  speakingIds: Record<string, boolean>;
  localMutedPeers: Record<string, boolean>;
  peerStates: Record<string, RTCPeerConnectionState>;
  onRequestMic: () => Promise<unknown>;
  onToggleMute: () => void;
  onTogglePeerMute: (peerId: string) => void;
  onReconnectVoice: () => void;
  compact?: boolean;
}

export const CardVoicePanel: React.FC<CardVoicePanelProps> = ({
  lang,
  myId,
  players,
  micStatus,
  isMuted,
  speakingIds,
  localMutedPeers,
  peerStates,
  onRequestMic,
  onToggleMute,
  onTogglePeerMute,
  onReconnectVoice,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const remotePlayers = players.filter((p) => p.id !== myId);
  const connectedPeersCount = remotePlayers.filter(
    (p) => peerStates[p.id] === 'connected'
  ).length;
  const activeSpeakers = players.filter((p) => speakingIds[p.id]).map((p) => p.name);

  return (
    <div className="bg-[#18221D]/95 border border-[#3B281E] rounded-2xl p-3 sm:p-4 text-[#FAF7F0] shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#24382D] border border-[#C5A059]/30 flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-[#FAF7F0]">
                {t(lang, 'pcVoiceLounge')}
              </span>
              <span className="text-[11px] font-mono-nums text-[#C9BEA8]">
                {connectedPeersCount}/{remotePlayers.length} linked
              </span>
            </div>
            <p className="text-xs text-[#A8B6AD] truncate">
              {activeSpeakers.length > 0
                ? `${t(lang, 'speakingNow')}: ${activeSpeakers.join(', ')}`
                : micStatus === 'granted'
                  ? isMuted
                    ? t(lang, 'micMuted')
                    : t(lang, 'micOn')
                  : 'Enable mic to talk live at the table'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {micStatus !== 'granted' ? (
            <button
              type="button"
              onClick={() => onRequestMic()}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] text-[#141816] font-display font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Mic className="w-4 h-4" />
              <span>{micStatus === 'denied' ? t(lang, 'retryMic') : 'Enable Mic'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleMute}
              className={`min-h-[44px] px-3.5 rounded-xl font-display font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isMuted
                  ? 'bg-[#6F2D28] hover:bg-[#823630] text-[#FAF7F0]'
                  : 'bg-[#264D39] hover:bg-[#2E5E45] text-[#FAF7F0] border border-[#C5A059]/40'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? t(lang, 'micMuted') : t(lang, 'micOn')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReconnectVoice}
            title="Reconnect voice connections"
            aria-label="Reconnect voice"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#222D27] hover:bg-[#2B3831] border border-[#3B281E] text-[#D9CEB8] flex items-center justify-center transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {remotePlayers.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-label="Toggle table speakers list"
              className="min-h-[44px] px-2.5 rounded-xl bg-[#222D27] hover:bg-[#2B3831] border border-[#3B281E] text-[#D9CEB8] text-xs font-semibold flex items-center gap-1"
            >
              <Users className="w-4 h-4" />
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {micStatus === 'denied' && (
        <div
          role="alert"
          className="mt-2.5 px-3 py-2 rounded-xl bg-[#4E221F]/70 border border-[#9E352B] text-xs text-[#F5D6D2]"
        >
          {t(lang, 'micDenied')}
        </div>
      )}

      {micStatus === 'unavailable' && (
        <div
          role="alert"
          className="mt-2.5 px-3 py-2 rounded-xl bg-[#3D311B]/70 border border-[#8E6F32] text-xs text-[#F3E2BA]"
        >
          {t(lang, 'micUnavailable')}
        </div>
      )}

      {expanded && remotePlayers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#2E3C34] grid grid-cols-1 sm:grid-cols-2 gap-2">
          {remotePlayers.map((p) => {
            const mutedLocally = Boolean(localMutedPeers[p.id]);
            const isSpeaking = Boolean(speakingIds[p.id]);
            const connState = peerStates[p.id] || 'connecting';
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[#131B17] border border-[#2A3730]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar
                    name={p.name}
                    avatar={p.avatar}
                    size="sm"
                    isSpeaking={isSpeaking}
                    isMuted={p.isMuted || mutedLocally}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#FAF7F0] truncate">{p.name}</p>
                    <p className="text-[11px] text-[#9AA69E]">
                      {mutedLocally
                        ? 'Muted by you'
                        : p.isMuted
                          ? 'Mic muted'
                          : connState === 'connected'
                            ? 'Audio linked'
                            : 'Linking audio...'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePeerMute(p.id)}
                  aria-label={mutedLocally ? `Unmute ${p.name}` : `Mute ${p.name}`}
                  className={`min-h-[36px] min-w-[36px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                    mutedLocally
                      ? 'bg-[#6F2D28] text-[#FAF7F0]'
                      : 'bg-[#222D27] hover:bg-[#2B3831] text-[#D9CEB8]'
                  }`}
                >
                  {mutedLocally ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
