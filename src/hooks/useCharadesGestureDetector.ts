import { useEffect, useRef } from 'react';
import type { GestureRecognizer } from '@mediapipe/tasks-vision';
import { CharadesReactionType } from '../types/charades';
import {
  evaluateGesturesFromResult,
  GestureTriggerTracker,
} from '../utils/charadesGestures';

interface UseCharadesGestureDetectorOptions {
  enabled: boolean;
  localStream: MediaStream | null;
  onGestureTriggered: (gesture: CharadesReactionType) => void;
}

const LOCAL_WASM_PATH = '/mediapipe/wasm';
const LOCAL_MODEL_PATH = '/mediapipe/gesture_recognizer.task';

function pickInferenceIntervalMs(): number {
  if (typeof window === 'undefined') return 110;
  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const lowCoreCount =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency <= 4;
  return coarsePointer || lowCoreCount ? 125 : 90;
}

async function createGestureRecognizerInstance(): Promise<GestureRecognizer> {
  const { FilesetResolver, GestureRecognizer: RecognizerClass } = await import(
    '@mediapipe/tasks-vision'
  );
  const vision = await FilesetResolver.forVisionTasks(LOCAL_WASM_PATH);

  try {
    return await RecognizerClass.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: LOCAL_MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      cannedGesturesClassifierOptions: {
        scoreThreshold: 0.5,
      },
    });
  } catch {
    // Automatic CPU fallback for devices with restricted WebGL contexts
    return await RecognizerClass.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: LOCAL_MODEL_PATH,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      cannedGesturesClassifierOptions: {
        scoreThreshold: 0.5,
      },
    });
  }
}

export function useCharadesGestureDetector({
  enabled,
  localStream,
  onGestureTriggered,
}: UseCharadesGestureDetectorOptions): void {
  const onTriggerRef = useRef(onGestureTriggered);
  onTriggerRef.current = onGestureTriggered;

  const trackerRef = useRef<GestureTriggerTracker>(new GestureTriggerTracker());
  const videoTrackId = localStream?.getVideoTracks()[0]?.id ?? '';

  useEffect(() => {
    if (!enabled || !localStream) {
      trackerRef.current.reset();
      return;
    }

    const videoTracks = localStream
      .getVideoTracks()
      .filter((track) => track.readyState === 'live' && track.enabled);

    if (videoTracks.length === 0) {
      trackerRef.current.reset();
      return;
    }

    let cancelled = false;
    let recognizer: GestureRecognizer | null = null;
    let timerId: number | null = null;
    let rafId: number | null = null;
    let lastTimestampMs = 0;

    // Offscreen video + compact 320x240 canvas to keep mobile CPU/GPU usage lightweight
    const videoEl = document.createElement('video');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.autoplay = true;
    const videoOnlyStream = new MediaStream(videoTracks);
    videoEl.srcObject = videoOnlyStream;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    const intervalMs = pickInferenceIntervalMs();
    trackerRef.current.reset();

    const scheduleNext = () => {
      if (cancelled) return;
      timerId = window.setTimeout(() => {
        if (cancelled) return;
        rafId = window.requestAnimationFrame(runFrame);
      }, intervalMs);
    };

    const runFrame = () => {
      if (cancelled) return;
      try {
        if (
          recognizer &&
          ctx &&
          !document.hidden &&
          videoEl.readyState >= 2 &&
          videoEl.videoWidth > 0 &&
          videoEl.videoHeight > 0
        ) {
          const track = videoTracks[0];
          if (track && track.readyState === 'live' && track.enabled) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const nowPerf = Math.round(performance.now());
            const ts = nowPerf > lastTimestampMs ? nowPerf : lastTimestampMs + 1;
            lastTimestampMs = ts;

            const result = recognizer.recognizeForVideo(canvas, ts);
            const detections = evaluateGesturesFromResult(result);
            const triggered = trackerRef.current.update(detections, Date.now());
            for (const gesture of triggered) {
              onTriggerRef.current(gesture);
            }
          } else {
            trackerRef.current.reset();
          }
        }
      } catch {
        // Ignore transient frame inference errors so camera/gameplay stay uninterrupted
      }
      scheduleNext();
    };

    const start = async () => {
      try {
        await videoEl.play().catch(() => {});
        const instance = await createGestureRecognizerInstance();
        if (cancelled) {
          instance.close();
          return;
        }
        recognizer = instance;
        scheduleNext();
      } catch {
        // Graceful degradation: if WASM/model fails on device, game continues normally
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      trackerRef.current.reset();
      videoEl.pause();
      videoEl.srcObject = null;
      if (recognizer) {
        try {
          recognizer.close();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [enabled, localStream, videoTrackId]);
}
