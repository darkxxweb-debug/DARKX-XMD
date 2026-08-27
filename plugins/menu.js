"use strict";

const fs = require("fs");
const path = require("path");
const { getAccount, allowedCommands, PLANS } = require("../library/subscriptionStore");

module.exports = {
    command: ["menu", "help", "mainmenu", "hali"],
    category: "main",

    execute: async (sock, m, { reply, config, sessionId }) => {
        try {
            const pluginFolder = path.join(__dirname, "../plugins");
            const pluginFiles = fs.readdirSync(pluginFolder).filter(f => f.endsWith(".js"));

            // 🔐 One single "menu" command — the content it shows is chosen
            // automatically based on the account's access: a full-access
            // plan (weekly/monthly, or an active admin promo) unlocks
            // everything, otherwise only individually-purchased commands
            // (+ this menu command itself) are unlocked.
            const senderNumber = sessionId || m.sender?.replace(/[^0-9]/g, "") || "";
            const account = await getAccount(senderNumber);
            const plan = account.plan || "starter";
            const allowed = allowedCommands(account); // null = full access (everything unlocked)

            // 🔔 NEWSLETTER INFO (FOR FORWARDED LOOK)
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

            // 🧾 HEADER
            let menuText = ``;
            menuText += `📌 ${config.botName}\n`;
            menuText += `──────────────────\n`;
            menuText += `👤 Owner   : ${config.ownerName}\n`;
            menuText += `📅 Date    : ${new Date().toLocaleDateString()}\n`;
            menuText += `⏱ Runtime : ${h}h ${min}m ${s}s\n`;
            menuText += `📂 Commands: ${pluginFiles.length}\n`;
            menuText += `📶 Status  : Online\n`;
            menuText += `💎 Plan    : ${(PLANS[plan]?.label || plan).toUpperCase()}\n`;
            menuText += `──────────────────\n\n`;

            // 📂 LOAD COMMANDS (unlocked vs locked, based on the account's plan)
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

            // 📜 COMMAND LIST — unlocked commands show plainly, locked ones
            // show with a 🔒 so the user knows to upgrade to see them work.
            let lockedCount = 0;
            for (const cat of Object.keys(categories).sort()) {
                menuText += `🔹 ${cat}\n`;
                for (const cmd of categories[cat].sort((a, b) => a.name.localeCompare(b.name))) {
                    if (cmd.unlocked) {
                        menuText += `   • ${config.prefix}${cmd.name}\n`;
                    } else {
                        menuText += `   🔒 ${config.prefix}${cmd.name}\n`;
                        lockedCount++;
                    }
                }
                menuText += `\n`;
            }

            if (lockedCount > 0) {
                menuText += `🔒 ${lockedCount} command(s) are locked.\n`;
                menuText += `Buy just the ones you want as a command pack, or subscribe to a\n`;
                menuText += `Weekly/Monthly plan for full access — from the web panel → *Subscribe*.\n`;
                menuText += `──────────────────\n`;
            } else {
                menuText += `──────────────────\n`;
            }
            menuText += `Powered by ${config.watermark}`;

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
