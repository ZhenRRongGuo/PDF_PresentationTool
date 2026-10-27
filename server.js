/**
 * Local HTTP/WebSocket server used by both the browser and Electron builds.
 * The server binds to loopback and an ephemeral port by default, avoiding
 * administrator privileges and port 80 conflicts on Windows.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const path = require('path');

function sendJson(ws, message) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

function createServer({ root = path.join(__dirname, 'dist') } = {}) {
  const app = express();

  app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  app.use(express.static(root));

  app.get('/api/qr', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('Missing url parameter');
    try {
      const buffer = await QRCode.toBuffer(url, {
        width: 300,
        margin: 2,
        color: { dark: '#e6edf3', light: '#0d1117' },
      });
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      console.error('[server] QR generation error:', err);
      res.status(500).send('QR generation failed');
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const sessions = new Map();

  wss.on('connection', (ws) => {
    let role = null;
    let sessionId = null;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (_) { return; }

      switch (msg.type) {
        case 'create-session': {
          sessionId = String(msg.sessionId || '');
          role = 'presenter';
          if (!sessionId) return;
          const old = sessions.get(sessionId);
          if (old) {
            old.remotes.forEach((r) => { try { r.close(1000, 'session-reset'); } catch (_) {} });
            old.qaClients.forEach((r) => { try { r.close(1000, 'session-reset'); } catch (_) {} });
          }
          sessions.set(sessionId, { presenter: ws, remotes: new Set(), qaClients: new Set() });
          sendJson(ws, { type: 'session-created', sessionId });
          break;
        }

        case 'join-session': {
          sessionId = String(msg.sessionId || '');
          role = 'remote';
          const session = sessions.get(sessionId);
          if (!session || !session.presenter || session.presenter.readyState !== 1) {
            sendJson(ws, { type: 'error', message: 'Session not found' });
            ws.close(4004, 'session-not-found');
            return;
          }
          session.remotes.add(ws);
          sendJson(ws, { type: 'session-joined', sessionId });
          sendJson(session.presenter, { type: 'remote-joined', remoteCount: session.remotes.size });
          break;
        }

        case 'join-qa': {
          sessionId = String(msg.sessionId || '');
          role = 'qa-audience';
          const session = sessions.get(sessionId);
          if (!session || !session.presenter || session.presenter.readyState !== 1) {
            sendJson(ws, { type: 'error', message: 'Session not found' });
            ws.close(4004, 'session-not-found');
            return;
          }
          session.qaClients.add(ws);
          sendJson(ws, { type: 'qa-joined', sessionId });
          break;
        }

        case 'qa-submit': {
          if (role !== 'qa-audience' || !sessionId) return;
          const session = sessions.get(sessionId);
          sendJson(session && session.presenter, {
            type: 'qa-question',
            text: String(msg.text || '').slice(0, 500),
            timestamp: Date.now(),
          });
          break;
        }

        case 'remote-command': {
          if (role !== 'remote' || !sessionId) return;
          const session = sessions.get(sessionId);
          sendJson(session && session.presenter, { type: 'remote-command', command: msg.command });
          break;
        }

        case 'state-update': {
          if (role !== 'presenter' || !sessionId) return;
          const session = sessions.get(sessionId);
          if (!session) return;
          session.remotes.forEach((remote) => sendJson(remote, {
            type: 'state-update',
            currentPage: msg.currentPage,
            totalPages: msg.totalPages,
          }));
          break;
        }
      }
    });

    ws.on('close', () => {
      if (!sessionId) return;
      const session = sessions.get(sessionId);
      if (!session) return;

      if (role === 'presenter') {
        const closed = { type: 'session-closed' };
        session.remotes.forEach((remote) => { sendJson(remote, closed); try { remote.close(1000, 'presenter-left'); } catch (_) {} });
        session.qaClients.forEach((client) => { sendJson(client, closed); try { client.close(1000, 'presenter-left'); } catch (_) {} });
        sessions.delete(sessionId);
      } else if (role === 'remote') {
        session.remotes.delete(ws);
        sendJson(session.presenter, { type: 'remote-left', remoteCount: session.remotes.size });
      } else if (role === 'qa-audience') {
        session.qaClients.delete(ws);
      }
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  const close = () => new Promise((resolve) => {
    clearInterval(heartbeat);
    wss.close(() => server.close(() => resolve()));
  });

  return { app, server, wss, close };
}

function startServer({ host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 0), root } = {}) {
  const instance = createServer({ root });
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      instance.server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      instance.server.removeListener('error', onError);
      const address = instance.server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      console.log(`[server] PDF Presentation Tool running at http://${host}:${actualPort}`);
      resolve({ ...instance, host, port: actualPort, url: `http://${host}:${actualPort}` });
    };
    instance.server.once('error', onError);
    instance.server.once('listening', onListening);
    instance.server.listen(port, host);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('[server] Failed to start:', error);
    process.exitCode = 1;
  });
}

module.exports = { createServer, startServer };
