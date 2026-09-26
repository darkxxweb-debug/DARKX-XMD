"use strict";

/**
 * Project: DarkX Ultimate
 * Owner: MrX Dev
 *
 * Multi-device session engine.
 * Each paired phone number gets its own Baileys socket + its own auth folder
 * under ./sessions/<number>, so many numbers can be connected to the bot at
 * the same time (same pattern as the web-pairing dashboard).
 */

const pino = require('pino');
const chalkImport = require('chalk');
const chalk = chalkImport.default || chalkImport;

const config = require('./settings/config');
const { smsg } = require('./library/serialize');
const { getBotResponse } = require('./library/brain');
const { getSettings } = require('./library/settingsStore');
const { isBanned } = require('./library/adminStore');
const { useMongoAuthState, removeMongoSession, mongoSessionExists, listMongoSessionIds } = require('./library/mongoAuthState');
const { toBold, toSmallCaps } = require('./library/function');
const channelGate = require('./library/channelGate');

process.on('uncaughtException', (err) => {
    console.error(chalk.red('CRITICAL ERROR (Uncaught Exception):'), err);
});

process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('CRITICAL ERROR (Unhandled Rejection):'), reason);
});

// --- Dynamic Baileys import (loaded once, reused for every session) ---
let makeWASocket,
    Browsers,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    delay,
    makeCacheableSignalKeyStore;

let baileysReady = null;
const loadBaileys = () => {
    if (!baileysReady) {
        baileysReady = import('@whiskeysockets/baileys').then((baileys) => {
            // Debug: print the exact shape of the module in the logs (Render).
            // You can remove this later once everything works fine.
            console.log(chalk.cyan('Baileys module keys:'), Object.keys(baileys));

            // Some Baileys versions export makeWASocket as `default`, others as
            // a named export `makeWASocket`, and others (because of CJS/ESM
            // interop) double-wrap it as `default.default`. Pick whichever
            // one is a function.
            makeWASocket =
                typeof baileys.default === 'function'
                    ? baileys.default
                    : typeof baileys.makeWASocket === 'function'
                    ? baileys.makeWASocket
                    : typeof baileys.default?.default === 'function'
                    ? baileys.default.default
                    : null;

            if (typeof makeWASocket !== 'function') {
                throw new Error(
                    'makeWASocket was not found in the @whiskeysockets/baileys module. ' +
                    'Check your version in package.json (see the "Baileys module keys" log above).'
                );
            }

            Browsers = baileys.Browsers || baileys.default?.Browsers;
            DisconnectReason = baileys.DisconnectReason || baileys.default?.DisconnectReason;
            fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion || baileys.default?.fetchLatestBaileysVersion;
            jidDecode = baileys.jidDecode || baileys.default?.jidDecode;
            delay = baileys.delay || baileys.default?.delay;
            makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore || baileys.default?.makeCacheableSignalKeyStore;

            // Make sure everything we need exists, otherwise fail early
            // instead of hitting a confusing crash later.
            const missing = [];
            if (!Browsers) missing.push('Browsers');
            if (!DisconnectReason) missing.push('DisconnectReason');
            if (!fetchLatestBaileysVersion) missing.push('fetchLatestBaileysVersion');
            if (!jidDecode) missing.push('jidDecode');
            if (!delay) missing.push('delay');
            if (!makeCacheableSignalKeyStore) missing.push('makeCacheableSignalKeyStore');

            if (missing.length) {
                throw new Error(`Missing Baileys exports: ${missing.join(', ')}`);
            }
        }).catch((e) => {
            console.error(chalk.red('Failed to load Baileys library:'), e);
            process.exit(1);
        });
    }
    return baileysReady;
};

// Global auto-AI toggle (kept as a simple in-memory flag, same as before)
let autoAi = config.autoAi || false;

