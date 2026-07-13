const config = require("../settings/config");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["repo", "script", "sc"],
    category: "INFO",

    execute: async (sock, m, { reply }) => {
        try {
            const imagePath = path.join(__dirname, "../media/repo.jpg");
            const audioPath = path.join(__dirname, "../media/repo.mp3");

            const repoLink = "https://github.com/darkx-pro/DarkX-Mini.git";
            const ownerNumber = "255775710774";
            const ownerName = "MrX Dev";
            const botName = "DarkX Ultra 👑";

            // SEND AUDIO FIRST
            if (fs.existsSync(audioPath)) {
                await sock.sendMessage(
                    m.chat,
                    {
                        audio: fs.readFileSync(audioPath),
                        mimetype: "audio/mpeg",
                        ptt: false
                    },
                    { quoted: m }
                );
            }

            const caption = `
*╭━━━〔 👑 DARKX ULTRA SYSTEM 👑 〕━━━⬣*
*┃ ⚡ BOT NAME:* ${botName}
*┃ 👑 OWNER:* ${ownerName}
*┃ 📞 NUMBER:* wa.me/${ownerNumber}
*┃ 🌐 VERSION:* v2.0.2
*┃ 🚀 STATUS:* ONLINE
*┃ 🧠 ENGINE:* Smart Auto Response
*┃ 🔥 TYPE:* WhatsApp Assistant Bot
*╰━━━━━━━━━━━━━━━━━━⬣*

*╭━━━〔 ⚔️ FEATURES LIST ⚔️ 〕━━━⬣*
*┃ ⬡ Fast Response Speed*
*┃ ⬡ Auto AI Chat Mode*
*┃ ⬡ Anti Delete System*
*┃ ⬡ Stylish Menu System*
*┃ ⬡ Plugin Commands*
*┃ ⬡ Group Management*
*┃ ⬡ Media Downloader*
*┃ ⬡ Stable Connection*
*┃ ⬡ Owner Controls*
*┃ ⬡ Clean Performance*
*╰━━━━━━━━━━━━━━━━━━⬣*

*╭━━━〔 📂 REPOSITORY 📂 〕━━━⬣*
*┃ 🔗 GitHub Script:*
${repoLink}
*╰━━━━━━━━━━━━━━━━━━⬣*

> _Powerful • Fast • Clean • DarkX Official_ 🔥
`;

            // SEND IMAGE + INFO
            await sock.sendMessage(
                m.chat,
                {
                    image: fs.readFileSync(imagePath),
                    caption: caption,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        externalAdReply: {
                            title: "DARKX ULTRA 👑",
                            body: "Official Repository & Bot Info",
                            mediaType: 1,
                            thumbnail: fs.readFileSync(imagePath),
                            sourceUrl: repoLink,
                            renderLargerThumbnail: true,
                            showAdAttribution: true
                        }
                    }
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Repo Command Error:", err);

            await sock.sendMessage(
                m.chat,
                { text: "❌ Repo command failed." },
                { quoted: m }
            );
        }
    }
};