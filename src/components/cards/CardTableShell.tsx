import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  Crown,
  Headphones,
  LogOut,
  Mic,
  MicOff,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import type { MicPermissionState } from '../../hooks/useVoiceChat';
import type { CardRoomClientState } from '../../types/cardGames';
import type { Language } from '../../types/game';
import { CARD_GAMES_INFO } from '../../data/cardGamesInfo';
import { t } from '../../data/i18n';
import { Avatar } from '../Avatar';
import { CardVoicePanel } from './CardVoicePanel';
import { PlayingCardView } from './PlayingCardView';
import { UnoCardView } from './UnoCardView';

interface CardTableShellProps {
  lang: Language;
  room: CardRoomClientState;
  myId: string;
  speakingIds: Record<string, boolean>;
  micStatus: MicPermissionState;
  isMuted: boolean;
  localMutedPeers: Record<string, boolean>;
  peerStates: Record<string, RTCPeerConnectionState>;
  onRequestMic: () => Promise<unknown>;
  onToggleMute: () => void;
  onTogglePeerMute: (peerId: string) => void;
  onReconnectVoice: () => void;
  onOpenRules: () => void;
  onPlayAgain: (mode: 'lobby' | 'redeal') => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  handTray: React.ReactNode;
  children: React.ReactNode;
}

