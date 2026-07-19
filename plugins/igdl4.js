const axios = require("axios");

module.exports = {
    command: ["igdl4", "instagram4", "insta4", "ig4", "igvideo4"],
    category: "download",
    description: "Download Instagram video (alternative API 4). Usage: .igdl4 <Instagram URL>",

    execute: async (sock, m, { args, reply, config }) => {
        try {
            const igUrl = args[0];
            if (!igUrl || !igUrl.includes("instagram.com")) {
                return reply("❌ Please provide a valid Instagram URL.\n\nExample:\n.igdl4 https://instagram.com/...");
            }

            await sock.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

            const apiUrl = `https://bk9.fun/download/instagram?url=${encodeURIComponent(igUrl)}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data?.status || !response.data?.BK9?.[0]?.url) {
                await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
                return reply("❌ Unable to fetch the video. Try .igdl for the primary download instead.");
            }

            const videoUrl = response.data.BK9[0].url;
            await sock.sendMessage(m.chat, { react: { text: "📶", key: m.key } });

            const videoResponse = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 60000 });
            if (!videoResponse.data) {
                await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
                return reply("❌ Failed to download the video. Please try again later.");
            }

            const videoBuffer = Buffer.from(videoResponse.data, "binary");

            await sock.sendMessage(m.chat, {
                video: videoBuffer,
                caption: `*_ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ_*

╔ஜ۩▒█ *${config.botName}* █▒۩ஜ╗
*|* 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 *${config.watermark}*
╰━━━━━━━━━━━━━━━━━━⊷`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error("IGDL4 Error:", error);
            await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } }).catch(() => {});
            reply("❌ This download source failed. Try .igdl for the primary download instead.");
        }
    }
};
