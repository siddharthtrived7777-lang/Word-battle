import type { CharadesReactionType } from '../types/charades';

export interface HandLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface GestureCategoryScore {
  categoryName: string;
  score: number;
}

export interface GestureEvaluationInput {
  landmarks: HandLandmarkPoint[][];
  gestures?: GestureCategoryScore[][];
}

export type GestureDetectionMap = Record<CharadesReactionType, boolean>;

export const GESTURE_HOLD_MS = 650;
export const GESTURE_COOLDOWN_MS = 3000;
export const GESTURE_MISS_GRACE_MS = 180;
export const GESTURE_RELEASE_MS = 220;

export function dist2D(a: HandLandmarkPoint, b: HandLandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getHandScale(lm: HandLandmarkPoint[]): number {
  if (lm.length < 21) return 0;
  const wristToMiddleMcp = dist2D(lm[0], lm[9]);
  const wristToIndexMcp = dist2D(lm[0], lm[5]);
  return Math.max(wristToMiddleMcp, wristToIndexMcp, 0.04);
}

function isFingerExtended(
  lm: HandLandmarkPoint[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const wrist = lm[0];
  const tipDist = dist2D(wrist, lm[tipIdx]);
  const pipDist = dist2D(wrist, lm[pipIdx]);
  const mcpDist = dist2D(wrist, lm[mcpIdx]);
  return tipDist > pipDist * 1.14 && tipDist > mcpDist * 1.32;
}

function isFingerCurled(
  lm: HandLandmarkPoint[],
  tipIdx: number,
  pipIdx: number
): boolean {
  const wrist = lm[0];
  const tipDist = dist2D(wrist, lm[tipIdx]);
  const pipDist = dist2D(wrist, lm[pipIdx]);
  return tipDist < pipDist * 1.12;
}

function getCategoryScore(
  categories: GestureCategoryScore[] | undefined,
  name: string
): number {
  if (!categories || categories.length === 0) return 0;
  const match = categories.find((c) => c.categoryName === name);
  return match ? match.score : 0;
}

/**
 * Thumbs Up:
 * - MediaPipe `Thumb_Up` score >= 0.58
 * - Thumb tip (4) points upward above IP (3) and MCP (2)
 * - Thumb tip separated from index MCP (5)
 * - Other 4 fingers curled (not open palm)
 */
export function isThumbsUpHand(
  lm: HandLandmarkPoint[],
  categories?: GestureCategoryScore[]
): boolean {
  if (lm.length < 21) return false;
  const score = getCategoryScore(categories, 'Thumb_Up');
  if (score < 0.58) return false;

  const scale = getHandScale(lm);
  const thumbUpward =
    lm[4].y < lm[3].y - 0.04 * scale &&
    lm[3].y < lm[2].y &&
    lm[4].y < lm[5].y;
  if (!thumbUpward) return false;

  const thumbClear = dist2D(lm[4], lm[5]) > 0.5 * scale;
  if (!thumbClear) return false;

  const indexCurled = !isFingerExtended(lm, 8, 6, 5);
  const middleCurled = !isFingerExtended(lm, 12, 10, 9);
  const ringCurled = !isFingerExtended(lm, 16, 14, 13);
  const pinkyCurled = !isFingerExtended(lm, 20, 18, 17);

  return indexCurled && middleCurled && ringCurled && pinkyCurled;
}

/**
 * Peace / Victory (V sign):
 * - MediaPipe `Victory` score >= 0.58
 * - Index (8) and Middle (12) extended upward and separated into a V
 * - Ring (16) and Pinky (20) curled down
 */
export function isPeaceHand(
  lm: HandLandmarkPoint[],
  categories?: GestureCategoryScore[]
): boolean {
  if (lm.length < 21) return false;
  const score = getCategoryScore(categories, 'Victory');
  if (score < 0.58) return false;

  const scale = getHandScale(lm);
  const indexExtended = isFingerExtended(lm, 8, 6, 5) && lm[8].y < lm[5].y;
  const middleExtended = isFingerExtended(lm, 12, 10, 9) && lm[12].y < lm[9].y;
  if (!indexExtended || !middleExtended) return false;

  const vSeparation = dist2D(lm[8], lm[12]) > 0.25 * scale;
  if (!vSeparation) return false;

  const ringCurled = isFingerCurled(lm, 16, 14);
  const pinkyCurled = isFingerCurled(lm, 20, 18);

  return ringCurled && pinkyCurled;
}

/**
 * Two-Hand Heart:
 * - Strictly requires 2 hands
 * - Top arch: index fingertips (8) or middle fingertips (12) meet closely
 * - Bottom V-point: thumb tips (4) meet closely
 * - Top arch is clearly higher (smaller y) than bottom thumb point
 * - Knuckles (5) bow outward on opposite sides of the center line
 *   (distinguishes a two-hand heart from Namaste/prayer hands, clapping, or side-by-side waving)
 */
export function isTwoHandHeartPair(
  handA: HandLandmarkPoint[],
  handB: HandLandmarkPoint[]
): boolean {
  if (handA.length < 21 || handB.length < 21) return false;

  const scaleA = getHandScale(handA);
  const scaleB = getHandScale(handB);
  const avgScale = (scaleA + scaleB) / 2;
  if (avgScale <= 0.04) return false;

  // Reject mismatched background/foreground hands
  const scaleRatio = Math.max(scaleA, scaleB) / Math.max(Math.min(scaleA, scaleB), 0.01);
  if (scaleRatio > 2.2) return false;

  // Each hand must form an open C-arc between thumb and index (not clenched fists)
  if (dist2D(handA[4], handA[8]) < 0.35 * scaleA) return false;
  if (dist2D(handB[4], handB[8]) < 0.35 * scaleB) return false;

  const indexTipDist = dist2D(handA[8], handB[8]);
  const topArchDist = Math.min(
    indexTipDist,
    dist2D(handA[12], handB[12]),
    dist2D(handA[8], handB[12]),
    dist2D(handA[12], handB[8])
  );
  const thumbTipDist = dist2D(handA[4], handB[4]);

  if (topArchDist > 0.65 * avgScale) return false;
  if (indexTipDist > 0.8 * avgScale) return false;
  if (thumbTipDist > 0.65 * avgScale) return false;

  // Top arch must sit clearly above the bottom thumb V-point
  const topY = (handA[8].y + handB[8].y) / 2;
  const bottomY = (handA[4].y + handB[4].y) / 2;
  if (bottomY - topY < 0.28 * avgScale) return false;

  // Knuckles (5) must spread wide on opposite sides of the meeting tips (rejects prayer hands/clapping)
  const knuckleDist = dist2D(handA[5], handB[5]);
  if (knuckleDist < 0.65 * avgScale) return false;
  if (knuckleDist <= thumbTipDist * 1.25 || knuckleDist <= topArchDist * 1.25) return false;

  const centerX = (handA[4].x + handB[4].x + handA[8].x + handB[8].x) / 4;
  const oppositeSides = (handA[5].x - centerX) * (handB[5].x - centerX) < 0;
  if (!oppositeSides) return false;

  return true;
}

export function isTwoHandHeart(landmarksList: HandLandmarkPoint[][]): boolean {
  if (landmarksList.length < 2) return false;
  for (let i = 0; i < landmarksList.length; i++) {
    for (let j = i + 1; j < landmarksList.length; j++) {
      if (isTwoHandHeartPair(landmarksList[i], landmarksList[j])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Evaluate all 3 gestures independently from a MediaPipe GestureRecognizerResult.
 */
export function evaluateGesturesFromResult(
  result: GestureEvaluationInput
): GestureDetectionMap {
  const landmarksList = result.landmarks ?? [];
  const gesturesList = result.gestures ?? [];

  const heart = isTwoHandHeart(landmarksList);

  let thumbs_up = false;
  let peace = false;

  for (let i = 0; i < landmarksList.length; i++) {
    const lm = landmarksList[i];
    const cats = gesturesList[i];
    if (!thumbs_up && isThumbsUpHand(lm, cats)) {
      thumbs_up = true;
    }
    if (!peace && isPeaceHand(lm, cats)) {
      peace = true;
    }
  }

  return {
    heart,
    thumbs_up,
    peace,
  };
}

interface GestureSlotState {
  holdStartMs: number | null;
  lastSeenMs: number | null;
  lastAbsentMs: number | null;
  cooldownUntilMs: number;
  awaitingRelease: boolean;
}

const ALL_GESTURES: CharadesReactionType[] = ['heart', 'thumbs_up', 'peace'];

function createInitialSlot(): GestureSlotState {
  return {
    holdStartMs: null,
    lastSeenMs: null,
    lastAbsentMs: null,
    cooldownUntilMs: 0,
    awaitingRelease: false,
  };
}

/**
 * Independent per-gesture trigger state machine enforcing:
 * - Consistent recognition (~650 ms) before triggering
 * - Single trigger per detection
 * - 3-second cooldown per gesture
 * - Gesture must disappear before it can trigger again (holding never repeats)
 */
export class GestureTriggerTracker {
  private readonly holdMs: number;
  private readonly cooldownMs: number;
  private readonly missGraceMs: number;
  private readonly releaseMs: number;
  private state: Record<CharadesReactionType, GestureSlotState>;

  constructor(opts?: {
    holdMs?: number;
    cooldownMs?: number;
    missGraceMs?: number;
    releaseMs?: number;
  }) {
    this.holdMs = opts?.holdMs ?? GESTURE_HOLD_MS;
    this.cooldownMs = opts?.cooldownMs ?? GESTURE_COOLDOWN_MS;
    this.missGraceMs = opts?.missGraceMs ?? GESTURE_MISS_GRACE_MS;
    this.releaseMs = opts?.releaseMs ?? GESTURE_RELEASE_MS;
    this.state = {
      heart: createInitialSlot(),
      thumbs_up: createInitialSlot(),
      peace: createInitialSlot(),
    };
  }

  public reset(): void {
    this.state = {
      heart: createInitialSlot(),
      thumbs_up: createInitialSlot(),
      peace: createInitialSlot(),
    };
  }

  public update(detected: GestureDetectionMap, nowMs: number): CharadesReactionType[] {
    const triggered: CharadesReactionType[] = [];

    for (const gesture of ALL_GESTURES) {
      const slot = this.state[gesture];
      const active = Boolean(detected[gesture]);

      if (active) {
        slot.lastSeenMs = nowMs;
        slot.lastAbsentMs = null;

        if (slot.awaitingRelease) {
          // Player is still holding the gesture; never re-trigger until released
          continue;
        }

        if (nowMs < slot.cooldownUntilMs) {
          // Still in 3s cooldown window
          continue;
        }

        if (slot.holdStartMs === null) {
          slot.holdStartMs = nowMs;
        } else if (nowMs - slot.holdStartMs >= this.holdMs) {
          triggered.push(gesture);
          slot.cooldownUntilMs = nowMs + this.cooldownMs;
          slot.awaitingRelease = true;
          slot.holdStartMs = null;
        }
      } else {
        if (slot.lastAbsentMs === null) {
          slot.lastAbsentMs = nowMs;
        }

        // Release lock once gesture has disappeared cleanly
        if (slot.awaitingRelease && nowMs - slot.lastAbsentMs >= this.releaseMs) {
          slot.awaitingRelease = false;
        }

        // Reset partial hold if absent beyond brief frame-drop grace window
        if (
          slot.holdStartMs !== null &&
          slot.lastSeenMs !== null &&
          nowMs - slot.lastSeenMs > this.missGraceMs
        ) {
          slot.holdStartMs = null;
        }
      }
    }

    return triggered;
  }
}
