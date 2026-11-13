import { useCallback, useEffect, useRef, useState } from 'react';
import { Player, SignalPayload } from '../types/game';
import { roomTransport } from '../services/roomTransport';

export type MicPermissionState = 'idle' | 'granted' | 'denied' | 'unavailable';

interface PeerEntry {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  pendingIce: RTCIceCandidateInit[];
  remoteDescSet: boolean;
  analyser?: AnalyserNode;
  source?: MediaStreamAudioSourceNode;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVoiceChat(
  myId: string,
  inRoom: boolean,
  players: Record<string, Player> | undefined
) {
  const [micStatus, setMicStatus] = useState<MicPermissionState>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speakingIds, setSpeakingIds] = useState<Record<string, boolean>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

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

  const requestMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicStatus('unavailable');
      return null;
    }

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });
      setMicStatus('granted');

      const ctx = ensureAudioContext();
      if (ctx) {
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        localAnalyserRef.current = analyser;
      }

      // Attach local tracks to any existing peer connections
      for (const [, entry] of peersRef.current.entries()) {
        const senders = entry.pc.getSenders();
        for (const track of stream.getAudioTracks()) {
          if (!senders.some((s) => s.track === track)) {
            entry.pc.addTrack(track, stream);
          }
        }
      }

      return stream;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setMicStatus('unavailable');
      } else {
        setMicStatus('denied');
      }
      return null;
    }
  }, [ensureAudioContext]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      if (inRoom) {
        roomTransport.updatePlayer(myId, { isMuted: next }).catch(() => {});
      }
      return next;
    });
  }, [inRoom, myId]);

  const createPeerConnection = useCallback(
    (peerId: string): PeerEntry => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');

      const entry: PeerEntry = {
        pc,
        audioEl,
        pendingIce: [],
        remoteDescSet: false,
      };

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getAudioTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          roomTransport
            .sendSignal({
              from: myId,
              to: peerId,
              type: 'ice',
              data: event.candidate.toJSON(),
            })
            .catch(() => {});
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => {});

        const ctx = ensureAudioContext();
        if (ctx && !entry.analyser) {
          try {
            const source = ctx.createMediaStreamSource(remoteStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            entry.source = source;
            entry.analyser = analyser;
          } catch {
            // Ignore stream analysis error
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
      if (signal.to !== myId || signal.from === myId) return;
      const entry = createPeerConnection(signal.from);
      const { pc } = entry;

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(
            new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
          );
          entry.remoteDescSet = true;
          for (const ice of entry.pendingIce) {
            await pc.addIceCandidate(new RTCIceCandidate(ice));
          }
          entry.pendingIce = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await roomTransport.sendSignal({
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
        // Ignore transient WebRTC negotiation races
      }
    },
    [createPeerConnection, myId]
  );

  // Sync peer connections with active room players
  useEffect(() => {
    if (!inRoom || !players) {
      for (const [, entry] of peersRef.current.entries()) {
        entry.pc.close();
        entry.audioEl.srcObject = null;
      }
      peersRef.current.clear();
      return;
    }

    const activePeerIds = new Set(
      Object.values(players)
        .filter((p) => p.connected && p.id !== myId)
        .map((p) => p.id)
    );

    // Close disconnected peers
    for (const [peerId, entry] of peersRef.current.entries()) {
      if (!activePeerIds.has(peerId)) {
        entry.pc.close();
        entry.audioEl.srcObject = null;
        peersRef.current.delete(peerId);
      }
    }

    // Initiate connection to new peers deterministically (myId < peerId)
    for (const peerId of activePeerIds) {
      if (!peersRef.current.has(peerId)) {
        const entry = createPeerConnection(peerId);
        if (myId < peerId) {
          entry.pc
            .createOffer({ offerToReceiveAudio: true })
            .then(async (offer) => {
              await entry.pc.setLocalDescription(offer);
              await roomTransport.sendSignal({
                from: myId,
                to: peerId,
                type: 'offer',
                data: offer,
              });
            })
            .catch(() => {});
        }
      }
    }
  }, [createPeerConnection, inRoom, myId, players]);

  // Monitor audio levels for glowing speaking rings
  useEffect(() => {
    if (!inRoom) {
      setSpeakingIds({});
      return;
    }

    const dataArray = new Uint8Array(128);
    const interval = window.setInterval(() => {
      const nextSpeaking: Record<string, boolean> = {};

      // Check local mic volume
      if (!isMutedRef.current && localAnalyserRef.current) {
        localAnalyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (rms > 0.025) {
          nextSpeaking[myId] = true;
        }
      }

      // Check remote peers' audio levels
      for (const [peerId, entry] of peersRef.current.entries()) {
        if (entry.analyser) {
          entry.analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          if (rms > 0.02) {
            nextSpeaking[peerId] = true;
          }
        }
      }

      setSpeakingIds(nextSpeaking);
    }, 120);

    return () => window.clearInterval(interval);
  }, [inRoom, myId]);

  // Stop microphone tracks when leaving room
  useEffect(() => {
    if (!inRoom && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      localAnalyserRef.current = null;
      setMicStatus('idle');
    }
  }, [inRoom]);

  return {
    micStatus,
    isMuted,
    speakingIds,
    requestMicrophone,
    toggleMute,
    handleSignal,
  };
}
