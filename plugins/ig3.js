const axios = require("axios");

module.exports = {
    command: ["ig3", "insta3", "instagram3"],
    category: "download",
    description: "Download Instagram video (alternative API 3). Usage: .ig3 <Instagram video URL>",

    execute: async (sock, m, { q, reply, config }) => {
        try {
            if (!q) return reply("❌ Please provide an Instagram video link.");
            if (!q.includes("instagram.com")) return reply("❌ That doesn't look like a valid Instagram link.");

            reply("⏳ Downloading video, please wait...");

            const apiUrl = `https://rest-lily.vercel.app/api/downloader/igdl?url=${encodeURIComponent(q)}`;
            const { data } = await axios.get(apiUrl, { timeout: 30000 });

            if (!data.status || !data.data || !data.data[0]) {
                return reply("❌ Failed to fetch that Instagram video.");
            }

            const { url } = data.data[0];

            const caption =
`*_ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ_*

╔ஜ۩▒█ *${config.botName}* █▒۩ஜ╗
*|* 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 *${config.watermark}*
╰━━━━━━━━━━━━━━━━━━⊷`;

            await sock.sendMessage(m.chat, {
                video: { url },
                caption,
                contextInfo: { mentionedJid: [m.sender] }
            }, { quoted: m });

        } catch (e) {
            console.error("IG3 Error:", e);
            reply(`❌ An error occurred: ${e.message}`);
        }
    }
};
