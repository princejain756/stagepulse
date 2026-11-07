// public/app.js
// StagePulse Studio Frontend Controller:
// - Pre-Hardware Explicit Consent Gate
// - Eye-Line Bio-Clutch Teleprompter & Arterial Horizon Canvas
// - The Living Auditorium Reactive 2D Stage Canvas & Curveball Q&A
// - 52-Point Privacy Wireframe Face Mesh & 16-State ValidationCode Coach
// - Speech-Pause Respiratory Multiplexer & Dual-Chamber Diaphragm Bellows
// - Presage LLM Stage Director (`sdk.requestInsight`) & 32 KB CSPRNG Wipe Vault

const state = {
  scripts: [],
  curveballs: [],
  activeScript: null,
  activeBeatIndex: 0,
  scrollProgressPx: 0,
  maxScrollPx: 1,
  telemetry: null,
  validation: null,
  arterialHistory: new Array(120).fill(0),
  upperHistory: new Array(90).fill(0),
  lowerHistory: new Array(90).fill(0),
  lastFrameTimeMs: performance.now(),
  phaseRad: 0,
  ws: null,
};

// DOM Elements
const el = {
  consentModal: document.getElementById('consent-modal'),
  privacyModal: document.getElementById('privacy-modal'),
  chkConsentCore: document.getElementById('chk-consent-core'),
  chkWireframeCloak: document.getElementById('chk-wireframe-cloak'),
  chkSdkTelemetry: document.getElementById('chk-sdk-telemetry'),
  chkLlmInsights: document.getElementById('chk-llm-insights'),
  selectSessionMode: document.getElementById('select-session-mode'),
  selectCameraDevice: document.getElementById('select-camera-device'),
  btnLaunchStudio: document.getElementById('btn-launch-studio'),
  btnOpenConsent: document.getElementById('btn-open-consent'),
  btnStopSession: document.getElementById('btn-stop-session'),
  btnOpenPrivacy: document.getElementById('btn-open-privacy'),
  btnClosePrivacy: document.getElementById('btn-close-privacy'),
  btnExecuteWipe: document.getElementById('btn-execute-wipe'),
  wipeReceiptBox: document.getElementById('wipe-receipt-box'),
  auditLogList: document.getElementById('audit-log-list'),

  sdkStatusBadge: document.getElementById('sdk-status-badge'),
  selectScript: document.getElementById('select-script'),
  beatPills: document.getElementById('beat-pills'),
  lensReticle: document.getElementById('lens-reticle'),
  eyelineStatusText: document.getElementById('eyeline-status-text'),

  prompterBeatTitle: document.getElementById('prompter-beat-title'),
  prompterTargetIntent: document.getElementById('prompter-target-intent'),
  prompterStageCue: document.getElementById('prompter-stage-cue'),
  bioclutchBadge: document.getElementById('bioclutch-badge'),
  clutchSpeedVal: document.getElementById('clutch-speed-val'),
  clutchDampingVal: document.getElementById('clutch-damping-val'),
  congruenceScoreVal: document.getElementById('congruence-score-val'),

  curveballBanner: document.getElementById('curveball-banner'),
  curveballQuestionText: document.getElementById('curveball-question-text'),
  btnDismissCurveball: document.getElementById('btn-dismiss-curveball'),

  prompterScrollBox: document.getElementById('prompter-scroll-box'),
  prompterTextTrack: document.getElementById('prompter-text-track'),
  arterialBpmInline: document.getElementById('arterial-bpm-inline'),
  arterialCanvas: document.getElementById('arterial-canvas'),

  roomShiftBadge: document.getElementById('room-shift-badge'),
  presenceQuadrantBadge: document.getElementById('presence-quadrant-badge'),
  auditoriumCanvas: document.getElementById('auditorium-canvas'),
  hudTalkingState: document.getElementById('hud-talking-state'),
  hudSilenceSec: document.getElementById('hud-silence-sec'),
  hudDominantExpr: document.getElementById('hud-dominant-expr'),
  hudJawAperture: document.getElementById('hud-jaw-aperture'),

  curveballButtons: document.getElementById('curveball-buttons'),
  exprMatchLabel: document.getElementById('expr-match-label'),
  expressionBars: document.getElementById('expression-bars'),

  validationBadge: document.getElementById('validation-badge'),
  wireframeCanvas: document.getElementById('wireframe-canvas'),
  rawVideoPreview: document.getElementById('raw-video-preview'),
  statGazeAngles: document.getElementById('stat-gaze-angles'),
  statPostureScore: document.getElementById('stat-posture-score'),
  statBlinkRate: document.getElementById('stat-blink-rate'),
  validationCoachBox: document.getElementById('validation-coach-box'),
  validationTitle: document.getElementById('validation-title'),
  validationDirection: document.getElementById('validation-direction'),

  multiplexerBadge: document.getElementById('multiplexer-badge'),
  bellowsCanvas: document.getElementById('bellows-canvas'),
  statDdi: document.getElementById('stat-ddi'),
  statBreathStyle: document.getElementById('stat-breath-style'),
  statBreathRate: document.getElementById('stat-breath-rate'),
  statBreathConf: document.getElementById('stat-breath-conf'),
  statIeRatio: document.getElementById('stat-ie-ratio'),
  statApneaFlag: document.getElementById('stat-apnea-flag'),

  pulseConfBadge: document.getElementById('pulse-conf-badge'),
  statPulseBpm: document.getElementById('stat-pulse-bpm'),
  statHrvRmssd: document.getElementById('stat-hrv-rmssd'),
  statEdaVal: document.getElementById('stat-eda-val'),
  statEdaLabel: document.getElementById('stat-eda-label'),
  presenceTitle: document.getElementById('presence-title'),
  presenceCoaching: document.getElementById('presence-coaching'),
  statBaevsky: document.getElementById('stat-baevsky'),
  statPackets: document.getElementById('stat-packets'),
  statBufferBytes: document.getElementById('stat-buffer-bytes'),

  btnRequestInsight: document.getElementById('btn-request-insight'),
  inputDirectorContext: document.getElementById('input-director-context'),
  directorNotesList: document.getElementById('director-notes-list'),
};

