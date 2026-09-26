"use strict";

/**
 * Central command router. Runs for every incoming message on every
 * connected session (phone number). Loads that number's own settings
 * (owner number, prefix, anti-link, etc.) so multiple numbers can run
 * the bot at once, each with its own configuration.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const baseConfig = require("./settings/config");
const { getSettings } = require("./library/settingsStore");
const { synchronizeData } = require("./library/database");
const antideleteStore = require("./library/antideleteStore");
const guard = require("./library/groupGuard");

const MEDIA_TYPES = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];

// ---------------------------------------------------------------------------
// Plugin index: every plugin file is loaded ONCE and mapped by command name.
// (Before, all plugin files were re-read from disk on every single command.)
// ---------------------------------------------------------------------------
let pluginMap = null;
function loadPlugins() {
    if (pluginMap) return pluginMap;
    const map = new Map();
    const pluginFolder = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginFolder)) return map;

    for (const file of fs.readdirSync(pluginFolder).filter((f) => f.endsWith(".js"))) {
        try {
            const plugin = require(path.join(pluginFolder, file));
            const names = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
            for (const name of names) {
                if (!name) continue;
                const key = String(name).toLowerCase();
                if (!map.has(key)) map.set(key, { plugin, file });
            }
        } catch (err) {
            console.error(chalk.red(`[PLUGIN LOAD ERROR] ${file}:`), err.message);
        }
    }
    pluginMap = map;
    return map;
}

// ---------------------------------------------------------------------------
// Anti-delete: send the report + any media that is still on disk
// ---------------------------------------------------------------------------
async function sendDeletedReport(sock, sessionId, config, chat, deleteKey, deleted) {
    const deletedSender = (deleted.sender || deleteKey.participant || "").split("@")[0];
    const hasMedia = !!deleted.mediaPath;

    const report =
        `⚠️ *MESSAGE DELETED*\n\n` +
        `👤 *Sender:* ${deleted.pushName || "Unknown"}\n` +
        `📱 *Number:* ${deletedSender}\n` +
        `📝 *Message:* ${deleted.body || (hasMedia ? "📎 Media (restored below)" : "No text content")}\n` +
        `🕐 *Deleted at:* ${new Date().toLocaleTimeString()}`;

    const targets = [chat];
    if (config.antideleteNotifyOwner && config.ownerNumber) {
        targets.push(config.ownerNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net");
    }

    let buffer = null;
    if (hasMedia) {
        try { buffer = await fs.promises.readFile(deleted.mediaPath); } catch { buffer = null; }
    }

    for (const jid of targets) {
        await sock.sendMessage(jid, {
            text: jid === chat ? report : `🔴 *ANTI-DELETE REPORT*\n\n${report}`,
        }).catch(() => {});

        if (!buffer) continue;
        const mime = deleted.mimetype || "";
        let content;
        if (deleted.mtype === "stickerMessage") content = { sticker: buffer };
        else if (deleted.mtype === "documentMessage") content = { document: buffer, mimetype: mime, fileName: deleted.fileName || "file" };
        else if (/video/.test(mime)) content = { video: buffer, caption: deleted.caption || "" };
        else if (/audio/.test(mime)) content = { audio: buffer, mimetype: mime || "audio/mpeg" };
        else content = { image: buffer, caption: deleted.caption || "" };
        await sock.sendMessage(jid, content).catch(() => {});
    }
}

module.exports = async (sock, m, chatUpdate) => {
    try {
        const { chat, sender, body, pushName, fromMe } = m;
        if (!chat) return;

        // --- Per-number settings, merged over the base defaults ---
        const sessionId = sock.sessionId || sender?.split("@")[0] || "default";
        const settings = getSettings(sessionId);
        const config = { ...baseConfig, ...settings };

        const prefix = config.prefix || ".";
        const isCmd = typeof body === "string" && body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : "";
        const args = typeof body === "string" ? body.trim().split(/ +/).slice(1) : [];
        const text = args.join(" ");
        const q = text;

        const isGroup = chat.endsWith("@g.us");
        const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        // Some groups list the bot under its @lid (Linked ID) identity instead of
        // its phone-number JID. sock.user.lid (when present) is that identity, so
        // we need to recognise both forms — otherwise isBotAdmin below can be
        // wrongly false even when the bot really is a group admin.
        const botLid = sock.user.lid ? sock.user.lid.split(":")[0] + "@lid" : null;
        const botIdentities = [botId, botLid].filter(Boolean);
        const ownerJid = String(config.ownerNumber || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const isOwner = !!fromMe || [ownerJid, ...botIdentities].includes(sender);

        const reply = (teks, opts = {}) => sock.sendMessage(chat, { text: teks, ...opts }, { quoted: m });

        // -------------------------------------------------------------------
        // Anti-delete: remember text (long) and media (disk, 5 minutes)
        // -------------------------------------------------------------------
        const isMediaMsg = MEDIA_TYPES.includes(m.mtype);
        if (config.antidelete && m.key?.id && !fromMe && (body || isMediaMsg)) {
            antideleteStore.saveText(sessionId, chat, m.key.id, {
                body, sender, pushName, chat, mtype: m.mtype, timestamp: Date.now(),
                caption: m.msg?.caption || "", fileName: m.msg?.fileName || "",
            });

            if (isMediaMsg) {
                (async () => {
                    try {
                        const { getMediaFromMessage } = require("./library/media");
                        const media = await getMediaFromMessage(sock, { msg: m.msg, message: m.message });
                        if (media) {
                            await antideleteStore.saveMedia(sessionId, chat, m.key.id, media.buffer, media.mimetype);
                        }
                    } catch (e) {
                        console.error("Anti-delete media cache error:", e.message);
                    }
                })();
            }
        }

        // --- Anti-delete: a "delete for everyone" event arrived ---
        const proto = m.message?.protocolMessage;
        if (proto && proto.type === 0 && proto.key && config.antidelete) {
            const deleteKey = proto.key;
            const targetChat = deleteKey.remoteJid || chat;
            const deleted = antideleteStore.get(sessionId, targetChat, deleteKey.id);
            if (deleted) {
                await sendDeletedReport(sock, sessionId, config, targetChat, deleteKey, deleted);
                antideleteStore.remove(sessionId, targetChat, deleteKey.id);
            }
            return;
        }

        // -------------------------------------------------------------------
        // Group protections that must run even when the message has no text
        // -------------------------------------------------------------------
        let groupMetadata, participants, groupAdmins, isAdmin = false, isBotAdmin = false;
        if (isGroup) {
            groupMetadata = await guard.getGroupMeta(sock, chat);
            if (groupMetadata) {
                participants = groupMetadata.participants || [];
                groupAdmins = participants.filter((v) => !!v.admin).map((v) => v.id);
                isAdmin = groupAdmins.includes(sender);
                isBotAdmin = groupAdmins.some((id) => botIdentities.includes(id));
            }
        }

        // --- Anti status-mention: delete the notice immediately, remove after 3 ---
        if (isGroup && !fromMe && guard.isStatusMention(m.message)) {
            const group = guard.ensureGroup(chat);
            if (config.antiStatusMention || group?.antistatusmention) {
                if (isBotAdmin) await sock.sendMessage(chat, { delete: m.key }).catch(() => {});

                if (isBotAdmin && !isAdmin && !isOwner) {
                    const strikes = guard.addStrike(chat, sender, "status");
                    if (strikes >= guard.MAX_STRIKES) {
                        guard.clearStrikes(chat, sender, "status");
                        await sock.groupParticipantsUpdate(chat, [sender], "remove").catch(() => {});
                        await sock.sendMessage(chat, {
                            text: `🚫 @${sender.split("@")[0]} was removed for mentioning this group in their status ${guard.MAX_STRIKES} times.`,
                            mentions: [sender],
                        }).catch(() => {});
                    }
                }
                return;
            }
        }

        if (fromMe && !isCmd) return;
        if (!body) return;

        if (global.db) synchronizeData(m, sock);

        // --- Chat activity counter (per user, per group) — powers the "top chatters" leaderboard shown in the welcome message ---
        if (isGroup && global.db && sender && !fromMe) {
            if (typeof global.db.groups[chat] !== "object" || !global.db.groups[chat]) global.db.groups[chat] = {};
            const group = global.db.groups[chat];
            if (!group.chatCount || typeof group.chatCount !== "object") group.chatCount = {};
            group.chatCount[sender] = (group.chatCount[sender] || 0) + 1;
        }

        // --- Private Mode: bot only obeys its owner, everyone else is ignored ---
        if (config.privateMode && !isOwner) {
            if (isCmd) return reply(config.msg?.private || "🔒 This bot is in Private Mode.");
            return;
        }

        // --- Muted users: delete their messages in this group ---
        if (isGroup && global.db?.groups?.[chat]?.mutedUsers?.includes(sender) && !isOwner && !isAdmin) {
            if (isBotAdmin) await sock.sendMessage(chat, { delete: m.key }).catch(() => {});
            return;
        }

        // --- Anti-link: delete silently (no warning), remove after 3 links ---
        if (isGroup && !isOwner && !isAdmin && isBotAdmin && guard.hasLink(body)) {
            const group = guard.ensureGroup(chat);
            if (config.antilink || group?.antilink) {
                try {
                    await sock.sendMessage(chat, { delete: m.key }).catch(() => {});
                    const strikes = guard.addStrike(chat, sender, "link");
                    if (strikes >= guard.MAX_STRIKES) {
                        guard.clearStrikes(chat, sender, "link");
                        await sock.groupParticipantsUpdate(chat, [sender], "remove").catch(() => {});
                        await sock.sendMessage(chat, {
                            text: `🚫 @${sender.split("@")[0]} was removed for sending links ${guard.MAX_STRIKES} times.`,
                            mentions: [sender],
                        }).catch(() => {});
                    }
                } catch (err) {
                    console.error(chalk.red("Anti-link error:"), err.message);
                }
                return;
            }
        }

        // --- Media / quoted helpers passed down to plugins ---
        const mime = m.msg?.mimetype || m.quoted?.mimetype || null;
        const isMedia = !!mime;

        // --- Plugin engine ---
        if (isCmd && command) {
            const hit = loadPlugins().get(command);
            if (!hit) return;
            const { plugin, file } = hit;

            if (plugin.isOwner && !isOwner) return reply(config.msg?.owner || "Owner only!");
            if (plugin.isGroup && !isGroup) return reply(config.msg?.group || "Group only!");
            if (plugin.isAdmin && !isAdmin && !isOwner) return reply(config.msg?.admin || "Admin only!");
            if (plugin.isBotAdmin && !isBotAdmin) return reply(config.msg?.botAdmin || "Make me admin!");

            try {
                await plugin.execute(sock, m, {
                    args, text, q, reply, config, chatUpdate, isGroup,
                    isAdmin, isBotAdmin, isOwner, participants, groupMetadata,
                    pushName, command, prefix, mime, isMedia, quoted: m.quoted,
                    sender, sessionId,
                });
            } catch (err) {
                console.error(chalk.red(`[PLUGIN ERROR] ${file}:`), err.message);
            }
        }
    } catch (err) {
        console.error(chalk.red("CRITICAL ERROR in message.js:"), err);
    }
};
