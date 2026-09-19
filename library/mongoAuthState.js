"use strict";

/**
 * A MongoDB-backed replacement for Baileys' useMultiFileAuthState.
 * Same shape/behaviour, but every credential/key "file" is stored as a
 * MongoDB document instead of a file on disk — so a linked session
 * survives restarts, redeploys, and moving to a different server.
 */

const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const { getDb } = require('./mongo');

async function useMongoAuthState(sessionId) {
    const db = await getDb();
    const keysCol = db.collection('authKeys');
    const credsCol = db.collection('authCreds');

    const readKey = async (docId) => {
        const doc = await keysCol.findOne({ sessionId, docId });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver);
    };

    const writeKey = async (docId, value) => {
        const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
        await keysCol.updateOne(
            { sessionId, docId },
            { $set: { sessionId, docId, value: serialized, updatedAt: new Date() } },
            { upsert: true }
        );
    };

    const removeKey = async (docId) => {
        await keysCol.deleteOne({ sessionId, docId });
    };

    const credsDoc = await credsCol.findOne({ sessionId });
    const creds = credsDoc
        ? JSON.parse(JSON.stringify(credsDoc.creds), BufferJSON.reviver)
        : initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readKey(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const docId = `${category}-${id}`;
                            tasks.push(value ? writeKey(docId, value) : removeKey(docId));
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },

        saveCreds: async () => {
            const serialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
            await credsCol.updateOne(
                { sessionId },
                { $set: { sessionId, creds: serialized, updatedAt: new Date() } },
                { upsert: true }
            );
        },
    };
}

/** Wipes every stored credential/key for a session (used before a fresh re-pair). */
async function removeMongoSession(sessionId) {
    const db = await getDb();
    await db.collection('authKeys').deleteMany({ sessionId });
    await db.collection('authCreds').deleteOne({ sessionId });
}

/** True if this number already has saved credentials in MongoDB. */
async function mongoSessionExists(sessionId) {
    const db = await getDb();
    const doc = await db.collection('authCreds').findOne({ sessionId }, { projection: { _id: 1 } });
    return !!doc;
}

/** Every sessionId currently saved in MongoDB. */
async function listMongoSessionIds() {
    const db = await getDb();
    const docs = await db.collection('authCreds').find({}, { projection: { sessionId: 1 } }).toArray();
    return docs.map((d) => d.sessionId);
}

module.exports = { useMongoAuthState, removeMongoSession, mongoSessionExists, listMongoSessionIds };