// --- Duplicate-message guard ---
// A message id is processed only ONCE per session. This is what stops the
// bot from answering the same command several times (for example when two
// sockets for one number briefly overlap, or WhatsApp re-delivers a message).
const seenMessages = new Map(); // `${session}|${chat}|${id}` -> timestamp
function alreadySeen(sessionId, mek) {
    const id = mek?.key?.id;
    if (!id) return false;
    const key = `${sessionId}|${mek.key.remoteJid}|${id}`;
    if (seenMessages.has(key)) return true;
    seenMessages.set(key, Date.now());
    if (seenMessages.size > 5000) {
        const cutoff = Date.now() - 5 * 60_000;
        for (const [k, t] of seenMessages) {
            if (t < cutoff) seenMessages.delete(k);
        }
    }
    return false;
}

const realType = (message) =>
    Object.keys(message || {}).find((k) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k));

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
 * Sends a stylish "bot connected" notification straight to the owner's
 * own WhatsApp, the moment their session comes online. Uses unicode
 * bold + small-caps for a "kali" (eye-catching) look with no external
 * fonts — plain WhatsApp text renders it perfectly on every device.
 */
async function sendConnectedMessage(sock, sessionId, sessionSettings) {
    try {
        const ownerNumber = (sessionSettings.ownerNumber || sessionId).replace(/[^0-9]/g, '');
        const ownerJid = ownerNumber + '@s.whatsapp.net';
        const botName = sessionSettings.botName || config.botName;
        const now = new Date();

        const text =
            `『 ${toBold('DARKX ULTIMATE')} 』\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `✅ ${toBold('CONNECTED SUCCESSFULLY')}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `👑 ${toSmallCaps('bot name')}   : ${botName}\n` +
            `📱 ${toSmallCaps('number')}     : ${ownerNumber}\n` +
            `📢 ${toSmallCaps('channel')}    : ${config.channelName} (${toSmallCaps('follow required')})\n` +
            `📅 ${toSmallCaps('date')}       : ${now.toLocaleDateString()}\n` +
            `⏰ ${toSmallCaps('time')}       : ${now.toLocaleTimeString()}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🔗 ${toSmallCaps('dashboard')} : ${config.repoUrl}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `_${toBoldItalicSafe('Your bot is online and ready to work.')}_\n` +
            `Powered by ${config.watermark} 🔥`;

        await sock.sendMessage(ownerJid, {
            text,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                externalAdReply: {
                    title: 'DARKX ULTIMATE 👑',
                    body: 'Connected Successfully',
                    thumbnailUrl: config.thumb,
                    sourceUrl: config.repoUrl,
                    mediaType: 1,
                    renderLargerThumbnail: false,
                },
            },
        });
    } catch (err) {
        console.error(chalk.red('Failed to send connected message:'), err.message);
    }
}

// Small helper kept local so a missing toBoldItalic export never crashes
// the connection handler.
function toBoldItalicSafe(text) {
    try {
        const { toBoldItalic } = require('./library/function');
        return toBoldItalic(text);
    } catch {
        return text;
    }
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

    // Never keep two live sockets for one number: a second socket would make
    // every command run (and every reply be sent) twice or more.
    const previous = activeSockets[sessionId];
    if (previous) {
        try { previous.ev.removeAllListeners(); } catch (_) {}
        try { previous.ws?.close?.(); } catch (_) {}
        delete activeSockets[sessionId];
    }

    const { state, saveCreds } = await useMongoAuthState(sessionId);
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
        // Return nothing when we don't have the original message cached.
        // Returning a fake message here (as before) causes Baileys to
        // resend that fake text every time WhatsApp issues a retry
        // receipt (undecryptable message on the recipient's side) —
        // which is what was causing the repeated "DarkX Ultimate-Internal-Cache"
        // spam messages. Returning undefined tells Baileys "message not
        // available", so it reports the retry as failed instead of
        // resending garbage content.
        getMessage: async () => undefined,
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
    if (!state.creds?.registered) {
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

            // 👑 Notify the owner on their own WhatsApp that the bot just
            // came online — styled with stylish unicode fonts.
            sendConnectedMessage(sock, sessionId, sessionSettings).catch(() => {});

            // 📢 Every linked number must follow the channel: check now and
            // auto-follow if needed (see library/channelGate.js).
            channelGate.onConnected(sock, sessionId);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(chalk.red(`❌ Session ${sessionId} closed (code: ${statusCode || 'unknown'}). Reconnecting: ${shouldReconnect}`));
            if (io) io.emit('disconnected', { number: sessionId, willReconnect: shouldReconnect });

            // Stop this dead socket from doing anything else / leaking listeners
            // before we spin up a fresh one for the same number.
            try { sock.ev.removeAllListeners(); } catch (_) {}
            // Only clear the slot if it still belongs to THIS socket.
            if (activeSockets[sessionId] === sock) delete activeSockets[sessionId];

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

                setTimeout(async () => {
                    // Don't reconnect a session that was deliberately deleted
                    // in the meantime (admin panel) or already reconnected.
                    if (!activeSockets[sessionId] && (await mongoSessionExists(sessionId))) {
                        startBot(sessionId, io).catch((err) =>
                            console.log(chalk.red(`❌ Reconnect failed for ${sessionId}: ${err.message}`))
                        );
                    }
                }, backoffMs);
            } else {
                removeMongoSession(sessionId).catch(() => {});
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

            // Process each message id only once (see alreadySeen above).
            if (alreadySeen(sessionId, mek)) return;

            const msgType = realType(mek.message);
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
                return await sock.sendMessage(m.chat, { text: '✅ *DarkX Ultimate AI:* Auto-Reply is now ON!' }, { quoted: m });
            }
            if (body === `${pfx}aioff` && isOwner) {
                autoAi = false;
                return await sock.sendMessage(m.chat, { text: '📴 *DarkX Ultimate AI:* Auto-Reply is now OFF!' }, { quoted: m });
            }

            // --- AI REPLY ---
            if (autoAi && body && !m.key.fromMe && !m.isGroup) {
                const aiResponse = getBotResponse(body);
                if (aiResponse) {
                    await sock.sendMessage(m.chat, { text: aiResponse }, { quoted: m });
                }
            }

            // --- MAIN COMMAND HANDLER (plugins) ---
            await require('./message')(sock, m, chatUpdate);
        } catch (err) {
            console.error(chalk.red('Error in message event loop: '), err);
        }
    });

    // --- GROUP JOIN / LEAVE: welcome, goodbye, antibot, antifake ---
    sock.ev.on('group-participants.update', async ({ id: chat, participants, action }) => {
        try {
            require('./library/groupGuard').dropGroupMeta(sock, chat); // admin list may have changed
            if (!global.db) return;
            if (typeof global.db.groups[chat] !== 'object') global.db.groups[chat] = {};
            const group = global.db.groups[chat];

            const groupMetadata = await sock.groupMetadata(chat).catch(() => null);
            const groupName = groupMetadata?.subject || 'this group';

            for (const participant of participants) {
                const number = participant.split('@')[0];

                if (action === 'add') {
                    // Anti-fake: kick numbers that don't start with an allowed
                    // country code prefix list (basic heuristic, off by default).
                    if (group.antifake) {
                        const allowedPrefixes = ['255', '254', '256', '257', '250']; // EA region by default
                        if (!allowedPrefixes.some((p) => number.startsWith(p))) {
                            await sock.groupParticipantsUpdate(chat, [participant], 'remove').catch(() => {});
                            continue;
                        }
                    }

                    // Anti-bot: remove numbers the admin has globally banned
                    // trying to (re)join.
                    if (group.antibot && isBanned(participant)) {
                        await sock.groupParticipantsUpdate(chat, [participant], 'remove').catch(() => {});
                        continue;
                    }

                    if (group.welcome) {
                        const memberCount = groupMetadata?.participants?.length || '?';
                        const joinTime = new Date().toLocaleString('en-GB', {
                            hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric'
                        });

                        // --- Top 5 chatters leaderboard (from the counters kept in message.js) ---
                        const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                        const chatCount = group.chatCount && typeof group.chatCount === 'object' ? group.chatCount : {};
                        const ranking = Object.entries(chatCount)
                            .filter(([jid, count]) => count > 0)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5);

                        const leaderboardMentions = ranking.map(([jid]) => jid);
                        const leaderboardText = ranking.length
                            ? ranking
                                  .map(([jid, count], i) => `┃ ${MEDALS[i]} @${jid.split('@')[0]} — *${count}* messages`)
                                  .join('\n')
                            : '┃ _No chat activity recorded yet._';

                        const template = group.setWelcome && group.setWelcome.trim()
                            ? group.setWelcome
                            : `╭━━━〔 🎉 *NEW MEMBER* 〕━━━┈⊷
┃ 👋 *Karibu* @user!
┃ 🏠 *Group:* *${groupName}*
┃ 👥 *Member #:* *${memberCount}* (total members now)
┃ 🕒 *Joined:* ${joinTime}
┃
┃ 📜 Please read the *group rules* and
┃ introduce yourself to everyone here.
┃ Enjoy your stay and be respectful! 💫
╰━━━━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🏆 *TOP 5 CHATTERS* 〕━━━┈⊷
${leaderboardText}
╰━━━━━━━━━━━━━━━━━━━┈⊷`;

                        const text = template.replace(/@user/gi, `@${number}`);

                        // Fetch the new member's profile picture (same method as the .getpp/dp command)
                        const DEFAULT_PIC = 'https://telegra.ph/file/default-profile-pic.jpg';
                        let ppUrl;
                        try {
                            ppUrl = await sock.profilePictureUrl(participant, 'image');
                        } catch (e) {
                            ppUrl = DEFAULT_PIC;
                        }

                        await sock.sendMessage(chat, {
                            image: { url: ppUrl },
                            caption: text,
                            mentions: [participant, ...leaderboardMentions]
                        }).catch(() => {});
                    }
                }

                if (action === 'remove' && group.goodbye) {
                    const template = group.setGoodbye && group.setGoodbye.trim()
                        ? group.setGoodbye
                        : `👋 @user has left *${groupName}*. Goodbye!`;
                    const text = template.replace(/@user/gi, `@${number}`);
                    await sock.sendMessage(chat, { text, mentions: [participant] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error(chalk.red('Error in group-participants.update: '), err.message);
        }
    });

    return sock;
}

/**
 * Resumes every session already saved in MongoDB (e.g. after a restart/redeploy).
 */
async function resumeExistingSessions(io) {
    let existing = [];
    try {
        existing = await listMongoSessionIds();
    } catch (err) {
        console.log(chalk.red(`❌ Could not load sessions from MongoDB: ${err.message}`));
        return;
    }

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
    // Re-checks every connected session; unfollowing the channel disconnects it.
    channelGate.startMonitor({ activeSockets, deleteSession, io });

    setInterval(async () => {
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
 * down its socket, and deletes its saved credentials from MongoDB. Used by
 * the admin panel's "delete session" action.
 */
async function deleteSession(number) {
    const sessionId = String(number).replace(/[^0-9]/g, '');
    const sock = activeSockets[sessionId];

    if (sock) {
        try { await sock.logout(); } catch (_) {}
        try { sock.ev.removeAllListeners(); } catch (_) {}
        delete activeSockets[sessionId];
    }
    delete reconnectAttempts[sessionId];

    await removeMongoSession(sessionId).catch(() => {});
    return true;
}

/**
 * Lists every known session (currently connected or previously saved in
 * MongoDB) for the admin panel, with its connection status and owner info.
 */
async function listAllSessions() {
    let stored = [];
    try {
        stored = await listMongoSessionIds();
    } catch (_) {}

    const allIds = new Set([...stored, ...Object.keys(activeSockets)]);

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
    mongoSessionExists,
    removeMongoSession,
};
