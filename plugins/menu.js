"use strict";

const fs = require("fs");
const path = require("path");

let baileys;
try { baileys = require("@whiskeysockets/baileys"); }
catch { baileys = require("baileys"); }
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = baileys;

const NEWSLETTER = {
    newsletterJid: "120363427307889741@newsletter",
    newsletterName: "DARKX ULTIMATE",
    serverMessageId: 1
};

const CAT_EMOJI = {
    MAIN: "🏠", OWNER: "👑", GROUP: "👥", DOWNLOAD: "📥", DOWNLOADER: "📥",
    AI: "🤖", FUN: "🎮", GAMES: "🎮", TOOLS: "🛠", SEARCH: "🔎",
    CONVERTER: "🔄", STICKER: "🎭", MUSIC: "🎵", ANIME: "🌸",
    IMAGE: "🖼", RELIGION: "🕌", OTHER: "📦"
};
const emo = (c) => CAT_EMOJI[c] || "🔹";

// ── Soma plugins na upange kwa category ──
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

async function sendInteractive(sock, m, { image, body, footer, buttons }) {
    const media = await prepareWAMessageMedia({ image }, { upload: sock.waUploadToServer });
    const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    header: proto.Message.InteractiveMessage.Header.create({
                        hasMediaAttachment: true,
                        ...media
                    }),
                    body: { text: body },
                    footer: { text: footer },
                    nativeFlowMessage: { buttons },
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: NEWSLETTER
                    }
                })
            }
        }
    }, { quoted: m });
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}

module.exports = {
    command: ["menu", "help", "mainmenu", "hali"],
    category: "main",

    execute: async (sock, m, { reply, config, args }) => {
        try {
            const pluginFolder = path.join(__dirname, "../plugins");
            const imagePath = path.resolve(__dirname, "../media/repo.jpg");
            const audioPath = path.resolve(__dirname, "../media/repo.mp3");

            const image = fs.existsSync(imagePath)
                ? fs.readFileSync(imagePath)
                : { url: "https://files.catbox.moe/pc5uec.png" };

            const { categories, total } = loadCategories(pluginFolder);
            const catNames = Object.keys(categories).sort();

            // Category aliyochagua user (menu <category>)
            const input = (args && args.length
                ? args.join(" ")
                : (m.text || m.body || "").trim().split(/\s+/).slice(1).join(" ")
            ).trim().toUpperCase();

            const footer = `⚡ ${config.watermark}`;

            // ═════════ SUB MENU ═════════
            if (input && categories[input]) {
                const cmds = categories[input];
                let text = `╭━━━〔 ${emo(input)} *${input} MENU* 〕━━━╮\n`;
                text += `┃ 📂 *Commands* : *${cmds.length}*\n`;
                text += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
                for (const c of cmds) text += ` ▸ *${config.prefix}${c}*\n`;
                text += `\n_Bonyeza kitufe hapa chini kurudi menu kuu_`;

                return await sendInteractive(sock, m, {
                    image, body: text, footer,
                    buttons: [{
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "⬅️ MENU KUU",
                            id: `${config.prefix}menu`
                        })
                    }]
                });
            }

            // ═════════ MENU KUU ═════════
            let text = `╭━━━〔 *${config.botName}* 〕━━━╮\n`;
            text += `┃ 👤 *Owner*    : *${config.ownerName}*\n`;
            text += `┃ 📅 *Date*     : *${new Date().toLocaleDateString()}*\n`;
            text += `┃ ⏱ *Runtime*  : *${uptime()}*\n`;
            text += `┃ 📂 *Commands* : *${total}*\n`;
            text += `┃ 📶 *Status*   : *Online* 🟢\n`;
            text += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
            text += `*📜 CATEGORIES*\n`;
            for (const c of catNames) text += ` ${emo(c)} *${c}* — _${categories[c].length}_\n`;
            text += `\n_Bonyeza kitufe cha chini kuchagua category_ 👇`;

            const rows = catNames.map(c => ({
                header: emo(c),
                title: `${c} MENU`,
                description: `Commands ${categories[c].length}`,
                id: `${config.prefix}menu ${c.toLowerCase()}`
            }));

            try {
                await sendInteractive(sock, m, {
                    image, body: text, footer,
                    buttons: [{
                        name: "single_select",
                        buttonParamsJson: JSON.stringify({
                            title: "📂 CHAGUA CATEGORY",
                            sections: [{ title: "✦ MAIN MENU ✦", highlight_label: "DARKX", rows }]
                        })
                    }]
                });
            } catch (e) {
                // Fallback kama buttons hazifanyi: tuma text ya kawaida
                console.error("INTERACTIVE FAIL:", e.message);
                let plain = text.replace("_Bonyeza kitufe cha chini kuchagua category_ 👇", "");
                plain += `\n_Andika_ *${config.prefix}menu <category>*  _mfano:_ *${config.prefix}menu ${catNames[0].toLowerCase()}*`;
                await sock.sendMessage(m.chat, {
                    image, caption: plain,
                    contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: NEWSLETTER }
                }, { quoted: m });
            }

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
