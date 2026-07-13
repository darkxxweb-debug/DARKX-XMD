"use strict";

/**
 * Project: DarkX Ultra
 * Owner: MrX Dev
 *
 * Multi-device session engine.
 * Each paired phone number gets its own Baileys socket + its own auth folder
 * under ./sessions/<number>, so many numbers can be connected to the bot at
 * the same time (same pattern as the web-pairing dashboard).
 */

const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const { Buffer } = require('buffer');
const pino = require('pino');
const chalkImport = require('chalk');
const chalk = chalkImport.default || chalkImport;

const config = require('./settings/config');
const { smsg } = require('./library/serialize');
const { getBotResponse } = require('./library/brain');

process.on('uncaughtException', (err) => {
    console.error(chalk.red('CRITICAL ERROR (Uncaught Exception):'), err);
});

process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('CRITICAL ERROR (Unhandled Rejection):'), reason);
});

// --- Dynamic Baileys import (loaded once, reused for every session) ---
let makeWASocket,
    Browsers,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    delay,
    makeCacheableSignalKeyStore;

let baileysReady = null;
const loadBaileys = () => {
    if (!baileysReady) {
        baileysReady = import('@whiskeysockets/baileys').then((baileys) => {
            makeWASocket = baileys.default;
            Browsers = baileys.Browsers;
            useMultiFileAuthState = baileys.useMultiFileAuthState;
            DisconnectReason = baileys.DisconnectReason;
            fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
            jidDecode = baileys.jidDecode;
            delay = baileys.delay;
            makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
        }).catch((e) => {
            console.error(chalk.red('Failed to load Baileys library:'), e);
            process.exit(1);
        });
    }
    return baileysReady;
};

// Global auto-AI toggle (kept as a simple in-memory flag, same as before)
let autoAi = config.autoAi || false;

const SESSIONS_ROOT = path.join(__dirname, 'sessions');
const activeSockets = {};

function decodeJidFactory() {
    return (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
        }
        return jid;
    };
}

/**
 * Starts (or resumes) a WhatsApp session for the given phone number.
 * @param {string} number  Phone number (digits only) used as the session id.
 * @param {object} io      socket.io server, used to relay pairing codes / status to the web UI (optional).
 * @param {function} onPairingCode  Optional callback fired with the pairing code once generated.
 */
