import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  Clapperboard,
  Copy,
  Crown,
  Link2,
  LogOut,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  Shield,
  UserMinus,
  Users,
  Video,
} from 'lucide-react';
import {
  CharadesMode,
  CharadesPlayer,
  CharadesReactionEvent,
  CharadesRoomState,
  CharadesTeamId,
} from '../types/charades';
import { Language } from '../types/game';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { CharadesReactionOverlay } from '../components/CharadesReactionOverlay';
import { MediaPermissionState } from '../hooks/useCharadesMedia';

interface CharadesLobbyScreenProps {
  lang: Language;
  room: CharadesRoomState;
  myId: string;
  localStream: MediaStream | null;
  cameraOn: boolean;
  micOn: boolean;
  camStatus: MediaPermissionState;
  micStatus: MediaPermissionState;
  facingMode: 'user' | 'environment';
  turnConfigured: boolean;
  mediaNotice: string | null;
  speakingIds: Record<string, boolean>;
  reactions?: CharadesReactionEvent[];
  onStartCameraAndMic: () => Promise<void>;
  onToggleCamera: () => Promise<void>;
  onToggleMic: () => Promise<void>;
  onSwitchCamera: () => Promise<void>;
  onUpdateHostPatch: (patch: Record<string, unknown>) => Promise<void>;
  onStartRound: (config: {
    actingTeam: CharadesTeamId | null;
    guessingTeam: CharadesTeamId | null;
    actorIds: string[];
    movieGiverId: string;
    guesserIds: string[];
  }) => Promise<void>;
  onRemoveDisconnected: (targetUid: string) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
}

