"use strict";

const fs = require("fs");
const path = require("path");
const { getAccount, allowedCommands, PLANS } = require("../library/subscriptionStore");

// 🅱️ Helper: geuza maandishi ya kawaida kuwa "bold" ya Unicode (𝗸𝗮𝗹𝗶)
// Hii inafanya kazi hata bila WhatsApp kuunga mkono *asterisk* bold —
// zinaonekana bold kila mahali (status, group name, n.k).
function toBoldUnicode(str) {
    const boldMap = {
        a: "𝗮", b: "𝗯", c: "𝗰", d: "𝗱", e: "𝗲", f: "𝗳", g: "𝗴", h: "𝗵",
        i: "𝗶", j: "𝗷", k: "𝗸", l: "𝗹", m: "𝗺", n: "𝗻", o: "𝗼", p: "𝗽",
        q: "𝗾", r: "𝗿", s: "𝘀", t: "𝘁", u: "𝘂", v: "𝘃", w: "𝘄", x: "𝘅",
        y: "𝘆", z: "𝘇",
        A: "𝗔", B: "𝗕", C: "𝗖", D: "𝗗", E: "𝗘", F: "𝗙", G: "𝗚", H: "𝗛",
        I: "𝗜", J: "𝗝", K: "𝗞", L: "𝗟", M: "𝗠", N: "𝗡", O: "𝗢", P: "𝗣",
        Q: "𝗤", R: "𝗥", S: "𝗦", T: "𝗧", U: "𝗨", V: "𝗩", W: "𝗪", X: "𝗫",
        Y: "𝗬", Z: "𝗭",
        0: "𝟬", 1: "𝟭", 2: "𝟮", 3: "𝟯", 4: "𝟰", 5: "𝟱", 6: "𝟲", 7: "𝟳",
        8: "𝟴", 9: "𝟵"
    };
    return str.split("").map(ch => boldMap[ch] || ch).join("");
}

// 🎯 Icons kwa kila category — ongeza mpya hapa ukiongeza category mpya
const CATEGORY_ICONS = {
    MAIN: "🏠",
    DOWNLOADER: "📥",
    GROUP: "👥",
    OWNER: "👑",
    TOOLS: "🛠️",
    FUN: "🎉",
    AI: "🤖",
    SEARCH: "🔍",
    STICKER: "🖼️",
    CONVERTER: "🔄",
    ANTI: "🛡️",
    GAME: "🎮",
    OTHER: "📦"
};

// 📐 Mpangilio wa order ya category — hizi zitatokea kwanza, kwa order hii,
// kabla ya zile ambazo hazipo kwenye list (ambazo zitapangwa A-Z mwishoni)
const CATEGORY_ORDER = [
    "MAIN", "DOWNLOADER", "GROUP", "TOOLS", "AI", "SEARCH",
    "STICKER", "CONVERTER", "ANTI", "GAME", "FUN", "OWNER", "OTHER"
];

