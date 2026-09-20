"use strict";

/**
 * Group protection helpers: link / status-mention detection, per-user
 * strike counters and a small cached group-metadata lookup.
 */

const LINK_REGEX = /(https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[^\s]+/i;

const MAX_STRIKES = 3;

/** True when the message text contains a link. */
const hasLink = (text) => typeof text === "string" && LINK_REGEX.test(text);

/**
 * True when the raw message is a "group mentioned in a status" notice.
 * WhatsApp delivers it as groupStatusMentionMessage, or as a
 * protocolMessage of type 25 (STATUS_MENTION_MESSAGE).
 */
function isStatusMention(rawMessage) {
    if (!rawMessage || typeof rawMessage !== "object") return false;
    if (rawMessage.groupStatusMentionMessage) return true;
    if (rawMessage.groupStatusMentionMessageV2) return true;
    const proto = rawMessage.protocolMessage;
    if (proto && (proto.type === 25 || proto.type === "STATUS_MENTION_MESSAGE")) return true;
    return false;
}

/** Makes sure the group record exists in the JSON database and returns it. */
function ensureGroup(chat) {
    if (!global.db) return null;
    if (!global.db.groups) global.db.groups = {};
    if (typeof global.db.groups[chat] !== "object" || !global.db.groups[chat]) {
        global.db.groups[chat] = { mute: false, welcome: true, antilink: false, setWelcome: "" };
    }
    return global.db.groups[chat];
}

/** Adds one strike for a user. Returns the new count. */
function addStrike(chat, sender, type) {
    const group = ensureGroup(chat);
    if (!group) return 1;
    const field = `${type}Strikes`;
    if (!group[field]) group[field] = {};
    group[field][sender] = (group[field][sender] || 0) + 1;
    return group[field][sender];
}

function clearStrikes(chat, sender, type) {
    const group = ensureGroup(chat);
    if (group?.[`${type}Strikes`]) delete group[`${type}Strikes`][sender];
}

// --- Cached group metadata (30 s) so busy groups don't hammer WhatsApp ---
const metaCache = new Map(); // `${session}|${chat}` -> { at, data }

async function getGroupMeta(sock, chat) {
    const key = `${sock.sessionId || ""}|${chat}`;
    const hit = metaCache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.data;
    const data = await sock.groupMetadata(chat).catch(() => null);
    if (data) metaCache.set(key, { at: Date.now(), data });
    return data;
}

function dropGroupMeta(sock, chat) {
    metaCache.delete(`${sock.sessionId || ""}|${chat}`);
}

module.exports = {
    MAX_STRIKES, hasLink, isStatusMention, ensureGroup,
    addStrike, clearStrikes, getGroupMeta, dropGroupMeta,
};
