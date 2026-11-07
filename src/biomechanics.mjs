// src/biomechanics.mjs
// StagePulse Real-Time Biomechanical & Signal-Fusion Engine.
// Respects Presage SmartSpectra v3.4.0 confidence gates, warm-up windows,
// and Model Card operating constraints (e.g., respiratory metrics gated by face.talking === false).

export const EXPRESSION_NAMES = Object.freeze({
  0: 'UNSPECIFIED',
  1: 'ANGRY',
  2: 'CONTEMPT',
  3: 'DISGUST',
  4: 'FEAR',
  5: 'HAPPY',
  6: 'NEUTRAL',
  7: 'SAD',
  8: 'SURPRISE',
});

export const WIREFRAME_INDICES = Object.freeze([
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  33, 133, 159, 145, 263, 362, 386, 374, 1, 4, 13, 14, 61, 291, 0, 17,
]);

// Target expression profiles for script beat tags (non-diagnostic delivery congruence)
export const BEAT_INTENT_PROFILES = Object.freeze({
  warm_opening:        { HAPPY: 0.55, NEUTRAL: 0.35, SURPRISE: 0.10 },
  'confident-warmth':  { HAPPY: 0.55, NEUTRAL: 0.35, SURPRISE: 0.10 },
  high_energy:         { HAPPY: 0.45, SURPRISE: 0.35, NEUTRAL: 0.20 },
  'measured-urgency':  { HAPPY: 0.45, SURPRISE: 0.35, NEUTRAL: 0.20 },
  serious_problem:     { NEUTRAL: 0.70, SAD: 0.15, SURPRISE: 0.15 },
  'analytical-gravity':{ NEUTRAL: 0.70, SAD: 0.15, SURPRISE: 0.15 },
  calm_closing:        { NEUTRAL: 0.55, HAPPY: 0.45 },
  'calm-resolve':      { NEUTRAL: 0.55, HAPPY: 0.45 },
  'composed-authority':{ NEUTRAL: 0.60, HAPPY: 0.40 },
});

const RAW_VALIDATION_DIRECTIONS = {
  0:  { name: 'kOk',                 badge: 'OPTICAL LOCK READY', uiAdapt: 'normal',          direction: 'Framing locked. Stage spotlight is yours.' },
  1:  { name: 'kNoFaceFound',        badge: 'NO FACE DETECTED',   uiAdapt: 'pause',           direction: 'Step into the spotlight: no speaker detected in frame.' },
  2:  { name: 'kMultipleFacesFound', badge: 'SOLO SPEAKER ONLY',  uiAdapt: 'warn',            direction: 'Multiple faces detected: StagePulse requires a single consenting speaker.' },
  3:  { name: 'kFaceNotCentered',    badge: 'CENTER STAGE',       uiAdapt: 'guide_ring',      direction: 'Drift toward center stage to align with the camera optical axis.' },
  4:  { name: 'kFaceSizeOutOfRange', badge: 'ADJUST DISTANCE',    uiAdapt: 'guide_ring',      direction: 'Adjust your distance from the lens so your face and upper torso fit the guide.' },
  5:  { name: 'kTooDark',            badge: 'LOW ILLUMINATION',   uiAdapt: 'keylight-boost',  direction: 'Front light is low: activating Screen Key-Light Border to illuminate your face.' },
  6:  { name: 'kTooBright',          badge: 'OVEREXPOSED GLARE',  uiAdapt: 'keylight-dim',    direction: 'Overexposed frame: switching stage to Deep Obsidian contrast; reduce backlight.' },
  7:  { name: 'kChestNotVisible',    badge: 'SHOW UPPER TORSO',   uiAdapt: 'guide_ring',      direction: 'Tilt camera down or step back 25 cm so your upper chest and abdomen are visible for breathing.' },
  10: { name: 'kCameraTuning',       badge: 'OPTICS CONVERGING',  uiAdapt: 'tuning',          direction: 'Camera exposure and white balance converging: hold steady for a beat.' },
  11: { name: 'kFrameRateTooLow',    badge: 'LOW CAMERA FPS',     uiAdapt: 'lite_gfx',        direction: 'Camera dropped below 25 FPS: improve front light for optimal physiological lock.' },
  12: { name: 'kExcessiveMotion',    badge: 'PLANT YOUR STANCE',  uiAdapt: 'hold_vitals',     direction: 'High head or body motion: plant your stance so pulse and breathing lock cleanly.' },
  13: { name: 'kFaceTooClose',       badge: 'STEP BACK SLIGHTLY', uiAdapt: 'guide_ring',      direction: 'Step slightly back from the webcam lens.' },
  14: { name: 'kFaceTooFar',         badge: 'STEP CLOSER',        uiAdapt: 'guide_ring',      direction: 'Move a half-step closer to the webcam lens.' },
  15: { name: 'kFaceTooHigh',        badge: 'LOWER CHIN SLIGHTLY',uiAdapt: 'shift_up',        direction: 'Your face is high in frame: shifting teleprompter eye-line upward.' },
  16: { name: 'kFaceTooLow',         badge: 'RAISE CAMERA TILT',  uiAdapt: 'shift_down',      direction: 'Your face is low in frame: shifting teleprompter eye-line downward.' },
  17: { name: 'kFaceNotForward',     badge: 'FACE CAMERA LENS',   uiAdapt: 'lens_beacon',     direction: 'Face the camera lens directly for optimal eye-contact and pulse sensing.' },
};

