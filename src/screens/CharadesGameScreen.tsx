import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  Home,
  LogOut,
  Mic,
  MicOff,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import {
  CharadesDifficulty,
  CharadesPlayer,
  CharadesPrivateMovie,
  CharadesRoomState,
  CharadesTeamId,
} from '../types/charades';
import { Language } from '../types/game';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { CharadesVideoStage } from '../components/CharadesVideoStage';
import { CharadesMovieSelector } from '../components/CharadesMovieSelector';
import { CharadesCelebrationOverlay } from '../components/CharadesCelebrationOverlay';
import { soundFx } from '../utils/soundFx';

interface CharadesGameScreenProps {
  lang: Language;
  room: CharadesRoomState;
  myId: string;
  privateMovie: CharadesPrivateMovie | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerStates: Record<string, RTCPeerConnectionState>;
  speakingIds: Record<string, boolean>;
  cameraOn: boolean;
  micOn: boolean;
  facingMode: 'user' | 'environment';
  mediaNotice: string | null;
  onToggleCamera: () => Promise<void>;
  onToggleMic: () => Promise<void>;
  onSwitchCamera: () => Promise<void>;
  onAssignMovie: (payload: {
    title: string;
    category: string;
    language: string;
    difficulty: CharadesDifficulty;
    hintsEnabled: boolean;
  }) => Promise<void>;
  onUpdateHostPatch: (patch: Record<string, unknown>) => Promise<void>;
  onUpdateMovieMeta: (meta: NonNullable<CharadesRoomState['movieMeta']>) => Promise<void>;
  onMarkWrongGuess: () => Promise<void>;
  onRevealMovie: (options: {
    outcome: 'guessed' | 'revealed';
    winnerUid?: string | null;
    winnerTeam?: CharadesTeamId | null;
    winnerName?: string;
  }) => Promise<void>;
  onStartRoundSetup: (config: {
    actingTeam: CharadesTeamId | null;
    guessingTeam: CharadesTeamId | null;
    actorIds: string[];
    movieGiverId: string;
    guesserIds: string[];
  }) => Promise<void>;
  onBackToLobby: () => Promise<void>;
  onRestartMatch: () => Promise<void>;
  onLeaveRoom: () => Promise<void>;
}

