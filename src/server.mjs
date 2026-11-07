// src/server.mjs
// StagePulse HTTP + WebSocket Server.
// Bridges the native @smartspectra/node-sdk v3.4.0 engine (`StagePulseEngine`)
// to the interactive StagePulse Studio & Living Auditorium web/desktop UI.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { StagePulseEngine } from './spectra-engine.mjs';
import { REHEARSAL_SCRIPTS, CURVEBALL_QUESTIONS } from '../assets/scripts/rehearsal-scripts.mjs';

const SDK_VERSION = '3.4.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadDotEnv();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};

export function createStagePulseServer(options = {}) {
  const engine = options.engine || new StagePulseEngine({
    apiKey: options.apiKey ?? process.env.SMARTSPECTRA_API_KEY ?? '',
  });

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();

  function broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === 1) {
        try {
          ws.send(msg);
        } catch {}
      }
    }
  }

  engine.on('processingStatus', (data) => broadcast({ type: 'processingStatus', data }));
  engine.on('validationStatus', (data) => broadcast({ type: 'validationStatus', data }));
  engine.on('telemetry', (data) => broadcast({ type: 'telemetry', data }));
  engine.on('accumulatedMetrics', (data) => broadcast({ type: 'accumulatedMetrics', data }));
  engine.on('insight', (data) => broadcast({ type: 'insight', data }));
  engine.on('sdkError', (data) => broadcast({ type: 'sdkError', data }));
  engine.on('memoryWiped', (data) => broadcast({ type: 'memoryWiped', data }));
  engine.on('privacyAudit', (data) => broadcast({ type: 'privacyAudit', data }));

  function sendJson(res, status, obj) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(obj));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) reject(new Error('Payload too large'));
      });
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  const handleRequest = async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        const hasVerifiedTrace = fs.existsSync(engine.defaultTracePath);
        const hasFixtureVideo = fs.existsSync(engine.defaultFixturePath);
        return sendJson(res, 200, {
          ok: true,
          app: 'StagePulse',
          sdkPackage: '@smartspectra/node-sdk',
          sdkVersion: SDK_VERSION,
          apiKeyConfigured: Boolean(engine.apiKey),
          hasVerifiedTrace,
          hasFixtureVideo,
          privacyAuditCount: engine.privacyAuditLog.length,
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/scripts') {
        return sendJson(res, 200, {
          scripts: REHEARSAL_SCRIPTS,
          curveballs: CURVEBALL_QUESTIONS,
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/session/trace-snapshots') {
        return sendJson(res, 200, engine.buildVerifiedTraceSnapshots());
      }

      if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/cameras') {
        const cameras = engine.discoverCameras();
        return sendJson(res, 200, { cameras });
      }

      if (req.method === 'POST' && url.pathname === '/api/session/start') {
        const body = await readBody(req);
        const info = await engine.startSession(body);
        return sendJson(res, 200, { ok: true, session: info });
      }

      if (req.method === 'POST' && url.pathname === '/api/session/stop') {
        await engine.stopSession();
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'POST' && url.pathname === '/api/session/beat') {
        const body = await readBody(req);
        engine.setScriptBeatContext(
          body.sectionTitle || body.beatId || '',
          body.beatTone || body.targetIntent || ''
        );
        return sendJson(res, 200, {
          ok: true,
          sectionTitle: engine.state.currentSectionTitle,
          beatTone: engine.state.currentBeatTone,
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/session/insight') {
        const body = await readBody(req);
        const result = engine.requestDirectorInsight(body.context || '');
        return sendJson(res, 200, { ok: true, ...result });
      }

      if (req.method === 'POST' && url.pathname === '/api/privacy/wipe') {
        const receipt = await engine.cryptographicWipeAndReset();
        return sendJson(res, 200, { ok: true, receipt });
      }

      if (req.method === 'GET' && url.pathname === '/api/privacy/audit') {
        return sendJson(res, 200, {
          auditLog: engine.privacyAuditLog,
          privacy: { auditLog: engine.privacyAuditLog },
          activeConfig: engine.activeConfig,
        });
      }

      // Serve fixture video for optional synchronised visual reference in File/Replay mode
      if (req.method === 'GET' && url.pathname === '/assets/speaker-rehearsal-65s.mp4') {
        if (!fs.existsSync(engine.defaultFixturePath)) {
          res.writeHead(404);
          return res.end('Not found');
        }
        const stat = fs.statSync(engine.defaultFixturePath);
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': 'video/mp4',
          });
          return fs.createReadStream(engine.defaultFixturePath, { start, end }).pipe(res);
        }
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'video/mp4',
        });
        return fs.createReadStream(engine.defaultFixturePath).pipe(res);
      }

      // Serve static files from /public
      let relPath = url.pathname === '/' ? '/index.html' : url.pathname;
      relPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.join(PUBLIC_DIR, relPath);
      if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        return fs.createReadStream(filePath).pipe(res);
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJson(res, 400, { error: err.message || 'Request failed', code: err.code });
    }
  };

  const server = http.createServer(handleRequest);

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        clients.add(ws);
        ws.send(JSON.stringify({
          type: 'welcome',
          data: {
            sdkVersion: SDK_VERSION,
            apiKeyConfigured: Boolean(engine.apiKey),
            validation: engine.currentValidation,
            privacyAuditLog: engine.privacyAuditLog.slice(-10),
          },
        }));
        ws.on('close', () => clients.delete(ws));
      });
    } else {
      socket.destroy();
    }
  });

  const listen = (portToUse = Number(options.port ?? process.env.PORT ?? 4321)) =>
    new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(portToUse, '127.0.0.1', () => {
        const addr = server.address();
        resolve(typeof addr === 'object' && addr ? addr.port : portToUse);
      });
    });

  const close = async () => {
    await engine.stopSession();
    for (const ws of clients) {
      try { ws.close(); } catch {}
    }
    await new Promise((resolve) => server.close(() => resolve()));
  };

  return { server, engine, wss, listen, close, handleRequest };
}

const defaultStudioInstance = createStagePulseServer();
export default defaultStudioInstance.handleRequest;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4321);
  const { server } = defaultStudioInstance;
  server.listen(port, '127.0.0.1', () => {
    console.log(`StagePulse Studio running at http://localhost:${port}`);
    console.log(`Presage @smartspectra/node-sdk v${SDK_VERSION} ready.`);
  });
  process.on('SIGINT', async () => {
    await defaultStudioInstance.engine.stopSession();
    process.exit(0);
  });
}
