import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  LogOut,
  Mic,
  MicOff,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { Language } from '../types/game';
import type {
  DrawMessageDoc,
  DrawRoomState,
  DrawSecretDoc,
  DrawStrokeDoc,
} from '../types/drawGuess';
import { Avatar } from '../components/Avatar';
import { DrawCanvas } from '../components/DrawCanvas';
import { t } from '../data/i18n';
import { soundFx } from '../utils/soundFx';

interface DrawGameScreenProps {
  lang: Language;
  room: DrawRoomState;
  myId: string;
  mySecret: DrawSecretDoc | null;
  strokes: DrawStrokeDoc[];
  messages: DrawMessageDoc[];
  speakingIds: Record<string, boolean>;
  voiceEnabled: boolean;
  isMuted: boolean;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onSelectWord: (word: string) => Promise<void>;
  onCreateStroke: (stroke: Omit<DrawStrokeDoc, 'createdAt'>) => Promise<void>;
  onUpdateStrokePoints: (strokeId: string, points: number[]) => Promise<void>;
  onUndoStroke: (strokeId: string) => Promise<void>;
  onClearCanvas: () => Promise<void>;
  onSubmitGuess: (
    text: string
  ) => Promise<{ status: 'correct' | 'close' | 'guess' | 'ignored'; points?: number }>;
  onNextTurn: () => Promise<void>;
  onPlayAgain: () => Promise<void>;
  onBackToLobby: () => Promise<void>;
  onLeaveRoom: () => Promise<void>;
}

