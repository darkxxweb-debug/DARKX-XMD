"use strict";

/**
 * Stores per-number (per connected user) bot settings, separate from the
 * static defaults in settings/config.js. Every number that links its
 * WhatsApp through the web dashboard gets its own settings block, so each
 * user can set their own owner number, bot name, status-reaction emojis,
 * anti-link toggle, and so on, without affecting other connected numbers.
 *
 * Also handles the web login flow: generating a short verification code,
 * sending it to the user's own WhatsApp number, and issuing a session
 * token once the code is confirmed.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../settings/config');

const STORE_PATH = path.join(__dirname, '..', 'sessionSettings.json');

const DEFAULT_OVERRIDES = () => ({
    ownerName: config.ownerName,
    botName: config.botName,
    prefix: config.prefix,
    statusEmojis: [...config.statusEmojis],
    chatEmojis: [...config.chatEmojis],
    antilink: config.antilink,
    antidelete: config.antiDelete,
    antideleteNotifyOwner: config.antiDeleteNotifyOwner,
    autoViewStatus: config.autoViewStatus,
    autoReactStatus: config.autoReactStatus,
    autoReadChat: config.autoReadChat,
    autoReactChat: config.autoReactChat,
    autoTyping: config.autoTyping,
    autoRecording: config.autoRecording,
    watermark: config.watermark,
});

function loadStore() {
    try {
        if (!fs.existsSync(STORE_PATH)) {
            fs.writeFileSync(STORE_PATH, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    } catch (err) {
        console.error('Failed to read session settings file:', err.message);
        return {};
    }
}

function saveStore(store) {
    try {
        fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    } catch (err) {
        console.error('Failed to save session settings file:', err.message);
    }
}

let store = loadStore();

/**
 * Returns the merged settings for a given connected number. The owner
 * number always defaults to the number that is logged in, unless the
 * user has explicitly changed it from the settings panel.
 */
function getSettings(number) {
    const id = String(number).replace(/[^0-9]/g, '');
    if (!store[id]) {
        store[id] = { ownerNumber: id, ...DEFAULT_OVERRIDES() };
        saveStore(store);
    }
    if (!store[id].ownerNumber) store[id].ownerNumber = id;
    return { ...DEFAULT_OVERRIDES(), ...store[id] };
}

/**
 * Updates settings for a number. Only known/allowed fields are merged in,
 * so the settings panel can't be used to inject arbitrary data.
 */
// NOTE: 'watermark' is intentionally NOT editable — it always stays "DarkX-Ultra".
const ALLOWED_FIELDS = [
    'ownerNumber', 'ownerName', 'botName', 'prefix', 'statusEmojis', 'chatEmojis',
    'antilink', 'antidelete', 'antideleteNotifyOwner',
    'autoViewStatus', 'autoReactStatus', 'autoReadChat', 'autoReactChat',
    'autoTyping', 'autoRecording',
];

function updateSettings(number, partial) {
    const id = String(number).replace(/[^0-9]/g, '');
    const current = getSettings(id);
    const next = { ...current };

    for (const key of ALLOWED_FIELDS) {
        if (partial[key] === undefined) continue;
        if (key === 'ownerNumber') {
            next.ownerNumber = String(partial.ownerNumber).replace(/[^0-9]/g, '') || id;
        } else if (key === 'statusEmojis' || key === 'chatEmojis') {
            const raw = partial[key];
            const list = Array.isArray(raw)
                ? raw
                : String(raw).split(',').map((e) => e.trim()).filter(Boolean);
            if (list.length) next[key] = list;
        } else {
            next[key] = partial[key];
        }
    }

    store[id] = next;
    saveStore(store);
    return next;
}

// --- Web login: verification codes + session tokens (in-memory) ---
const pendingCodes = new Map(); // number -> { code, expires }
const tokens = new Map(); // token -> { number, expires }

function createLoginCode(number) {
    const id = String(number).replace(/[^0-9]/g, '');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pendingCodes.set(id, { code, expires: Date.now() + 5 * 60 * 1000 });
    return code;
}

function verifyLoginCode(number, code) {
    const id = String(number).replace(/[^0-9]/g, '');
    const entry = pendingCodes.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        pendingCodes.delete(id);
        return null;
    }
    if (String(code).trim() !== entry.code) return null;

    pendingCodes.delete(id);
    const token = crypto.randomBytes(24).toString('hex');
    tokens.set(token, { number: id, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return token;
}

function resolveToken(token) {
    const entry = tokens.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        tokens.delete(token);
        return null;
    }
    return entry.number;
}

module.exports = {
    getSettings,
    updateSettings,
    createLoginCode,
    verifyLoginCode,
    resolveToken,
};
