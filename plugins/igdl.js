const axios = require("axios");

module.exports = {
    command: ["igdl", "instagram", "insta", "ig"],
    category: "download",
    description: "Download Instagram videos/reels. Usage: .igdl <Instagram URL>",

    execute: async (sock, m, { q, quoted, reply, config }) => {
        try {
            const url = q || quoted?.body;
            if (!url || !url.includes("instagram.com")) {
                return reply("❌ Please provide or reply to an Instagram link.");
            }

            await sock.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

            const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data?.status || !response.data.data?.length) {
                await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
                return reply("❌ Failed to fetch media. Invalid link or private content.");
            }

            const caption =
`*_ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ_*

╔ஜ۩▒█ *${config.botName}* █▒۩ஜ╗
*|* 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 *${config.watermark}*
╰━━━━━━━━━━━━━━━━━━⊷`;

            for (const item of response.data.data) {
                await sock.sendMessage(m.chat, {
                    [item.type === "video" ? "video" : "image"]: { url: item.url },
                    caption
                }, { quoted: m });
            }

            await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error("IGDL Error:", error);
            await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } }).catch(() => {});
            reply("❌ Download failed. Try again later.");
        }
    }
};
