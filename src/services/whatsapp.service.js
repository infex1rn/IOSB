const { 
    default: makeWASocket, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
require('dotenv').config();

const logger = pino({ level: 'silent' });

const { handleMessage } = require('../handlers/command.handler');
const pollingService = require('./polling.service');
const { useSupabaseAuthState } = require('../utils/supabase-auth');

let currentSock = null;
let currentStatus = 'disconnected';
let lastPairingCode = null;

async function connectToWhatsApp() {
    currentStatus = 'connecting';
    const sessionId = process.env.BOT_NAME || 'iosb-session';
    const { state, saveCreds } = await useSupabaseAuthState(sessionId);
    
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Connecting to WhatsApp v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        browser: [process.env.BOT_NAME || 'IOSB', 'Chrome', '1.0.0']
    });
    
    currentSock = sock;

    // --- PAIRING CODE LOGIC ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.BOT_PHONE;
        if (phoneNumber) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    lastPairingCode = code;
                    console.log(`\n>>> PAIRING CODE: ${code} <<<\n`);
                } catch (err) {
                    console.error('Failed to auto-request pairing code:', err.message);
                }
            }, 5000);
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            currentStatus = 'disconnected';
            lastPairingCode = null;
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? 
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            currentStatus = 'connected';
            lastPairingCode = null;
            console.log('✅ WhatsApp connection established!');
            pollingService.start(sock);
        }
    });

    sock.ev.on('messages.upsert', async m => {
        await handleMessage(sock, m);
    });

    return sock;
}

function getBotStatus() {
    return {
        status: currentStatus,
        isRegistered: currentSock?.authState?.creds?.registered || false,
        phoneNumber: process.env.BOT_PHONE || null,
        pairingCode: lastPairingCode
    };
}

async function triggerPairingCode(phoneNumber) {
    if (!currentSock) throw new Error('Socket not initialized');
    if (currentSock.authState.creds.registered) throw new Error('Device already registered');
    
    const phone = phoneNumber || process.env.BOT_PHONE;
    if (!phone) throw new Error('Phone number required for pairing');

    const code = await currentSock.requestPairingCode(phone);
    lastPairingCode = code;
    return code;
}

module.exports = { connectToWhatsApp, getBotStatus, triggerPairingCode };