export const VALIDATION_STAGE_DIRECTIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_VALIDATION_DIRECTIONS).map(([code, item]) => [
      code,
      Object.freeze({
        ...item,
        title: item.badge,
        uiAdaptation: item.uiAdapt,
        severity: Number(code) === 0 ? 'ready' : 'warn',
      }),
    ])
  )
);

/**
 * Compute jaw aperture, webcam lens eye-contact score, and vocal tract posture
 * from the 478 2D facial landmarks emitted by SmartSpectra `face.landmarks`.
 */
export function computeFaceGeometry(landmarksPoints) {
  if (!Array.isArray(landmarksPoints) || landmarksPoints.length < 264) {
    return {
      landmarkCount: Array.isArray(landmarksPoints) ? landmarksPoints.length : 0,
      jawAperture: 0,
      eyeContactScore: 1,
      inEyeContactCone: true,
      yawDeg: 0,
      pitchDeg: 0,
      postureScore: 100,
      headYawRatio: 0,
      bbox: null,
      keyPoints: [],
      wireframe: { points: [], groups: {} },
    };
  }

  const dist = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
  const nose = landmarksPoints[1];
  const upperLip = landmarksPoints[13];
  const lowerLip = landmarksPoints[14];
  const leftEye = landmarksPoints[33];
  const rightEye = landmarksPoints[263];
  const chin = landmarksPoints[152];

  const noseToChin = Math.max(dist(nose, chin), 1e-4);
  const eyeSpan = Math.max(dist(leftEye, rightEye), 1e-4);
  const lipGap = dist(upperLip, lowerLip);

  const jawAperture = Math.min(1, Math.max(0, lipGap / (noseToChin * 0.28)));

  const leftSpan = dist(nose, leftEye);
  const rightSpan = dist(nose, rightEye);
  const headYawRatio = (leftSpan - rightSpan) / eyeSpan;
  const eyeContactScore = Math.min(1, Math.max(0, 1 - Math.abs(headYawRatio) * 1.75));
  const yawDeg = Number((headYawRatio * 42).toFixed(1));
  const pitchDeg = Number((((nose.y - (leftEye.y + rightEye.y) * 0.5) / noseToChin - 0.32) * 35).toFixed(1));
  const inEyeContactCone = Math.abs(yawDeg) <= 14 && eyeContactScore >= 0.55;

  const verticalRatio = noseToChin / eyeSpan;
  const postureNorm = Math.min(1, Math.max(0, (verticalRatio - 0.50) / 0.34));
  const postureScore = Math.round(postureNorm * 100);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < landmarksPoints.length; i++) {
    const p = landmarksPoints[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);

  const keyPoints = WIREFRAME_INDICES
    .filter((idx) => idx < landmarksPoints.length)
    .map((idx) => ({
      i: idx,
      x: Number(((landmarksPoints[idx].x - minX) / w).toFixed(3)),
      y: Number(((landmarksPoints[idx].y - minY) / h).toFixed(3)),
    }));

  const wireframe = {
    points: keyPoints,
    groups: {
      jawline: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      leftBrow: [31, 32, 33, 34, 35],
      rightBrow: [1, 2, 3, 4, 5],
      leftEye: [36, 38, 37, 39],
      rightEye: [40, 42, 41, 43],
      noseBridge: [44, 45],
      lips: [48, 50, 49, 51, 47, 46],
    },
  };

  return {
    landmarkCount: landmarksPoints.length,
    jawAperture: Number(jawAperture.toFixed(3)),
    eyeContactScore: Number(eyeContactScore.toFixed(3)),
    inEyeContactCone,
    yawDeg,
    pitchDeg,
    postureScore,
    headYawRatio: Number(headYawRatio.toFixed(3)),
    bbox: { minX: Math.round(minX), minY: Math.round(minY), width: Math.round(w), height: Math.round(h) },
    keyPoints,
    wireframe,
  };
}

