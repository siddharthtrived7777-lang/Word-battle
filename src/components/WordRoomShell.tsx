import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Lock,
  Mic,
  MicOff,
  RefreshCw,
  AlertCircle,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Language, Player, RoomState } from '../types/game';
import { getCategoryLabel, getPairById } from '../data/wordPairs';
import { t } from '../data/i18n';
import { getSortedPlayers } from '../utils/gameLogic';
import { getInitials } from './Avatar';
import { MicPermissionState } from '../hooks/useVoiceChat';

interface WordRoomShellProps {
  lang: Language;
  room: RoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  micStatus: MicPermissionState;
  isMuted: boolean;
  onToggleMute: () => void;
  onRetryMic: () => void;
  onLeaveRoom: () => void;
  onToggleLang: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  children: React.ReactNode;
}

function splitDesktopPerimeter(players: Player[]): {
  top: Player[];
  right: Player[];
  bottom: Player[];
  left: Player[];
} {
  const n = players.length;
  if (n <= 1) return { top: players, right: [], bottom: [], left: [] };
  if (n === 2) return { top: [players[0]], right: [], bottom: [players[1]], left: [] };
  if (n === 3) return { top: [players[0]], right: [players[2]], bottom: [], left: [players[1]] };
  if (n === 4) {
    return {
      top: [players[0]],
      right: [players[1]],
      bottom: [players[2]],
      left: [players[3]],
    };
  }
  if (n === 5) {
    return {
      top: players.slice(0, 2),
      right: [players[2]],
      bottom: [players[3]],
      left: [players[4]],
    };
  }
  if (n === 6) {
    return {
      top: players.slice(0, 2),
      right: [players[2]],
      bottom: players.slice(3, 5),
      left: [players[5]],
    };
  }
  if (n === 7) {
    return {
      top: players.slice(0, 2),
      right: players.slice(2, 4),
      bottom: players.slice(4, 6),
      left: [players[6]],
    };
  }
  if (n === 8) {
    return {
      top: players.slice(0, 3),
      right: [players[3]],
      bottom: players.slice(4, 7),
      left: [players[7]],
    };
  }
  if (n === 9) {
    return {
      top: players.slice(0, 3),
      right: players.slice(3, 5),
      bottom: players.slice(5, 7),
      left: players.slice(7, 9),
    };
  }
  return {
    top: players.slice(0, 3),
    right: players.slice(3, 5),
    bottom: players.slice(5, 8),
    left: players.slice(8, 10),
  };
}

