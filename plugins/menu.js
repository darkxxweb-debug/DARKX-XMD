"use strict";

const fs = require("fs");
const path = require("path");

const NEWSLETTER = {
    newsletterJid: "120363427307889741@newsletter",
    newsletterName: "DARKX ULTIMATE",
    serverMessageId: 1
};

const CTX = {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: NEWSLETTER
};

const CAT_EMOJI = {
    MAIN: "🏠", OWNER: "👑", GROUP: "👥", DOWNLOAD: "📥", DOWNLOADER: "📥",
    AI: "🤖", FUN: "🎮", GAMES: "🎮", TOOLS: "🛠", SEARCH: "🔎",
    CONVERTER: "🔄", STICKER: "🎭", MUSIC: "🎵", ANIME: "🌸",
    IMAGE: "🖼", RELIGION: "🕌", OTHER: "📦"
};
const emo = (c) => CAT_EMOJI[c] || "🔹";

function loadCategories(pluginFolder) {
    const files = fs.readdirSync(pluginFolder).filter(f => f.endsWith(".js"));
    const categories = {};
    for (const file of files) {
        try {
            const p = path.join(pluginFolder, file);
            delete require.cache[require.resolve(p)];
            const plugin = require(p);
            if (!plugin.command || plugin.ownerOnly === true) continue;
            const name = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
            const cat = (plugin.category || "OTHER").toUpperCase();
            (categories[cat] = categories[cat] || []).push(name);
        } catch { continue; }
    }
    for (const c in categories) categories[c].sort((a, b) => a.localeCompare(b));
    return { categories, total: files.length };
}

function uptime() {
    const r = process.uptime();
    return `${Math.floor(r / 3600)}h ${Math.floor((r % 3600) / 60)}m ${Math.floor(r % 60)}s`;
}

module.exports = {
    command: ["menu", "help", "mainmenu", "hali"],
    category: "main",

    execute: async (sock, m, { reply, config, args }) => {
        try {
            const pluginFolder = path.join(__dirname, "../plugins");
            const imagePath = path.resolve(__dirname, "../media/repo.jpg");
            const audioPath = path.resolve(__dirname, "../media/repo.mp3");
            const P = config.prefix;

            const image = fs.existsSync(imagePath)
                ? fs.readFileSync(imagePath)
                : { url: "https://files.catbox.moe/pc5uec.png" };

            const { categories, total } = loadCategories(pluginFolder);
            const catNames = Object.keys(categories).sort();

            // Input ya user: .menu group  au  .menu 2
            let input = (args && args.length
                ? args.join(" ")
                : (m.text || m.body || "").trim().split(/\s+/).slice(1).join(" ")
            ).trim().toUpperCase();

            if (/^\d+$/.test(input)) input = catNames[parseInt(input) - 1] || input;

            const send = async (caption) => {
                try {
                    await sock.sendMessage(m.chat, { image, caption, contextInfo: CTX }, { quoted: m });
                } catch (e) {
                    console.error("IMAGE SEND FAIL:", e.message);
                    await sock.sendMessage(m.chat, { text: caption, contextInfo: CTX }, { quoted: m });
                }
            };

            // ═════════ SUB MENU ═════════
            if (input && categories[input]) {
                const cmds = categories[input];
                let t = `╭━━━━━━━━━━━━━━━━━━╮\n`;
                t += `┃ ${emo(input)} *${input} MENU*\n`;
                t += `┃ 📂 *Commands* : *${cmds.length}*\n`;
                t += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
                for (const c of cmds) t += `  ▸ *${P}${c}*\n`;
                t += `\n━━━━━━━━━━━━━━━━━━\n`;
                t += `↩️ *Rudi menu kuu:* *${P}menu*\n`;
                t += `⚡ _${config.watermark}_`;
                return await send(t);
            }

            // ═════════ MENU KUU ═════════
            let t = `╭━━━━━━━━━━━━━━━━━━╮\n`;
            t += `┃ 🤖 *${config.botName}*\n`;
            t += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
            t += `👤 *Owner*    : *${config.ownerName}*\n`;
            t += `📅 *Date*     : *${new Date().toLocaleDateString()}*\n`;
            t += `⏱ *Runtime*  : *${uptime()}*\n`;
            t += `📂 *Commands* : *${total}*\n`;
            t += `📶 *Status*   : *Online* 🟢\n\n`;
            t += `━━━━━〔 *📜 CATEGORIES* 〕━━━━━\n\n`;
            catNames.forEach((c, i) => {
                t += `*${i + 1}.* ${emo(c)} *${c}* ➜ _${categories[c].length}_\n`;
            });
            t += `\n━━━━━━━━━━━━━━━━━━\n`;
            t += `👉 *Fungua category:*\n`;
            t += `   *${P}menu <jina>*  au  *${P}menu <namba>*\n`;
            t += `   _mfano:_ *${P}menu ${catNames[0].toLowerCase()}*  au  *${P}menu 1*\n`;
            t += `━━━━━━━━━━━━━━━━━━\n`;
            t += `⚡ _${config.watermark}_`;

            if (input) {
                t = `❌ *Category "${input}" haipo.*\n\n` + t;
            }

            await send(t);

            if (fs.existsSync(audioPath)) {
                await sock.sendMessage(m.chat, {
                    audio: fs.readFileSync(audioPath),
                    mimetype: "audio/mpeg"
                }, { quoted: m });
            }

        } catch (err) {
            console.error("MENU ERROR:", err);
            reply("❌ Menu failed to load.");
        }
    }
};