async function startBot(number, io, onPairingCode) {
    await loadBaileys();

    const sessionId = String(number).replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSIONS_ROOT, sessionId);
    fsExtra.ensureDirSync(sessionPath);

    // Legacy support: allow seeding a session from a base64 SESSION_ID env value,
    // same format the bot used before ("DarkX-Ultra~<base64 creds>").
    const seedId = process.env.SESSION_ID;
    if (seedId && seedId.startsWith('DarkX-Ultra~') && !fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        try {
            const base64Data = seedId.split('DarkX-Ultra~')[1];
            fs.writeFileSync(path.join(sessionPath, 'creds.json'), Buffer.from(base64Data, 'base64').toString('utf-8'));
        } catch (e) {
            console.log(chalk.red('❌ SESSION_ID is corrupt, ignoring.'));
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        version,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async () => ({ conversation: 'DarkX-Ultra-Internal-Cache' }),
    });

    activeSockets[sessionId] = sock;
    sock.decodeJid = decodeJidFactory();

    // --- Pairing code (web-driven instead of terminal prompt) ---
    if (!sock.authState?.creds?.registered) {
        try {
            await delay(1500);
            const code = await sock.requestPairingCode(sessionId);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(chalk.green(`👑 Pairing code for ${sessionId}: ${formattedCode}`));
            if (typeof onPairingCode === 'function') onPairingCode(formattedCode);
            if (io) io.emit('pairing-code', { number: sessionId, code: formattedCode });
        } catch (err) {
            console.log(chalk.red(`❌ Failed to request pairing code: ${err.message}`));
            if (io) io.emit('pairing-error', { number: sessionId, error: err.message });
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
            console.log(chalk.yellow(`🔄 Connecting session ${sessionId}...`));
        }

        if (connection === 'open') {
            console.log(chalk.green(`✅ ${config.botName} (${sessionId}) connected!`));
            if (io) io.emit('connected', { number: sessionId });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(chalk.red(`❌ Session ${sessionId} closed. Reconnecting: ${shouldReconnect}`));
            if (io) io.emit('disconnected', { number: sessionId, willReconnect: shouldReconnect });

            if (shouldReconnect) {
                setTimeout(() => startBot(sessionId, io), 5000);
            } else {
                fsExtra.remove(sessionPath).catch(() => {});
                delete activeSockets[sessionId];
                console.log(chalk.red(`👋 Session ${sessionId} logged out.`));
            }
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (chatUpdate.type !== 'notify') return;

            const mek = chatUpdate.messages[0];
            if (!mek?.message) return;

            const msgType = Object.keys(mek.message)[0];
            if (msgType === 'ephemeralMessage' || msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') {
                mek.message = mek.message[msgType].message;
            }

            const m = smsg(sock, mek);
            const body = m.body || '';

            const isOwner = m.key.fromMe || config.ownerNumber?.includes(m.sender.split('@')[0]);

            // --- AUTO VIEW / REACT STATUS ---
            if (m.chat === 'status@broadcast') {
                try {
                    if (config.autoViewStatus) {
                        await sock.readMessages([mek.key]);
                    }
                    if (config.autoReactStatus) {
                        const statusReactions = ['🔥', '💎', '💜', '❤️', '💙', '💚', '💖'];
                        const randomReaction = statusReactions[Math.floor(Math.random() * statusReactions.length)];
                        await sock.sendMessage(
                            'status@broadcast',
                            { react: { text: randomReaction, key: mek.key } },
                            { statusJidList: [m.sender] }
                        );
                    }
                } catch (statusError) {
                    console.log(chalk.red('Status react/view error:'), statusError.message);
                }
                return;
            }

            // --- AUTO READ CHAT ---
            if (config.autoReadChat) {
                await sock.readMessages([mek.key]);
            }

            // --- AUTO TYPING / RECORDING ---
            if (config.autoTyping) {
                await sock.sendPresenceUpdate('composing', m.chat);
            }
            if (config.autoRecording) {
                await sock.sendPresenceUpdate('recording', m.chat);
            }

            // --- AUTO REACT NORMAL CHAT ---
            if (config.autoReactChat && !m.isBaileys && !m.key.fromMe) {
                const chatEmojis = ['😆', '😱', '😂', '🤫', '🤫'];
                const randomEmoji = chatEmojis[Math.floor(Math.random() * chatEmojis.length)];
                await sock.sendMessage(m.chat, { react: { text: randomEmoji, key: m.key } });
            }

            // --- AI TOGGLE ---
            if (body === '.aion' && isOwner) {
                autoAi = true;
                return await sock.sendMessage(m.chat, { text: '✅ *DarkX AI:* Auto-Reply is now ON!' }, { quoted: m });
            }
            if (body === '.aioff' && isOwner) {
                autoAi = false;
                return await sock.sendMessage(m.chat, { text: '📴 *DarkX AI:* Auto-Reply is now OFF!' }, { quoted: m });
            }

            // --- AI REPLY ---
            if (autoAi && body && !m.key.fromMe && !m.isGroup) {
                const aiResponse = getBotResponse(body);
                if (aiResponse) {
                    await sock.sendMessage(m.chat, { text: aiResponse }, { quoted: m });
                }
            }

            // --- MAIN COMMAND HANDLER (plugins) ---
            require('./message')(sock, m, chatUpdate);
        } catch (err) {
            console.error(chalk.red('Error in message event loop: '), err);
        }
    });

    return sock;
}

/**
 * Resumes every session already saved on disk (e.g. after a restart/deploy).
 */
async function resumeExistingSessions(io) {
    fsExtra.ensureDirSync(SESSIONS_ROOT);

    const existing = fs
        .readdirSync(SESSIONS_ROOT)
        .filter((name) => fs.statSync(path.join(SESSIONS_ROOT, name)).isDirectory());

    for (const sessionId of existing) {
        console.log(chalk.cyan(`💫 Resuming saved session: ${sessionId}`));
        startBot(sessionId, io).catch((err) =>
            console.log(chalk.red(`❌ Failed to resume session ${sessionId}: ${err.message}`))
        );
    }
}

module.exports = { startBot, resumeExistingSessions, activeSockets };
