const axios = require("axios");

module.exports = {
    command: ["igdl2", "instagram2", "ig2", "instadl2"],
    category: "download",
    description: "Download Instagram video (alternative API 2). Usage: .igdl2 <Instagram video URL>",

    execute: async (sock, m, { args, reply, config }) => {
        try {
            const igUrl = args[0];
            if (!igUrl || !igUrl.includes("instagram.com")) {
                return reply("❌ Please provide a valid Instagram video URL.\n\nExample:\n.igdl2 https://instagram.com/reel/...");
            }

            await sock.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

            const apiUrl = `https://jawad-tech.vercel.app/downloader?url=${encodeURIComponent(igUrl)}`;
            const { data } = await axios.get(apiUrl, { timeout: 30000 });

            if (!data.status || !data.result || !Array.isArray(data.result)) {
                return reply("❌ Unable to fetch the video. Please check the URL and try again.");
            }

            const videoUrl = data.result[0];
            if (!videoUrl) return reply("❌ No video found in the response.");

            const metadata = data.metadata || {};
            const author = metadata.author || "Unknown";
            const caption = metadata.caption ? metadata.caption.slice(0, 300) + "..." : "No caption provided.";
            const likes = metadata.like || 0;
            const comments = metadata.comment || 0;

            await sock.sendMessage(m.chat, {
                video: { url: videoUrl },
                caption: `📥 *Instagram Reel Downloader*\n👤 *Author:* ${author}\n💬 *Caption:* ${caption}\n❤️ *Likes:* ${likes} | 💭 *Comments:* ${comments}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.watermark}`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error("IGDL2 Error:", error);
            await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } }).catch(() => {});
            reply("❌ Failed to download the Instagram video. Please try again later.");
        }
    }
};
