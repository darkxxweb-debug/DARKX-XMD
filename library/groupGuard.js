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
 * WhatsApp can report the same person under two different JID types: their
 * phone-based JID (...@s.whatsapp.net) or their @lid ("Linked ID", a privacy
 * feature). Which one shows up for a given person can differ between a
 * mention/reply and a later plain message. Features that compare JIDs across
 * time (mute, warn, strikes, etc.) must therefore treat both forms as the
 * same person, or the comparison can silently never match.
 *
 * This resolves `jid` to every form Baileys currently knows about for that
 * person: itself, plus its PN<->LID counterpart when the running Baileys
 * version exposes that mapping. Always returns at least [jid].
 */
async function resolveIdentities(sock, jid) {
    const ids = new Set([jid]);
    if (!jid) return [...ids];

    try {
        const mapping = sock?.signalRepository?.lidMapping;
        if (jid.endsWith("@lid") && mapping?.getPNForLID) {
            const pn = await mapping.getPNForLID(jid);
            if (pn) ids.add(pn);
        } else if (jid.endsWith("@s.whatsapp.net") && mapping?.getLIDForPN) {
            const lid = await mapping.getLIDForPN(jid);
            if (lid) ids.add(lid);
        }
    } catch (_) {
        // Mapping not available on this Baileys version/session — fall back
        // to just the JID we were given.
    }

    return [...ids];
}

/** True if `list` contains ANY known identity of `jid` (see resolveIdentities). */
async function includesIdentity(sock, list, jid) {
    if (!Array.isArray(list) || !list.length) return false;
    const identities = await resolveIdentities(sock, jid);
    return identities.some((id) => list.includes(id));
}

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
    resolveIdentities, includesIdentity,
};