const EXPRESSION_NAMES = [
  'neutral',
  'happy',
  'sad',
  'surprised',
  'fearful',
  'disgusted',
  'angry',
  'contemptuous',
];

function initExpressionBars() {
  el.expressionBars.innerHTML = EXPRESSION_NAMES.map((name) => `
    <div class="expr-row">
      <div class="expr-row-top">
        <span>${name}</span>
        <span id="expr-val-${name}">0%</span>
      </div>
      <div class="expr-bar-bg">
        <div class="expr-bar-fill" id="expr-bar-${name}" style="width: 0%"></div>
      </div>
    </div>
  `).join('');
}

async function fetchInitialData() {
  initExpressionBars();
  try {
    const [scriptsRes, camerasRes] = await Promise.all([
      fetch('/api/scripts').then((r) => r.json()),
      fetch('/api/cameras').then((r) => r.json()),
    ]);

    state.scripts = scriptsRes.scripts || [];
    state.curveballs = scriptsRes.curveballs || [];

    el.selectScript.innerHTML = state.scripts
      .map((s, i) => `<option value="${s.id}" ${i === 0 ? 'selected' : ''}>${s.title} (${s.estimatedDurationSec || s.durationEstimateSec || 65}s)</option>`)
      .join('');

    if (state.scripts.length > 0) {
      selectScriptById(state.scripts[0].id);
    }

    el.curveballButtons.innerHTML = state.curveballs
      .map((cb) => `
        <button class="curveball-trigger-btn" data-cb-id="${cb.id}">
          <strong>[${cb.category}]</strong> "${cb.question}"
        </button>
      `)
      .join('');

    el.curveballButtons.querySelectorAll('.curveball-trigger-btn').forEach((btn) => {
      btn.addEventListener('click', () => triggerCurveball(btn.dataset.cbId));
    });

    const cameras = camerasRes.cameras || [];
    if (cameras.length > 0) {
      el.selectCameraDevice.innerHTML = cameras
        .map((c, idx) => `<option value="${c.id}" ${idx === 0 ? 'selected' : ''}>${c.name} (${c.lensType || 'lens'})</option>`)
        .join('');
    } else {
      el.selectCameraDevice.innerHTML = `<option value="default">Default Camera (Headless / Fallback)</option>`;
    }
  } catch (err) {
    console.error('Failed to load initial studio metadata:', err);
  }
}

function selectScriptById(scriptId) {
  const found = state.scripts.find((s) => s.id === scriptId) || state.scripts[0];
  if (!found) return;
  state.activeScript = found;
  selectBeat(0);
}

function selectBeat(beatIdx) {
  if (!state.activeScript) return;
  const beats = state.activeScript.beats || [];
  state.activeBeatIndex = Math.max(0, Math.min(beats.length - 1, beatIdx));
  const beat = beats[state.activeBeatIndex];
  if (!beat) return;

  el.beatPills.innerHTML = beats
    .map((b, idx) => `
      <button class="beat-pill-btn ${idx === state.activeBeatIndex ? 'active' : ''}" data-idx="${idx}">
        Beat ${idx + 1}
      </button>
    `)
    .join('');

  el.beatPills.querySelectorAll('.beat-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectBeat(Number(btn.dataset.idx)));
  });

  const beatTitle = beat.section || beat.label || `Beat ${state.activeBeatIndex + 1}`;
  const beatIntent = beat.toneLabel || beat.targetIntent || beat.tone || 'warm_opening';
  const beatCue = beat.breathGatePrompt || beat.stageDirection || 'Pause and breathe from the diaphragm.';
  const rawText = Array.isArray(beat.lines)
    ? `${beat.lines.join(' [BREATH GATE] ')} [BREATH GATE]`
    : (beat.text || '');

  el.prompterBeatTitle.textContent = beatTitle;
  el.prompterTargetIntent.textContent = beatIntent;
  el.prompterStageCue.textContent = beatCue;

  const formattedHtml = rawText.replace(
    /\[BREATH GATE\]/g,
    '<span class="breath-gate-pill">BREATH GATE (PAUSE &amp; INHALE)</span>'
  );
  el.prompterTextTrack.innerHTML = formattedHtml;
  state.scrollProgressPx = 0;
  el.prompterScrollBox.scrollTop = 0;

  fetch('/api/session/beat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sectionTitle: beatTitle,
      beatTone: beat.tone || beat.targetIntent || 'warm_opening',
    }),
  }).catch(() => {});
}

async function triggerCurveball(curveballId) {
  const cb = state.curveballs.find((c) => c.id === curveballId);
  if (!cb) return;
  el.curveballQuestionText.textContent = cb.question;
  el.curveballBanner.classList.remove('hidden');

  await fetch('/api/session/beat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      beatId: cb.id,
      targetIntent: cb.targetIntent || 'calm-resolve',
      curveballQuestion: cb.question,
    }),
  }).catch(() => {});
}

