const axios = require('axios');
const yts = require('yt-search');
const config = require("../settings/config");

module.exports = {
    command: ["video", "playvid"],
    execute: async (sock, m, args) => {
        const from = m.chat;
        const text = args.join(' ');

        try {
            if (!text) {
                return await sock.sendMessage(from, { 
                    text: `❌ Tafadhali weka jina la video au link!\nMfano: *${config.prefix}video* funny cats` 
                }, { quoted: m });
            }

            // Reaction ya kuanza
            await sock.sendMessage(from, { react: { text: "⏳", key: m.key } });

            let videoUrl = '';
            let videoTitle = '';
            let videoThumbnail = '';

            // Angalia kama ni URL au Jina
            if (text.startsWith('http://') || text.startsWith('https://')) {
                videoUrl = text;
            } else {
                const { videos } = await yts(text);
                if (!videos || videos.length === 0) {
                    await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
                    return await sock.sendMessage(from, { text: "⚠️ Video haijapatikana!" });
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
            }

            // Downloading reaction
            await sock.sendMessage(from, { react: { text: "⬇️", key: m.key } });

            // API ya Hector Manuel
            const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
            const response = await axios.get(apiUrl);

            if (response.status !== 200 || !response.data.status) {
                await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
                return await sock.sendMessage(from, { text: "🚫 API imeshindwa kupata video. Jaribu tena baadae." });
            }

            const data = response.data;
            const title = data.title || videoTitle || 'YouTube Video';
            const thumbnail = data.thumbnail || videoThumbnail;
            const videoDownloadUrl = data.videos["360"]; // Tunachukua quality ya 360p

            // Tuma video
            await sock.sendMessage(from, {
                video: { url: videoDownloadUrl },
                mimetype: 'video/mp4',
                caption: `🎬 *${title}*\n\n✅ Download imekamilika!\n🎥 Quality: 360p\n\n> 👑 *${config.botName}* Downloader`
            }, { quoted: m });

            // Success reaction
            await sock.sendMessage(from, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error('Error in video command:', error);
            await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
            await sock.sendMessage(from, { text: "❌ Imefeli kudownload video." });
        }
    }
};
