// test/stagepulse.test.mjs
// Automated Unit & Integration Test Suite for StagePulse

import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationCode, SmartSpectraSDK } from '@smartspectra/node-sdk';
import {
  encodeInsightBuffer,
  decodeInsightBuffer,
} from '../src/insight-decoder.mjs';
import {
  VALIDATION_STAGE_DIRECTIONS,
  WIREFRAME_INDICES,
  computeFaceGeometry,
  computeDiaphragmaticDominance,
  evaluateExpressionCongruence,
  computeBioClutchScroll,
  classifyStagePresence,
} from '../src/biomechanics.mjs';
import { StagePulseEngine } from '../src/spectra-engine.mjs';
import { createStagePulseServer } from '../src/server.mjs';

function buildSyntheticLandmarks478({ mouthGap = 12, yawShift = 0 } = {}) {
  const pts = [];
  for (let i = 0; i < 478; i++) {
    pts.push({ x: 640 + (i % 15) - 7, y: 360 + Math.floor(i / 20) - 12 });
  }
  // Key anatomical anchors used by computeFaceGeometry
  pts[10] = { x: 640, y: 250 };               // Forehead top
  pts[152] = { x: 640, y: 470 };              // Chin bottom (faceHeight = 220)
  pts[33] = { x: 590, y: 330 };               // Left eye outer
  pts[263] = { x: 690, y: 330 };              // Right eye outer (eyeSpan = 100)
  pts[1] = { x: 640 + yawShift, y: 365 };     // Nose tip
  pts[13] = { x: 640, y: 405 };               // Upper inner lip
  pts[14] = { x: 640, y: 405 + mouthGap };    // Lower inner lip
  return pts;
}

test('SmartSpectra SDK v3.4.0 native module loads and exposes ValidationCode & availableCameras', () => {
  assert.equal(typeof SmartSpectraSDK.version, 'string');
  assert.ok(SmartSpectraSDK.version.startsWith('3.4.'));
  assert.equal(ValidationCode.kOk, 0);
  assert.equal(ValidationCode.kFaceNotForward, 17);
  const cameras = SmartSpectraSDK.availableCameras();
  assert.ok(Array.isArray(cameras));
});

test('Insight protobuf encoder and decoder round-trip presage.smartspectra.Insight accurately', () => {
  const original = {
    requestId: 42,
    processedAt: '2026-11-07T14:30:00Z',
    analysis: 'Hold a 2-second breath pause before the metrics reveal.',
    type: 0,
  };
  const encoded = encodeInsightBuffer(original);
  assert.ok(Buffer.isBuffer(encoded));
  assert.ok(encoded.byteLength > 20);

  const decoded = decodeInsightBuffer(encoded, 42);
  assert.equal(decoded.requestId, 42);
  assert.equal(decoded.analysis, original.analysis);
  assert.equal(decoded.error, null);
});

test('All 16 ValidationCode values map to theatrical stage directions and UI adaptations', () => {
  const expectedCodes = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17];
  for (const code of expectedCodes) {
    const entry = VALIDATION_STAGE_DIRECTIONS[code];
    assert.ok(entry, `Missing stage direction for ValidationCode ${code}`);
    assert.equal(typeof entry.title, 'string');
    assert.equal(typeof entry.direction, 'string');
    assert.equal(typeof entry.uiAdaptation, 'string');
  }
});

test('computeFaceGeometry extracts jaw aperture, head pose cone, and 52-point privacy wireframe', () => {
  const closedMouthPts = buildSyntheticLandmarks478({ mouthGap: 2, yawShift: 0 });
  const closedGeo = computeFaceGeometry(closedMouthPts);
  assert.ok(closedGeo);
  assert.ok(closedGeo.jawAperture < 0.08);
  assert.equal(closedGeo.inEyeContactCone, true);
  assert.equal(closedGeo.wireframe.points.length, WIREFRAME_INDICES.length);

  const openMouthPts = buildSyntheticLandmarks478({ mouthGap: 26, yawShift: 35 });
  const openGeo = computeFaceGeometry(openMouthPts);
  assert.ok(openGeo.jawAperture > 0.5);
  assert.equal(openGeo.inEyeContactCone, false);
});

test('computeDiaphragmaticDominance distinguishes abdominal vs thoracic breathing', () => {
  const shallowUpper = [0.8, -0.8, 0.75, -0.75, 0.82, -0.81, 0.79, -0.77];
  const quietLower = [0.1, -0.1, 0.12, -0.09, 0.11, -0.1, 0.08, -0.11];
  const thoracicDdi = computeDiaphragmaticDominance(shallowUpper, quietLower);
  assert.ok(thoracicDdi < 0.25, `Expected low DDI for chest breathing, got ${thoracicDdi}`);

  const quietUpper = [0.12, -0.11, 0.1, -0.12, 0.09, -0.1, 0.11, -0.09];
  const deepLower = [0.85, -0.82, 0.88, -0.84, 0.81, -0.86, 0.83, -0.80];
  const abdominalDdi = computeDiaphragmaticDominance(quietUpper, deepLower);
  assert.ok(abdominalDdi > 0.75, `Expected high DDI for diaphragmatic breathing, got ${abdominalDdi}`);
});

