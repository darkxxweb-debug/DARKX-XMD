"use strict";

const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["menu", "help", "mainmenu", "hali"],
    category: "main",

    execute: async (sock, m, { reply, config }) => {
        try {
            const pluginFolder = path.join(__dirname, "../plugins");
            const pluginFiles = fs.readdirSync(pluginFolder).filter(f => f.endsWith(".js"));

            // 🔔 NEWSLETTER INFO
            const newsletterJid = "120363427307889741@newsletter";
            const newsletterName = "DARKX ULTIMATE";

            // MEDIA
            const imagePath = path.resolve(__dirname, "../media/repo.jpg");
            const audioPath = path.resolve(__dirname, "../media/repo.mp3");

            // ⏱ Runtime
            const runtime = process.uptime();
            const h = Math.floor(runtime / 3600);
            const min = Math.floor((runtime % 3600) / 60);
            const s = Math.floor(runtime % 60);

            // 🩸 GANG-STYLE HEADER
            let menuText = ``;
            menuText += `▀▄▀▄▀▄ ⚡ 𝐃𝐀𝐑𝐊𝐗 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 ⚡ ▄▀▄▀▄▀\n`;
            menuText += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`;
            menuText += `╔═══════ 𝗦𝗧𝗥𝗘𝗘𝗧 𝗠𝗢𝗗𝗘 ═══════╗\n`;
            menuText += `║ 🩸 𝗕𝗢𝗧   » ${toGang(config.botName)}\n`;
            menuText += `║ 👑 𝗢𝗪𝗡𝗘𝗥 » ${toGang(config.ownerName)}\n`;
            menuText += `║ 📅 𝗗𝗔𝗧𝗘  » ${new Date().toLocaleDateString()}\n`;
            menuText += `║ ⏱ 𝗨𝗣    » ${h}h ${min}m ${s}s\n`;
            menuText += `║ 📂 𝗖𝗠𝗗𝗦  » ${pluginFiles.length}\n`;
            menuText += `║ 📶 𝗦𝗧𝗔𝗧𝗨𝗦 » 𝗢𝗡𝗟𝗜𝗡𝗘 🟢\n`;
            menuText += `╚═══════════════════════════╝\n\n`;

            // 📂 LOAD COMMANDS
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

                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push({ name });
                } catch {
                    continue;
                }
            }

            // 📜 COMMAND LIST — GANG STYLE
            for (const cat of Object.keys(categories).sort()) {
                menuText += `┏━━━━━━━「 🔥 ${toGang(cat)} 🔥 」━━━━━━━┓\n`;
                for (const cmd of categories[cat].sort((a, b) => a.name.localeCompare(b.name))) {
                    menuText += `┃ ⚔️ ${config.prefix}${toGang(cmd.name)}\n`;
                }
                menuText += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            }

            menuText += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`;
            menuText += `💀 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬 » ${toGang(config.watermark)}\n`;
            menuText += `🔥 PRIME MRX DEV· KiLLER 🔥\n`;
            menuText += `▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀\n`;

            // 🖼 IMAGE
            const image = fs.existsSync(imagePath)
                ? fs.readFileSync(imagePath)
                : { url: "https://files.catbox.moe/pc5uec.png" };

            // 🚀 SEND MENU (FORWARDED FROM NEWSLETTER)
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

            // 🔊 OPTIONAL AUDIO
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

// 🔥 Convert normal text to gang/bold Unicode style
function toGang(text = "") {
    const map = {
        a:"𝐀", b:"𝐁", c:"𝐂", d:"𝐃", e:"𝐄", f:"𝐅", g:"𝐆", h:"𝐇", i:"𝐈",
        j:"𝐉", k:"𝐊", l:"𝐋", m:"𝐌", n:"𝐍", o:"𝐎", p:"𝐏", q:"𝐐", r:"𝐑",
        s:"𝐒", t:"𝐓", u:"𝐔", v:"𝐕", w:"𝐖", x:"𝐗", y:"𝐘", z:"𝐙",
        A:"𝐀", B:"𝐁", C:"𝐂", D:"𝐃", E:"𝐄", F:"𝐅", G:"𝐆", H:"𝐇", I:"𝐈",
        J:"𝐉", K:"𝐊", L:"𝐋", M:"𝐌", N:"𝐍", O:"𝐎", P:"𝐏", Q:"𝐐", R:"𝐑",
        S:"𝐒", T:"𝐓", U:"𝐔", V:"𝐕", W:"𝐖", X:"𝐗", Y:"𝐘", Z:"𝐙",
        0:"𝟎", 1:"𝟏", 2:"𝟐", 3:"𝟑", 4:"𝟒", 5:"𝟓", 6:"𝟔", 7:"𝟕", 8:"𝟖", 9:"𝟗"
    };
    return String(text).split("").map(c => map[c] || c).join("");
        }
