const axios = require("axios");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");

module.exports = {
    command: ["emojimix"],
    category: "sticker",
    description: "Mix two emojis into one sticker. Usage: .emojimix 😀+😭",
    execute: async (sock, m, { text, reply, config }) => {
        const parts = (text || "").split("+").map((e) => e.trim()).filter(Boolean);
        if (parts.length !== 2) return reply("Usage: .emojimix 😀+😭");

        try {
            await sock.sendMessage(m.chat, { react: { text: "🧪", key: m.key } });
            const url = `https://emojik.vercel.app/s/${encodeURIComponent(parts[0])}_${encodeURIComponent(parts[1])}?size=256`;
            const res = await axios.get(url, { responseType: "arraybuffer" });

            const sticker = new Sticker(Buffer.from(res.data), {
                pack: config.botName || "DarkX-Ultra",
                author: config.ownerName || "DarkX-Ultra",
                type: StickerTypes.FULL,
                quality: 90,
            });

            await sock.sendMessage(m.chat, { sticker: await sticker.toBuffer() }, { quoted: m });
        } catch (e) {
            reply("❌ Couldn't mix those two emojis. Try a different pair.");
        }
    }
};
