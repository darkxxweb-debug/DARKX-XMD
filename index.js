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
const { getSettings } = require('./library/settingsStore');
const { isBanned } = require('./library/adminStore');

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
const reconnectAttempts = {}; // sessionId -> consecutive failed-reconnect count

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
        // --- Long-lived-session tuning ---
        // Baileys pings WhatsApp's servers to keep the socket alive; a short
        // interval + generous timeouts stop the session from silently dying
        // on flaky connections, which is what was cutting sessions off after
        // just a few hours.
        keepAliveIntervalMs: 20_000,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        qrTimeout: 60_000,
        emitOwnEvents: true,
        retryRequestDelayMs: 2_000,
        maxMsgRetryCount: 5,
    });

    activeSockets[sessionId] = sock;
    sock.decodeJid = decodeJidFactory();
    sock.sessionId = sessionId;

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
            // Make sure this number has its own settings, with itself as the
            // owner number by default (this is what owner-only commands
            // check against for this session).
            const sessionSettings = getSettings(sessionId);
            reconnectAttempts[sessionId] = 0; // connection is healthy again, reset backoff
            console.log(chalk.green(`✅ ${sessionSettings.botName} (${sessionId}) connected!`));
            if (io) io.emit('connected', { number: sessionId });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(chalk.red(`❌ Session ${sessionId} closed (code: ${statusCode || 'unknown'}). Reconnecting: ${shouldReconnect}`));
            if (io) io.emit('disconnected', { number: sessionId, willReconnect: shouldReconnect });

            // Stop this dead socket from doing anything else / leaking listeners
            // before we spin up a fresh one for the same number.
            try { sock.ev.removeAllListeners(); } catch (_) {}
            delete activeSockets[sessionId];

            if (shouldReconnect) {
                // Capped exponential backoff: 5s, 10s, 20s ... up to 5 minutes.
                // We keep retrying indefinitely (this is what lets a session
                // stay linked for days instead of giving up after a few
                // failed attempts) — it only stops if the user logs out from
                // their phone (DisconnectReason.loggedOut) or the session is
                // deleted from the admin panel.
                const attempt = (reconnectAttempts[sessionId] || 0) + 1;
                reconnectAttempts[sessionId] = attempt;
                const backoffMs = Math.min(5_000 * Math.pow(2, attempt - 1), 5 * 60_000);

                setTimeout(() => {
                    // Don't reconnect a session that was deliberately deleted
                    // in the meantime (admin panel) or already reconnected.
                    if (fs.existsSync(sessionPath) && !activeSockets[sessionId]) {
                        startBot(sessionId, io).catch((err) =>
                            console.log(chalk.red(`❌ Reconnect failed for ${sessionId}: ${err.message}`))
                        );
                    }
                }, backoffMs);
            } else {
                fsExtra.remove(sessionPath).catch(() => {});
                delete reconnectAttempts[sessionId];
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

            // --- Global ban check (admin panel) ---
            // Banned numbers can't use the bot at all, on any connected session.
            if (!m.key.fromMe && isBanned(m.sender)) return;

            const settings = getSettings(sessionId);
            const isOwner = m.key.fromMe || settings.ownerNumber === m.sender.split('@')[0];

            // --- AUTO VIEW / REACT STATUS ---
            if (m.chat === 'status@broadcast') {
                try {
                    if (settings.autoViewStatus) {
                        await sock.readMessages([mek.key]);
                    }
                    if (settings.autoReactStatus) {
                        const statusReactions = settings.statusEmojis?.length ? settings.statusEmojis : ['🔥'];
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
            if (settings.autoReadChat) {
                await sock.readMessages([mek.key]);
            }

            // --- AUTO TYPING / RECORDING ---
            if (settings.autoTyping) {
                await sock.sendPresenceUpdate('composing', m.chat);
            }
            if (settings.autoRecording) {
                await sock.sendPresenceUpdate('recording', m.chat);
            }

            // --- AUTO REACT NORMAL CHAT ---
            if (settings.autoReactChat && !m.isBaileys && !m.key.fromMe) {
                const chatEmojis = settings.chatEmojis?.length ? settings.chatEmojis : ['😆'];
                const randomEmoji = chatEmojis[Math.floor(Math.random() * chatEmojis.length)];
                await sock.sendMessage(m.chat, { react: { text: randomEmoji, key: m.key } });
            }

            // --- AI TOGGLE ---
            const pfx = settings.prefix || '.';
            if (body === `${pfx}aion` && isOwner) {
                autoAi = true;
                return await sock.sendMessage(m.chat, { text: '✅ *DarkX-Ultra AI:* Auto-Reply is now ON!' }, { quoted: m });
            }
            if (body === `${pfx}aioff` && isOwner) {
                autoAi = false;
                return await sock.sendMessage(m.chat, { text: '📴 *DarkX-Ultra AI:* Auto-Reply is now OFF!' }, { quoted: m });
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

/**
 * Watchdog: every 5 minutes, checks that every socket we think is "active"
 * still has a genuinely open underlying websocket. Occasionally a socket
 * can hang (the 'close' event never fires) which would otherwise leave a
 * session silently dead until something happens to notice. This is part of
 * what keeps sessions alive for days instead of a few hours.
 */
function startWatchdog(io) {
    setInterval(() => {
        for (const sessionId of Object.keys(activeSockets)) {
            const sock = activeSockets[sessionId];
            const readyState = sock?.ws?.socket?.readyState ?? sock?.ws?.readyState;
            // 1 === OPEN. Anything else (and defined) means the socket is
            // stuck in a bad state that never triggered a proper 'close'.
            if (readyState !== undefined && readyState !== 1) {
                console.log(chalk.yellow(`🩺 Watchdog: session ${sessionId} looks stuck (readyState ${readyState}), restarting...`));
                try { sock.ev.removeAllListeners(); } catch (_) {}
                try { sock.ws?.close?.(); } catch (_) {}
                delete activeSockets[sessionId];
                startBot(sessionId, io).catch((err) =>
                    console.log(chalk.red(`❌ Watchdog restart failed for ${sessionId}: ${err.message}`))
                );
            }
        }
    }, 5 * 60_000);
}

/**
 * Fully removes a session: logs it out of WhatsApp (best-effort), tears
 * down its socket, and deletes its saved credentials from disk. Used by
 * the admin panel's "delete session" action.
 */
async function deleteSession(number) {
    const sessionId = String(number).replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSIONS_ROOT, sessionId);
    const sock = activeSockets[sessionId];

    if (sock) {
        try { await sock.logout(); } catch (_) {}
        try { sock.ev.removeAllListeners(); } catch (_) {}
        delete activeSockets[sessionId];
    }
    delete reconnectAttempts[sessionId];

    await fsExtra.remove(sessionPath).catch(() => {});
    return true;
}

/**
 * Lists every known session (currently connected or previously saved on
 * disk) for the admin panel, with its connection status and owner info.
 */
function listAllSessions() {
    fsExtra.ensureDirSync(SESSIONS_ROOT);
    const onDisk = fs
        .readdirSync(SESSIONS_ROOT)
        .filter((name) => fs.statSync(path.join(SESSIONS_ROOT, name)).isDirectory());

    const allIds = new Set([...onDisk, ...Object.keys(activeSockets)]);

    return [...allIds].map((sessionId) => {
        const settings = getSettings(sessionId);
        return {
            number: sessionId,
            connected: !!activeSockets[sessionId],
            botName: settings.botName,
            ownerNumber: settings.ownerNumber,
        };
    });
}

module.exports = {
    startBot,
    resumeExistingSessions,
    activeSockets,
    startWatchdog,
    deleteSession,
    listAllSessions,
};