export const CharadesLobbyScreen: React.FC<CharadesLobbyScreenProps> = ({
  lang,
  room,
  myId,
  localStream,
  cameraOn,
  micOn,
  camStatus,
  micStatus,
  facingMode,
  turnConfigured,
  mediaNotice,
  speakingIds,
  reactions = [],
  onStartCameraAndMic,
  onToggleCamera,
  onToggleMic,
  onSwitchCamera,
  onUpdateHostPatch,
  onStartRound,
  onRemoveDisconnected,
  onLeaveRoom,
}) => {
  const isHost = room.hostId === myId;
  const players = room.playerIds
    .map((id) => room.players[id])
    .filter((p): p is CharadesPlayer => Boolean(p))
    .sort((a, b) => a.joinedAt - b.joinedAt);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Local editable team names synced to Firestore cleanly
  const [teamAInput, setTeamAInput] = useState(room.teamNames.A);
  const [teamBInput, setTeamBInput] = useState(room.teamNames.B);

  useEffect(() => {
    setTeamAInput(room.teamNames.A);
    setTeamBInput(room.teamNames.B);
  }, [room.teamNames.A, room.teamNames.B]);

  // Round starter selections (Host controls)
  const [actingTeam, setActingTeam] = useState<CharadesTeamId>(room.actingTeam ?? 'A');
  const [selectedActorIds, setSelectedActorIds] = useState<string[]>(
    room.actorIds.length > 0 ? room.actorIds : players[0] ? [players[0].id] : []
  );
  const [selectedGiverId, setSelectedGiverId] = useState<string>(
    room.movieGiverId ?? players[1]?.id ?? players[0]?.id ?? myId
  );
  const [selectedGuesserIds, setSelectedGuesserIds] = useState<string[]>(
    room.guesserIds.length > 0 ? room.guesserIds : []
  );
  const [startingRound, setStartingRound] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = previewVideoRef.current;
    if (!el) return;
    if (el.srcObject !== localStream) {
      el.srcObject = localStream;
    }
    if (localStream) {
      el.play().catch(() => {});
    }
  }, [localStream, cameraOn]);

  // Keep selections valid if players leave
  useEffect(() => {
    const validSet = new Set(room.playerIds);
    setSelectedActorIds((prev) => prev.filter((id) => validSet.has(id)));
    if (!validSet.has(selectedGiverId) && room.playerIds[0]) {
      setSelectedGiverId(room.playerIds[0]);
    }
    setSelectedGuesserIds((prev) => prev.filter((id) => validSet.has(id)));
  }, [room.playerIds, selectedGiverId]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?charades=${room.code}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSaveTeamName = (team: CharadesTeamId, val: string) => {
    const cleaned = val.trim() || (team === 'A' ? 'Team A' : 'Team B');
    if (cleaned !== room.teamNames[team]) {
      onUpdateHostPatch({ [`teamNames.${team}`]: cleaned });
    }
  };

  const handleAssignTeam = (uid: string, team: CharadesTeamId | null) => {
    onUpdateHostPatch({ [`players.${uid}.team`]: team });
  };

  const handleModeChange = (mode: CharadesMode) => {
    onUpdateHostPatch({ mode });
  };

  const teamAPlayers = players.filter((p) => p.team === 'A');
  const teamBPlayers = players.filter((p) => p.team === 'B');
  const guessingTeam: CharadesTeamId = actingTeam === 'A' ? 'B' : 'A';

  const actingPool =
    room.mode === 'team'
      ? actingTeam === 'A'
        ? teamAPlayers
        : teamBPlayers
      : players;

  const toggleActorSelection = (uid: string) => {
    if (room.mode === 'individual') {
      setSelectedActorIds([uid]);
      return;
    }
    setSelectedActorIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const toggleGuesserSelection = (uid: string) => {
    setSelectedGuesserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const resolvedActors =
    selectedActorIds.length > 0
      ? selectedActorIds
      : actingPool[0]
        ? [actingPool[0].id]
        : players[0]
          ? [players[0].id]
          : [];

  const resolvedGuessers =
    room.mode === 'team'
      ? (guessingTeam === 'A' ? teamAPlayers : teamBPlayers).map((p) => p.id)
      : selectedGuesserIds.length > 0
        ? selectedGuesserIds
        : players
            .filter((p) => !resolvedActors.includes(p.id) && p.id !== selectedGiverId)
            .map((p) => p.id);

  const canStartRound =
    isHost && players.length >= 2 && resolvedActors.length >= 1 && Boolean(selectedGiverId);

  const handleStartRoundClick = async () => {
    if (!canStartRound || startingRound) return;
    setStartingRound(true);
    try {
      await onStartRound({
        actingTeam: room.mode === 'team' ? actingTeam : null,
        guessingTeam: room.mode === 'team' ? guessingTeam : null,
        actorIds: resolvedActors,
        movieGiverId: selectedGiverId,
        guesserIds: resolvedGuessers,
      });
    } finally {
      setStartingRound(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-8 space-y-6">
      {/* Top Cinema Room Header */}
      <div className="rounded-3xl bg-gradient-to-r from-[#2A0E2D] via-[#1B0C2B] to-[#130821] border border-amber-500/30 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Clapperboard className="w-4 h-4" />
            <span>{t(lang, 'dcLobbyTitle')}</span>
            <span aria-hidden="true">·</span>
            <span>
              {room.mode === 'team' ? t(lang, 'dcTeamMode') : t(lang, 'dcIndividualMode')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono-nums text-3xl sm:text-4xl font-black tracking-[0.2em] text-amber-300">
              {room.code}
            </h1>
            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{copiedCode ? t(lang, 'copied') : t(lang, 'copyCode')}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="min-h-[40px] px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-xs font-semibold text-amber-200 flex items-center gap-1.5 transition-colors"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Link2 className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{copiedLink ? t(lang, 'dcInviteCopied') : t(lang, 'dcShareInvite')}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onLeaveRoom}
          className="min-h-[44px] px-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 shrink-0 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t(lang, 'leaveRoom')}</span>
        </button>
      </div>

      {/* Camera & Mic Setup Preview + Live Players */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Local Camera & Mic Preview */}
        <section className="lg:col-span-5 rounded-3xl bg-[#180C29] border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-amber-400" />
              <span>{lang === 'hi' ? 'आपका कैमरा और माइक' : 'Camera & Mic Check'}</span>
            </h2>
            <span className="text-[11px] font-medium text-amber-200/70">
              {turnConfigured ? 'STUN + TURN Ready' : 'STUN Active'}
            </span>
          </div>

          <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0B0514] border border-white/10 flex items-center justify-center">
            {localStream && cameraOn ? (
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? '-scale-x-100' : ''
                }`}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <CameraOff className="w-8 h-8 text-amber-300/50" />
                <p className="text-xs text-amber-100/70">
                  {camStatus === 'denied'
                    ? lang === 'hi'
                      ? 'कैमरा अनुमति बंद है — अवतार दिखेगा'
                      : 'Camera permission denied — avatar will appear'
                    : lang === 'hi'
                      ? 'लाइव कैमरा और माइक टेस्ट करने के लिए नीचे दबाएँ'
                      : 'Tap below to enable live camera & voice'}
                </p>
              </div>
            )}
            <CharadesReactionOverlay
              reactions={reactions.filter((rx) => rx.senderId === myId)}
              variant="tile"
            />
            <CharadesReactionOverlay
              reactions={reactions.filter((rx) => rx.senderId !== myId)}
              variant="corner"
            />
          </div>

          {mediaNotice && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-xl px-3 py-2">
              {mediaNotice}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {camStatus === 'idle' && micStatus === 'idle' ? (
              <button
                type="button"
                onClick={onStartCameraAndMic}
                className="col-span-full min-h-[46px] rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Camera className="w-4 h-4" />
                <span>
                  {lang === 'hi' ? 'कैमरा और माइक चालू करें' : 'Enable Camera & Mic'}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    cameraOn
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-white/5 border-white/15 text-slate-300'
                  }`}
                >
                  {cameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  <span>{cameraOn ? t(lang, 'dcCamOn') : t(lang, 'dcCamOff')}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    micOn
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                  }`}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span>{micOn ? t(lang, 'micOn') : t(lang, 'micMuted')}</span>
                </button>

                <button
                  type="button"
                  onClick={onSwitchCamera}
                  className="col-span-2 sm:col-span-1 min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-amber-100 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t(lang, 'dcSwitchCam')}</span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Right: Live Player List */}
        <section className="lg:col-span-7 rounded-3xl bg-[#180C29] border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>
                {t(lang, 'playersCount')} ({players.length}/10)
              </span>
            </h2>
            {players.length < 2 && (
              <span className="text-xs font-medium text-amber-300">
                {t(lang, 'minPlayersNotice')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {players.map((p) => {
              const isMe = p.id === myId;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-3 border flex items-center justify-between gap-3 ${
                    p.connected
                      ? 'bg-black/30 border-white/10'
                      : 'bg-rose-950/20 border-rose-500/25 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={p.name}
                      avatar={p.avatar}
                      size="md"
                      isSpeaking={Boolean(speakingIds[p.id])}
                      isMuted={!p.micEnabled || p.isMuted}
                      isHost={p.isHost}
                    />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm text-white truncate">
                        {p.name}
                        {isMe ? ` (${t(lang, 'youLabel')})` : ''}
                      </p>
                      <p className="text-[11px] text-amber-100/65 flex items-center gap-1.5 mt-0.5">
                        <span>
                          {p.connected
                            ? lang === 'hi'
                              ? 'ऑनलाइन'
                              : 'Online'
                            : lang === 'hi'
                              ? 'डिस्कनेक्ट'
                              : 'Disconnected'}
                        </span>
                        {room.mode === 'team' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300 font-semibold">
                              {p.team ? room.teamNames[p.team] : lang === 'hi' ? 'कोई टीम नहीं' : 'No team'}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.cameraEnabled ? (
                      <Camera className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <CameraOff className="w-4 h-4 text-slate-500" />
                    )}
                    {p.micEnabled && !p.isMuted ? (
                      <Mic className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <MicOff className="w-4 h-4 text-rose-400" />
                    )}
                    {isHost && !p.connected && !isMe && (
                      <button
                        type="button"
                        onClick={() => onRemoveDisconnected(p.id)}
                        className="min-h-[34px] min-w-[34px] rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 flex items-center justify-center"
                        title="Remove disconnected player"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Host Settings & Manual Team / Role Assignment */}
      <section className="rounded-3xl bg-[#180C29] border border-amber-500/25 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Shield className="w-4 h-4" />
              <span>
                {isHost
                  ? lang === 'hi'
                    ? 'होस्ट कंट्रोल पैनल'
                    : 'Host Controls · Manual Setup'
                  : lang === 'hi'
                    ? 'होस्ट द्वारा सेटअप'
                    : 'Room Setup (Managed by Host)'}
              </span>
            </div>
            <h2 className="font-display text-xl font-extrabold text-white mt-0.5">
              {room.mode === 'team' ? t(lang, 'dcTeamMode') : t(lang, 'dcIndividualMode')}
            </h2>
          </div>

          {isHost && (
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/40 border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => handleModeChange('team')}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors ${
                  room.mode === 'team'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-amber-100/70 hover:text-white'
                }`}
              >
                {t(lang, 'dcTeamMode')}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('individual')}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors ${
                  room.mode === 'individual'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-amber-100/70 hover:text-white'
                }`}
              >
                {t(lang, 'dcIndividualMode')}
              </button>
            </div>
          )}
        </div>

        {/* Team Mode Management */}
        {room.mode === 'team' && (
          <div className="space-y-5">
            {/* Team Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-rose-950/25 border border-rose-400/25 p-4 space-y-2">
                <label className="block text-xs font-semibold text-rose-200">
                  {t(lang, 'dcTeamA')}
                </label>
                {isHost ? (
                  <input
                    type="text"
                    maxLength={24}
                    value={teamAInput}
                    onChange={(e) => setTeamAInput(e.target.value)}
                    onBlur={() => handleSaveTeamName('A', teamAInput)}
                    className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/15 text-sm font-display font-bold text-white focus:outline-none focus:border-rose-400"
                  />
                ) : (
                  <p className="font-display font-bold text-base text-white">{room.teamNames.A}</p>
                )}
                <p className="text-xs text-rose-200/70">
                  {teamAPlayers.map((p) => p.name).join(', ') || '—'}
                </p>
              </div>

              <div className="rounded-2xl bg-amber-950/25 border border-amber-400/25 p-4 space-y-2">
                <label className="block text-xs font-semibold text-amber-200">
                  {t(lang, 'dcTeamB')}
                </label>
                {isHost ? (
                  <input
                    type="text"
                    maxLength={24}
                    value={teamBInput}
                    onChange={(e) => setTeamBInput(e.target.value)}
                    onBlur={() => handleSaveTeamName('B', teamBInput)}
                    className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/15 text-sm font-display font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                ) : (
                  <p className="font-display font-bold text-base text-white">{room.teamNames.B}</p>
                )}
                <p className="text-xs text-amber-200/70">
                  {teamBPlayers.map((p) => p.name).join(', ') || '—'}
                </p>
              </div>
            </div>

            {/* Host Manual Team Assignment Per Player */}
            {isHost && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-amber-200">
                  {lang === 'hi'
                    ? 'खिलाड़ियों को मैनुअली टीम में रखें:'
                    : 'Assign Players to Teams Manually:'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl bg-black/30 border border-white/10 p-3 flex items-center justify-between gap-2"
                    >
                      <span className="font-display font-semibold text-sm text-white truncate">
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAssignTeam(p.id, 'A')}
                          className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold transition-colors ${
                            p.team === 'A'
                              ? 'bg-rose-500 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAssignTeam(p.id, 'B')}
                          className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold transition-colors ${
                            p.team === 'B'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAssignTeam(p.id, null)}
                          className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold transition-colors ${
                            p.team === null
                              ? 'bg-slate-600 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          —
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Host Round Starter Roles (Team or Individual) */}
        {isHost ? (
          <div className="pt-4 border-t border-white/10 space-y-4">
            {room.mode === 'team' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-amber-200">
                  {t(lang, 'dcActingTeam')}:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActingTeam('A');
                    const firstA = teamAPlayers[0]?.id;
                    if (firstA) setSelectedActorIds([firstA]);
                    const firstB = teamBPlayers[0]?.id;
                    if (firstB) setSelectedGiverId(firstB);
                  }}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors ${
                    actingTeam === 'A'
                      ? 'bg-rose-500 text-white'
                      : 'bg-white/5 text-amber-100/80 border border-white/10'
                  }`}
                >
                  {room.teamNames.A}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActingTeam('B');
                    const firstB = teamBPlayers[0]?.id;
                    if (firstB) setSelectedActorIds([firstB]);
                    const firstA = teamAPlayers[0]?.id;
                    if (firstA) setSelectedGiverId(firstA);
                  }}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors ${
                    actingTeam === 'B'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-white/5 text-amber-100/80 border border-white/10'
                  }`}
                >
                  {room.teamNames.B}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Select Acting Player(s) */}
              <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-amber-200">
                  {t(lang, 'dcSelectActor')}
                  {room.mode === 'team' && ' (1 or more)'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(actingPool.length > 0 ? actingPool : players).map((p) => {
                    const active = resolvedActors.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleActorSelection(p.id)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-bold transition-colors ${
                          active
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/5 hover:bg-white/10 text-amber-100 border border-white/10'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Movie Giver */}
              <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-amber-200">
                  {t(lang, 'dcSelectGiver')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => {
                    const active = selectedGiverId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedGiverId(p.id)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-bold transition-colors ${
                          active
                            ? 'bg-rose-500 text-white'
                            : 'bg-white/5 hover:bg-white/10 text-amber-100 border border-white/10'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {room.mode === 'individual' && (
              <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-amber-200">
                  {t(lang, 'dcSelectGuessers')} (optional filter — defaults to everyone else)
                </p>
                <div className="flex flex-wrap gap-2">
                  {players
                    .filter((p) => !resolvedActors.includes(p.id) && p.id !== selectedGiverId)
                    .map((p) => {
                      const active = resolvedGuessers.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleGuesserSelection(p.id)}
                          className={`min-h-[38px] px-3 rounded-xl text-xs font-bold transition-colors ${
                            active
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-white/5 hover:bg-white/10 text-amber-100 border border-white/10'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!canStartRound || startingRound}
              onClick={handleStartRoundClick}
              className="w-full min-h-[54px] rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-105 disabled:opacity-45 text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all active:scale-[0.99]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {startingRound
                  ? lang === 'hi'
                    ? 'शुरू हो रहा है...'
                    : 'Starting Round...'
                  : t(lang, 'dcStartRound')}
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-black/30 border border-white/10 p-4 flex items-center gap-3 text-sm text-amber-100/80">
            <Crown className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{t(lang, 'dcWaitingHost')}</span>
          </div>
        )}
      </section>
    </div>
  );
};
