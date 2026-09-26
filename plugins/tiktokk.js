const axios = require("axios");

module.exports = {
    command: ["tiktok", "tt", "ttdl", "tiktokdl"],
    category: "download",
    description: "Download TikTok video without watermark (HD if available)",
    execute: async (sock, m, { text, reply }) => {
        const url = text?.trim();

        if (!url) {
            return reply(
                "🎵 *TikTok Downloader*\n\nPlease provide a TikTok URL.\nExample:\n.tiktok https://vm.tiktok.com/XXXX"
            );
        }

        try {
            await reply("⏳ Downloading TikTok video...");

            const apiUrl = `https://discardapi.onrender.com/api/dl/tiktok?apikey=guru&url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, {
                timeout: 45000,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });

            if (!data?.status || !data?.result) {
                throw new Error("Invalid API response");
            }

            const res = data.result;
            const hd = res.data.find((v) => v.type === "nowatermark_hd");
            const noWm = res.data.find((v) => v.type === "nowatermark");
            const videoUrl = hd?.url || noWm?.url;

            if (!videoUrl) {
                throw new Error("No downloadable video found");
            }

            const caption = `🎵 *TikTok Downloader*
━━━━━━━━━━━━━━━━━━━
👤 *User:* ${res.author.nickname}
🆔 *Username:* ${res.author.fullname}
🌍 *Region:* ${res.region}
⏱️ *Duration:* ${res.duration}

❤️ *Likes:* ${res.stats.likes}
💬 *Comments:* ${res.stats.comment}
🔁 *Shares:* ${res.stats.share}
👀 *Views:* ${res.stats.views}

🎧 *Sound:* ${res.music_info.title}
📅 *Posted:* ${res.taken_at}

📝 *Caption:*
${res.title || "No caption"}

✨ *Quality:* ${hd ? "HD No Watermark" : "No Watermark"}
━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(
                m.chat,
                {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption,
                },
                { quoted: m }
            );
        } catch (err) {
            console.error("[TIKTOK] Error:", err.message);
            if (err.code === "ECONNABORTED") {
                reply("⏱️ Request timed out. Please try again later.");
            } else {
                reply(`❌ Failed to download TikTok video.\nReason: ${err.message}`);
            }
        }
    },
};
