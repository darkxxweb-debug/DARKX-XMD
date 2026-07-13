"use strict";

const config = require("../settings/config");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["menu", "help", "mainmenu", "hali"],
    category: "main",

    execute: async (sock, m, { reply }) => {
        try {
            const pluginFolder = path.join(__dirname, "../plugins");
            const pluginFiles = fs.readdirSync(pluginFolder).filter(f => f.endsWith(".js"));

            // 🔔 NEWSLETTER INFO (FOR FORWARDED LOOK)
            const newsletterJid = "120363426285893376@newsletter";
            const newsletterName = "DARKX-ULTRA";

            // MEDIA
            const imagePath = path.resolve(__dirname, "../media/repo.jpg");
            const audioPath = path.resolve(__dirname, "../media/repo.mp3");

            // ⏱ Runtime
            const runtime = process.uptime();
            const h = Math.floor(runtime / 3600);
            const min = Math.floor((runtime % 3600) / 60);
            const s = Math.floor(runtime % 60);

            // 🧾 HEADER
            let menuText = ``;
            menuText += `📌 DARKX-ULTRA\n`;
            menuText += `──────────────────\n`;
            menuText += `👤 Owner   : ${config.ownerName}\n`;
            menuText += `📅 Date    : ${new Date().toLocaleDateString()}\n`;
            menuText += `⏱ Runtime : ${h}h ${min}m ${s}s\n`;
            menuText += `📂 Commands: ${pluginFiles.length}\n`;
            menuText += `📶 Status  : Online\n`;
            menuText += `──────────────────\n\n`;

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
                    categories[cat].push(name);
                } catch {
                    continue;
                }
            }

            // 📜 COMMAND LIST
            for (const cat of Object.keys(categories).sort()) {
                menuText += `🔹 ${cat}\n`;
                for (const cmd of categories[cat].sort()) {
                    menuText += `   • ${config.prefix}${cmd}\n`;
                }
                menuText += `\n`;
            }

            menuText += `──────────────────\n`;
            menuText += `Powered by DarkX System`;

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

            // 🔊 OPTIONAL AUDIO (no forward needed)
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