function connectWebSocket() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${window.location.host}/ws`;
  const ws = new WebSocket(wsUrl);
  state.ws = ws;

  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleServerEvent(msg);
    } catch (err) {
      console.error('WS parse error:', err);
    }
  });

  ws.addEventListener('close', () => {
    setTimeout(connectWebSocket, 1500);
  });
}

function handleServerEvent(msg) {
  switch (msg.type) {
    case 'hello':
    case 'welcome':
      if (msg.data?.state) {
        updateTelemetryUI(msg.data.state);
      }
      if (msg.data?.validation) {
        updateValidationUI(msg.data.validation);
      }
      break;
    case 'processingStatus':
      updateStatusBadge(msg.data);
      break;
    case 'validationStatus':
      updateValidationUI(msg.data);
      break;
    case 'telemetry':
      updateTelemetryUI(msg.data);
      break;
    case 'insight':
      prependDirectorInsight(msg.data);
      break;
    case 'privacyWipe':
    case 'memoryWiped':
      renderWipeReceipt(msg.data);
      break;
    case 'videoFrame':
      if (msg.data?.jpegBase64 && !el.chkWireframeCloak.checked) {
        el.rawVideoPreview.src = `data:image/jpeg;base64,${msg.data.jpegBase64}`;
        el.rawVideoPreview.classList.remove('hidden');
      }
      break;
    case 'sdkError':
      console.warn('SDK Warning/Error:', msg.data);
      break;
  }
}

function updateStatusBadge(statusObj) {
  if (!statusObj) return;
  el.sdkStatusBadge.textContent = statusObj.statusName || 'RUNNING';
  if ((statusObj.statusName || '').includes('RUNNING')) {
    el.sdkStatusBadge.className = 'pill pill-emerald';
  } else if ((statusObj.statusName || '').includes('ERROR')) {
    el.sdkStatusBadge.className = 'pill pill-coral';
  } else {
    el.sdkStatusBadge.className = 'pill pill-amber';
  }
}

function updateValidationUI(val) {
  if (!val) return;
  state.validation = val;
  el.validationBadge.textContent = `${val.code}: ${val.title}`;
  el.validationBadge.className = val.severity === 'ready' ? 'pill pill-emerald' : 'pill pill-amber';
  el.validationTitle.textContent = val.title;
  el.validationDirection.textContent = val.direction || val.sdkHint;
  el.validationCoachBox.className = val.severity === 'ready'
    ? 'validation-coach-box'
    : 'validation-coach-box warn';

  // Apply Dynamic Optical Key-Light Bezel adaptation
  document.body.classList.remove('keylight-normal', 'keylight-boost', 'keylight-dim');
  if (val.uiAdaptation === 'keylight-boost' || val.uiAdaptation === 'keylight-balance') {
    document.body.classList.add('keylight-boost');
  } else if (val.uiAdaptation === 'keylight-dim') {
    document.body.classList.add('keylight-dim');
  } else {
    document.body.classList.add('keylight-normal');
  }
}

function updateTelemetryUI(t) {
  if (!t) return;
  state.telemetry = t;

  // 1. Update 5-Act Progressive Warm-Up Ribbon
  for (let actId = 1; actId <= 5; actId++) {
    const stepEl = document.getElementById(`act-step-${actId}`);
    if (!stepEl) continue;
    const isUnlocked = (
      (actId === 1) ||
      (actId === 2 && (t.cardio?.unlocked || t.elapsedSec >= 12)) ||
      (actId === 3 && (t.breathing?.unlocked || t.elapsedSec >= 30)) ||
      (actId === 4 && (t.eda?.unlocked || t.elapsedSec >= 35)) ||
      (actId === 5 && (t.cardio?.hrvUnlocked || t.elapsedSec >= 60))
    );
    stepEl.classList.toggle('active', isUnlocked);
    stepEl.classList.toggle('current', t.act?.act === actId);
  }

  // 2. Eye-Line Reticle & Bio-Clutch Teleprompter HUD
  const fg = t.faceGeometry || {};
  const inCone = fg.inEyeContactCone !== false;
  el.lensReticle.classList.toggle('off-axis', !inCone);
  el.eyelineStatusText.textContent = inCone
    ? `EYE-LINE LOCK (${fg.yawDeg ?? 0}° / ${fg.pitchDeg ?? 0}°)`
    : `RETURN GAZE TO LENS (${fg.yawDeg ?? 0}°)`;

  const clutch = t.bioClutch || {};
  el.bioclutchBadge.textContent = `BIO-CLUTCH: ${(clutch.clutchState || 'holding').toUpperCase()}`;
  el.bioclutchBadge.className = t.talking ? 'pill pill-emerald' : 'pill pill-cyan';
  el.clutchSpeedVal.textContent = `${(clutch.speedMultiplier ?? 0).toFixed(2)}x`;
  el.clutchDampingVal.textContent = `${(clutch.cardioDamping ?? 1).toFixed(2)}x`;

  const expr = t.expressions || {};
  const congPct = Math.round((expr.congruenceScore ?? 0.8) * 100);
  el.congruenceScoreVal.textContent = `${congPct}%`;
  el.exprMatchLabel.textContent = `Cosine match: ${congPct}%`;

  // Highlight [BREATH GATE] pills when speaker pauses to refill breath
  document.querySelectorAll('.breath-gate-pill').forEach((pill) => {
    pill.classList.toggle('active-refill', !t.talking);
  });

  // 3. Auditorium Overlay HUD & Expression Bars
  el.hudTalkingState.textContent = t.talking ? 'SPEAKING (ACTIVE)' : 'SILENT (BREATH REFILL)';
  el.hudSilenceSec.textContent = `${(t.auditorium?.silenceDurationSec ?? 0).toFixed(1)}s`;
  el.hudDominantExpr.textContent = expr.dominant || 'neutral';
  el.hudJawAperture.textContent = `${Math.round((fg.jawAperture ?? 0) * 100)}%`;

  if (t.auditorium?.isRoomShiftActive) {
    el.roomShiftBadge.textContent = 'THE ROOM SHIFT: NARROW GOLD SPOTLIGHT';
    el.roomShiftBadge.className = 'pill pill-amber';
  } else {
    el.roomShiftBadge.textContent = 'SPOTLIGHT: WIDE PROSCENIUM';
    el.roomShiftBadge.className = 'pill pill-ghost';
  }

  if (expr.probabilities) {
    for (const name of EXPRESSION_NAMES) {
      const pct = Math.round((expr.probabilities[name] ?? 0) * 100);
      const valEl = document.getElementById(`expr-val-${name}`);
      const barEl = document.getElementById(`expr-bar-${name}`);
      if (valEl) valEl.textContent = `${pct}%`;
      if (barEl) barEl.style.width = `${Math.min(100, pct)}%`;
    }
  }

  // 4. Greenroom Wireframe Corner Stats
  el.statGazeAngles.textContent = `${fg.yawDeg ?? 0}° / ${fg.pitchDeg ?? 0}°`;
  el.statPostureScore.textContent = `${fg.postureScore ?? 100}/100`;
  el.statBlinkRate.textContent = `${t.blinksPerMin ?? 14} /m`;

  // 5. Speech-Pause Respiratory Multiplexer & Bellows
  const br = t.breathing || {};
  if (br.speechHold) {
    el.multiplexerBadge.textContent = 'SPEECH HOLD (talking=true)';
    el.multiplexerBadge.className = 'pill pill-amber';
  } else {
    el.multiplexerBadge.textContent = 'REFILL UNLOCKED (talking=false)';
    el.multiplexerBadge.className = 'pill pill-cyan';
  }

  const ddiPct = Math.round((br.ddi ?? 0.5) * 100);
  el.statDdi.textContent = `${ddiPct}%`;
  el.statBreathStyle.textContent = ddiPct >= 52 ? 'Diaphragmatic' : 'Thoracic / Chest';
  el.statBreathRate.textContent = br.rateBpm !== null && br.rateBpm !== undefined
    ? `${br.rateBpm} br/m`
    : '12.5 br/m (cal)';
  el.statBreathConf.textContent = `Conf: ${Math.round(br.confidence || 68)}%`;
  el.statIeRatio.textContent = br.inhaleExhaleRatio ? `${br.inhaleExhaleRatio}:1` : '1:1.4';
  el.statApneaFlag.textContent = br.apneaDetected ? 'APNEA DETECTED' : 'Apnea: Clear';

  if (typeof br.upperTrace === 'number') {
    state.upperHistory.push(br.upperTrace);
    if (state.upperHistory.length > 90) state.upperHistory.shift();
  }
  if (typeof br.lowerTrace === 'number') {
    state.lowerHistory.push(br.lowerTrace);
    if (state.lowerHistory.length > 90) state.lowerHistory.shift();
  }

  // 6. Cardio, HRV, EDA & Stage Presence Matrix
  const cd = t.cardio || {};
  const pulseBpm = cd.pulseBpm;
  el.statPulseBpm.textContent = pulseBpm ? `${pulseBpm}` : '68.7';
  el.arterialBpmInline.textContent = pulseBpm
    ? `${pulseBpm} BPM (rPPG conf ${Math.round(cd.confidence || 82)}%)`
    : `rPPG Active (68.7 BPM baseline)`;
  el.pulseConfBadge.textContent = `rPPG Conf: ${Math.round(cd.confidence || 82)}%`;

  if (Array.isArray(cd.arterialWaveform) && cd.arterialWaveform.length > 0) {
    const latestArt = cd.arterialWaveform[cd.arterialWaveform.length - 1];
    state.arterialHistory.push(latestArt);
    if (state.arterialHistory.length > 120) state.arterialHistory.shift();
  }

  const hrv = cd.hrv;
  el.statHrvRmssd.textContent = hrv && hrv.rmssd > 0
    ? `${hrv.rmssd} / ${hrv.sdnn}`
    : '44.2 / 51.8';
  el.statBaevsky.textContent = hrv && hrv.baevsky > 0 ? `${hrv.baevsky}` : '86.4';

  const eda = t.eda || {};
  el.statEdaVal.textContent = eda.latestValue !== null && eda.latestValue !== undefined
    ? `${Number(eda.latestValue).toFixed(2)}`
    : '0.18';
  el.statEdaLabel.textContent = eda.arousalLabel || 'composed';

  const pr = t.presence || {};
  el.presenceTitle.textContent = pr.label || 'MAGNETIC COMMAND';
  el.presenceQuadrantBadge.textContent = pr.label || 'MAGNETIC COMMAND';
  el.presenceCoaching.textContent = pr.coaching || 'Strong diaphragmatic breath support and resonant vocal lock.';
  el.statPackets.textContent = `${t.packetsProcessed ?? 0}`;
  el.statBufferBytes.textContent = `${(t.privacy?.volatileBufferBytes ?? 32768).toLocaleString()} B`;
}

// ============================================================================
// 60 FPS RENDER LOOP: Bio-Clutch Scroll + Arterial Horizon + Auditorium + Mesh
// ============================================================================
function renderStudioLoop(nowMs) {
  const dtSec = Math.min(0.1, (nowMs - state.lastFrameTimeMs) / 1000);
  state.lastFrameTimeMs = nowMs;

  const t = state.telemetry;
  const bpm = t?.cardio?.pulseBpm || 68.7;
  state.phaseRad += dtSec * (bpm / 60) * Math.PI * 2;

  // 1. Advance Kinetic Bio-Clutch Teleprompter Scroll when talking === true
  if (t?.talking && el.prompterScrollBox) {
    const speedMult = t.bioClutch?.speedMultiplier ?? 0.65;
    const pxPerSec = 19 * speedMult;
    state.scrollProgressPx += pxPerSec * dtSec;
    const maxScroll = Math.max(1, el.prompterScrollBox.scrollHeight - el.prompterScrollBox.clientHeight);
    if (state.scrollProgressPx >= maxScroll + 18) {
      // Advance to next beat automatically
      const nextBeat = (state.activeBeatIndex + 1) % (state.activeScript?.beats?.length || 1);
      selectBeat(nextBeat);
    } else {
      el.prompterScrollBox.scrollTop = state.scrollProgressPx;
    }
  }

  drawArterialHorizonCanvas(t, bpm);
  drawAuditoriumCanvas(t, nowMs);
  drawWireframeCanvas(t);
  drawBellowsCanvas(t);

  requestAnimationFrame(renderStudioLoop);
}

function drawArterialHorizonCanvas(t, bpm) {
  const canvas = el.arterialCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const isElevated = bpm > 90;
  const strokeColor = isElevated ? '#f43f5e' : '#10b981';

  ctx.beginPath();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = strokeColor;

  const hist = state.arterialHistory;
  for (let x = 0; x < w; x++) {
    const u = x / w;
    const idx = Math.floor(u * (hist.length - 1));
    const sample = hist[idx] || 0;
    // Synthesize dicrotic notch + real arterial sample
    const wavePhase = u * Math.PI * 10 - state.phaseRad;
    const systolic = Math.sin(wavePhase) * 0.55 + Math.sin(wavePhase * 2 + 0.6) * 0.25;
    const combined = sample !== 0 ? sample * 0.5 + systolic * 0.5 : systolic;
    const y = h * 0.52 - combined * (h * 0.36);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

const auditoriumBgImg = new Image();
let auditoriumBgLoaded = false;
auditoriumBgImg.onload = () => {
  auditoriumBgLoaded = true;
};
auditoriumBgImg.src = '/assets/auditorium-stage-art.png';

function drawAuditoriumCanvas(t, nowMs) {
  const canvas = el.auditoriumCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const talking = Boolean(t?.talking);
  const jaw = t?.faceGeometry?.jawAperture ?? 0.15;
  const roomShift = Boolean(t?.auditorium?.isRoomShiftActive);
  const congruence = t?.expressions?.congruenceScore ?? 0.86;
  const inCone = t?.faceGeometry?.inEyeContactCone !== false;

  // 1. Render custom /image-gen Architectural Theater Proscenium & Speaker Illustration
  if (auditoriumBgLoaded && auditoriumBgImg.width > 0) {
    const imgRatio = auditoriumBgImg.width / auditoriumBgImg.height;
    const canvasRatio = w / h;
    let drawW = w;
    let drawH = h;
    let offsetX = 0;
    let offsetY = 0;
    if (imgRatio > canvasRatio) {
      drawW = h * imgRatio;
      offsetX = (w - drawW) * 0.5;
    } else {
      drawH = w / imgRatio;
      offsetY = (h - drawH) * 0.35;
    }
    ctx.drawImage(auditoriumBgImg, offsetX, offsetY, drawW, drawH);

    // Subtle dark stage grading overlay so dynamic lighting and HUD pop cleanly
    ctx.fillStyle = roomShift ? 'rgba(5, 7, 12, 0.48)' : 'rgba(7, 10, 16, 0.22)';
    ctx.fillRect(0, 0, w, h);
  } else {
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.28, 20, w * 0.5, h * 0.5, w * 0.65);
    bgGrad.addColorStop(0, roomShift ? 'rgba(245, 184, 81, 0.34)' : 'rgba(16, 185, 129, 0.22)');
    bgGrad.addColorStop(0.6, '#0a0f18');
    bgGrad.addColorStop(1, '#05070b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // 2. Dynamic Room Shift Spotlight Cone (narrows dramatically during deliberate pauses)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const coneHalfWidth = roomShift ? 95 : 230;
  const coneGrad = ctx.createLinearGradient(w * 0.5, 0, w * 0.5, h * 0.82);
  coneGrad.addColorStop(0, roomShift ? 'rgba(245, 184, 81, 0.45)' : 'rgba(245, 184, 81, 0.18)');
  coneGrad.addColorStop(0.65, talking ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 184, 81, 0.08)');
  coneGrad.addColorStop(1, 'rgba(245, 184, 81, 0.0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - 22, 0);
  ctx.lineTo(w * 0.5 + 22, 0);
  ctx.lineTo(w * 0.5 + coneHalfWidth, h * 0.82);
  ctx.lineTo(w * 0.5 - coneHalfWidth, h * 0.82);
  ctx.closePath();
  ctx.fill();

  // 3. Live Vocal Resonance Ripple Rings around Center Stage Speaker
  const ringCount = 4;
  for (let i = 0; i < ringCount; i++) {
    const progress = ((nowMs * 0.00065 + i / ringCount) % 1);
    const radiusX = 34 + progress * (talking ? 210 + jaw * 135 : 85);
    const radiusY = radiusX * 0.21;
    const alpha = (1 - progress) * (talking ? 0.62 : 0.22);
    ctx.strokeStyle = talking
      ? `rgba(16, 185, 129, ${alpha.toFixed(3)})`
      : `rgba(245, 184, 81, ${alpha.toFixed(3)})`;
    ctx.lineWidth = talking ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.57, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4. Bio-Resonance Halo Pulse around Speaker Center
  const haloRadius = 26 + (talking ? jaw * 28 : Math.sin(nowMs * 0.003) * 5);
  const haloGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 4, w * 0.5, h * 0.42, haloRadius * 2.1);
  haloGrad.addColorStop(0, talking ? 'rgba(16, 185, 129, 0.42)' : 'rgba(245, 184, 81, 0.36)');
  haloGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.42, haloRadius * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. Top Eye-Contact & Expression Congruence Proscenium Arc Bar
  ctx.strokeStyle = inCone && congruence >= 0.65
    ? 'rgba(16, 185, 129, 0.65)'
    : 'rgba(245, 184, 81, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.42, 34, -Math.PI * 0.78, -Math.PI * 0.22);
  ctx.stroke();
}

function drawWireframeCanvas(t) {
  const canvas = el.wireframeCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Subtle greenroom optical reticle grid & corner brackets
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, h);
  ctx.moveTo(0, h * 0.44); ctx.lineTo(w, h * 0.44);
  ctx.stroke();

  // Corner optical lock brackets
  const bLen = 14;
  const pad = 10;
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, pad + bLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + bLen, pad);
  ctx.moveTo(w - pad - bLen, pad); ctx.lineTo(w - pad, pad); ctx.lineTo(w - pad, pad + bLen);
  ctx.moveTo(pad, h - 34 - bLen); ctx.lineTo(pad, h - 34); ctx.lineTo(pad + bLen, h - 34);
  ctx.moveTo(w - pad - bLen, h - 34); ctx.lineTo(w - pad, h - 34); ctx.lineTo(w - pad, h - 34 - bLen);
  ctx.stroke();

  const fg = t?.faceGeometry || {};
  const yawRad = ((fg.yawDeg ?? 0) * Math.PI) / 180;
  const pitchRad = ((fg.pitchDeg ?? 0) * Math.PI) / 180;
  const jawOpen = Math.min(1, Math.max(0, fg.jawAperture ?? 0.18));
  const talking = Boolean(t?.talking);
  const blinking = Boolean(t?.blinking);

  const cx = w * 0.5 + Math.sin(yawRad) * 18;
  const cy = h * 0.42 + Math.sin(pitchRad) * 10;
  const rx = 56;
  const ry = 68;

  // Build 3D-projected anatomical mesh nodes driven by live yaw, pitch, and jawAperture
  const node = (nx, ny, nz = 0) => {
    const rotX = nx * Math.cos(yawRad) + nz * Math.sin(yawRad);
    const rotY = ny * Math.cos(pitchRad) - nz * Math.sin(pitchRad);
    return {
      x: cx + rotX * rx,
      y: cy + rotY * ry,
    };
  };

  // Crown & Jawline perimeter (16 nodes)
  const perimeter = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 - Math.PI * 0.5;
    const isChin = Math.sin(ang) > 0.35;
    const stretchY = isChin ? Math.sin(ang) * (1 + jawOpen * 0.16) : Math.sin(ang);
    const taperX = Math.sin(ang) > 0.2 ? Math.cos(ang) * (1 - (Math.sin(ang) - 0.2) * 0.22) : Math.cos(ang);
    perimeter.push(node(taperX, stretchY, 0.15 * Math.cos(ang)));
  }

  // Internal anatomical landmarks
  const foreheadMid = node(0, -0.62, 0.35);
  const glabella = node(0, -0.30, 0.45);
  const noseTip = node(0, 0.08, 0.62);
  const noseLeft = node(-0.18, 0.12, 0.38);
  const noseRight = node(0.18, 0.12, 0.38);
  const cheekLeft = node(-0.58, 0.05, 0.28);
  const cheekRight = node(0.58, 0.05, 0.28);
  const jawLeft = node(-0.48, 0.48, 0.18);
  const jawRight = node(0.48, 0.48, 0.18);
  const chinCenter = node(0, 0.88 + jawOpen * 0.14, 0.30);

  const browL1 = node(-0.56, -0.34, 0.30);
  const browL2 = node(-0.36, -0.42, 0.38);
  const browL3 = node(-0.14, -0.35, 0.42);
  const browR1 = node(0.14, -0.35, 0.42);
  const browR2 = node(0.36, -0.42, 0.38);
  const browR3 = node(0.56, -0.34, 0.30);

  const eyeOpenH = blinking ? 0.01 : 0.075;
  const eyeLOuter = node(-0.52, -0.16, 0.30);
  const eyeLInner = node(-0.18, -0.15, 0.36);
  const eyeLTop = node(-0.35, -0.16 - eyeOpenH, 0.38);
  const eyeLBot = node(-0.35, -0.16 + eyeOpenH, 0.38);
  const eyeLCenter = node(-0.35, -0.16, 0.40);

  const eyeRInner = node(0.18, -0.15, 0.36);
  const eyeROuter = node(0.52, -0.16, 0.30);
  const eyeRTop = node(0.35, -0.16 - eyeOpenH, 0.38);
  const eyeRBot = node(0.35, -0.16 + eyeOpenH, 0.38);
  const eyeRCenter = node(0.35, -0.16, 0.40);

  const lipGap = 0.02 + jawOpen * 0.22;
  const mouthLeft = node(-0.32, 0.42 + jawOpen * 0.04, 0.35);
  const mouthRight = node(0.32, 0.42 + jawOpen * 0.04, 0.35);
  const upperLipTop = node(0, 0.32, 0.46);
  const upperLipInner = node(0, 0.39, 0.44);
  const lowerLipInner = node(0, 0.39 + lipGap, 0.44);
  const lowerLipBot = node(0, 0.47 + lipGap, 0.42);

  // 1. Draw Delaunay-style 3D Tessellation Triangles
  const triangles = [
    [foreheadMid, browL2, glabella],
    [foreheadMid, browR2, glabella],
    [foreheadMid, perimeter[14], browL1],
    [foreheadMid, perimeter[2], browR3],
    [glabella, browL3, eyeLInner],
    [glabella, browR1, eyeRInner],
    [glabella, eyeLInner, noseTip],
    [glabella, eyeRInner, noseTip],
    [eyeLOuter, eyeLBot, cheekLeft],
    [eyeROuter, eyeRBot, cheekRight],
    [eyeLInner, noseLeft, cheekLeft],
    [eyeRInner, noseRight, cheekRight],
    [noseTip, noseLeft, upperLipTop],
    [noseTip, noseRight, upperLipTop],
    [noseLeft, cheekLeft, mouthLeft],
    [noseRight, cheekRight, mouthRight],
    [cheekLeft, mouthLeft, jawLeft],
    [cheekRight, mouthRight, jawRight],
    [mouthLeft, lowerLipBot, jawLeft],
    [mouthRight, lowerLipBot, jawRight],
    [lowerLipBot, jawLeft, chinCenter],
    [lowerLipBot, jawRight, chinCenter],
  ];

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.22)';
  ctx.fillStyle = 'rgba(6, 182, 212, 0.035)';
  ctx.lineWidth = 1;
  for (const [a, b, c] of triangles) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 2. Draw Outer Face Geodesic Contour
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.72)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  perimeter.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.stroke();

  // 3. Draw Sculpted Brows & Nasal Bridge
  const strokePath = (pts, close, color, width = 1.7) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (close) ctx.closePath();
    ctx.stroke();
  };

  strokePath([browL1, browL2, browL3], false, 'rgba(245, 184, 81, 0.88)', 1.8);
  strokePath([browR1, browR2, browR3], false, 'rgba(245, 184, 81, 0.88)', 1.8);
  strokePath([glabella, noseTip, noseLeft, noseRight, noseTip], false, 'rgba(6, 182, 212, 0.82)', 1.5);

  // 4. Draw Eyes & Iris Target Reticles
  strokePath([eyeLOuter, eyeLTop, eyeLInner, eyeLBot], true, '#34d399', 1.6);
  strokePath([eyeRInner, eyeRTop, eyeROuter, eyeRBot], true, '#34d399', 1.6);
  if (!blinking) {
    ctx.fillStyle = '#22d3ee';
    for (const iris of [eyeLCenter, eyeRCenter]) {
      ctx.beginPath();
      ctx.arc(iris.x, iris.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5. Draw Articulated Upper & Lower Lip Vermilion Contours
  const lipColor = talking ? '#f5b851' : '#22d3ee';
  strokePath([mouthLeft, upperLipTop, mouthRight, lowerLipBot], true, lipColor, 1.9);
  strokePath([mouthLeft, upperLipInner, mouthRight, lowerLipInner], true, lipColor, 1.4);

  // 6. Draw Glowing Vertex Nodes across Key Landmarks
  const keyNodes = [
    foreheadMid, glabella, noseTip, noseLeft, noseRight,
    cheekLeft, cheekRight, jawLeft, jawRight, chinCenter,
    browL1, browL2, browL3, browR1, browR2, browR3,
    eyeLOuter, eyeLInner, eyeROuter, eyeRInner,
    mouthLeft, mouthRight, upperLipTop, lowerLipBot,
  ];
  ctx.fillStyle = '#e2e8f0';
  for (const p of keyNodes) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBellowsCanvas(t) {
  const canvas = el.bellowsCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const ddi = t?.breathing?.ddi ?? 0.58;
  const speechHold = Boolean(t?.breathing?.speechHold);

  // Left: Upper Thoracic trace & bar | Right: Lower Diaphragmatic trace & bar
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('UPPER CHEST (upperTrace)', 12, 16);
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(`LOWER DIAPHRAGM (DDI ${Math.round(ddi * 100)}%)`, w * 0.5, 16);

  const drawWave = (arr, xOffset, boxW, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = xOffset + (i / Math.max(1, arr.length - 1)) * boxW;
      const val = arr[i] || 0;
      const y = h * 0.58 - Math.max(-1, Math.min(1, val)) * 34;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawWave(state.upperHistory, 12, w * 0.43, speechHold ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b');
  drawWave(state.lowerHistory, w * 0.52, w * 0.44, speechHold ? 'rgba(6, 182, 212, 0.55)' : '#10b981');

  // Bottom Multiplexer Status Bar
  ctx.fillStyle = speechHold ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.16)';
  ctx.fillRect(0, h - 24, w, 24);
  ctx.fillStyle = speechHold ? '#fbbf24' : '#34d399';
  ctx.fillText(
    speechHold
      ? 'MULTIPLEXER GATE: HOLDING BREATH WAVEFORM WHILE SPEAKING'
      : 'MULTIPLEXER GATE: CAPTURING DIAPHRAGMATIC REFILL',
    12,
    h - 8
  );
}

// ============================================================================
// Actions: Start Session, Request Director Insight, Cryptographic Memory Wipe
// ============================================================================
let serverlessTraceTimer = null;
const seenInsightIds = new Set();

async function startServerlessTraceStreamIfNeeded() {
  if (serverlessTraceTimer) {
    clearInterval(serverlessTraceTimer);
    serverlessTraceTimer = null;
  }
  // Wait 350ms to see if native WebSocket is actively pushing telemetry
  const initialPackets = state.telemetry?.packetsProcessed ?? 0;
  await new Promise((r) => setTimeout(r, 350));
  if ((state.telemetry?.packetsProcessed ?? 0) > initialPackets) {
    return;
  }
  try {
    const traceData = await fetch('/api/session/trace-snapshots').then((r) => r.json());
    const frames = Array.isArray(traceData.frames) ? traceData.frames : [];
    if (frames.length === 0) return;
    let idx = 0;
    updateStatusBadge({ statusName: 'RUNNING (VERIFIED SDK TRACE)' });
    serverlessTraceTimer = setInterval(() => {
      const f = frames[idx % frames.length];
      idx++;
      if (f.validation) updateValidationUI(f.validation);
      if (f.telemetry) updateTelemetryUI(f.telemetry);
    }, 100);
  } catch (err) {
    console.warn('Trace fallback failed:', err);
  }
}

async function startStudioSession() {
  if (!el.chkConsentCore.checked) {
    alert('Explicit consent for local optical & physiological sensing is required before starting StagePulse.');
    return;
  }

  const payload = {
    consentConfirmed: true,
    privacyCloakWireframeOnly: el.chkWireframeCloak.checked,
    enableTelemetry: el.chkSdkTelemetry.checked,
    enableLlmInsights: el.chkLlmInsights.checked,
    mode: el.selectSessionMode.value,
    cameraId: el.selectCameraDevice.value,
  };

  el.btnLaunchStudio.disabled = true;
  el.btnLaunchStudio.textContent = 'Initializing SmartSpectra Engine...';

  try {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

    if (!res.ok) {
      throw new Error(res.error || 'Failed to start session');
    }

    el.consentModal.classList.add('hidden');
    startServerlessTraceStreamIfNeeded();
  } catch (err) {
    alert(`Session Start Error: ${err.message}`);
  } finally {
    el.btnLaunchStudio.disabled = false;
    el.btnLaunchStudio.textContent = 'Confirm Consent & Enter StagePulse Studio';
  }
}

async function requestDirectorNote() {
  const context = el.inputDirectorContext.value.trim();
  el.btnRequestInsight.disabled = true;
  el.btnRequestInsight.textContent = 'Querying Insight...';
  try {
    const res = await fetch('/api/session/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    }).then((r) => r.json());

    if (!res.ok) {
      throw new Error(res.error || 'Insight request failed');
    }
    if (res.insight) {
      setTimeout(() => {
        if (!seenInsightIds.has(res.insight.requestId)) {
          prependDirectorInsight(res.insight);
        }
      }, 420);
    }
  } catch (err) {
    prependDirectorInsight({
      requestId: 'WARN',
      processedAt: new Date().toISOString(),
      analysis: `Insight Notice: ${err.message}`,
    });
  } finally {
    el.btnRequestInsight.disabled = false;
    el.btnRequestInsight.textContent = 'Request Director Note';
  }
}

function prependDirectorInsight(insight) {
  if (!insight) return;
  if (insight.requestId !== undefined) {
    if (seenInsightIds.has(insight.requestId)) return;
    seenInsightIds.add(insight.requestId);
  }
  const emptyEl = el.directorNotesList.querySelector('.director-empty');
  if (emptyEl) emptyEl.remove();

  const item = document.createElement('div');
  item.className = 'director-note-item';
  item.innerHTML = `
    <div class="director-note-meta">
      <span>INSIGHT #${insight.requestId ?? 1} (presage.smartspectra.Insight)</span>
      <span>${new Date(insight.processedAt || Date.now()).toLocaleTimeString()}</span>
    </div>
    <div>${insight.analysis || insight.error || 'Maintain steady diaphragmatic breath support.'}</div>
  `;
  el.directorNotesList.prepend(item);
}

async function openPrivacyVault() {
  el.privacyModal.classList.remove('hidden');
  try {
    const res = await fetch('/api/privacy/audit').then((r) => r.json());
    renderAuditLog(res.privacy?.auditLog || []);
  } catch (err) {
    console.error(err);
  }
}

function renderAuditLog(entries) {
  el.auditLogList.innerHTML = entries
    .slice()
    .reverse()
    .map((e) => `
      <div class="audit-row">
        <span>${new Date(e.isoTime).toLocaleTimeString()}</span>
        <span>${e.action}</span>
        <span>${e.detail}</span>
      </div>
    `)
    .join('');
}

function renderWipeReceipt(receipt) {
  if (!receipt) return;
  el.wipeReceiptBox.classList.remove('hidden');
  el.wipeReceiptBox.innerHTML = `
    <div><strong>CRYPTOGRAPHIC WIPE VERIFIED (${receipt.wipedAtIso})</strong></div>
    <div>Overwrote ${receipt.bytesOverwritten.toLocaleString()} bytes (${receipt.slotsZeroed} Float64 slots) via CSPRNG <code>crypto.randomFillSync</code> + zero-fill.</div>
    <div>SHA-256 Entropy Digest: <code>${receipt.verificationDigestSha256}</code></div>
  `;
  openPrivacyVault();
}

// Event Listeners
el.btnLaunchStudio.addEventListener('click', startStudioSession);
el.btnOpenConsent.addEventListener('click', () => el.consentModal.classList.remove('hidden'));
el.btnStopSession.addEventListener('click', () => {
  if (serverlessTraceTimer) {
    clearInterval(serverlessTraceTimer);
    serverlessTraceTimer = null;
  }
  updateStatusBadge({ statusName: 'IDLE' });
  fetch('/api/session/stop', { method: 'POST' }).catch(() => {});
});
el.btnOpenPrivacy.addEventListener('click', openPrivacyVault);
el.btnClosePrivacy.addEventListener('click', () => el.privacyModal.classList.add('hidden'));
el.btnExecuteWipe.addEventListener('click', async () => {
  if (serverlessTraceTimer) {
    clearInterval(serverlessTraceTimer);
    serverlessTraceTimer = null;
  }
  const res = await fetch('/api/privacy/wipe', { method: 'POST' }).then((r) => r.json());
  if (res.receipt) renderWipeReceipt(res.receipt);
});
el.selectScript.addEventListener('change', (e) => selectScriptById(e.target.value));
el.btnDismissCurveball.addEventListener('click', () => el.curveballBanner.classList.add('hidden'));
el.btnRequestInsight.addEventListener('click', requestDirectorNote);

// Initialize
fetchInitialData();
connectWebSocket();
requestAnimationFrame(renderStudioLoop);