export const DrawGameScreen: React.FC<DrawGameScreenProps> = ({
  lang,
  room,
  myId,
  mySecret,
  strokes,
  messages,
  speakingIds,
  voiceEnabled,
  isMuted,
  onToggleVoice,
  onToggleMute,
  onSelectWord,
  onCreateStroke,
  onUpdateStrokePoints,
  onUndoStroke,
  onClearCanvas,
  onSubmitGuess,
  onNextTurn,
  onPlayAgain,
  onBackToLobby,
  onLeaveRoom,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [guessInput, setGuessInput] = useState('');
  const [sendingGuess, setSendingGuess] = useState(false);
  const [closeNotice, setCloseNotice] = useState<string | null>(null);
  const [pickingWord, setPickingWord] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastTickSecRef = useRef<number>(-1);

  const turn = room.turn;
  const isHost = room.hostId === myId;
  const isDrawer = Boolean(turn && turn.drawerUid === myId);
  const drawerPlayer = turn ? room.players[turn.drawerUid] : null;
  const alreadyGuessed = Boolean(turn && turn.guessedBy[myId]);

  // Smooth countdown clock
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!turn) return 0;
    return Math.max(0, Math.ceil((turn.deadlineAt - nowMs) / 1000));
  }, [turn, nowMs]);

  // Subtle tick in final 5 seconds of drawing
  useEffect(() => {
    if (room.phase === 'drawing' && secondsLeft > 0 && secondsLeft <= 5) {
      if (lastTickSecRef.current !== secondsLeft) {
        lastTickSecRef.current = secondsLeft;
        soundFx.countdownTick();
      }
    }
  }, [room.phase, secondsLeft]);

  // Auto-scroll chat feed
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const sortedPlayers = useMemo(() => {
    return Object.values(room.players).sort(
      (a, b) => b.score - a.score || a.joinedAt - b.joinedAt
    );
  }, [room.players]);

  const currentMessages = useMemo(() => {
    if (!turn) return messages;
    return messages.filter((m) => m.turnKey === turn.turnKey);
  }, [messages, turn]);

  const handlePickWord = async (word: string) => {
    if (pickingWord) return;
    setPickingWord(true);
    try {
      soundFx.click();
      await onSelectWord(word);
    } finally {
      setPickingWord(false);
    }
  };

  const handleSendGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = guessInput.trim();
    if (!cleaned || sendingGuess) return;
    setSendingGuess(true);
    setGuessInput('');
    try {
      const res = await onSubmitGuess(cleaned);
      if (res.status === 'correct') {
        soundFx.correctGuess();
        setCloseNotice(null);
      } else if (res.status === 'close') {
        setCloseNotice(`"${cleaned}" — ${t(lang, 'dgCloseGuess')}`);
        window.setTimeout(() => setCloseNotice(null), 2600);
      }
    } finally {
      setSendingGuess(false);
    }
  };

  // Final Podium Screen
  if (room.phase === 'finished') {
    const podium = sortedPlayers.slice(0, 3);
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-6">
        <div className="bg-[#151C2C] border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-amber-300 mx-auto">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t(lang, 'dgGameOverTitle')}
            </h1>
            {podium[0] && (
              <p className="text-sm sm:text-base text-slate-300 mt-2">
                {podium[0].name} {t(lang, 'dgWinsWith')}{' '}
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {podium[0].score}
                </span>{' '}
                {t(lang, 'ptsLabel')}
              </p>
            )}
          </div>

          {/* Ranked Leaderboard */}
          <div className="space-y-2.5 text-left max-w-lg mx-auto">
            {sortedPlayers.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${
                  idx === 0
                    ? 'bg-amber-500/10 border-amber-400/40'
                    : 'bg-[#0B0F17] border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center font-mono text-sm font-bold text-slate-400 tabular-nums">
                    #{idx + 1}
                  </span>
                  <Avatar name={p.name} avatar={p.avatar} size="sm" isHost={p.id === room.hostId} />
                  <span className="text-sm font-semibold text-white truncate">
                    {p.name}
                    {p.id === myId ? ` (${t(lang, 'youLabel')})` : ''}
                  </span>
                </div>
                <span className="font-mono text-base font-bold text-amber-300 tabular-nums shrink-0">
                  {p.score} {t(lang, 'ptsLabel')}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {isHost ? (
              <>
                <button
                  type="button"
                  onClick={() => void onPlayAgain()}
                  className="min-h-[48px] px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-[0.98]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t(lang, 'playAgain')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onBackToLobby()}
                  className="min-h-[48px] px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-display font-semibold text-sm whitespace-nowrap shrink-0 transition-colors"
                >
                  {t(lang, 'dgBackToLobby')}
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-400">{t(lang, 'waitingForHost')}</p>
            )}
            <button
              type="button"
              onClick={() => void onLeaveRoom()}
              className="min-h-[48px] px-5 rounded-2xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm whitespace-nowrap shrink-0 transition-colors"
            >
              {t(lang, 'leaveRoom')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const secretWordVisible =
    isDrawer && mySecret && turn && mySecret.turnKey === turn.turnKey && mySecret.word;
  const wordDisplay =
    room.phase === 'turn_reveal' && turn?.revealedWord
      ? turn.revealedWord
      : secretWordVisible
        ? mySecret.word
        : turn?.hintMask || '';

  const canTypeGuess = room.phase === 'drawing' && !isDrawer && !alreadyGuessed;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Compact Top Game HUD */}
      <div className="bg-[#151C2C] border border-slate-800/90 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Round & Drawer Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-xs font-mono font-bold text-indigo-300 tabular-nums whitespace-nowrap">
            {t(lang, 'roundLabel')} {turn?.roundNumber ?? 1}/{room.settings.rounds}
          </div>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <div className="text-xs text-slate-300 truncate">
            {drawerPlayer ? (
              <>
                <span className="text-white font-semibold">{drawerPlayer.name}</span>{' '}
                {room.phase === 'choosing_word'
                  ? t(lang, 'dgIsChoosing')
                  : t(lang, 'dgIsDrawing')}
              </>
            ) : (
              room.code
            )}
          </div>
        </div>

        {/* Center: Secret Word (drawer) or Masked Blanks (guessers) */}
        <div className="flex-1 min-w-[180px] flex flex-col items-center justify-center text-center">
          {room.phase === 'choosing_word' ? (
            <span className="text-xs font-semibold text-amber-300">
              {isDrawer ? t(lang, 'dgPickYourWord') : t(lang, 'dgWaitingWordPick')}
            </span>
          ) : (
            <div className="flex items-center gap-2.5">
              <span
                className={`font-mono text-base sm:text-xl font-extrabold tracking-[0.16em] ${
                  room.phase === 'turn_reveal'
                    ? 'text-emerald-300'
                    : secretWordVisible
                      ? 'text-amber-300'
                      : 'text-white'
                }`}
              >
                {wordDisplay || '_ _ _ _'}
              </span>
              {turn && turn.wordLengths.length > 0 && !secretWordVisible && room.phase === 'drawing' && (
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  ({turn.wordLengths.join(' ')})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Countdown Timer, Voice, Leave */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`min-h-[38px] px-3 rounded-xl border flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums ${
              room.phase === 'drawing' && secondsLeft <= 10
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                : 'bg-[#0B0F17] border-slate-700/80 text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{secondsLeft}s</span>
          </div>

          <button
            type="button"
            onClick={voiceEnabled ? onToggleMute : onToggleVoice}
            aria-label={voiceEnabled ? (isMuted ? 'Unmute' : 'Mute') : 'Join Voice'}
            className={`min-h-[38px] min-w-[38px] px-2.5 rounded-xl border flex items-center justify-center transition-colors ${
              !voiceEnabled
                ? 'bg-[#0B0F17] border-slate-700/80 text-slate-300 hover:bg-slate-800'
                : isMuted
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
            }`}
          >
            {voiceEnabled && isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => void onLeaveRoom()}
            aria-label={t(lang, 'leaveRoom')}
            className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace: Canvas Left (8 cols) + Scoreboard & Guess Chat Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Canvas Stage */}
        <div className="lg:col-span-8 relative">
          {room.phase === 'choosing_word' ? (
            <div className="rounded-2xl bg-[#151C2C] border border-slate-800 aspect-[16/10] flex flex-col items-center justify-center p-6 text-center space-y-5">
              {isDrawer ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-indigo-300">
                      {t(lang, 'dgYourTurnToDraw')}
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                      {t(lang, 'dgChooseAWord')}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
                    {(mySecret && turn && mySecret.turnKey === turn.turnKey && mySecret.choices.length > 0
                      ? mySecret.choices
                      : []
                    ).map((wordOption) => (
                      <button
                        key={wordOption}
                        type="button"
                        disabled={pickingWord}
                        onClick={() => void handlePickWord(wordOption)}
                        className="min-h-[68px] px-4 py-3 rounded-2xl bg-[#0B0F17] hover:bg-indigo-500 border border-slate-700 hover:border-indigo-400 text-white font-display font-bold text-base transition-all active:scale-[0.98]"
                      >
                        {wordOption}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3 max-w-sm">
                  {drawerPlayer && (
                    <div className="flex justify-center">
                      <Avatar name={drawerPlayer.name} avatar={drawerPlayer.avatar} size="lg" />
                    </div>
                  )}
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                    {drawerPlayer?.name || 'Player'} {t(lang, 'dgIsChoosing')}
                  </h2>
                  <p className="text-xs text-slate-400">{t(lang, 'dgGetReadyToGuess')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <DrawCanvas
                lang={lang}
                canDraw={room.phase === 'drawing' && isDrawer}
                turnKey={turn?.turnKey || ''}
                canvasVersion={turn?.canvasVersion || 0}
                drawerUid={turn?.drawerUid || myId}
                recipientIds={room.playerIds}
                strokes={strokes}
                onCreateStroke={onCreateStroke}
                onUpdateStrokePoints={onUpdateStrokePoints}
                onUndoStroke={onUndoStroke}
                onClearCanvas={onClearCanvas}
              />

              {/* Turn Reveal Overlay */}
              {room.phase === 'turn_reveal' && turn && (
                <div className="absolute inset-0 rounded-2xl bg-[#0B0F17]/88 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <p className="text-xs font-semibold text-indigo-300">
                    {t(lang, 'dgTheWordWas')}
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-emerald-300 tracking-tight">
                    {turn.revealedWord || '—'}
                  </h2>

                  <div className="w-full max-w-sm space-y-1.5 pt-1">
                    {Object.entries(turn.guessedBy)
                      .sort((a, b) => a[1].order - b[1].order)
                      .map(([uid, rec]) => {
                        const pl = room.players[uid];
                        if (!pl) return null;
                        return (
                          <div
                            key={uid}
                            className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#151C2C] border border-slate-800 text-xs"
                          >
                            <span className="font-semibold text-white truncate">{pl.name}</span>
                            <span className="font-mono font-bold text-emerald-300 tabular-nums">
                              +{rec.points}
                            </span>
                          </div>
                        );
                      })}
                    {Object.keys(turn.guessedBy).length === 0 && (
                      <p className="text-xs text-slate-400">{t(lang, 'dgNobodyGuessed')}</p>
                    )}
                  </div>

                  {(isHost || isDrawer) && (
                    <button
                      type="button"
                      onClick={() => void onNextTurn()}
                      className="min-h-[42px] px-5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-display font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
                    >
                      {t(lang, 'dgNextTurnNow')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Scoreboard + Live Guess Chat */}
        <div className="lg:col-span-4 space-y-4">
          {/* Compact Scoreboard */}
          <div className="bg-[#151C2C] border border-slate-800/90 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-300">{t(lang, 'leaderboard')}</span>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {sortedPlayers.length} {t(lang, 'playersCount')}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-0.5">
              {sortedPlayers.map((p, idx) => {
                const pIsDrawer = turn?.drawerUid === p.id;
                const pGuessed = Boolean(turn?.guessedBy[p.id]);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl border ${
                      pGuessed
                        ? 'bg-emerald-500/12 border-emerald-500/35'
                        : pIsDrawer
                          ? 'bg-indigo-500/12 border-indigo-400/35'
                          : 'bg-[#0B0F17] border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-4 text-center font-mono text-[11px] font-bold text-slate-500 tabular-nums">
                        {idx + 1}
                      </span>
                      <Avatar
                        name={p.name}
                        avatar={p.avatar}
                        size="sm"
                        isHost={p.id === room.hostId}
                        isSpeaking={Boolean(speakingIds[p.id])}
                        isMuted={p.isMuted}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          <span className="truncate">{p.name}</span>
                          {pIsDrawer && <Pencil className="w-3 h-3 text-indigo-300 shrink-0" />}
                          {pGuessed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                          {p.score} {t(lang, 'ptsLabel')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guess & Chat Panel */}
          <div className="bg-[#151C2C] border border-slate-800/90 rounded-2xl p-3.5 flex flex-col h-[320px] lg:h-[360px]">
            <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-800/80">
              <span className="text-xs font-semibold text-slate-300">{t(lang, 'dgGuessesTitle')}</span>
              {alreadyGuessed && room.phase === 'drawing' && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t(lang, 'dgYouGuessedIt')}</span>
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto py-2.5 space-y-1.5 pr-1">
              {currentMessages.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">
                  {t(lang, 'dgEmptyChatHint')}
                </p>
              )}

              {currentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`px-3 py-2 rounded-xl text-xs leading-snug ${
                    msg.kind === 'correct'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 font-semibold'
                      : 'bg-[#0B0F17] text-slate-200'
                  }`}
                >
                  {msg.kind === 'correct' ? (
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {msg.senderName} {t(lang, 'dgGuessedTheWord')}
                      </span>
                      {typeof msg.points === 'number' && (
                        <span className="font-mono font-bold text-emerald-300 tabular-nums shrink-0">
                          +{msg.points}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>
                      <span className="font-semibold text-indigo-300">{msg.senderName}: </span>
                      <span className="break-words">{msg.text}</span>
                    </span>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {closeNotice && (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-200 text-xs font-semibold">
                {closeNotice}
              </div>
            )}

            <form onSubmit={handleSendGuess} className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <input
                type="text"
                maxLength={80}
                disabled={!canTypeGuess || sendingGuess}
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder={
                  isDrawer
                    ? t(lang, 'dgDrawerChatDisabled')
                    : alreadyGuessed
                      ? t(lang, 'dgAlreadyGuessedInput')
                      : room.phase === 'drawing'
                        ? t(lang, 'dgTypeGuessPlaceholder')
                        : t(lang, 'dgWaitForTurnInput')
                }
                className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-[#0B0F17] border border-slate-700/80 disabled:opacity-50 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              />
              <button
                type="submit"
                disabled={!canTypeGuess || sendingGuess || !guessInput.trim()}
                aria-label="Send guess"
                className="h-11 w-11 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
