"use strict";

/**
 * Anti-delete cache.
 *
 *  - TEXT  : kept in memory for TEXT_TTL_MS (long: 6 hours), capped at MAX_TEXT_ENTRIES.
 *  - MEDIA : written to DISK (never MongoDB) under ./data/antidelete/<session>/,
 *            and removed automatically MEDIA_TTL_MS (5 minutes) after it was saved.
 *            A sweeper also cleans leftovers (e.g. after a restart).
 */

const fs = require("fs");
const path = require("path");

const TEXT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MEDIA_TTL_MS = 5 * 60 * 1000;     // 5 minutes
const MAX_TEXT_ENTRIES = 5000;
const MAX_MEDIA_BYTES = 40 * 1024 * 1024; // skip files bigger than 40 MB

const ROOT = path.join(__dirname, "..", "data", "antidelete");
const entries = new Map(); // key -> { ...entry, expires }

const keyOf = (sessionId, chat, id) => `${sessionId}|${chat}|${id}`;
const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "_");

const EXT = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "aac",
    "application/pdf": "pdf",
};
const extOf = (mime) => EXT[String(mime || "").split(";")[0].trim().toLowerCase()] || "bin";

function removeFile(file) {
    if (!file) return;
    fs.unlink(file, () => {});
}

function removeEntry(key) {
    const e = entries.get(key);
    if (e?.mediaPath) removeFile(e.mediaPath);
    entries.delete(key);
}

/** Save the text/metadata of an incoming message. */
function saveText(sessionId, chat, id, data) {
    const key = keyOf(sessionId, chat, id);
    entries.set(key, { ...data, mediaPath: null, expires: Date.now() + TEXT_TTL_MS });

    if (entries.size > MAX_TEXT_ENTRIES) {
        // drop the oldest entries first (Map keeps insertion order)
        let over = entries.size - MAX_TEXT_ENTRIES;
        for (const k of entries.keys()) {
            if (over-- <= 0) break;
            removeEntry(k);
        }
    }
}

/** Save media to disk and attach it to the text entry. Deleted after 5 minutes. */
async function saveMedia(sessionId, chat, id, buffer, mimetype) {
    if (!buffer || buffer.length > MAX_MEDIA_BYTES) return false;
    const key = keyOf(sessionId, chat, id);
    const entry = entries.get(key);
    if (!entry) return false;

    const dir = path.join(ROOT, safe(sessionId));
    await fs.promises.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${safe(id)}.${extOf(mimetype)}`);
    await fs.promises.writeFile(file, buffer);

    entry.mediaPath = file;
    entry.mimetype = mimetype;
    entry.mediaExpires = Date.now() + MEDIA_TTL_MS;

    const timer = setTimeout(() => {
        const e = entries.get(key);
        if (e && e.mediaPath === file) {
            e.mediaPath = null; // the text stays, only the media goes
        }
        removeFile(file);
    }, MEDIA_TTL_MS);
    timer.unref?.();
    return true;
}

function get(sessionId, chat, id) {
    const key = keyOf(sessionId, chat, id);
    const e = entries.get(key);
    if (!e) return null;
    if (Date.now() > e.expires) { removeEntry(key); return null; }
    if (e.mediaPath && !fs.existsSync(e.mediaPath)) e.mediaPath = null;
    return e;
}

function remove(sessionId, chat, id) {
    removeEntry(keyOf(sessionId, chat, id));
}

/** Periodic sweep: expired text entries + any media file older than 5 minutes. */
function sweep() {
    const now = Date.now();
    for (const [key, e] of entries) {
        if (now > e.expires) removeEntry(key);
    }
    try {
        if (!fs.existsSync(ROOT)) return;
        for (const sessionDir of fs.readdirSync(ROOT)) {
            const dir = path.join(ROOT, sessionDir);
            let files = [];
            try { files = fs.readdirSync(dir); } catch { continue; }
            for (const f of files) {
                const p = path.join(dir, f);
                try {
                    if (now - fs.statSync(p).mtimeMs > MEDIA_TTL_MS) fs.unlinkSync(p);
                } catch { /* ignore */ }
            }
        }
    } catch { /* ignore */ }
}

// Clean everything left over from a previous run, then sweep every minute.
sweep();
setInterval(sweep, 60 * 1000).unref?.();

module.exports = { saveText, saveMedia, get, remove, TEXT_TTL_MS, MEDIA_TTL_MS };
