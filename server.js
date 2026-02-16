import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > 600000) { // 10 minutes
      if (session.sock) {
        session.sock.end();
      }
      const sessionPath = path.join(__dirname, 'sessions', id);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      sessions.delete(id);
      console.log('Cleaned up session:', id);
    }
  }
}, 60000);

function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

app.post('/api/create-session', async (req, res) => {
  try {
    const sessionId = generateSessionId();
    const sessionPath = path.join(__dirname, 'sessions', sessionId);
    
    if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
      fs.mkdirSync(path.join(__dirname, 'sessions'), { recursive: true });
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
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    
    let isConnected = false;
    let isPairing = false;
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr);
          const sessionData = sessions.get(sessionId) || {};
          sessions.set(sessionId, {
            ...sessionData,
            qrImage,
            qrData: qr
          });
          console.log('QR generated for session:', sessionId);
        } catch (err) {
          console.error('QR generation error:', err);
        }
      }
      
      if (connection === 'open') {
        console.log('Session connected:', sessionId);
        isConnected = true;
        await saveCreds();
        
        const credsData = JSON.stringify(state.creds, null, 2);
        const sessionData = sessions.get(sessionId) || {};
        sessions.set(sessionId, {
          ...sessionData,
          connected: true,
          creds: credsData
        });
        
        setTimeout(() => {
          try {
            sock.end();
          } catch (e) {
            console.error('Error closing socket:', e);
          }
        }, 3000);
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        console.log('Connection closed for session:', sessionId, 'Status:', statusCode);
        
        if (statusCode === DisconnectReason.loggedOut) {
          const sessionData = sessions.get(sessionId) || {};
          sessions.set(sessionId, {
            ...sessionData,
            loggedOut: true
          });
        }
        
        if (!isConnected && !isPairing) {
          // Only cleanup if not waiting for pairing
          setTimeout(() => {
            if (sessions.has(sessionId) && !sessions.get(sessionId).connected) {
              sessions.delete(sessionId);
            }
          }, 60000); // Give 1 minute for pairing
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
      creds: null,
      isPairing: false,
      loggedOut: false
    });
    
    console.log('Created session:', sessionId);
    res.json({ success: true, sessionId });
    
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/get-pairing-code', async (req, res) => {
  try {
    const { sessionId, phoneNumber } = req.body;
    
    console.log('Pairing code request for session:', sessionId, 'Phone:', phoneNumber);
    
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const session = sessions.get(sessionId);
    
    if (!session.sock) {
      return res.status(400).json({ success: false, error: 'Socket not initialized' });
    }
    
    // Clean phone number - remove all non-digits
    let phone = phoneNumber.replace(/\D/g, '');
    
    // Validate phone number
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid phone number. Must be 10-15 digits.' 
      });
    }
    
    console.log('Cleaned phone number:', phone);
    
    // Mark as pairing
    session.isPairing = true;
    sessions.set(sessionId, session);
    
    // Request pairing code
    try {
      console.log('Requesting pairing code...');
      const code = await session.sock.requestPairingCode(phone);
      
      console.log('Pairing code received:', code);
      
      // Format code as XXXX-XXXX
      const formattedCode = code.match(/.{1,4}/g).join('-');
      
      session.pairingCode = formattedCode;
      sessions.set(sessionId, session);
      
      res.json({ success: true, code: formattedCode });
      
    } catch (pairingError) {
      console.error('Pairing code generation error:', pairingError);
      
      // Try without country code if it fails
      if (phone.length > 10) {
        try {
          console.log('Retrying without country code...');
          const phoneWithoutCC = phone.slice(-10); // Last 10 digits
          const code = await session.sock.requestPairingCode(phoneWithoutCC);
          const formattedCode = code.match(/.{1,4}/g).join('-');
          
          session.pairingCode = formattedCode;
          sessions.set(sessionId, session);
          
          return res.json({ success: true, code: formattedCode });
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
      
      throw pairingError;
    }
    
  } catch (error) {
    console.error('Pairing code error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate pairing code. Try: 1) Check number format 2) Use QR code method instead 3) Ensure WhatsApp is updated'
    });
  }
});

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
    pairingCode: session.pairingCode,
    loggedOut: session.loggedOut
  });
});

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

app.listen(PORT, () => {
  console.log('=================================');
  console.log('Casper2 Pairing Site Started!');
  console.log('Port:', PORT);
  console.log('=================================');
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});
