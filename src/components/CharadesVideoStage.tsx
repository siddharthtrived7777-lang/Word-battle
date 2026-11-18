import React, { useEffect, useRef } from 'react';
import {
  Clapperboard,
  Maximize2,
  Minimize2,
  MicOff,
  Users,
  VideoOff,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { CharadesPlayer, CharadesRoomState } from '../types/charades';
import { Avatar } from './Avatar';
import { Language } from '../types/game';

interface CharadesVideoStageProps {
  lang: Language;
  room: CharadesRoomState;
  myId: string;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerStates: Record<string, RTCPeerConnectionState>;
  speakingIds: Record<string, boolean>;
  cameraOn: boolean;
  facingMode?: 'user' | 'environment';
  layoutMode: 'acting' | 'all';
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggleLayout: () => void;
}

interface MediaStreamPlayerProps {
  stream: MediaStream | null;
  muted: boolean;
  mirror?: boolean;
  className?: string;
}

const VideoFeed: React.FC<MediaStreamPlayerProps> = ({
  stream,
  muted,
  mirror = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (stream) {
      el.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover ${mirror ? '-scale-x-100' : ''} ${className}`}
    />
  );
};

const AudioOnlyFeed: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.play().catch(() => {});
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

function hasLiveVideoTrack(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream
    .getVideoTracks()
    .some((track) => track.readyState === 'live' && track.enabled);
}

export const CharadesVideoStage: React.FC<CharadesVideoStageProps> = ({
  lang,
  room,
  myId,
  localStream,
  remoteStreams,
  peerStates,
  speakingIds,
  cameraOn,
  facingMode = 'user',
  layoutMode,
  isFullscreen,
  onToggleFullscreen,
  onToggleLayout,
}) => {
  const stagePlayers: CharadesPlayer[] = (() => {
    if (layoutMode === 'acting') {
      const actors = room.actorIds
        .map((id) => room.players[id])
        .filter((p): p is CharadesPlayer => Boolean(p));
      if (actors.length > 0) return actors;
    }
    return room.playerIds
      .map((id) => room.players[id])
      .filter((p): p is CharadesPlayer => Boolean(p));
  })();

  const visibleIdSet = new Set(stagePlayers.map((p) => p.id));

  // Ensure every remote stream has an active audio output even when its video tile is hidden in 'acting' mode
  const audioOnlyRemoteStreams = Object.entries(remoteStreams).filter(
    ([peerId]) => peerId !== myId && !visibleIdSet.has(peerId)
  );

  const count = stagePlayers.length;
  const gridClass =
    count <= 1
      ? 'grid-cols-1'
      : count === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : count === 3
          ? 'grid-cols-1 sm:grid-cols-3'
          : count === 4
            ? 'grid-cols-2'
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  const tileHeightClass =
    count <= 1
      ? isFullscreen
        ? 'min-h-[58vh] sm:min-h-[68vh]'
        : 'min-h-[290px] sm:min-h-[420px]'
      : count === 2
        ? isFullscreen
          ? 'min-h-[34vh] sm:min-h-[60vh]'
          : 'min-h-[210px] sm:min-h-[320px]'
        : 'min-h-[175px] sm:min-h-[220px]';

  const actingTeamLabel =
    room.mode === 'team' && room.actingTeam
      ? room.teamNames[room.actingTeam]
      : null;

  return (
    <section
      className={`relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#1D1030] via-[#140B24] to-[#0E071B] border border-amber-500/25 shadow-2xl ${
        isFullscreen ? 'p-3 sm:p-5 h-full flex flex-col' : 'p-3 sm:p-4'
      }`}
    >
      {/* Background audio-only outputs for hidden remote participants */}
      {audioOnlyRemoteStreams.map(([peerId, stream]) => (
        <AudioOnlyFeed key={peerId} stream={stream} />
      ))}

      {/* Spotlight ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full bg-amber-500/15 blur-3xl"
      />

      {/* Stage Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-200 min-w-0">
          <Clapperboard className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">
            {layoutMode === 'acting'
              ? lang === 'hi'
                ? 'लाइव एक्टिंग स्टेज'
                : 'Live Acting Stage'
              : lang === 'hi'
                ? 'सभी कैमरे'
                : 'All Player Cameras'}
          </span>
          {actingTeamLabel && (
            <>
              <span aria-hidden="true" className="text-amber-500/50">·</span>
              <span className="text-rose-300 truncate">{actingTeamLabel}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleLayout}
            className="min-h-[38px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-amber-100 flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {layoutMode === 'acting'
                ? lang === 'hi'
                  ? 'सभी देखें'
                  : 'All Cams'
                : lang === 'hi'
                  ? 'केवल एक्टर'
                  : 'Actors Only'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-100 flex items-center justify-center transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen stage' : 'Expand stage'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className={`relative z-10 grid ${gridClass} gap-3 flex-1`}>
        {stagePlayers.map((player) => {
          const isMe = player.id === myId;
          const isActor = room.actorIds.includes(player.id);
          const stream = isMe ? localStream : remoteStreams[player.id] ?? null;
          const videoActive = isMe
            ? cameraOn && hasLiveVideoTrack(localStream)
            : player.cameraEnabled && hasLiveVideoTrack(stream);
          const isSpeaking = Boolean(speakingIds[player.id]);
          const connState = isMe ? 'connected' : peerStates[player.id] ?? 'connecting';

          return (
            <div
              key={player.id}
              className={`relative rounded-2xl overflow-hidden bg-[#0D0718] ${tileHeightClass} flex items-center justify-center transition-all ${
                isSpeaking
                  ? 'ring-2 ring-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.35)]'
                  : isActor
                    ? 'ring-2 ring-amber-400/70 shadow-[0_0_28px_rgba(245,158,11,0.2)]'
                    : 'ring-1 ring-white/10'
              }`}
            >
              {stream && (
                <VideoFeed
                  stream={stream}
                  muted={isMe}
                  mirror={isMe && facingMode === 'user'}
                  className={videoActive ? 'opacity-100' : 'opacity-0 absolute inset-0'}
                />
              )}

              {!videoActive && (
                <div className="relative z-10 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                  <Avatar
                    name={player.name}
                    avatar={player.avatar}
                    size={count <= 2 ? 'xl' : 'lg'}
                    isSpeaking={isSpeaking}
                    isMuted={player.isMuted}
                    isHost={player.isHost}
                    isActiveTurn={isActor}
                  />
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <VideoOff className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {!player.connected
                        ? lang === 'hi'
                          ? 'डिस्कनेक्ट'
                          : 'Offline'
                        : lang === 'hi'
                          ? 'कैमरा बंद'
                          : 'Camera Off'}
                    </span>
                  </div>
                </div>
              )}

              {/* Bottom nameplate overlay */}
              <div className="absolute inset-x-0 bottom-0 z-20 p-2.5 sm:p-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display font-bold text-xs sm:text-sm text-white truncate">
                    {player.name}
                    {isMe ? (lang === 'hi' ? ' (आप)' : ' (You)') : ''}
                  </span>
                  {isActor && (
                    <span className="text-[11px] font-semibold text-amber-300 shrink-0">
                      · {lang === 'hi' ? 'एक्टर' : 'Acting'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isMe && (
                    <span
                      className="text-xs flex items-center"
                      title={`Connection: ${connState}`}
                    >
                      {connState === 'connected' ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </span>
                  )}
                  {player.isMuted && (
                    <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