/**
 * Compute Diaphragmatic Dominance Index (DDI) from rolling thoracic (upperTrace)
 * and abdominal (lowerTrace) respiratory waveforms during quiet/non-talking windows.
 */
export function computeDiaphragmaticDominance(upperWindow, lowerWindow) {
  const rms = (arr) => {
    if (!Array.isArray(arr) || arr.length < 3) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sq = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return Math.sqrt(sq);
  };
  const uRms = rms(upperWindow);
  const lRms = rms(lowerWindow);
  if (uRms + lRms < 1e-5) return 0.5;
  return Number((lRms / (lRms + uRms + 1e-6)).toFixed(3));
}

/**
 * Normalize SmartSpectra's 8-class `ExpressionScore[]` array into a clean map
 * and compute cosine congruence against the current script beat's delivery tone.
 */
export function evaluateExpressionCongruence(scoresArray, beatTone = 'warm_opening') {
  const distribution = {
    ANGRY: 0,
    CONTEMPT: 0,
    DISGUST: 0,
    FEAR: 0,
    HAPPY: 0,
    NEUTRAL: 0,
    SAD: 0,
    SURPRISE: 0,
  };

  if (Array.isArray(scoresArray)) {
    for (const item of scoresArray) {
      const name = typeof item.type === 'string'
        ? item.type.toUpperCase()
        : (EXPRESSION_NAMES[item.type] || 'UNSPECIFIED');
      if (name in distribution) {
        distribution[name] = Number((item.confidence ?? 0).toFixed(1));
      }
    }
  }

  let dominantUpper = 'NEUTRAL';
  let maxScore = -1;
  for (const [k, v] of Object.entries(distribution)) {
    if (v > maxScore) {
      maxScore = v;
      dominantUpper = k;
    }
  }

  const LOWER_NAME_MAP = {
    NEUTRAL: 'neutral',
    HAPPY: 'happy',
    SAD: 'sad',
    SURPRISE: 'surprised',
    FEAR: 'fearful',
    DISGUST: 'disgusted',
    ANGRY: 'angry',
    CONTEMPT: 'contemptuous',
  };

  const probabilities = {
    neutral: Number(((distribution.NEUTRAL || 0) / 100).toFixed(3)),
    happy: Number(((distribution.HAPPY || 0) / 100).toFixed(3)),
    sad: Number(((distribution.SAD || 0) / 100).toFixed(3)),
    surprised: Number(((distribution.SURPRISE || 0) / 100).toFixed(3)),
    fearful: Number(((distribution.FEAR || 0) / 100).toFixed(3)),
    disgusted: Number(((distribution.DISGUST || 0) / 100).toFixed(3)),
    angry: Number(((distribution.ANGRY || 0) / 100).toFixed(3)),
    contemptuous: Number(((distribution.CONTEMPT || 0) / 100).toFixed(3)),
  };

  const profile = BEAT_INTENT_PROFILES[beatTone] || BEAT_INTENT_PROFILES.warm_opening;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const k of Object.keys(distribution)) {
    const a = (distribution[k] || 0) / 100;
    const b = profile[k] || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const congruence = normA > 1e-6 && normB > 1e-6
    ? Math.min(1, Math.max(0, dot / (Math.sqrt(normA) * Math.sqrt(normB))))
    : 0.78;

  return {
    distribution,
    probabilities,
    dominant: LOWER_NAME_MAP[dominantUpper] || dominantUpper.toLowerCase(),
    dominantUpper,
    congruenceScore: Number(congruence.toFixed(3)),
  };
}

