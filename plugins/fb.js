const axios = require("axios");

module.exports = {
    command: ["fb", "facebook", "fbdl"],
    category: "download",
    description: "Download a Facebook video. Usage: .fb <video link>",

    execute: async (sock, m, { q, reply, config }) => {
        try {
            if (!q) {
                return reply("❌ Please send a Facebook video link.\n\nExample:\n.fb https://facebook.com/watch/xxxxx");
            }

            const apiUrl = `https://movanest.xyz/v2/fbdown?url=${encodeURIComponent(q)}`;
            const { data } = await axios.get(apiUrl, { timeout: 30000 });

            if (data.status !== true) {
                return reply("❌ API error. Please try again later.");
            }

            if (!Array.isArray(data.results) || data.results.length === 0) {
                return reply("❌ Couldn't find that Facebook video.");
            }

            const result = data.results[0];

            // 🎥 Prefer HD, fall back to normal quality
            const videoUrl = result.hdQualityLink || result.normalQualityLink;

            if (!videoUrl) {
                return reply("❌ No downloadable video found for that link.");
            }

            const caption =
`*👑 FB VIDEO 👑*
*👑 DURATION:* ${result.duration || "N/A"}
*👑 CREATOR:* ${data.creator || "Unknown"}
*👑 BY:* ${config.watermark}`;

            await sock.sendMessage(m.chat, {
                video: { url: videoUrl },
                mimetype: "video/mp4",
                caption
            }, { quoted: m });

        } catch (err) {
            console.error("FB DOWNLOAD ERROR:", err);
            reply("❌ Something went wrong. Please try again.");
        }
    }
};
