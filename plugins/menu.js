"use strict";

const fs = require("fs");
const path = require("path");
const { menuImagePath } = require("../library/settingsStore");

const CAT_EMOJI = {
    MAIN: "🏠", OWNER: "👑", GROUP: "👥", DOWNLOAD: "📥", DOWNLOADER: "📥",
    AI: "🤖", FUN: "🎮", GAMES: "🎮", TOOLS: "🛠", SEARCH: "🔎",
    CONVERTER: "🔄", STICKER: "🎭", MUSIC: "🎵", ANIME: "🌸",
    IMAGE: "🖼", RELIGION: "🕌", BUSINESS: "💼", INFO: "ℹ️", OTHER: "📦"
};
const emo = (c) => CAT_EMOJI[c] || "🔹";

// ---- Command list cache: plugins are scanned at most once per minute ----
let cache = null;
function loadCategories(pluginFolder) {
    if (cache && Date.now() - cache.at < 60_000) return cache.data;

    const files = fs.readdirSync(pluginFolder).filter((f) => f.endsWith(".js"));
    const categories = {};
    let total = 0;
    for (const file of files) {
        try {
            const plugin = require(path.join(pluginFolder, file));
            if (!plugin.command) continue;
            const name = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
            const cat = String(plugin.category || "OTHER").toUpperCase();
            (categories[cat] = categories[cat] || []).push(name);
            total++;
        } catch { continue; }
    }
    for (const c in categories) categories[c].sort((a, b) => a.localeCompare(b));

    const data = { categories, total };
    cache = { at: Date.now(), data };
    return data;
}

function uptime() {
    const r = process.uptime();
    return `${Math.floor(r / 3600)}h ${Math.floor((r % 3600) / 60)}m ${Math.floor(r % 60)}s`;
}

// ---- Guard: one reply per incoming message, no matter how often we are called ----
const handled = new Set();
function firstTime(id) {
    if (!id) return true;
    if (handled.has(id)) return false;
    handled.add(id);
    setTimeout(() => handled.delete(id), 60_000).unref?.();
    return true;
}

module.exports = {
    command: ["menu", "help", "mainmenu"],
    category: "main",

    execute: async (sock, m, { reply, config, args, sessionId }) => {
        if (!firstTime(`${sessionId}|${m.key?.id}`)) return;

        try {
            const pluginFolder = path.join(__dirname);
            const P = config.prefix;

            const { categories, total } = loadCategories(pluginFolder);
            const catNames = Object.keys(categories).sort();

            // What the user typed after the command:  .menu group   or   .menu 2
            let input = (args && args.length ? args.join(" ") : "").trim().toUpperCase();
            if (/^\d+$/.test(input)) input = catNames[parseInt(input, 10) - 1] || input;

            // The forwarded-channel tag uses the SAME channel the bot auto-follows.
            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.channelJid,
                    newsletterName: config.channelName,
                    serverMessageId: 1,
                },
            };

            // Menu image: only when the user set one on the web (uploaded file first, then link).
            const filePath = menuImagePath(sessionId);
            let image = null;
            if (filePath) image = fs.readFileSync(filePath);
            else if (config.menuImageUrl) image = { url: config.menuImageUrl };

            const send = async (caption) => {
                if (image) {
                    try {
                        return await sock.sendMessage(m.chat, { image, caption, contextInfo }, { quoted: m });
                    } catch (e) {
                        console.error("MENU IMAGE SEND FAILED:", e.message);
                    }
                }
                return sock.sendMessage(m.chat, { text: caption, contextInfo }, { quoted: m });
            };

            // ═════════ CATEGORY MENU ═════════
            if (input && categories[input]) {
                const cmds = categories[input];
                let t = `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
                t += `   ${emo(input)}  *${input}*\n`;
                t += `┗━━━━━━━━━━━━━━━━━━━━┛\n`;
                t += `  ${cmds.length} command${cmds.length === 1 ? "" : "s"}\n\n`;
                for (const c of cmds) t += `  ⌁ ${P}${c}\n`;
                t += `\n─────────────────────\n`;
                t += `↩️ Back: *${P}menu*\n`;
                t += `_${config.watermark}_`;
                return await send(t);
            }

            // ═════════ MAIN MENU ═════════
            let t = "";
            if (input) t += `❌ Category *${input}* was not found.\n\n`;

            t += `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
            t += `   ✦ *${String(config.botName).toUpperCase()}* ✦\n`;
            t += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            t += `┌─ ⌬ *BOT INFO*\n`;
            t += `│ 👤 Owner    : ${config.ownerName}\n`;
            t += `│ 🔣 Prefix   : ${P}\n`;
            t += `│ ⏱ Uptime   : ${uptime()}\n`;
            t += `│ 📂 Commands : ${total}\n`;
            t += `└─ 🟢 Online\n\n`;
            t += `┌─ ⌬ *CATEGORIES*\n`;
            catNames.forEach((c, i) => {
                t += `│ ${i + 1}. ${emo(c)} ${c} (${categories[c].length})\n`;
            });
            t += `└──────────────\n\n`;
            t += `👉 Open a category:\n`;
            t += `   *${P}menu <name>*  or  *${P}menu <number>*\n`;
            t += `   e.g. *${P}menu ${catNames[0].toLowerCase()}*  or  *${P}menu 1*\n\n`;
            t += `_${config.watermark}_`;

            await send(t);
        } catch (err) {
            console.error("MENU ERROR:", err);
            reply("❌ Menu failed to load.");
        }
    }
};
