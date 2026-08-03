"use strict";

/**
 * Optional per-user MongoDB connection.
 *
 * The shared bot database (library/mongo.js) is TEXT ONLY — it never
 * stores media, so it doesn't fill up. If a user wants view-once media,
 * saved statuses, or anti-delete media recovery, they must supply their
 * OWN MongoDB connection string in their settings panel. When they do,
 * media is stored in *their* database. When they don't, media is never
 * persisted anywhere — only handled transiently in memory (e.g. so
 * anti-delete can still resend media within the short recovery window).
 */

const { MongoClient } = require("mongodb");

// sessionId -> { client, dbPromise, uri }
const connections = new Map();

/**
 * Returns the user's own Mongo `Db` instance, or `null` if they haven't
 * configured one (or the connection fails). Never throws.
 */
async function getUserDb(sessionId, mongoUrl) {
    if (!mongoUrl) return null;

    const id = String(sessionId);
    const existing = connections.get(id);
    if (existing && existing.uri === mongoUrl) {
        try {
            return await existing.dbPromise;
        } catch {
            connections.delete(id);
        }
    }

    try {
        const client = new MongoClient(mongoUrl, {
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 8000,
        });
        const dbPromise = client.connect().then((c) => c.db());
        connections.set(id, { client, dbPromise, uri: mongoUrl });
        return await dbPromise;
    } catch (err) {
        console.error(`❌ User Mongo connection failed for ${id}:`, err.message);
        connections.delete(id);
        return null;
    }
}

/** Called when a user removes/changes their Mongo URL, to drop the old connection. */
function forgetConnection(sessionId) {
    const id = String(sessionId);
    const existing = connections.get(id);
    if (existing) {
        existing.dbPromise.then((db) => db.client?.close?.()).catch(() => {});
        connections.delete(id);
    }
}

module.exports = { getUserDb, forgetConnection };
