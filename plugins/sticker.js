const { Sticker, StickerTypes } = require("wa-sticker-formatter");
const { getMediaFromMessage } = require("../library/media");

module.exports = {
    command: ["s", "sticker"],
    category: "tools",
    description: "Convert an image or short video into a sticker",
    execute: async (sock, m, { reply, config }) => {
        try {
            const media = await getMediaFromMessage(sock, m);
            if (!media) {
                return reply("Send an image/video with *.s* as the caption, or reply to one with *.s*");
            }
            if (!/image|video/.test(media.mimetype || "")) {
                return reply("Only images or short videos can be turned into stickers.");
            }

            await sock.sendMessage(m.chat, { react: { text: "🎨", key: m.key } });

            const sticker = new Sticker(media.buffer, {
                pack: config.botName || "DarkX Ultimate",
                author: config.ownerName || "DarkX Ultimate",
                type: StickerTypes.FULL,
                quality: 70,
            });

            const stickerBuffer = await sticker.toBuffer();
            await sock.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m });
        } catch (e) {
            console.error("Sticker error:", e);
            await reply("❌ Failed to create the sticker.");
        }
    }
};