test('evaluateExpressionCongruence scores 8-class expression alignment against beat intent', () => {
  const warmScores = [
    { type: 1, confidence: 0.5 },
    { type: 2, confidence: 0.5 },
    { type: 3, confidence: 0.5 },
    { type: 4, confidence: 0.5 },
    { type: 5, confidence: 55 }, // HAPPY
    { type: 6, confidence: 38 }, // NEUTRAL
    { type: 7, confidence: 1 },
    { type: 8, confidence: 4 },  // SURPRISE
  ];
  const match = evaluateExpressionCongruence(warmScores, 'confident-warmth');
  assert.equal(match.dominant, 'happy');
  assert.ok(match.congruenceScore > 0.85);
});

test('computeBioClutchScroll holds on pause and damps velocity when pulse spikes above baseline', () => {
  const paused = computeBioClutchScroll({
    talking: false,
    jawAperture: 0.1,
    pulseBpm: 70,
    baselineBpm: 68,
    apneaDetected: false,
    inEyeContactCone: true,
  });
  assert.equal(paused.speedMultiplier, 0);
  assert.equal(paused.clutchState, 'paused-breath-gate');

  const normalSpeaking = computeBioClutchScroll({
    talking: true,
    jawAperture: 0.4,
    pulseBpm: 72,
    baselineBpm: 70,
    apneaDetected: false,
    inEyeContactCone: true,
  });
  assert.ok(normalSpeaking.speedMultiplier > 0.8);
  assert.equal(normalSpeaking.cardioDamping, 1.0);

  const elevatedPulseSpeaking = computeBioClutchScroll({
    talking: true,
    jawAperture: 0.4,
    pulseBpm: 98,
    baselineBpm: 70,
    apneaDetected: false,
    inEyeContactCone: true,
  });
  assert.ok(elevatedPulseSpeaking.cardioDamping < 0.8);
  assert.ok(elevatedPulseSpeaking.speedMultiplier < normalSpeaking.speedMultiplier);
});

test('StagePulseEngine enforces pre-hardware consent gate, Speech-Pause Multiplexer, and CSPRNG memory wipe', async () => {
  const engine = new StagePulseEngine();

  await assert.rejects(
    () => engine.startSession({ consentConfirmed: false }),
    /CONSENT_REQUIRED/
  );

  // Feed a talking frame: breathing speechHold must engage
  const talkingSnap = engine.ingestDecodedMetrics({
    face: {
      talking: [{ detected: true, stable: true }],
      blinking: [{ detected: false, stable: true }],
      landmarks: [{ value: buildSyntheticLandmarks478({ mouthGap: 20 }) }],
      expression: [{
        scores: [
          { type: 1, confidence: 60 },
          { type: 2, confidence: 35 },
        ],
      }],
    },
    cardio: {
      pulseRate: [{ value: 71.4, confidence: 84.0, stable: true }],
      arterialPressureTrace: [{ value: 0.22, confidence: 84.0, stable: true }],
    },
    breathing: {
      upperTrace: [{ value: 0.42, stable: true }],
      lowerTrace: [{ value: 0.65, stable: true }],
    },
  }, 15_000_000);

  assert.equal(talkingSnap.talking, true);
  assert.equal(talkingSnap.breathing.speechHold, true);
  assert.equal(talkingSnap.cardio.pulseBpm, 71.4);

  // Feed a silent pause frame: Speech-Pause Multiplexer unlocks respiratory refill
  const silentSnap = engine.ingestDecodedMetrics({
    face: {
      talking: [{ detected: false, stable: true }],
    },
    breathing: {
      rate: [{ value: 12.6, confidence: 72.0, stable: true }],
      upperTrace: [{ value: 0.15, stable: true }],
      lowerTrace: [{ value: 0.78, stable: true }],
      inhaleExhaleRatio: [{ value: 0.82, stable: true }],
    },
  }, 31_000_000);

  assert.equal(silentSnap.talking, false);
  assert.equal(silentSnap.breathing.speechHold, false);
  assert.equal(silentSnap.breathing.rateBpm, 12.6);

  // Execute CSPRNG cryptographic memory wipe
  const receipt = await engine.cryptographicWipeAndReset();
  assert.equal(receipt.bytesOverwritten, 32768);
  assert.equal(receipt.slotsZeroed, 4096);
  assert.equal(receipt.allZeroAfterWipe, true);
  assert.equal(receipt.verificationDigestSha256.length, 64);
});

test('HTTP and WebSocket server exposes health, scripts, cameras, and privacy wipe endpoints', async () => {
  const srv = createStagePulseServer({ port: 0 });
  const port = await srv.listen();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.ok(health.sdkVersion.startsWith('3.4.'));

    const scripts = await fetch(`${baseUrl}/api/scripts`).then((r) => r.json());
    assert.ok(scripts.scripts.length >= 2);
    assert.ok(scripts.curveballs.length >= 3);

    const wipe = await fetch(`${baseUrl}/api/privacy/wipe`, { method: 'POST' }).then((r) => r.json());
    assert.equal(wipe.ok, true);
    assert.equal(wipe.receipt.allZeroAfterWipe, true);
  } finally {
    await srv.close();
  }
});