export const WordRoomShell: React.FC<WordRoomShellProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  micStatus,
  isMuted,
  onToggleMute,
  onRetryMic,
  onLeaveRoom,
  onToggleLang,
  sfxEnabled,
  onToggleSfx,
  children,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [peekingWord, setPeekingWord] = useState(false);

  const players = getSortedPlayers(room.players);
  const roundConfig = room.roundConfig;
  const activeSpeakerId =
    room.phase === 'discussion' && roundConfig
      ? roundConfig.turnOrder[roundConfig.currentTurnIndex]
      : null;

  const activeCategory = roundConfig?.category ?? room.settings.category;
  const categoryName = getCategoryLabel(activeCategory, lang);

  // Assigned word computed privately for the local player only when in an active word phase
  const showPrivateWordControl =
    Boolean(roundConfig) &&
    (room.phase === 'reveal' || room.phase === 'discussion' || room.phase === 'voting');

  let myAssignedWord = '';
  if (roundConfig && showPrivateWordControl) {
    const pair = getPairById(roundConfig.pairId);
    const isImposter = roundConfig.imposterIds.includes(myId);
    const wordIndex = isImposter
      ? roundConfig.imposterWordIndex
      : roundConfig.majorityWordIndex;
    myAssignedWord = pair ? pair[lang][wordIndex] : '—';
  }

  const speakingNames = players
    .filter((p) => speakingIds[p.id])
    .map((p) => p.name);

  const seatNumberById: Record<string, number> = {};
  players.forEach((p, idx) => {
    seatNumberById[p.id] = idx + 1;
  });

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(room.code).then(() => {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    });
  };

  const renderSeat = (p: Player) => {
    const seatNumber = seatNumberById[p.id] ?? 1;
    const isMe = p.id === myId;
    const isHost = p.id === room.hostId;
    const isSpeaking = Boolean(speakingIds[p.id]);
    const isTurn = room.phase === 'discussion' && activeSpeakerId === p.id;
    const isReady = room.phase === 'reveal' && p.readyForDiscussion;
    const hasVoted = room.phase === 'voting' && Boolean(room.votes?.[p.id]);

    const ringClass = isSpeaking
      ? 'speaking-glow ring-[3px] ring-emerald-400'
      : isTurn
        ? 'ring-[3px] ring-sky-300 shadow-[0_0_22px_rgba(125,211,252,0.5)]'
        : isMe
          ? 'ring-2 ring-white/55'
          : 'ring-2 ring-blue-200/25';

    return (
      <div
        key={p.id}
        className="flex flex-col items-center w-[74px] sm:w-[92px] shrink-0 select-none"
      >
        <div className="relative flex items-center justify-center">
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-display font-bold transition-transform duration-200 ${ringClass} ${
              isTurn ? 'scale-105' : ''
            }`}
            style={{
              backgroundColor: p.avatar.color || '#F59E0B',
            }}
            aria-label={`${p.name} (${t(lang, 'playerPrefix')} ${seatNumber})`}
          >
            <span className="text-sm sm:text-base tracking-tight text-slate-950 font-extrabold">
              {getInitials(p.name)}
            </span>
          </div>

          {/* Player number indicator */}
          <span
            className={`absolute -top-1 -left-1 w-5 h-5 rounded-full border flex items-center justify-center font-mono-nums text-[10px] font-bold shadow-sm ${
              isTurn
                ? 'bg-sky-300 text-[#07184A] border-white'
                : 'bg-[#091A54] text-white border-blue-200/40'
            }`}
          >
            {seatNumber}
          </span>

          {/* Host crown */}
          {isHost && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-[#091A54] flex items-center justify-center shadow-sm"
              title={t(lang, 'hostLabel')}
            >
              <Crown className="w-3 h-3 stroke-[2.5]" />
            </span>
          )}

          {/* Muted indicator */}
          {p.isMuted && (
            <span
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#091A54] border border-blue-200/30 text-rose-300 flex items-center justify-center shadow-sm"
              title={t(lang, 'micMuted')}
            >
              <MicOff className="w-2.5 h-2.5" />
            </span>
          )}

          {/* Phase progress badge (never reveals imposter) */}
          {!p.isMuted && (isReady || hasVoted) && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 text-[#07184A] flex items-center justify-center shadow-sm">
              {hasVoted ? (
                <Lock className="w-2.5 h-2.5 stroke-[2.5]" />
              ) : (
                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
              )}
            </span>
          )}
        </div>

        {/* Name + Speaking/Turn micro label underneath */}
        <div className="mt-1.5 flex flex-col items-center w-full">
          <span
            className={`text-[11px] sm:text-xs font-semibold truncate max-w-full text-center leading-tight ${
              isTurn ? 'text-sky-200 font-bold' : isMe ? 'text-white' : 'text-blue-100/90'
            }`}
          >
            {p.name}
          </span>

          {isSpeaking ? (
            <span
              className="mt-0.5 inline-flex items-end gap-0.5 h-3"
              aria-label={t(lang, 'speakingNow')}
            >
              <span className="w-0.5 h-2.5 rounded-full bg-emerald-300 voice-wave-bar" />
              <span
                className="w-0.5 h-3 rounded-full bg-emerald-300 voice-wave-bar"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="w-0.5 h-2 rounded-full bg-emerald-300 voice-wave-bar"
                style={{ animationDelay: '0.3s' }}
              />
            </span>
          ) : isTurn ? (
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
              {t(lang, 'turnLabel')}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const desktopSeats = splitDesktopPerimeter(players);
  const mobileTopCount = Math.ceil(players.length / 2);
  const mobileTopSeats = players.slice(0, mobileTopCount);
  const mobileBottomSeats = players.slice(mobileTopCount);
  const hasMicIssue = micStatus === 'denied' || micStatus === 'unavailable';

  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-gradient-to-b from-[#0E287E] via-[#14359C] to-[#0A1C59] text-white overflow-x-hidden">
      {/* Subtle abstract geometric shapes background */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden select-none"
        aria-hidden="true"
      >
        <svg
          className="w-full h-full opacity-100"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <circle cx="180" cy="140" r="240" fill="rgba(147, 197, 253, 0.05)" />
          <circle
            cx="1260"
            cy="740"
            r="310"
            stroke="rgba(191, 219, 254, 0.07)"
            strokeWidth="2"
          />
          <circle cx="1280" cy="160" r="160" fill="rgba(96, 165, 250, 0.045)" />
          <circle
            cx="720"
            cy="450"
            r="360"
            stroke="rgba(191, 219, 254, 0.045)"
            strokeWidth="1.5"
          />
          <rect
            x="-90"
            y="580"
            width="380"
            height="380"
            rx="64"
            transform="rotate(-24 -90 580)"
            fill="rgba(147, 197, 253, 0.04)"
          />
          <polygon
            points="1080,40 1390,210 1220,460"
            fill="rgba(219, 234, 254, 0.03)"
          />
        </svg>
      </div>

      {/* Top Game Header */}
      <header className="relative z-20 px-3 sm:px-6 pt-3 pb-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Back Button */}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="min-h-[44px] px-3 rounded-2xl bg-[#1C40AE]/65 hover:bg-[#234CC6]/80 backdrop-blur-md border border-blue-200/20 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors active:scale-[0.98]"
            aria-label={t(lang, 'leaveRoom')}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t(lang, 'leaveRoom')}</span>
          </button>

          {/* Compact Rounded Room Information Panel */}
          <div className="flex-1 min-w-0 flex justify-center">
            <div className="max-w-full bg-[#193A9F]/70 backdrop-blur-md border border-blue-200/25 rounded-2xl px-3 sm:px-4 py-1.5 shadow-lg shadow-[#06123D]/30 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
              {/* Room Code + Copy */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-medium text-blue-200/80 hidden sm:inline">
                  {t(lang, 'roomCode')}
                </span>
                <span className="font-mono-nums text-sm sm:text-base font-extrabold tracking-[0.16em] text-white">
                  {room.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="min-h-[32px] min-w-[32px] px-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap transition-colors"
                  aria-label={t(lang, 'copyCode')}
                  title={t(lang, 'copyCode')}
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-blue-100" />
                  )}
                  <span className="hidden md:inline">
                    {copiedCode ? t(lang, 'copied') : t(lang, 'copyCode')}
                  </span>
                </button>
              </div>

              <span className="text-blue-200/35" aria-hidden="true">
                ·
              </span>

              {/* Category Name */}
              <span className="text-xs sm:text-sm font-semibold text-sky-200 truncate max-w-[140px] sm:max-w-[200px]">
                {categoryName}
              </span>

              <span className="text-blue-200/35" aria-hidden="true">
                ·
              </span>

              {/* Total Players Count */}
              <div
                className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-white shrink-0 font-mono-nums"
                aria-label={`${players.length} ${t(lang, 'playersCount')}`}
              >
                <Users className="w-3.5 h-3.5 text-sky-200" />
                <span>{players.length}</span>
              </div>

              {/* Private Role Word Peek (only shown during word phases, hold to view privately) */}
              {showPrivateWordControl && (
                <>
                  <span className="text-blue-200/35" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    onPointerDown={() => setPeekingWord(true)}
                    onPointerUp={() => setPeekingWord(false)}
                    onPointerLeave={() => setPeekingWord(false)}
                    onPointerCancel={() => setPeekingWord(false)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`min-h-[32px] px-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 select-none touch-none whitespace-nowrap transition-colors ${
                      peekingWord
                        ? 'bg-sky-300 text-[#07184A]'
                        : 'bg-white/12 hover:bg-white/20 text-white border border-blue-200/20'
                    }`}
                  >
                    {peekingWord ? (
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                    )}
                    <span>{peekingWord ? myAssignedWord : t(lang, 'holdToPeekWord')}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sound + Language Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleSfx}
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-[#1C40AE]/65 hover:bg-[#234CC6]/80 backdrop-blur-md border border-blue-200/20 text-blue-100 flex items-center justify-center transition-colors"
              aria-label={sfxEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            >
              {sfxEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-blue-300/60" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleLang}
              className="min-h-[44px] px-3 rounded-2xl bg-[#1C40AE]/65 hover:bg-[#234CC6]/80 backdrop-blur-md border border-blue-200/20 text-xs font-semibold text-white whitespace-nowrap transition-colors"
            >
              {lang === 'en' ? 'EN / हिं' : 'हिं / EN'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Arena: Dynamic Player Perimeter + Central Game Area */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-3 sm:px-6 py-2 max-w-6xl w-full mx-auto">
        {/* Mobile Layout (< md): Top Player Row -> Central Arena -> Bottom Player Row */}
        <div className="md:hidden flex flex-col items-center gap-3 w-full">
          {mobileTopSeats.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-2 w-full">
              {mobileTopSeats.map((p) => renderSeat(p))}
            </div>
          )}

          <div className="w-full bg-[#193B9F]/58 backdrop-blur-md border border-blue-200/22 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-[#05103B]/45">
            {children}
          </div>

          {mobileBottomSeats.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-2 w-full">
              {mobileBottomSeats.map((p) => renderSeat(p))}
            </div>
          )}
        </div>

        {/* Desktop / Tablet Layout (md+): 4-Sided Perimeter Ring Around Central Arena */}
        <div className="hidden md:flex flex-col items-center justify-center gap-4 w-full">
          {desktopSeats.top.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-5">
              {desktopSeats.top.map((p) => renderSeat(p))}
            </div>
          )}

          <div
            className={`w-full grid items-center gap-4 ${
              desktopSeats.left.length > 0 || desktopSeats.right.length > 0
                ? 'grid-cols-[108px_minmax(0,1fr)_108px]'
                : 'grid-cols-1 max-w-2xl mx-auto'
            }`}
          >
            {(desktopSeats.left.length > 0 || desktopSeats.right.length > 0) && (
              <div className="flex flex-col items-center justify-center gap-5">
                {desktopSeats.left.map((p) => renderSeat(p))}
              </div>
            )}

            <div className="w-full bg-[#193B9F]/58 backdrop-blur-md border border-blue-200/22 rounded-3xl p-6 shadow-2xl shadow-[#05103B]/45">
              {children}
            </div>

            {(desktopSeats.left.length > 0 || desktopSeats.right.length > 0) && (
              <div className="flex flex-col items-center justify-center gap-5">
                {desktopSeats.right.map((p) => renderSeat(p))}
              </div>
            )}
          </div>

          {desktopSeats.bottom.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-5">
              {desktopSeats.bottom.map((p) => renderSeat(p))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Integrated Voice Chat Dock + Attribution */}
      <footer className="relative z-20 mt-auto bg-[#0A1C59]/85 backdrop-blur-md border-t border-blue-200/15 px-3 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            {hasMicIssue ? (
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
                  <p className="text-xs text-blue-100/85 line-clamp-2 leading-snug">
                    {micStatus === 'denied' ? t(lang, 'micDenied') : t(lang, 'micUnavailable')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRetryMic}
                  className="min-h-[44px] px-3.5 rounded-2xl bg-sky-300 hover:bg-sky-200 text-[#07184A] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t(lang, 'retryMic')}</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      speakingNames.length > 0
                        ? 'bg-emerald-300'
                        : isMuted
                          ? 'bg-rose-300/75'
                          : 'bg-sky-300/85'
                    }`}
                  />
                  <span
                    className={`text-xs font-medium truncate ${
                      speakingNames.length > 0 ? 'text-emerald-300' : 'text-blue-100/85'
                    }`}
                  >
                    {speakingNames.length > 0
                      ? `${t(lang, 'speakingNow')}: ${speakingNames.join(', ')}`
                      : isMuted
                        ? t(lang, 'micMuted')
                        : t(lang, 'voiceConnected')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`min-h-[44px] px-4 sm:px-5 rounded-2xl font-display font-bold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-[0.97] ${
                    isMuted
                      ? 'bg-rose-500/20 text-rose-100 border border-rose-300/35 hover:bg-rose-500/30'
                      : speakingIds[myId]
                        ? 'bg-emerald-400 text-[#07184A] shadow-lg shadow-emerald-400/25'
                        : 'bg-white/15 hover:bg-white/22 text-white border border-blue-200/25'
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

          <div className="text-center text-[11px] text-blue-200/65">
            Developed by <span className="text-blue-100 font-semibold">Siddharth Trivedi</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
