import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGesturesFromResult,
  GestureTriggerTracker,
  HandLandmarkPoint,
  isPeaceHand,
  isThumbsUpHand,
  isTwoHandHeart,
} from './charadesGestures';

function makeEmptyHand(): HandLandmarkPoint[] {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

function makeThumbsUpHand(): HandLandmarkPoint[] {
  const lm = makeEmptyHand();
  lm[0] = { x: 0.5, y: 0.65, z: 0 }; // wrist
  lm[1] = { x: 0.47, y: 0.58, z: 0 };
  lm[2] = { x: 0.46, y: 0.52, z: 0 }; // thumb MCP
  lm[3] = { x: 0.46, y: 0.43, z: 0 }; // thumb IP
  lm[4] = { x: 0.46, y: 0.34, z: 0 }; // thumb tip pointing up
  lm[5] = { x: 0.53, y: 0.54, z: 0 }; // index MCP
  lm[6] = { x: 0.57, y: 0.55, z: 0 };
  lm[8] = { x: 0.52, y: 0.58, z: 0 }; // index curled
  lm[9] = { x: 0.54, y: 0.59, z: 0 };
  lm[10] = { x: 0.57, y: 0.60, z: 0 };
  lm[12] = { x: 0.52, y: 0.61, z: 0 }; // middle curled
  lm[13] = { x: 0.54, y: 0.63, z: 0 };
  lm[14] = { x: 0.56, y: 0.64, z: 0 };
  lm[16] = { x: 0.52, y: 0.64, z: 0 }; // ring curled
  lm[17] = { x: 0.53, y: 0.66, z: 0 };
  lm[18] = { x: 0.55, y: 0.67, z: 0 };
  lm[20] = { x: 0.51, y: 0.66, z: 0 }; // pinky curled
  return lm;
}

function makePeaceHand(): HandLandmarkPoint[] {
  const lm = makeEmptyHand();
  lm[0] = { x: 0.5, y: 0.72, z: 0 }; // wrist
  lm[2] = { x: 0.45, y: 0.64, z: 0 };
  lm[3] = { x: 0.48, y: 0.60, z: 0 };
  lm[4] = { x: 0.50, y: 0.59, z: 0 }; // thumb tucked
  // Index extended up-left
  lm[5] = { x: 0.46, y: 0.56, z: 0 };
  lm[6] = { x: 0.44, y: 0.47, z: 0 };
  lm[8] = { x: 0.41, y: 0.36, z: 0 };
  // Middle extended up-right (V-shape)
  lm[9] = { x: 0.51, y: 0.55, z: 0 };
  lm[10] = { x: 0.53, y: 0.46, z: 0 };
  lm[12] = { x: 0.56, y: 0.35, z: 0 };
  // Ring curled
  lm[13] = { x: 0.54, y: 0.58, z: 0 };
  lm[14] = { x: 0.56, y: 0.61, z: 0 };
  lm[16] = { x: 0.53, y: 0.64, z: 0 };
  // Pinky curled
  lm[17] = { x: 0.56, y: 0.61, z: 0 };
  lm[18] = { x: 0.57, y: 0.64, z: 0 };
  lm[20] = { x: 0.55, y: 0.66, z: 0 };
  return lm;
}

function makeHeartHands(): [HandLandmarkPoint[], HandLandmarkPoint[]] {
  const left = makeEmptyHand();
  // Left half of heart (knuckles bow left, tips meet at center x=0.5)
  left[0] = { x: 0.36, y: 0.68, z: 0 };
  left[4] = { x: 0.49, y: 0.62, z: 0 }; // bottom V thumb tip
  left[5] = { x: 0.37, y: 0.46, z: 0 }; // knuckle bowed left
  left[8] = { x: 0.49, y: 0.42, z: 0 }; // top arch index tip
  left[9] = { x: 0.35, y: 0.52, z: 0 }; // middle MCP gives ~0.16 hand scale
  left[12] = { x: 0.49, y: 0.41, z: 0 };

  const right = makeEmptyHand();
  // Right half of heart (knuckles bow right, tips meet at center x=0.5)
  right[0] = { x: 0.64, y: 0.68, z: 0 };
  right[4] = { x: 0.51, y: 0.62, z: 0 }; // bottom V thumb tip
  right[5] = { x: 0.63, y: 0.46, z: 0 }; // knuckle bowed right
  right[8] = { x: 0.51, y: 0.42, z: 0 }; // top arch index tip
  right[9] = { x: 0.65, y: 0.52, z: 0 };
  right[12] = { x: 0.51, y: 0.41, z: 0 };

  return [left, right];
}

function makePrayerHands(): [HandLandmarkPoint[], HandLandmarkPoint[]] {
  const left = makeEmptyHand();
  left[0] = { x: 0.49, y: 0.68, z: 0 };
  left[4] = { x: 0.49, y: 0.52, z: 0 };
  left[5] = { x: 0.49, y: 0.48, z: 0 };
  left[8] = { x: 0.49, y: 0.34, z: 0 };
  left[9] = { x: 0.49, y: 0.48, z: 0 };
  left[12] = { x: 0.49, y: 0.32, z: 0 };

  const right = makeEmptyHand();
  right[0] = { x: 0.51, y: 0.68, z: 0 };
  right[4] = { x: 0.51, y: 0.52, z: 0 };
  right[5] = { x: 0.51, y: 0.48, z: 0 };
  right[8] = { x: 0.51, y: 0.34, z: 0 };
  right[9] = { x: 0.51, y: 0.48, z: 0 };
  right[12] = { x: 0.51, y: 0.32, z: 0 };

  return [left, right];
}

describe('Charades Hand Gesture Geometry', () => {
  it('detects two-hand heart and rejects single hand or prayer/random hands', () => {
    const [left, right] = makeHeartHands();
    assert.equal(isTwoHandHeart([left, right]), true);
    assert.equal(isTwoHandHeart([left]), false);

    const [pLeft, pRight] = makePrayerHands();
    assert.equal(isTwoHandHeart([pLeft, pRight]), false);

    // Separated hands waving apart should not trigger heart
    const farRight = right.map((pt) => ({ ...pt, x: pt.x + 0.3 }));
    assert.equal(isTwoHandHeart([left, farRight]), false);
  });

  it('detects genuine thumbs-up and rejects open palm or low confidence', () => {
    const thumb = makeThumbsUpHand();
    assert.equal(
      isThumbsUpHand(thumb, [{ categoryName: 'Thumb_Up', score: 0.88 }]),
      true
    );
    assert.equal(
      isThumbsUpHand(thumb, [{ categoryName: 'Thumb_Up', score: 0.35 }]),
      false
    );
    // Peace hand should never pass as thumbs up even if misclassified
    const peace = makePeaceHand();
    assert.equal(
      isThumbsUpHand(peace, [{ categoryName: 'Thumb_Up', score: 0.9 }]),
      false
    );
  });

  it('detects peace sign and rejects curled or closed fingers', () => {
    const peace = makePeaceHand();
    assert.equal(
      isPeaceHand(peace, [{ categoryName: 'Victory', score: 0.89 }]),
      true
    );
    assert.equal(
      isPeaceHand(peace, [{ categoryName: 'Victory', score: 0.4 }]),
      false
    );
    const thumb = makeThumbsUpHand();
    assert.equal(
      isPeaceHand(thumb, [{ categoryName: 'Victory', score: 0.92 }]),
      false
    );
  });

  it('evaluates multiple gestures independently', () => {
    const thumb = makeThumbsUpHand();
    const peace = makePeaceHand();
    const map = evaluateGesturesFromResult({
      landmarks: [thumb, peace],
      gestures: [
        [{ categoryName: 'Thumb_Up', score: 0.9 }],
        [{ categoryName: 'Victory', score: 0.91 }],
      ],
    });
    assert.deepEqual(map, { heart: false, thumbs_up: true, peace: true });
  });
});

describe('GestureTriggerTracker Hold, Cooldown & Release Logic', () => {
  const NONE = { heart: false, thumbs_up: false, peace: false };
  const HEART = { heart: true, thumbs_up: false, peace: false };
  const THUMB = { heart: false, thumbs_up: true, peace: false };
  const PEACE = { heart: false, thumbs_up: false, peace: true };

  it('requires ~650ms sustained hold before triggering and rejects brief flashes', () => {
    const tracker = new GestureTriggerTracker();
    // Brief 300ms flash then gone
    assert.deepEqual(tracker.update(HEART, 1000), []);
    assert.deepEqual(tracker.update(HEART, 1300), []);
    assert.deepEqual(tracker.update(NONE, 1600), []);

    // Sustained 650ms hold
    assert.deepEqual(tracker.update(HEART, 2000), []);
    assert.deepEqual(tracker.update(HEART, 2400), []);
    assert.deepEqual(tracker.update(HEART, 2650), ['heart']);
  });

  it('never repeats while player holds gesture even past 3s cooldown', () => {
    const tracker = new GestureTriggerTracker();
    assert.deepEqual(tracker.update(THUMB, 1000), []);
    assert.deepEqual(tracker.update(THUMB, 1650), ['thumbs_up']);

    // Hold continuously for 6 more seconds
    for (let t = 2000; t <= 8000; t += 250) {
      assert.deepEqual(tracker.update(THUMB, t), []);
    }
  });

  it('enforces 3s cooldown AND requires release before re-triggering', () => {
    const tracker = new GestureTriggerTracker();
    assert.deepEqual(tracker.update(PEACE, 1000), []);
    assert.deepEqual(tracker.update(PEACE, 1650), ['peace']);

    // Release gesture at 2000-2300ms
    assert.deepEqual(tracker.update(NONE, 2000), []);
    assert.deepEqual(tracker.update(NONE, 2300), []);

    // Re-show before 3s cooldown (1650 + 3000 = 4650) expires: must NOT trigger
    assert.deepEqual(tracker.update(PEACE, 2600), []);
    assert.deepEqual(tracker.update(PEACE, 3500), []);
    assert.deepEqual(tracker.update(PEACE, 4500), []);

    // Release again, wait until cooldown passes, then hold 650ms -> triggers
    assert.deepEqual(tracker.update(NONE, 4600), []);
    assert.deepEqual(tracker.update(NONE, 4850), []);
    assert.deepEqual(tracker.update(PEACE, 5000), []);
    assert.deepEqual(tracker.update(PEACE, 5650), ['peace']);
  });

  it('tracks different gestures independently without blocking each other', () => {
    const tracker = new GestureTriggerTracker();
    assert.deepEqual(tracker.update(THUMB, 1000), []);
    assert.deepEqual(tracker.update(THUMB, 1650), ['thumbs_up']);

    // Immediately switch to peace while thumbs_up is on 3s cooldown
    assert.deepEqual(tracker.update(PEACE, 1800), []);
    assert.deepEqual(tracker.update(PEACE, 2450), ['peace']);
  });
});
