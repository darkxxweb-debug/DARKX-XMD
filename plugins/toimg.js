const sharp = require("sharp");
const { getMediaFromMessage } = require("../library/media");

module.exports = {
    command: ["toimg", "toimage"],
    category: "sticker",
    description: "Convert a (static) sticker back into an image (reply to the sticker)",
    execute: async (sock, m, { reply }) => {
        const media = await getMediaFromMessage(sock, m);
        if (!media || !/webp/.test(media.mimetype || "")) {
            return reply("Reply to a sticker with *.toimg* to convert it into an image.");
        }

        try {
            const png = await sharp(media.buffer).png().toBuffer();
            await sock.sendMessage(m.chat, { image: png, caption: "✅ Converted by DarkX-Ultra" }, { quoted: m });
        } catch (e) {
            reply("❌ Failed to convert. Animated stickers should use *.tovid* instead.");
        }
    }
};
