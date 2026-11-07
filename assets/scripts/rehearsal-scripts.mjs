// assets/scripts/rehearsal-scripts.mjs
// Annotated presentation scripts for StagePulse's Bio-Adaptive Teleprompter.
// Each beat carries a target delivery tone (`warm_opening`, `high_energy`, `serious_problem`, `calm_closing`)
// and explicit `[BREATH GATE]` rhetorical pauses where `face.talking === false` unlocks
// Presage's respiratory refill tracking (`upperTrace` vs `lowerTrace` DDI, `rate`, `inhaleExhaleRatio`, `apnea`).

export const REHEARSAL_SCRIPTS = [
  {
    id: 'presage-challenge-pitch',
    title: 'StagePulse: Presage SmartSpectra Challenge Demo Pitch',
    subtitle: 'Meta-rehearsal script showcasing all 5 acts of physiological sensing',
    estimatedDurationSec: 75,
    beats: [
      {
        id: 'beat-1',
        section: 'Act I: The Broken Teleprompter Problem',
        tone: 'warm_opening',
        toneLabel: 'Warm Opening (HAPPY + NEUTRAL)',
        lines: [
          'Every traditional teleprompter is physiologically blind.',
          'It scrolls at a rigid, mechanical speed while your heart races, your jaw tenses, and your breathing shifts up into your chest.',
          'Welcome to StagePulse: a consent-first rehearsal studio and living auditorium powered by the Presage SmartSpectra SDK.',
        ],
        breathGatePrompt: 'BREATH GATE // Pause speaking for 3 seconds. Let the room settle and take one deep abdominal refill breath.',
      },
      {
        id: 'beat-2',
        section: 'Act II: Frame-1 Bio-Clutch & Eye-Line Lock',
        tone: 'high_energy',
        toneLabel: 'High-Energy Demo (HAPPY + SURPRISE)',
        lines: [
          'Right from frame one, StagePulse tracks 478 facial landmarks, blink cadence, and jaw articulation.',
          'Notice how this script only scrolls while I am actively speaking, coasting to a smooth stop the instant I pause for emphasis.',
          'Meanwhile, the Top-Edge Eye-Line Cone keeps my gaze locked within three degrees of the physical camera lens.',
        ],
        breathGatePrompt: 'BREATH GATE // Hold a 3-second rhetorical pause. Watch the Speech-Pause Multiplexer sample diaphragmatic recovery.',
      },
      {
        id: 'beat-3',
        section: 'Act III: Hemodynamic Damping & The Model Card Gate',
        tone: 'serious_problem',
        toneLabel: 'Technical Authority (NEUTRAL + FOCUSED)',
        lines: [
          'At twelve seconds, the Arterial Horizon Ribbon beneath this active line locks onto my live blood volume pulse waveform.',
          'If my speaking pulse climbs more than twelve percent above my personal baseline, StagePulse applies viscous tempo damping so I never spiral into nervous speed-reading.',
          'And because Presage Model Cards specify that respiratory waveforms require stillness without speech, StagePulse uses face-talking detection as a live multiplexer, sampling chest versus abdominal breathing strictly during silent pauses.',
        ],
        breathGatePrompt: 'BREATH GATE // Deliberate 4-second pause. Watch the Living Auditorium spotlight narrow during The Room Shift.',
      },
      {
        id: 'beat-4',
        section: 'Act IV: Vagal Composure & Cryptographic Privacy',
        tone: 'calm_closing',
        toneLabel: 'Grounded Closing (CALM + WARM)',
        lines: [
          'By sixty seconds, Electrodermal Proxy and Heart Rate Variability unlock the full Stage Presence Quadrant and on-demand Presage LLM Director Notes.',
          'Every signal lives exclusively in a thirty-two kilobyte volatile memory ring buffer with SDK telemetry opted out by default.',
          'When the rehearsal ends, one click overwrites the buffer with cryptographic random bytes and leaves zero trace on disk.',
        ],
        breathGatePrompt: 'FINAL BOW // Rehearsal complete. Review your physiological timeline or trigger a Cryptographic Session Wipe.',
      },
    ],
  },
  {
    id: 'founder-seed-pitch',
    title: 'Founder 60-Second Seed Pitch',
    subtitle: 'High-stakes investor pitch with deliberate rhetorical pauses',
    estimatedDurationSec: 60,
    beats: [
      {
        id: 'seed-1',
        section: 'The Inevitable Shift',
        tone: 'warm_opening',
        toneLabel: 'Warm & Conversational',
        lines: [
          'Last month, our engineering team watched forty hours of remote customer demos.',
          'In almost every call, the presenter lost the room in the first thirty seconds by rushing through their opening slide without taking a single breath.',
        ],
        breathGatePrompt: 'BREATH GATE // Pause 3 seconds before revealing the product metric.',
      },
      {
        id: 'seed-2',
        section: 'The Product Breakthrough',
        tone: 'high_energy',
        toneLabel: 'Energized Conviction',
        lines: [
          'We built an edge runtime that cuts cold-start latency by eighty-four percent across three hundred global regions.',
          'Teams deploy with a single command and see sub-ten-millisecond p99 responses in production.',
        ],
        breathGatePrompt: 'BREATH GATE // Let the 84% number hang in silence for 3 seconds.',
      },
      {
        id: 'seed-3',
        section: 'Traction & The Ask',
        tone: 'calm_closing',
        toneLabel: 'Calm Executive Poise',
        lines: [
          'We have grown thirty-two percent month over month with zero paid acquisition.',
          'We are raising our seed round to expand the core systems team and would love to have you on board.',
        ],
        breathGatePrompt: 'FINAL BOW // Hold steady eye contact with the lens for 2 seconds.',
      },
    ],
  },
];

export const CURVEBALL_QUESTIONS = [
  {
    id: 'cb-moat',
    category: 'Skeptical Investor Curveball',
    question: 'Why wouldn’t a hyperscaler ship this exact feature as a free checkbox in their next quarterly release?',
    coachingTip: 'Pause for 3 full seconds (talking=false) to let StagePulse measure your recovery breath before answering.',
  },
  {
    id: 'cb-outage',
    category: 'Live Demo Incident Curveball',
    question: 'Your primary API endpoint just returned a 502 Bad Gateway on screen during the live keynote. Walk the audience through what happened.',
    coachingTip: 'Keep your jaw relaxed, drop your breath into your abdomen (DDI >= 50%), and speak 15% slower than your baseline.',
  },
  {
    id: 'cb-privacy',
    category: 'Security Auditor Curveball',
    question: 'Where do raw camera frames go when a user opens your application on an untrusted corporate network?',
    coachingTip: 'Maintain direct lens eye contact (>85%) and explain on-device C++ processing plus the Wireframe Cloak.',
  },
];