/**
 * Compute Bio-Clutch Teleprompter scroll velocity multiplier.
 */
export function computeBioClutchScroll({
  talking,
  jawAperture = 0.2,
  pulseBpm,
  baselinePulseBpm,
  baselineBpm,
  apneaDetected = false,
}) {
  const effectiveBaseline = baselinePulseBpm ?? baselineBpm ?? null;
  if (apneaDetected) {
    return {
      velocityMultiplier: 0,
      speedMultiplier: 0,
      cardioDamping: 1,
      mode: 'apnea_gate',
      clutchState: 'apnea-rescue',
      reason: 'Breath-hold detected during pause: take a calm refill breath to resume.',
    };
  }
  if (!talking) {
    return {
      velocityMultiplier: 0,
      speedMultiplier: 0,
      cardioDamping: 1,
      mode: 'deliberate_pause',
      clutchState: 'paused-breath-gate',
      reason: 'Speaking paused: teleprompter holding position and sampling recovery breath.',
    };
  }

  let cardioDamping = 1.0;
  if (pulseBpm && effectiveBaseline && effectiveBaseline > 35) {
    const ratio = pulseBpm / effectiveBaseline;
    if (ratio > 1.12) {
      cardioDamping = Math.max(0.68, Number((1 - (ratio - 1.12) * 0.85).toFixed(3)));
    }
  }

  const articulationBoost = Math.min(1.30, Math.max(0.65, 0.78 + jawAperture * 0.55));
  const velocityMultiplier = Number((articulationBoost * cardioDamping).toFixed(3));

  return {
    velocityMultiplier,
    speedMultiplier: velocityMultiplier,
    cardioDamping,
    mode: cardioDamping < 0.95 ? 'paced_damping' : 'bio_clutch_active',
    clutchState: cardioDamping < 0.95 ? 'cardio-damped' : 'engaged',
    reason: cardioDamping < 0.95
      ? `Pulse elevated above baseline (${Math.round(pulseBpm)} vs ${Math.round(effectiveBaseline)} BPM): applying ${(100 - cardioDamping * 100).toFixed(0)}% viscous tempo damping.`
      : 'Scrolling locked to live vocal articulation cadence.',
  };
}

/**
 * Classify non-medical Stage Presence Quadrant once signals unlock.
 */
export function classifyStagePresence({
  pulseBpm,
  baselinePulseBpm,
  baselineBpm,
  hrv,
  ddi = 0.5,
  apneaDetected = false,
  talking = false,
}) {
  const effectiveBaseline = baselinePulseBpm ?? baselineBpm ?? null;
  if (apneaDetected) {
    return {
      id: 'breath_hold_pause',
      quadrant: 'OVER-CLENCHED',
      label: 'Breath-Hold Pause',
      coaching: 'Unconscious breath-hold detected. Soften your shoulders and take a quiet abdominal refill breath.',
    };
  }
  const pulseElevated = pulseBpm && effectiveBaseline ? pulseBpm > effectiveBaseline * 1.12 : false;
  const highBaevsky = hrv && typeof hrv.baevsky === 'number' ? hrv.baevsky > 180 : false;
  const strongDiaphragm = ddi >= 0.48;

  if (pulseElevated && !highBaevsky && strongDiaphragm) {
    return {
      id: 'commanding_flow',
      quadrant: 'ELECTRIC URGENCY',
      label: 'Commanding Flow',
      coaching: 'Energized pulse paired with grounded vagal composure and diaphragmatic support.',
    };
  }
  if (pulseElevated && (highBaevsky || !strongDiaphragm)) {
    return {
      id: 'wired_rushing',
      quadrant: 'OVER-CLENCHED',
      label: 'High-Tempo Drive',
      coaching: 'Elevated tempo detected: lean into your next [BREATH GATE] pause and let the teleprompter damp your pace.',
    };
  }
  return {
    id: 'grounded_poise',
    quadrant: 'MAGNETIC COMMAND',
    label: 'Grounded Poise',
    coaching: talking
      ? 'Steady vocal cadence and balanced physiological baseline.'
      : 'Quiet recovery window active: measuring respiratory refill.',
  };
}
