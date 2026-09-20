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
    antiStatusMention: false,
    antidelete: config.antiDelete,
    antideleteNotifyOwner: config.antiDeleteNotifyOwner,
    autoViewStatus: config.autoViewStatus,
    autoReactStatus: config.autoReactStatus,
    autoReadChat: config.autoReadChat,
    autoReactChat: config.autoReactChat,
    autoTyping: config.autoTyping,
    autoRecording: config.autoRecording,
    watermark: config.watermark,
    privateMode: config.privateMode,

    // --- Menu image (optional). No image is sent unless one of these is set. ---
    menuImageUrl: "",   // link to an image (set from the web settings)
    menuImageFile: "",  // file name of an image uploaded from the web settings

    // --- Optional per-user MongoDB (media storage) ---
    // Left empty by default -> shared bot DB is used, which is text-only
    // and never stores media. Set this to enable saving view-once media
    // and statuses into the user's own DB. (Anti-delete media never uses
    // MongoDB: it is kept on disk for 5 minutes and then deleted.)
    mongoUrl: "",
    autoViewOnce: false,   // auto-forward every view-once media to the owner's DM
    autoSaveStatus: false, // auto-save every contact status update
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
// NOTE: 'watermark' is intentionally NOT editable — it always stays "DarkX Ultimate".
const ALLOWED_FIELDS = [
    'ownerNumber', 'ownerName', 'botName', 'prefix', 'statusEmojis', 'chatEmojis',
    'antilink', 'antiStatusMention', 'antidelete', 'antideleteNotifyOwner',
    'menuImageUrl', 'menuImageFile',
    'autoViewStatus', 'autoReactStatus', 'autoReadChat', 'autoReactChat',
    'autoTyping', 'autoRecording', 'privateMode',
    'mongoUrl', 'autoViewOnce', 'autoSaveStatus',
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
        } else if (key === 'menuImageUrl') {
            const raw = String(partial.menuImageUrl || '').trim();
            if (raw && !/^https?:\/\/\S+$/i.test(raw)) continue; // ignore invalid links
            next.menuImageUrl = raw;
        } else if (key === 'menuImageFile') {
            const raw = String(partial.menuImageFile || '');
            if (raw && !/^[a-zA-Z0-9_.-]+$/.test(raw)) continue;
            next.menuImageFile = raw;
        } else if (key === 'mongoUrl') {
            const raw = String(partial.mongoUrl || '').trim();
            if (raw && !/^mongodb(\+srv)?:\/\//.test(raw)) {
                continue; // silently ignore an invalid connection string
            }
            if (raw !== current.mongoUrl) {
                // eslint-disable-next-line global-require
                require('./userMongo').forgetConnection(id);
            }
            next.mongoUrl = raw;
        } else {
            next[key] = partial[key];
        }
    }

    store[id] = next;
    saveStore(store);
    return next;
}

// --- Menu image (uploaded from the web settings, stored on disk) ---
const MENU_DIR = path.join(__dirname, '..', 'data', 'menu');
const MENU_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function menuImagePath(number) {
    const id = String(number).replace(/[^0-9]/g, '');
    const file = getSettings(id).menuImageFile;
    if (!file) return null;
    const full = path.join(MENU_DIR, file);
    return fs.existsSync(full) ? full : null;
}

/** Saves an uploaded menu image (Buffer) and remembers it in the settings. */
function saveMenuImage(number, buffer, mimetype) {
    const id = String(number).replace(/[^0-9]/g, '');
    const ext = MENU_TYPES[String(mimetype || '').toLowerCase()];
    if (!ext) throw new Error('Only JPG, PNG or WEBP images are allowed.');
    if (!buffer || !buffer.length) throw new Error('Empty image.');
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Image is too large (max 5 MB).');

    fs.mkdirSync(MENU_DIR, { recursive: true });
    clearMenuImage(id);
    const file = `${id}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(MENU_DIR, file), buffer);
    updateSettings(id, { menuImageFile: file });
    return file;
}

function clearMenuImage(number) {
    const id = String(number).replace(/[^0-9]/g, '');
    const file = getSettings(id).menuImageFile;
    if (file) {
        try { fs.unlinkSync(path.join(MENU_DIR, file)); } catch (_) {}
    }
    updateSettings(id, { menuImageFile: '' });
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
    menuImagePath,
    saveMenuImage,
    clearMenuImage,
};