export const CharadesGameScreen: React.FC<CharadesGameScreenProps> = ({
  lang,
  room,
  myId,
  privateMovie,
  localStream,
  remoteStreams,
  peerStates,
  speakingIds,
  cameraOn,
  micOn,
  facingMode,
  mediaNotice,
  onToggleCamera,
  onToggleMic,
  onSwitchCamera,
  onAssignMovie,
  onUpdateHostPatch,
  onUpdateMovieMeta,
  onMarkWrongGuess,
  onRevealMovie,
  onStartRoundSetup,
  onBackToLobby,
  onRestartMatch,
  onLeaveRoom,
}) => {
  const isHost = room.hostId === myId;
  const isMovieGiver = room.movieGiverId === myId;
  const isActor = room.actorIds.includes(myId);

  const [layoutMode, setLayoutMode] = useState<'acting' | 'all'>('acting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [assigningMovie, setAssigningMovie] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showWinnerPicker, setShowWinnerPicker] = useState(false);
  const [showNextRoundConfig, setShowNextRoundConfig] = useState(false);

  // Next round setup state for Host
  const [nextActingTeam, setNextActingTeam] = useState<CharadesTeamId>(
    room.actingTeam === 'A' ? 'B' : 'A'
  );
  const [nextActorIds, setNextActorIds] = useState<string[]>([]);
  const [nextGiverId, setNextGiverId] = useState<string>(room.movieGiverId ?? room.hostId);

  const players = room.playerIds
    .map((id) => room.players[id])
    .filter((p): p is CharadesPlayer => Boolean(p))
    .sort((a, b) => a.joinedAt - b.joinedAt);

  const actorPlayers = room.actorIds
    .map((id) => room.players[id])
    .filter((p): p is CharadesPlayer => Boolean(p));

  const movieGiver = room.movieGiverId ? room.players[room.movieGiverId] ?? null : null;

  const guesserPlayers =
    room.mode === 'team' && room.guessingTeam
      ? players.filter((p) => p.team === room.guessingTeam)
      : room.guesserIds.length > 0
        ? players.filter((p) => room.guesserIds.includes(p.id))
        : players.filter((p) => !room.actorIds.includes(p.id) && p.id !== room.movieGiverId);

  // Sound cues synchronized with room state transitions
  const prevPhaseRef = useRef(room.phase);
  const prevWrongCountRef = useRef(room.guessFeedback.count);

  useEffect(() => {
    if (prevPhaseRef.current !== room.phase) {
      if (room.phase === 'acting') {
        soundFx.clapboard();
      } else if (room.phase === 'revealed') {
        if (room.revealedMovie?.outcome === 'guessed') {
          soundFx.movieWin();
        } else {
          soundFx.reveal();
        }
      }
      prevPhaseRef.current = room.phase;
    }
  }, [room.phase, room.revealedMovie?.outcome]);

  useEffect(() => {
    if (room.guessFeedback.count > prevWrongCountRef.current) {
      soundFx.wrongGuess();
    }
    prevWrongCountRef.current = room.guessFeedback.count;
  }, [room.guessFeedback.count]);

  const handleAssignSubmit = async (payload: {
    title: string;
    category: string;
    language: string;
    difficulty: CharadesDifficulty;
    hintsEnabled: boolean;
  }) => {
    setAssigningMovie(true);
    try {
      await onAssignMovie(payload);
    } finally {
      setAssigningMovie(false);
    }
  };

  const handleToggleWordCompleted = async (idx: number) => {
    if (!room.movieMeta) return;
    const nextCompleted = room.movieMeta.completedWords.map((val, i) =>
      i === idx ? !val : val
    );
    if (nextCompleted[idx]) {
      soundFx.wordComplete();
    } else {
      soundFx.click();
    }
    await onUpdateMovieMeta({
      ...room.movieMeta,
      completedWords: nextCompleted,
    });
  };

  const handleMarkAllWords = async (value: boolean) => {
    if (!room.movieMeta) return;
    if (value) soundFx.wordComplete();
    else soundFx.click();
    await onUpdateMovieMeta({
      ...room.movieMeta,
      completedWords: room.movieMeta.completedWords.map(() => value),
    });
  };

  const handleToggleHintsVisible = async () => {
    if (!room.movieMeta) return;
    await onUpdateMovieMeta({
      ...room.movieMeta,
      hintsEnabled: !room.movieMeta.hintsEnabled,
    });
  };

  const handleCorrectClick = async () => {
    if (!privateMovie) return;
    if (room.mode === 'team') {
      const winTeam = room.guessingTeam ?? (room.actingTeam === 'A' ? 'B' : 'A');
      await onRevealMovie({
        outcome: 'guessed',
        winnerTeam: winTeam,
        winnerName: room.teamNames[winTeam],
      });
    } else {
      setShowWinnerPicker(true);
    }
  };

  const openNextRoundConfigurator = () => {
    const swappedTeam: CharadesTeamId = room.actingTeam === 'A' ? 'B' : 'A';
    setNextActingTeam(swappedTeam);
    if (room.mode === 'team') {
      const nextTeamPlayers = players.filter((p) => p.team === swappedTeam);
      const otherTeamPlayers = players.filter((p) => p.team !== swappedTeam);
      setNextActorIds(nextTeamPlayers[0] ? [nextTeamPlayers[0].id] : players[0] ? [players[0].id] : []);
      setNextGiverId(otherTeamPlayers[0]?.id ?? room.hostId);
    } else {
      const idx = players.findIndex((p) => room.actorIds.includes(p.id));
      const nextActor = players[(idx + 1) % Math.max(players.length, 1)];
      const nextGiver = players[(idx + 2) % Math.max(players.length, 1)] ?? players[0];
      setNextActorIds(nextActor ? [nextActor.id] : []);
      setNextGiverId(nextGiver?.id ?? room.hostId);
    }
    setShowNextRoundConfig(true);
  };

  const handleConfirmNextRound = async () => {
    const actingPool =
      room.mode === 'team'
        ? players.filter((p) => p.team === nextActingTeam)
        : players;
    const actors =
      nextActorIds.length > 0
        ? nextActorIds
        : actingPool[0]
          ? [actingPool[0].id]
          : players[0]
            ? [players[0].id]
            : [];
    const guessingTeam: CharadesTeamId = nextActingTeam === 'A' ? 'B' : 'A';
    const guessers =
      room.mode === 'team'
        ? players.filter((p) => p.team === guessingTeam).map((p) => p.id)
        : players.filter((p) => !actors.includes(p.id) && p.id !== nextGiverId).map((p) => p.id);

    setShowNextRoundConfig(false);
    await onStartRoundSetup({
      actingTeam: room.mode === 'team' ? nextActingTeam : null,
      guessingTeam: room.mode === 'team' ? guessingTeam : null,
      actorIds: actors,
      movieGiverId: nextGiverId,
      guesserIds: guessers,
    });
  };

  const canDecideRound = Boolean(privateMovie) && (isMovieGiver || isHost);

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#0D0618] overflow-y-auto p-3 sm:p-5 space-y-4'
          : 'max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 space-y-5'
      }`}
    >
      {/* Top Status & Score Strip */}
      <div className="rounded-2xl bg-[#180C29] border border-amber-500/25 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
          <span className="font-display font-extrabold text-amber-300 flex items-center gap-1.5">
            <Film className="w-4 h-4" />
            <span>Round {room.roundNumber}</span>
          </span>
          <span aria-hidden="true" className="text-white/25">·</span>
          <span className="text-amber-100/80 font-medium">
            {room.mode === 'team'
              ? `${room.teamNames.A} ${room.scores.teamA} — ${room.scores.teamB} ${room.teamNames.B}`
              : t(lang, 'dcIndividualMode')}
          </span>
          <span aria-hidden="true" className="text-white/25">·</span>
          <span className="text-amber-100/65">{players.length} online</span>
        </div>

        <div className="flex items-center gap-2">
          {isHost && (room.phase === 'acting' || room.phase === 'paused') && (
            <button
              type="button"
              onClick={() =>
                onUpdateHostPatch(
                  room.phase === 'paused'
                    ? { phase: room.pausedFromPhase ?? 'acting', pausedFromPhase: null }
                    : { phase: 'paused', pausedFromPhase: room.phase }
                )
              }
              className="min-h-[38px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-amber-100 flex items-center gap-1.5"
            >
              {room.phase === 'paused' ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t(lang, 'dcResume')}</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-300" />
                  <span>{t(lang, 'dcPause')}</span>
                </>
              )}
            </button>
          )}

          {isHost && (
            <button
              type="button"
              onClick={onBackToLobby}
              className="min-h-[38px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-amber-100 flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(lang, 'dcBackToLobby')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="min-h-[38px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t(lang, 'leaveRoom')}</span>
          </button>
        </div>
      </div>

      {mediaNotice && (
        <div className="rounded-2xl bg-amber-500/15 border border-amber-400/35 px-4 py-2.5 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{mediaNotice}</span>
        </div>
      )}

      {/* Paused Banner */}
      {room.phase === 'paused' && (
        <div className="rounded-3xl bg-amber-500/15 border-2 border-amber-400/50 p-6 text-center space-y-3">
          <p className="font-display text-2xl font-extrabold text-amber-200">
            ⏸️ {t(lang, 'dcPausedBanner')}
          </p>
          {isHost && (
            <button
              type="button"
              onClick={() =>
                onUpdateHostPatch({
                  phase: room.pausedFromPhase ?? 'acting',
                  pausedFromPhase: null,
                })
              }
              className="min-h-[46px] px-6 rounded-2xl bg-amber-400 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t(lang, 'dcResume')}</span>
            </button>
          )}
        </div>
      )}

      {/* Phase: Selecting Movie */}
      {room.phase === 'selecting_movie' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7">
            {isMovieGiver ? (
              <CharadesMovieSelector
                lang={lang}
                room={room}
                actorPlayers={actorPlayers}
                allPlayers={players}
                submitting={assigningMovie}
                onChangeTargetActor={
                  room.mode === 'individual'
                    ? (actorId) => {
                        const guessers = players
                          .filter((p) => p.id !== actorId && p.id !== myId)
                          .map((p) => p.id);
                        onUpdateHostPatch({ actorIds: [actorId], guesserIds: guessers });
                      }
                    : undefined
                }
                onAssignMovie={handleAssignSubmit}
              />
            ) : (
              <div className="rounded-3xl bg-[#180C29] border border-amber-500/30 p-7 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto">
                  <Clapperboard className="w-8 h-8" />
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white">
                  {movieGiver ? `${movieGiver.name} is picking a movie...` : t(lang, 'dcWaitingMoviePick')}
                </h2>
                <p className="text-sm text-amber-100/75 max-w-md mx-auto">
                  {isActor
                    ? lang === 'hi'
                      ? 'कैमरे के सामने तैयार हो जाएँ — मूवी सीधे आपकी स्क्रीन पर भेजी जाएगी!'
                      : 'Get ready in front of your camera — the secret movie will appear privately on your screen!'
                    : lang === 'hi'
                      ? 'अनुमान लगाने के लिए तैयार रहें! मूवी का नाम गुप्त रहेगा।'
                      : 'Get ready to guess over live voice! The title stays completely secret.'}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <CharadesVideoStage
              lang={lang}
              room={room}
              myId={myId}
              localStream={localStream}
              remoteStreams={remoteStreams}
              peerStates={peerStates}
              speakingIds={speakingIds}
              cameraOn={cameraOn}
              facingMode={facingMode}
              layoutMode="all"
              isFullscreen={false}
              onToggleFullscreen={() => setIsFullscreen((v) => !v)}
              onToggleLayout={() => setLayoutMode((m) => (m === 'acting' ? 'all' : 'acting'))}
            />
          </div>
        </div>
      )}

      {/* Phase: Acting & Live Guessing */}
      {(room.phase === 'acting' || room.phase === 'paused') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 8 Cols: Live Video Stage + Private Secret Word Controls */}
          <div className="lg:col-span-8 space-y-4">
            <CharadesVideoStage
              lang={lang}
              room={room}
              myId={myId}
              localStream={localStream}
              remoteStreams={remoteStreams}
              peerStates={peerStates}
              speakingIds={speakingIds}
              cameraOn={cameraOn}
              facingMode={facingMode}
              layoutMode={layoutMode}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((v) => !v)}
              onToggleLayout={() => setLayoutMode((m) => (m === 'acting' ? 'all' : 'acting'))}
            />

            {/* PRIVATE MOVIE PANEL: Strictly rendered ONLY when privateMovie exists (Actor / Movie Giver) */}
            {privateMovie && (
              <section className="rounded-3xl bg-gradient-to-br from-[#2B123F] via-[#1C0C2C] to-[#130820] border-2 border-amber-400/50 p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {t(lang, 'dcPrivateMovieTitle')} ·{' '}
                        {isActor
                          ? lang === 'hi'
                            ? 'केवल आपको और मूवी देने वाले को दिखता है'
                            : 'Visible only to Actor & Movie Giver'
                          : lang === 'hi'
                            ? 'गुप्त मूवी'
                            : 'Movie Giver View'}
                      </span>
                    </p>
                    <h3 className="font-display text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                      {privateMovie.title}
                    </h3>
                    <p className="text-xs text-amber-100/70 mt-0.5">
                      {privateMovie.category} · {privateMovie.language} · {privateMovie.difficulty}
                    </p>
                  </div>

                  {room.movieMeta && (
                    <button
                      type="button"
                      onClick={handleToggleHintsVisible}
                      className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        room.movieMeta.hintsEnabled
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                          : 'bg-white/5 border-white/15 text-amber-100/70'
                      }`}
                    >
                      {room.movieMeta.hintsEnabled ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                      <span>
                        {room.movieMeta.hintsEnabled ? 'Hints Visible' : 'Hints Hidden'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Interactive Word Completion Tiles */}
                {room.movieMeta && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-amber-200/80">
                        {lang === 'hi'
                          ? 'जो शब्द गेस हो जाए उस पर टैप करें:'
                          : 'Tap any word to mark it completed for guessers:'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleMarkAllWords(true)}
                          className="min-h-[34px] px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold"
                        >
                          Mark All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkAllWords(false)}
                          className="min-h-[34px] px-3 rounded-lg bg-white/10 hover:bg-white/15 text-amber-100 text-xs font-bold"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {privateMovie.words.map((word, idx) => {
                        const done = Boolean(room.movieMeta?.completedWords[idx]);
                        return (
                          <button
                            key={`${word}_${idx}`}
                            type="button"
                            onClick={() => handleToggleWordCompleted(idx)}
                            className={`min-h-[48px] px-4 py-2 rounded-2xl border-2 font-display font-extrabold text-sm sm:text-base flex items-center gap-2 transition-all active:scale-95 ${
                              done
                                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 shadow-lg shadow-emerald-500/15'
                                : 'bg-black/40 hover:bg-white/10 border-amber-400/40 text-white'
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-amber-300/60" />
                            )}
                            <span>{word}</span>
                            <span className="text-xs font-mono-nums text-amber-300/80">
                              ({room.movieMeta?.wordLengths[idx] ?? word.length})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Movie Giver Round Judgment Controls */}
                {canDecideRound && (
                  <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={handleCorrectClick}
                      className="min-h-[50px] px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>{t(lang, 'dcCorrectGuess')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onMarkWrongGuess}
                      className="min-h-[50px] px-4 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>{t(lang, 'dcWrongGuess')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRevealMovie({ outcome: 'revealed' })}
                      className="min-h-[50px] px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-amber-100 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-amber-300" />
                      <span>{t(lang, 'dcRevealAnswer')}</span>
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Right 4 Cols: Public Hints, Wrong Guess Feedback & Guessing Team Strip */}
          <aside className="lg:col-span-4 space-y-4">
            {/* Wrong Guess Feedback Banner */}
            {room.guessFeedback.status === 'wrong' && room.guessFeedback.count > 0 && (
              <div className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-4 py-3 flex items-center justify-between gap-2 text-rose-100">
                <div className="flex items-center gap-2 text-sm font-display font-bold">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>
                    {lang === 'hi'
                      ? 'गलत अनुमान — एक्टिंग जारी रखें!'
                      : 'Wrong Guess — Keep Guessing!'}
                  </span>
                </div>
                <span className="font-mono-nums text-xs font-bold text-rose-300">
                  #{room.guessFeedback.count}
                </span>
              </div>
            )}

            {/* Public Movie Hint Card (Never exposes movie title) */}
            <section className="rounded-3xl bg-[#180C29] border border-amber-500/25 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-extrabold text-white">
                  {lang === 'hi' ? 'मूवी संकेत' : 'Movie Clues'}
                </h3>
                {room.movieMeta && (
                  <span className="font-mono-nums text-xs font-bold text-amber-300">
                    {room.movieMeta.wordCount}{' '}
                    {room.movieMeta.wordCount === 1 ? 'Word' : 'Words'}
                  </span>
                )}
              </div>

              {!room.movieMeta ? (
                <p className="text-xs text-amber-100/60">Waiting for movie hints...</p>
              ) : !room.movieMeta.hintsEnabled ? (
                <p className="text-xs text-amber-100/70">
                  {lang === 'hi'
                    ? 'इस राउंड में शब्द हिंट्स छिपाए गए हैं — सीधे एक्टिंग देखकर पहचानें!'
                    : 'Word hints are hidden for this round — watch the acting closely!'}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-amber-200/80">
                    {room.movieMeta.category} · {room.movieMeta.language} ·{' '}
                    {room.movieMeta.difficulty}
                  </p>

                  <div className="space-y-2">
                    {room.movieMeta.wordLengths.map((len, idx) => {
                      const done = Boolean(room.movieMeta?.completedWords[idx]);
                      return (
                        <div
                          key={idx}
                          className={`rounded-2xl px-3.5 py-2.5 border flex items-center justify-between gap-2 ${
                            done
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                              : 'bg-black/30 border-white/10 text-amber-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {done ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                            )}
                            <span className="font-display font-bold text-sm">
                              Word {idx + 1}:{' '}
                              <span className="font-mono-nums text-amber-300">
                                {len} {len === 1 ? 'char' : 'letters'}
                              </span>
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold">
                            {done ? t(lang, 'dcWordCompleted') : t(lang, 'dcWordPending')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Guessers & Voice Strip */}
            <section className="rounded-3xl bg-[#180C29] border border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>
                    {room.mode === 'team' && room.guessingTeam
                      ? `${room.teamNames[room.guessingTeam]} (Guessing)`
                      : 'Guessing Players'}
                  </span>
                </h3>
                {movieGiver && (
                  <span className="text-[11px] text-amber-100/60">
                    Giver: {movieGiver.name}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {guesserPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl bg-black/30 border border-white/10 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={p.name}
                        avatar={p.avatar}
                        size="sm"
                        isSpeaking={Boolean(speakingIds[p.id])}
                        isMuted={!p.micEnabled || p.isMuted}
                        isHost={p.isHost}
                      />
                      <span className="font-display font-semibold text-sm text-white truncate">
                        {p.name}
                        {p.id === myId ? ` (${t(lang, 'youLabel')})` : ''}
                      </span>
                    </div>
                    <span className="text-xs font-mono-nums text-amber-300">
                      {room.mode === 'individual' ? `${room.scores.players[p.id] ?? 0} pts` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* Phase: Revealed & Celebration */}
      {room.phase === 'revealed' && (
        <div className="space-y-6">
          <CharadesCelebrationOverlay
            lang={lang}
            room={room}
            isHost={isHost}
            onConfigureNextRound={openNextRoundConfigurator}
            onBackToLobby={onBackToLobby}
            onRestartMatch={onRestartMatch}
          />

          <CharadesVideoStage
            lang={lang}
            room={room}
            myId={myId}
            localStream={localStream}
            remoteStreams={remoteStreams}
            peerStates={peerStates}
            speakingIds={speakingIds}
            cameraOn={cameraOn}
            facingMode={facingMode}
            layoutMode="all"
            isFullscreen={false}
            onToggleFullscreen={() => {}}
            onToggleLayout={() => {}}
          />
        </div>
      )}

      {/* Sticky Bottom Media Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md rounded-2xl bg-[#190C2B]/95 backdrop-blur-md border border-amber-500/35 px-3 py-2.5 shadow-2xl flex items-center justify-around gap-2">
        <button
          type="button"
          onClick={onToggleMic}
          className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
            micOn
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
              : 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
          }`}
        >
          {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span>{micOn ? t(lang, 'micOn') : t(lang, 'micMuted')}</span>
        </button>

        <button
          type="button"
          onClick={onToggleCamera}
          className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
            cameraOn
              ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
              : 'bg-white/10 text-slate-300 border border-white/15'
          }`}
        >
          {cameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          <span>{cameraOn ? t(lang, 'dcCamOn') : t(lang, 'dcCamOff')}</span>
        </button>

        <button
          type="button"
          onClick={onSwitchCamera}
          className="min-h-[44px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-amber-100 text-xs font-bold flex items-center justify-center gap-1.5"
          aria-label="Switch front or back camera"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">{t(lang, 'dcSwitchCam')}</span>
        </button>
      </div>

      {/* Individual Mode Winner Picker Modal */}
      {showWinnerPicker && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#1A0D2E] border border-amber-400/40 p-6 space-y-4 shadow-2xl">
            <h3 className="font-display text-xl font-extrabold text-white">
              {lang === 'hi' ? 'किसने सही मूवी पहचानी?' : 'Who Guessed the Movie?'}
            </h3>
            <p className="text-xs text-amber-100/70">
              {lang === 'hi'
                ? 'पॉइंट देने और सेलिब्रेशन शुरू करने के लिए खिलाड़ी चुनें:'
                : 'Select the winning guesser to award points & celebrate:'}
            </p>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
              {players
                .filter((p) => !room.actorIds.includes(p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={async () => {
                      setShowWinnerPicker(false);
                      await onRevealMovie({
                        outcome: 'guessed',
                        winnerUid: p.id,
                        winnerName: p.name,
                      });
                    }}
                    className="min-h-[48px] px-4 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-left font-display font-bold text-sm text-white flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <Trophy className="w-4 h-4 text-emerald-400" />
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setShowWinnerPicker(false)}
              className="w-full min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 text-amber-100 text-sm font-semibold"
            >
              {t(lang, 'gtaCancel')}
            </button>
          </div>
        </div>
      )}

      {/* Host Next Round Configuration Modal */}
      {showNextRoundConfig && isHost && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-3xl bg-[#1A0D2E] border border-amber-400/40 p-6 space-y-5 shadow-2xl">
            <h3 className="font-display text-xl font-extrabold text-white">
              {t(lang, 'dcNextRound')}
            </h3>

            {room.mode === 'team' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-200">{t(lang, 'dcActingTeam')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNextActingTeam('A');
                      const firstA = players.find((p) => p.team === 'A');
                      const firstB = players.find((p) => p.team === 'B');
                      if (firstA) setNextActorIds([firstA.id]);
                      if (firstB) setNextGiverId(firstB.id);
                    }}
                    className={`min-h-[42px] rounded-xl text-xs font-bold ${
                      nextActingTeam === 'A'
                        ? 'bg-rose-500 text-white'
                        : 'bg-white/5 text-amber-100 border border-white/10'
                    }`}
                  >
                    {room.teamNames.A}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNextActingTeam('B');
                      const firstB = players.find((p) => p.team === 'B');
                      const firstA = players.find((p) => p.team === 'A');
                      if (firstB) setNextActorIds([firstB.id]);
                      if (firstA) setNextGiverId(firstA.id);
                    }}
                    className={`min-h-[42px] rounded-xl text-xs font-bold ${
                      nextActingTeam === 'B'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white/5 text-amber-100 border border-white/10'
                    }`}
                  >
                    {room.teamNames.B}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-200">{t(lang, 'dcSelectActor')}</p>
              <div className="flex flex-wrap gap-2">
                {(room.mode === 'team'
                  ? players.filter((p) => p.team === nextActingTeam)
                  : players
                ).map((p) => {
                  const selected = nextActorIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setNextActorIds((prev) =>
                          room.mode === 'individual'
                            ? [p.id]
                            : prev.includes(p.id)
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id]
                        )
                      }
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-bold ${
                        selected
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/5 text-amber-100 border border-white/10'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-200">{t(lang, 'dcSelectGiver')}</p>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setNextGiverId(p.id)}
                    className={`min-h-[38px] px-3 rounded-xl text-xs font-bold ${
                      nextGiverId === p.id
                        ? 'bg-rose-500 text-white'
                        : 'bg-white/5 text-amber-100 border border-white/10'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmNextRound}
                className="flex-1 min-h-[48px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t(lang, 'dcStartRound')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNextRoundConfig(false)}
                className="min-h-[48px] px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-amber-100 text-sm font-semibold"
              >
                {t(lang, 'gtaCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Room Confirmation Modal */}
      {showLeaveConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#1A0D2E] border border-white/15 p-6 space-y-4 shadow-2xl">
            <h3 className="font-display text-lg font-extrabold text-white">
              {t(lang, 'gtaExitTitle')}
            </h3>
            <p className="text-xs text-amber-100/75 leading-relaxed">
              {lang === 'hi'
                ? 'रूम छोड़ने से आपका कैमरा और माइक बंद हो जाएगा।'
                : 'Leaving the room will disconnect your camera and microphone.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setShowLeaveConfirm(false);
                  await onLeaveRoom();
                }}
                className="flex-1 min-h-[46px] rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-sm"
              >
                {t(lang, 'leaveRoom')}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 min-h-[46px] rounded-2xl bg-white/10 hover:bg-white/15 text-amber-100 font-display font-bold text-sm"
              >
                {t(lang, 'gtaCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
