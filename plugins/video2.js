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
                    text: `❌ Please enter a video name or link!\nExample: *${config.prefix}video* funny cats` 
                }, { quoted: m });
            }

            // Starting reaction
            await sock.sendMessage(from, { react: { text: "⏳", key: m.key } });

            let videoUrl = '';
            let videoTitle = '';
            let videoThumbnail = '';

            // Check whether it is a URL or a name
            if (text.startsWith('http://') || text.startsWith('https://')) {
                videoUrl = text;
            } else {
                const { videos } = await yts(text);
                if (!videos || videos.length === 0) {
                    await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
                    return await sock.sendMessage(from, { text: "⚠️ Video not found!" });
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
            }

            // Downloading reaction
            await sock.sendMessage(from, { react: { text: "⬇️", key: m.key } });

            // Hector Manuel API
            const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
            const response = await axios.get(apiUrl);

            if (response.status !== 200 || !response.data.status) {
                await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
                return await sock.sendMessage(from, { text: "🚫 The API could not get the video. Please try again later." });
            }

            const data = response.data;
            const title = data.title || videoTitle || 'YouTube Video';
            const videoDownloadUrl = data.videos["360"]; // We take the 360p quality

            if (!videoDownloadUrl) {
                await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
                return await sock.sendMessage(from, { text: "⚠️ No download link is available for this quality!" });
            }

            // DOWNLOAD THE VIDEO AS A BUFFER TO AVOID FORMAT PROBLEMS
            const videoResponse = await axios.get(videoDownloadUrl, { responseType: 'arraybuffer' });
            const videoBuffer = Buffer.from(videoResponse.data, 'binary');

            // Send the video as a buffer (more reliable)
            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                fileName: `${title}.mp4`,
                caption: `🎬 *${title}*\n\n✅ Download imekamilika!\n🎥 Quality: 360p\n\n> 👑 *${config.botName}* Downloader`
            }, { quoted: m });

            // Success reaction
            await sock.sendMessage(from, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error('Error in video command:', error);
            await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
            await sock.sendMessage(from, { text: "❌ Failed to download or send the video." });
        }
    }
};
