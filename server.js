import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Store active sessions
const sessions = new Map();

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > 300000) { // 5 minutes
      if (session.sock) {
        session.sock.end();
      }
      const sessionPath = path.join(__dirname, 'sessions', id);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      sessions.delete(id);
    }
  }
}, 300000);

// Generate unique session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Create new pairing session
app.post('/api/create-session', async (req, res) => {
  try {
    const sessionId = generateSessionId();
    const sessionPath = path.join(__dirname, 'sessions', sessionId);
    
    if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
      fs.mkdirSync(path.join(__dirname, 'sessions'));
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Casper2 Pairing', 'Chrome', '1.0.0'],
    });
    
    let qrData = null;
    let pairingCode = null;
    let isConnected = false;
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrData = qr;
        try {
          const qrImage = await QRCode.toDataURL(qr);
          sessions.set(sessionId, {
            ...sessions.get(sessionId),
            qrImage,
            qrData
          });
        } catch (err) {
          console.error('QR generation error:', err);
        }
      }
      
      if (connection === 'open') {
        isConnected = true;
        await saveCreds();
        
        const credsData = JSON.stringify(state.creds, null, 2);
        sessions.set(sessionId, {
          ...sessions.get(sessionId),
          connected: true,
          creds: credsData
        });
        
        setTimeout(() => {
          sock.end();
        }, 3000);
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (!isConnected && !shouldReconnect) {
          sessions.delete(sessionId);
        }
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sessions.set(sessionId, {
      sock,
      createdAt: Date.now(),
      qrImage: null,
      qrData: null,
      pairingCode: null,
      connected: false,
      creds: null
    });
    
    res.json({ success: true, sessionId });
    
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pairing code
app.post('/api/get-pairing-code', async (req, res) => {
  try {
    const { sessionId, phoneNumber } = req.body;
    
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const session = sessions.get(sessionId);
    const phone = phoneNumber.replace(/[^0-9]/g, '');
    
    if (phone.length < 10) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }
    
    const code = await session.sock.requestPairingCode(phone);
    session.pairingCode = code;
    sessions.set(sessionId, session);
    
    res.json({ success: true, code });
    
  } catch (error) {
    console.error('Pairing code error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get session status
app.get('/api/session/:id', (req, res) => {
  const sessionId = req.params.id;
  
  if (!sessions.has(sessionId)) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  
  const session = sessions.get(sessionId);
  
  res.json({
    success: true,
    qrImage: session.qrImage,
    connected: session.connected,
    pairingCode: session.pairingCode
  });
});

// Download session credentials
app.get('/api/download/:id', (req, res) => {
  const sessionId = req.params.id;
  
  if (!sessions.has(sessionId)) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  
  const session = sessions.get(sessionId);
  
  if (!session.connected || !session.creds) {
    return res.status(400).json({ success: false, error: 'Session not connected yet' });
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=creds.json');
  res.send(session.creds);
});

// Download full session folder
app.get('/api/download-session/:id', (req, res) => {
  const sessionId = req.params.id;
  const sessionPath = path.join(__dirname, 'sessions', sessionId);
  
  if (!fs.existsSync(sessionPath)) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  
  const archiver = require('archiver');
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=session.zip');
  
  archive.pipe(res);
  archive.directory(sessionPath, false);
  archive.finalize();
});

app.listen(PORT, () => {
  console.log('Casper2 Pairing Site running on port ' + PORT);
});