export const CardTableShell: React.FC<CardTableShellProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  micStatus,
  isMuted,
  localMutedPeers,
  peerStates,
  onRequestMic,
  onToggleMute,
  onTogglePeerMute,
  onReconnectVoice,
  onOpenRules,
  onPlayAgain,
  onLeaveRoom,
  handTray,
  children,
}) => {
  const [showVoiceDrawer, setShowVoiceDrawer] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [resetBusy, setResetBusy] = useState(false);

  const table = room.table;
  const info = CARD_GAMES_INFO[room.selectedGame];
  const isHost = room.hostId === myId;
  const orderedPlayers = (room.playerOrder.length > 0 ? room.playerOrder : Object.keys(room.players))
    .map((uid) => room.players[uid])
    .filter(Boolean);

  useEffect(() => {
    if (!table?.turnDeadlineAt || room.phase !== 'playing') return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [room.phase, table?.turnDeadlineAt]);

  const secondsLeft =
    table?.turnDeadlineAt && room.phase === 'playing'
      ? Math.max(0, Math.ceil((table.turnDeadlineAt - nowMs) / 1000))
      : null;

  const isMyTurn = room.phase === 'playing' && table?.turnUid === myId;
  const turnPlayerName = table?.turnUid ? room.players[table.turnUid]?.name || 'Player' : '';

  const handleOutcomeAction = async (mode: 'lobby' | 'redeal') => {
    setResetBusy(true);
    try {
      await onPlayAgain(mode);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-5 space-y-3">
      {/* Top Table Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1A211E] border border-[#3B281E] rounded-2xl px-3.5 py-2.5 text-[#FAF7F0]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight truncate">
                {info.name}
              </h1>
              <span className="text-xs text-[#C9BEA8] font-mono-nums">
                · Hand #{table?.roundNumber || 1}
              </span>
            </div>
            <p className="text-xs text-[#B6C2BA] truncate">
              {room.phase === 'finished'
                ? 'Hand complete'
                : isMyTurn
                  ? 'Your turn to play'
                  : `${turnPlayerName}'s turn`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {secondsLeft !== null && (
            <div
              className={`min-h-[38px] px-2.5 rounded-xl border font-mono-nums text-xs font-bold flex items-center gap-1.5 ${
                secondsLeft <= 7
                  ? 'bg-[#6F2D28]/80 border-[#B8574E] text-[#FAF7F0]'
                  : 'bg-[#131916] border-[#2E3D35] text-[#E6D7B7]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{secondsLeft}s</span>
            </div>
          )}

          {micStatus !== 'granted' ? (
            <button
              type="button"
              onClick={() => onRequestMic()}
              className="min-h-[40px] px-3 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] text-[#141816] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">Mic</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isMuted
                  ? 'bg-[#6F2D28] text-[#FAF7F0]'
                  : 'bg-[#254936] text-[#FAF7F0] border border-[#C5A059]/40'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Mic On'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowVoiceDrawer((v) => !v)}
            aria-label="Voice mixer and speakers"
            className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showVoiceDrawer
                ? 'bg-[#2A3D32] border-[#C5A059]/60 text-[#FAF7F0]'
                : 'bg-[#141917] border-[#303B35] text-[#D9CEB8]'
            }`}
          >
            <Headphones className="w-4 h-4 text-[#C5A059]" />
            <span className="hidden md:inline">Voice</span>
          </button>

          <button
            type="button"
            onClick={onOpenRules}
            className="min-h-[40px] px-2.5 rounded-xl bg-[#141917] hover:bg-[#222B26] border border-[#303B35] text-[#D9CEB8] text-xs font-semibold flex items-center gap-1.5"
          >
            <BookOpen className="w-4 h-4 text-[#C5A059]" />
            <span className="hidden sm:inline">{t(lang, 'pcRules')}</span>
          </button>

          {!confirmLeave ? (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              aria-label="Leave table"
              className="min-h-[40px] px-2.5 rounded-xl bg-[#382120] hover:bg-[#4F2C2A] border border-[#6E3B37] text-[#F2D5D2] text-xs font-semibold flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t(lang, 'leaveRoom')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onLeaveRoom}
                className="min-h-[40px] px-2.5 rounded-xl bg-[#9E352B] text-white text-xs font-bold"
              >
                Leave?
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="min-h-[40px] px-2 rounded-xl bg-[#262E2A] text-[#D9CEB8] text-xs"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Voice Audio Panel */}
      {showVoiceDrawer && (
        <CardVoicePanel
          lang={lang}
          myId={myId}
          players={orderedPlayers}
          micStatus={micStatus}
          isMuted={isMuted}
          speakingIds={speakingIds}
          localMutedPeers={localMutedPeers}
          peerStates={peerStates}
          onRequestMic={onRequestMic}
          onToggleMute={onToggleMute}
          onTogglePeerMute={onTogglePeerMute}
          onReconnectVoice={onReconnectVoice}
          compact
        />
      )}

      {/* Seated Players Strip around the Table */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {orderedPlayers.map((p) => {
          const isTurn = room.phase === 'playing' && table?.turnUid === p.id;
          const isMe = p.id === myId;
          const speaking = Boolean(speakingIds[p.id]);
          return (
            <div
              key={p.id}
              className={`min-w-[144px] sm:min-w-[162px] flex-1 rounded-2xl px-3 py-2 border transition-all flex items-center gap-2.5 ${
                isTurn
                  ? 'bg-[#224534] border-[#C5A059] shadow-[0_0_0_1px_rgba(197,160,89,0.35)]'
                  : 'bg-[#19221E] border-[#2E3A33]'
              } ${!p.connected ? 'opacity-55' : ''}`}
            >
              <Avatar
                name={p.name}
                avatar={p.avatar}
                size="sm"
                isSpeaking={speaking}
                isMuted={p.isMuted || Boolean(localMutedPeers[p.id])}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-[#FAF7F0] truncate">
                    {p.name}
                    {isMe ? ' (You)' : ''}
                  </span>
                  {p.isHost && <Crown className="w-3 h-3 text-[#C5A059] shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono-nums text-[#C9BEA8]">
                  <span>
                    {p.safe ? 'SAFE' : `${p.cardCount} ${p.cardCount === 1 ? 'card' : 'cards'}`}
                  </span>
                  <span>·</span>
                  <span>{p.score} pts</span>
                </div>
                {p.saidUno && p.cardCount <= 2 && (
                  <p className="text-[10px] font-bold text-[#E6C57A]">UNO!</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Felt Card Table Surface with Walnut Trim */}
      <div className="rounded-3xl p-2 sm:p-3 bg-gradient-to-b from-[#493226] to-[#322118] border border-[#5B4031] shadow-2xl">
        <div
          className="rounded-[20px] bg-[#173326] border border-[#C5A059]/30 p-3.5 sm:p-6 min-h-[270px] sm:min-h-[320px] flex flex-col justify-between gap-4 relative overflow-hidden"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at center, rgba(42, 85, 62, 0.55) 0%, rgba(23, 51, 38, 0.96) 75%)',
          }}
        >
          {/* Felt subtle table hairline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 rounded-2xl border border-[#C5A059]/12"
          />

          {/* Center Interactive Game Zone */}
          <div className="relative z-10 flex-1 flex flex-col justify-center">{children}</div>

          {/* Compact Recent Action Feed */}
          {table && table.actionLog.length > 0 && (
            <div className="relative z-10 pt-2 border-t border-[#FAF7F0]/10 flex items-center justify-between gap-3 text-xs text-[#D9CEB8]/90">
              <span className="truncate">
                <strong className="text-[#E6D7B7]">{table.actionLog[0].actorName}:</strong>{' '}
                {table.actionLog[0].text}
              </span>
              {table.actionLog[1] && (
                <span className="hidden md:inline truncate text-[#A8B6AD] max-w-[42%]">
                  {table.actionLog[1].actorName}: {table.actionLog[1].text}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Finished Hand Outcome Panel */}
      {room.phase === 'finished' && table?.outcome && (
        <div className="rounded-3xl bg-[#FAF7F0] text-[#1A1D1B] border border-[#D9CEB8] p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#173326] text-[#C5A059] flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#173326]">
                  {table.outcome.loserUid ? 'Round Over · Gadha Chor Caught' : 'Hand Complete'}
                </h2>
                <p className="text-sm text-[#4A443B] mt-0.5">{table.outcome.reason}</p>
              </div>
            </div>

            {isHost ? (
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={resetBusy}
                  onClick={() => handleOutcomeAction('lobby')}
                  className="min-h-[44px] px-4 rounded-xl border border-[#C8BBA4] bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#3B281E] font-semibold text-sm transition-colors disabled:opacity-60"
                >
                  {t(lang, 'pcReturnLobby')}
                </button>
                <button
                  type="button"
                  disabled={resetBusy}
                  onClick={() => handleOutcomeAction('redeal')}
                  className="min-h-[44px] px-5 rounded-xl bg-[#173326] hover:bg-[#1E4231] text-[#FAF7F0] font-display font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4 text-[#C5A059]" />
                  <span>{t(lang, 'pcPlayAgain')}</span>
                </button>
              </div>
            ) : (
              <p className="text-xs font-medium text-[#6B6254]">
                Waiting for host to deal again or return to lobby...
              </p>
            )}
          </div>

          {/* Revealed Remaining Cards & Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orderedPlayers.map((p) => {
              const isWinner = table.outcome!.winnerUids.includes(p.id);
              const isLoser = table.outcome!.loserUid === p.id;
              const remCards = table.outcome?.revealedHands?.[p.id] || [];
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-3.5 border ${
                    isLoser
                      ? 'bg-[#F8E7E5] border-[#C97B72]'
                      : isWinner
                        ? 'bg-[#E9F1EB] border-[#6A997B]'
                        : 'bg-[#F3EDE0] border-[#DFD4C0]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-display font-bold text-sm text-[#1A1D1B] truncate">
                      {p.name}
                      {isLoser ? ' · Gadha Chor' : isWinner ? ' · Winner' : ''}
                    </span>
                    <span className="font-mono-nums text-xs font-bold text-[#3B281E]">
                      {table.outcome!.scores[p.id] ?? p.score} pts
                    </span>
                  </div>
                  {remCards.length === 0 ? (
                    <p className="text-xs text-[#2B6847] font-semibold">Hand cleared (0 cards)</p>
                  ) : (
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {remCards.slice(0, 8).map((c) =>
                        c.kind === 'uno' ? (
                          <UnoCardView key={c.id} card={c} size="sm" />
                        ) : (
                          <PlayingCardView key={c.id} card={c} size="xs" />
                        )
                      )}
                      {remCards.length > 8 && (
                        <span className="font-mono-nums text-xs text-[#5B5449] pl-1">
                          +{remCards.length - 8}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personal Player Hand Tray */}
      {room.phase === 'playing' && handTray}
    </div>
  );
};