module.exports = {
    command: ["menu", "help", "mainmenu", "hali"],
    category: "main",

    execute: async (sock, m, { reply, config, sessionId }) => {
        try {
            const pluginFolder = path.join(__dirname, "../plugins");
            const pluginFiles = fs.readdirSync(pluginFolder).filter(f => f.endsWith(".js"));

            const senderNumber = sessionId || m.sender?.replace(/[^0-9]/g, "") || "";
            const account = await getAccount(senderNumber);
            const plan = account.plan || "starter";
            const allowed = allowedCommands(plan); // null = pro (kila kitu wazi)

            const newsletterJid = "120363427307889741@newsletter";
            const newsletterName = "DARKX ULTIMATE";

            const imagePath = path.resolve(__dirname, "../media/repo.jpg");
            const audioPath = path.resolve(__dirname, "../media/repo.mp3");

            const runtime = process.uptime();
            const h = Math.floor(runtime / 3600);
            const min = Math.floor((runtime % 3600) / 60);
            const s = Math.floor(runtime % 60);

            const planLabel = (PLANS[plan]?.label || plan).toUpperCase();

            // 🧾 HEADER — bold kali + box-drawing ya kifahari
            let menuText = "";
            menuText += `╭━━━「 ${toBoldUnicode(config.botName)} 」━━━╮\n`;
            menuText += `┃ 👤 *Owner*    : ${config.ownerName}\n`;
            menuText += `┃ 📅 *Date*     : ${new Date().toLocaleDateString()}\n`;
            menuText += `┃ ⏱ *Runtime*  : ${h}h ${min}m ${s}s\n`;
            menuText += `┃ 📂 *Commands* : ${pluginFiles.length}\n`;
            menuText += `┃ 📶 *Status*   : Online ✅\n`;
            menuText += `┃ 💎 *Plan*     : ${planLabel}\n`;
            menuText += `╰━━━━━━━━━━━━━━━━━━━╯\n\n`;

            // 📂 KUSANYA COMMANDS KWA CATEGORY
            let categories = {};

            for (const file of pluginFiles) {
                try {
                    const pluginPath = path.join(pluginFolder, file);
                    delete require.cache[require.resolve(pluginPath)];
                    const plugin = require(pluginPath);

                    if (!plugin.command) continue;
                    if (plugin.ownerOnly === true) continue;

                    const name = Array.isArray(plugin.command)
                        ? plugin.command[0]
                        : plugin.command;

                    const cat = plugin.category
                        ? plugin.category.toUpperCase()
                        : "OTHER";

                    const unlocked = allowed === null || allowed.includes(name.toLowerCase());

                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push({ name, unlocked });
                } catch {
                    continue;
                }
            }

            // 🔀 Panga category: kwanza zile zilizo kwenye CATEGORY_ORDER
            // (kwa order husika), kisha zilizobaki A-Z
            const knownCats = CATEGORY_ORDER.filter(c => categories[c]);
            const unknownCats = Object.keys(categories)
                .filter(c => !CATEGORY_ORDER.includes(c))
                .sort();
            const sortedCats = [...knownCats, ...unknownCats];

            let lockedCount = 0;
            for (const cat of sortedCats) {
                const icon = CATEGORY_ICONS[cat] || "📦";
                menuText += `┏━「 ${icon} ${toBoldUnicode(cat)} 」\n`;
                for (const cmd of categories[cat].sort((a, b) => a.name.localeCompare(b.name))) {
                    if (cmd.unlocked) {
                        menuText += `┃ ➤ ${config.prefix}${cmd.name}\n`;
                    } else {
                        menuText += `┃ 🔒 ${config.prefix}${cmd.name}\n`;
                        lockedCount++;
                    }
                }
                menuText += `┗━━━━━━━━━━━━━━━━\n\n`;
            }

            if (lockedCount > 0) {
                menuText += `🔒 *${lockedCount}* command(s) zimefungwa kwenye plan yako ya sasa.\n`;
                menuText += `💎 Upgrade kupitia web panel → *Subscribe* ili uzifungue.\n`;
                menuText += `───────────────\n`;
            } else {
                menuText += `───────────────\n`;
            }
            menuText += `✨ Powered by ${toBoldUnicode(config.watermark)}`;

            // 🖼 IMAGE
            const image = fs.existsSync(imagePath)
                ? fs.readFileSync(imagePath)
                : { url: "https://files.catbox.moe/pc5uec.png" };

            // 🚀 TUMA MENU (FORWARDED FROM NEWSLETTER)
            await sock.sendMessage(
                m.chat,
                {
                    image,
                    caption: menuText,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: newsletterJid,
                            newsletterName: newsletterName,
                            serverMessageId: 1
                        }
                    }
                },
                { quoted: m }
            );

            // 🔊 AUDIO (si lazima kuiforward)
            if (fs.existsSync(audioPath)) {
                await sock.sendMessage(
                    m.chat,
                    {
                        audio: fs.readFileSync(audioPath),
                        mimetype: "audio/mpeg"
                    },
                    { quoted: m }
                );
            }

        } catch (err) {
            console.error("MENU ERROR:", err);
            reply("❌ Menu failed to load.");
        }
    }
};
