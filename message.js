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

// Store for anti-delete cache (per process, shared across sessions is fine)
const recentMessages = new Map();

const LINK_REGEX = /(https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[^\s]+/i;

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

        // --- Anti-delete: remember the message so we can report a delete later ---
        if (m.key && !fromMe && body) {
            const storageKey = `${chat}_${m.key.id}`;
            recentMessages.set(storageKey, { body, sender, pushName, chat, timestamp: Date.now() });
            setTimeout(() => recentMessages.delete(storageKey), 10 * 60 * 1000);
        }

        // --- Anti-delete: detect a delete event ---
        if (chatUpdate?.type === "notify") {
            const msg = chatUpdate.messages?.[0];
            const proto = msg?.message?.protocolMessage;
            if (proto && proto.type === 0 && config.antidelete) {
                const deleteKey = proto.key;
                const storageKey = `${deleteKey.remoteJid}_${deleteKey.id}`;
                const deleted = recentMessages.get(storageKey);
                if (deleted) {
                    const deletedSender = (deleted.sender || proto.sender || deleteKey.participant || "").split("@")[0];
                    const report =
                        `⚠️ *MESSAGE DELETED*\n\n` +
                        `👤 *Sender:* ${deleted.pushName || "Unknown"}\n` +
                        `📱 *Number:* ${deletedSender}\n` +
                        `📝 *Message:* ${deleted.body || "📝 *No text content*"}\n` +
                        `🕐 *Deleted at:* ${new Date().toLocaleTimeString()}`;

                    await sock.sendMessage(deleteKey.remoteJid, { text: report }).catch(() => {});
                    if (config.antideleteNotifyOwner) {
                        const ownerJid = config.ownerNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
                        await sock.sendMessage(ownerJid, { text: `🔴 *ANTI-DELETE REPORT*\n\n${report}` }).catch(() => {});
                    }
                    recentMessages.delete(storageKey);
                }
            }
        }

        if (fromMe && !isCmd) return;
        if (!body) return;

        if (global.db) synchronizeData(m, sock);

        // --- Group metadata / permissions ---
        const isGroup = chat.endsWith("@g.us");
        const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";

        let groupMetadata, participants, groupAdmins, isAdmin, isBotAdmin;
        if (isGroup) {
            groupMetadata = await sock.groupMetadata(chat).catch(() => null);
            if (groupMetadata) {
                participants = groupMetadata.participants || [];
                groupAdmins = participants.filter((v) => v.admin !== null).map((v) => v.id);
                isAdmin = groupAdmins.includes(sender);
                isBotAdmin = groupAdmins.includes(botId);
            }
        }

        const ownerJid = config.ownerNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const isOwner = fromMe || [ownerJid, botId].includes(sender);

        const reply = (teks) => sock.sendMessage(chat, { text: teks }, { quoted: m });

        // --- Muted users: delete their messages in this group ---
        if (isGroup && global.db?.groups?.[chat]?.mutedUsers?.includes(sender) && !isOwner && !isAdmin) {
            if (isBotAdmin) await sock.sendMessage(chat, { delete: m.key }).catch(() => {});
            return;
        }

        // --- Anti-link enforcement (default OFF until the owner turns it on) ---
        if (isGroup && config.antilink && !isOwner && !isAdmin && LINK_REGEX.test(body)) {
            try {
                await sock.sendMessage(chat, { delete: m.key });
                await sock.sendMessage(chat, {
                    text: `🚫 @${sender.split("@")[0]}, links are not allowed in this group.`,
                    mentions: [sender],
                });
                if (isBotAdmin) {
                    await sock.groupParticipantsUpdate(chat, [sender], "remove").catch(() => {});
                }
            } catch (err) {
                console.error(chalk.red("Anti-link error:"), err.message);
            }
            return;
        }

        // --- Media / quoted helpers passed down to plugins ---
        const mime = m.msg?.mimetype || m.quoted?.mimetype || null;
        const isMedia = !!mime;

        // --- Plugin engine ---
        if (isCmd && command) {
            const pluginFolder = path.join(__dirname, "plugins");
            if (!fs.existsSync(pluginFolder)) return;

            const pluginFiles = fs.readdirSync(pluginFolder).filter((file) => file.endsWith(".js"));

            for (const file of pluginFiles) {
                try {
                    const filePath = path.join(pluginFolder, file);
                    delete require.cache[require.resolve(filePath)];
                    const plugin = require(filePath);

                    const cmdMatch = Array.isArray(plugin.command)
                        ? plugin.command.some((c) => c.toLowerCase() === command)
                        : plugin.command?.toLowerCase() === command;

                    if (!cmdMatch) continue;

                    if (plugin.isOwner && !isOwner) return reply(config.msg?.owner || "Owner only!");
                    if (plugin.isGroup && !isGroup) return reply(config.msg?.group || "Group only!");
                    if (plugin.isAdmin && !isAdmin && !isOwner) return reply(config.msg?.admin || "Admin only!");
                    if (plugin.isBotAdmin && !isBotAdmin) return reply(config.msg?.botAdmin || "Make me admin!");

                    await plugin.execute(sock, m, {
                        args, text, q, reply, config, chatUpdate, isGroup,
                        isAdmin, isBotAdmin, isOwner, participants, groupMetadata,
                        pushName, command, prefix, mime, isMedia, quoted: m.quoted,
                        sender, sessionId,
                    });
                    return;
                } catch (err) {
                    console.error(chalk.red(`[PLUGIN ERROR] ${file}:`), err.message);
                    continue;
                }
            }
        }
    } catch (err) {
        console.error(chalk.red("CRITICAL ERROR in message.js:"), err);
    }
};
