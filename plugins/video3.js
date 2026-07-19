const axios = require("axios");
const yts = require("yt-search");

module.exports = {
    command: ["video2", "vid2"],
    category: "download",
    description: "Download a YouTube video by search term (fast)",

    execute: async (sock, m, { text, reply, config }) => {
        try {
            if (!text) {
                return reply("❌ Example:\n.video2 pasoori");
            }

            // 🔍 Search
            const search = await yts(text);

            if (!search.videos.length) {
                return reply("❌ No video found.");
            }

            const vid = search.videos[0];

            // 🎨 Preview
            const caption =
`╔ஜ۩▒█ ${config.botName} █▒۩ஜ╗
┃🎬 VIDEO FOUND
┃📌 Title: ${vid.title}
┃⏱️ Duration: ${vid.timestamp}
┃⚡ Sending video...
╰━━━━━━━━━━━━━━⊷`;

            await sock.sendMessage(m.chat, {
                image: { url: vid.thumbnail },
                caption
            }, { quoted: m });

            // 🎥 API
            const api = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(vid.url)}`;
            const res = await axios.get(api, { timeout: 60000 });

            if (
                !res.data ||
                !res.data.status ||
                !res.data.result ||
                !res.data.result.download ||
                !res.data.result.download.url
            ) {
                return reply("❌ Video API failed. Please try again later.");
            }

            const videoUrl = res.data.result.download.url;
            const title = res.data.result.metadata?.title || vid.title;

            // 🚀 Send video
            await sock.sendMessage(m.chat, {
                video: { url: videoUrl },
                mimetype: "video/mp4",
                caption: `🎬 *${title}*\n\n> © ${config.watermark}`
            }, { quoted: m });

        } catch (err) {
            console.error("VIDEO2 ERROR:", err);
            reply("❌ Video error. Please try again later.");
        }
    }
};
