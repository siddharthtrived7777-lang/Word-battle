import { useCallback, useEffect, useRef, useState } from 'react';
import { SignalPayload } from '../types/game';
import { CharadesPlayer } from '../types/charades';
import { charadesRoomService } from '../services/charadesRoomService';

export type MediaPermissionState = 'idle' | 'granted' | 'denied' | 'unavailable';

interface CharadesPeerEntry {
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  pendingIce: RTCIceCandidateInit[];
  remoteDescSet: boolean;
  analyser?: AnalyserNode;
  source?: MediaStreamAudioSourceNode;
  makingOffer: boolean;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function useCharadesMedia(
  myId: string,
  roomCode: string | null,
  players: Record<string, CharadesPlayer> | undefined
) {
  const [iceServers, setIceServers] = useState<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const [turnConfigured, setTurnConfigured] = useState(false);

  const [camStatus, setCamStatus] = useState<MediaPermissionState>('idle');
  const [micStatus, setMicStatus] = useState<MediaPermissionState>('idle');
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [peerStates, setPeerStates] = useState<Record<string, RTCPeerConnectionState>>({});
  const [speakingIds, setSpeakingIds] = useState<Record<string, boolean>>({});
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const peersRef = useRef<Map<string, CharadesPeerEntry>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>(iceServers);
  iceServersRef.current = iceServers;
  const roomCodeRef = useRef<string | null>(roomCode);
  roomCodeRef.current = roomCode;
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;

  // Fetch STUN/TURN configuration from backend once
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ice-servers', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { iceServers?: RTCIceServer[]; turnConfigured?: boolean } | null) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          setIceServers(data.iceServers);
        }
        setTurnConfigured(Boolean(data.turnConfigured));
      })
      .catch(() => {
        // Default STUN remains active
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const syncLocalMediaStatus = useCallback(
    (cam: boolean, mic: boolean) => {
      if (roomCodeRef.current) {
        charadesRoomService
          .updateMediaState(roomCodeRef.current, myId, {
            cameraEnabled: cam,
            micEnabled: mic,
            isMuted: !mic,
          })
          .catch(() => {});
      }
    },
    [myId]
  );

  const attachTracksToPeer = useCallback(
    async (peerId: string, entry: CharadesPeerEntry, renegotiate: boolean) => {
      const stream = localStreamRef.current;
      if (!stream) return;

      let changed = false;
      const senders = entry.pc.getSenders();
      for (const track of stream.getTracks()) {
        const existingSender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (existingSender) {
          if (existingSender.track !== track) {
            await existingSender.replaceTrack(track).catch(() => {});
          }
        } else {
          entry.pc.addTrack(track, stream);
          changed = true;
        }
      }

      if (renegotiate && changed && roomCodeRef.current && !entry.makingOffer) {
        try {
          entry.makingOffer = true;
          const offer = await entry.pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await entry.pc.setLocalDescription(offer);
          await charadesRoomService.sendSignal(roomCodeRef.current, {
            from: myId,
            to: peerId,
            type: 'offer',
            data: offer,
          });
        } catch {
          // Ignore negotiation race
        } finally {
          entry.makingOffer = false;
        }
      }
    },
    [myId]
  );

  const setupLocalAnalyser = useCallback(
    (stream: MediaStream) => {
      if (stream.getAudioTracks().length === 0) {
        localAnalyserRef.current = null;
        return;
      }
      const ctx = ensureAudioContext();
      if (!ctx) return;
      try {
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        localAnalyserRef.current = analyser;
      } catch {
        // Ignore audio analysis setup error
      }
    },
    [ensureAudioContext]
  );

  const startMedia = useCallback(
    async (opts: { wantVideo: boolean; wantAudio: boolean; facing?: 'user' | 'environment' }) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (opts.wantVideo) setCamStatus('unavailable');
        if (opts.wantAudio) setMicStatus('unavailable');
        setMediaNotice('Camera and microphone APIs are unavailable on this browser.');
        return null;
      }

      setMediaNotice(null);
      const targetFacing = opts.facing ?? facingMode;

      // Stop old tracks cleanly
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      let acquiredStream: MediaStream | null = null;
      let gotVideo = false;
      let gotAudio = false;

      if (opts.wantVideo && opts.wantAudio) {
        try {
          acquiredStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: targetFacing,
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 24, max: 30 },
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          gotVideo = acquiredStream.getVideoTracks().length > 0;
          gotAudio = acquiredStream.getAudioTracks().length > 0;
        } catch {
          // Fallback individually below so mic still works if camera is blocked/missing
        }
      }

      if (!acquiredStream) {
        const combined = new MediaStream();
        if (opts.wantVideo) {
          try {
            const vStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: targetFacing,
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
              audio: false,
            });
            vStream.getVideoTracks().forEach((t) => combined.addTrack(t));
            gotVideo = vStream.getVideoTracks().length > 0;
          } catch (err) {
            const name = err instanceof DOMException ? err.name : '';
            setCamStatus(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied');
            setMediaNotice('Camera permission denied or unavailable. You can still play with voice and avatar.');
          }
        }
        if (opts.wantAudio) {
          try {
            const aStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            aStream.getAudioTracks().forEach((t) => combined.addTrack(t));
            gotAudio = aStream.getAudioTracks().length > 0;
          } catch (err) {
            const name = err instanceof DOMException ? err.name : '';
            setMicStatus(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied');
            setMediaNotice((prev) =>
              prev
                ? `${prev} Microphone access was also denied.`
                : 'Microphone permission denied or unavailable.'
            );
          }
        }
        acquiredStream = combined;
      }

      if (gotVideo) setCamStatus('granted');
      if (gotAudio) setMicStatus('granted');

      localStreamRef.current = acquiredStream;
      setLocalStream(acquiredStream);
      setCameraOn(gotVideo);
      setMicOn(gotAudio);
      setupLocalAnalyser(acquiredStream);
      syncLocalMediaStatus(gotVideo, gotAudio);

      for (const [peerId, entry] of peersRef.current.entries()) {
        await attachTracksToPeer(peerId, entry, true);
      }

      return acquiredStream;
    },
    [attachTracksToPeer, facingMode, setupLocalAnalyser, syncLocalMediaStatus]
  );

  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const videoTracks = stream?.getVideoTracks() ?? [];
    if (videoTracks.length === 0) {
      // Acquire camera for the first time (keep mic state)
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        const targetStream = stream ?? new MediaStream();
        vStream.getVideoTracks().forEach((t) => targetStream.addTrack(t));
        localStreamRef.current = new MediaStream(targetStream.getTracks());
        setLocalStream(localStreamRef.current);
        setCamStatus('granted');
        setCameraOn(true);
        setMediaNotice(null);
        syncLocalMediaStatus(true, micOnRef.current);
        for (const [peerId, entry] of peersRef.current.entries()) {
          await attachTracksToPeer(peerId, entry, true);
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        setCamStatus(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied');
        setMediaNotice('Could not access camera. Check browser permissions.');
      }
      return;
    }

    const nextOn = !cameraOn;
    videoTracks.forEach((t) => {
      t.enabled = nextOn;
    });
    setCameraOn(nextOn);
    syncLocalMediaStatus(nextOn, micOnRef.current);
  }, [attachTracksToPeer, cameraOn, facingMode, syncLocalMediaStatus]);

  const toggleMic = useCallback(async () => {
    const stream = localStreamRef.current;
    const audioTracks = stream?.getAudioTracks() ?? [];
    if (audioTracks.length === 0) {
      try {
        const aStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const targetStream = stream ?? new MediaStream();
        aStream.getAudioTracks().forEach((t) => targetStream.addTrack(t));
        localStreamRef.current = new MediaStream(targetStream.getTracks());
        setLocalStream(localStreamRef.current);
        setupLocalAnalyser(localStreamRef.current);
        setMicStatus('granted');
        setMicOn(true);
        setMediaNotice(null);
        syncLocalMediaStatus(cameraOn, true);
        for (const [peerId, entry] of peersRef.current.entries()) {
          await attachTracksToPeer(peerId, entry, true);
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        setMicStatus(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied');
        setMediaNotice('Could not access microphone. Check browser permissions.');
      }
      return;
    }

    const nextOn = !micOn;
    audioTracks.forEach((t) => {
      t.enabled = nextOn;
    });
    setMicOn(nextOn);
    syncLocalMediaStatus(cameraOn, nextOn);
  }, [attachTracksToPeer, cameraOn, micOn, setupLocalAnalyser, syncLocalMediaStatus]);

  const switchCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const newTrack = newVideoStream.getVideoTracks()[0];
      if (!newTrack) return;

      const currentStream = localStreamRef.current ?? new MediaStream();
      currentStream.getVideoTracks().forEach((oldTrack) => {
        oldTrack.stop();
        currentStream.removeTrack(oldTrack);
      });
      currentStream.addTrack(newTrack);
      newTrack.enabled = cameraOn;

      const refreshed = new MediaStream(currentStream.getTracks());
      localStreamRef.current = refreshed;
      setLocalStream(refreshed);
      setFacingMode(nextFacing);

      for (const [, entry] of peersRef.current.entries()) {
        const videoSender = entry.pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newTrack).catch(() => {});
        }
      }
    } catch {
      setMediaNotice('Only one camera is available on this device.');
    }
  }, [cameraOn, facingMode]);

  const stopAllMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    localAnalyserRef.current = null;
    setLocalStream(null);
    setCameraOn(false);
    setMicOn(false);
    setCamStatus('idle');
    setMicStatus('idle');
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): CharadesPeerEntry => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const remoteStream = new MediaStream();

      const entry: CharadesPeerEntry = {
        pc,
        remoteStream,
        pendingIce: [],
        remoteDescSet: false,
        makingOffer: false,
      };

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && roomCodeRef.current) {
          charadesRoomService
            .sendSignal(roomCodeRef.current, {
              from: myId,
              to: peerId,
              type: 'ice',
              data: event.candidate.toJSON(),
            })
            .catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        setPeerStates((prev) => ({ ...prev, [peerId]: pc.connectionState }));
        if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
      };

      pc.ontrack = (event) => {
        const track = event.track;
        if (!entry.remoteStream.getTracks().some((t) => t.id === track.id)) {
          entry.remoteStream.addTrack(track);
        }
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: new MediaStream(entry.remoteStream.getTracks()),
        }));

        if (track.kind === 'audio') {
          const ctx = ensureAudioContext();
          if (ctx && !entry.analyser) {
            try {
              const source = ctx.createMediaStreamSource(entry.remoteStream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);
              entry.source = source;
              entry.analyser = analyser;
            } catch {
              // Ignore remote audio analysis failure
            }
          }
        }
      };

      peersRef.current.set(peerId, entry);
      return entry;
    },
    [ensureAudioContext, myId]
  );

  const handleSignal = useCallback(
    async (signal: SignalPayload) => {
      if (signal.to !== myId || signal.from === myId || !roomCodeRef.current) return;
      const entry = createPeerConnection(signal.from);
      const { pc } = entry;

      try {
        if (signal.type === 'offer') {
          if (pc.signalingState !== 'stable') {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(
                new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
              ),
            ]);
          } else {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
            );
          }
          entry.remoteDescSet = true;
          for (const ice of entry.pendingIce) {
            await pc.addIceCandidate(new RTCIceCandidate(ice));
          }
          entry.pendingIce = [];

          // Ensure local tracks are attached before answering
          await attachTracksToPeer(signal.from, entry, false);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await charadesRoomService.sendSignal(roomCodeRef.current, {
            from: myId,
            to: signal.from,
            type: 'answer',
            data: answer,
          });
        } else if (signal.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
            );
            entry.remoteDescSet = true;
            for (const ice of entry.pendingIce) {
              await pc.addIceCandidate(new RTCIceCandidate(ice));
            }
            entry.pendingIce = [];
          }
        } else if (signal.type === 'ice') {
          const iceData = signal.data as RTCIceCandidateInit;
          if (entry.remoteDescSet) {
            await pc.addIceCandidate(new RTCIceCandidate(iceData));
          } else {
            entry.pendingIce.push(iceData);
          }
        }
      } catch {
        // Ignore transient SDP/ICE races
      }
    },
    [attachTracksToPeer, createPeerConnection, myId]
  );

  // Maintain mesh connections with connected room players
  useEffect(() => {
    if (!roomCode || !players) {
      for (const [, entry] of peersRef.current.entries()) {
        entry.pc.close();
      }
      peersRef.current.clear();
      setRemoteStreams({});
      setPeerStates({});
      return;
    }

    const activePeerIds = new Set(
      Object.values(players)
        .filter((p) => p.connected && p.id !== myId)
        .map((p) => p.id)
    );

    for (const [peerId, entry] of peersRef.current.entries()) {
      if (!activePeerIds.has(peerId)) {
        entry.pc.close();
        peersRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
      }
    }

    for (const peerId of activePeerIds) {
      if (!peersRef.current.has(peerId)) {
        const entry = createPeerConnection(peerId);
        if (myId < peerId) {
          entry.makingOffer = true;
          entry.pc
            .createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            .then(async (offer) => {
              await entry.pc.setLocalDescription(offer);
              await charadesRoomService.sendSignal(roomCode, {
                from: myId,
                to: peerId,
                type: 'offer',
                data: offer,
              });
            })
            .catch(() => {})
            .finally(() => {
              entry.makingOffer = false;
            });
        }
      }
    }
  }, [createPeerConnection, myId, players, roomCode]);

  // Monitor audio levels for speaking rings
  useEffect(() => {
    if (!roomCode) {
      setSpeakingIds({});
      return;
    }
    const dataArray = new Uint8Array(128);
    const interval = window.setInterval(() => {
      const next: Record<string, boolean> = {};
      if (micOnRef.current && localAnalyserRef.current) {
        localAnalyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        if (Math.sqrt(sum / dataArray.length) > 0.025) {
          next[myId] = true;
        }
      }

      for (const [peerId, entry] of peersRef.current.entries()) {
        if (entry.analyser) {
          entry.analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          if (Math.sqrt(sum / dataArray.length) > 0.02) {
            next[peerId] = true;
          }
        }
      }
      setSpeakingIds(next);
    }, 120);

    return () => window.clearInterval(interval);
  }, [myId, roomCode]);

  // Sync camera/mic state whenever room connects or leaves
  useEffect(() => {
    if (!roomCode) {
      stopAllMedia();
      return;
    }
    syncLocalMediaStatus(cameraOn, micOn);
  }, [cameraOn, micOn, roomCode, stopAllMedia, syncLocalMediaStatus]);

  return {
    localStream,
    remoteStreams,
    peerStates,
    speakingIds,
    camStatus,
    micStatus,
    cameraOn,
    micOn,
    facingMode,
    turnConfigured,
    mediaNotice,
    startMedia,
    toggleCamera,
    toggleMic,
    switchCamera,
    stopAllMedia,
    handleSignal,
  };
}
