"use strict";

/**
 * Saves media (view-once, statuses, anti-delete recoveries) into the
 * user's OWN MongoDB (if they configured one in settings). If they
 * haven't, this is a safe no-op — nothing is written to the shared bot
 * database, which stays text-only on purpose.
 */

const { Binary } = require("mongodb");
const { getSettings } = require("./settingsStore");
const { getUserDb } = require("./userMongo");

/**
 * @param {string} sessionId - the bot owner's number
 * @param {"viewonce"|"status"|"antidelete"} kind
 * @param {{ buffer: Buffer, mimetype: string, sender?: string, caption?: string, chat?: string }} media
 */
async function saveMedia(sessionId, kind, media) {
    const settings = getSettings(sessionId);
    if (!settings.mongoUrl) return { saved: false, reason: "no_user_db" };

    const db = await getUserDb(sessionId, settings.mongoUrl);
    if (!db) return { saved: false, reason: "connection_failed" };

    try {
        await db.collection(`darkx_${kind}_media`).insertOne({
            sessionId,
            sender: media.sender || null,
            chat: media.chat || null,
            mimetype: media.mimetype,
            caption: media.caption || "",
            data: new Binary(media.buffer),
            createdAt: new Date(),
        });
        return { saved: true };
    } catch (err) {
        console.error(`❌ Failed to save ${kind} media for ${sessionId}:`, err.message);
        return { saved: false, reason: "write_failed" };
    }
}

module.exports = { saveMedia };
