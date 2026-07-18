const { Sticker, StickerTypes } = require("wa-sticker-formatter");
const { getMediaFromMessage } = require("../library/media");

module.exports = {
    command: ["take", "stealsticker"],
    category: "sticker",
    description: "Re-brand an existing sticker with your own pack/author name. Usage: .take PackName | AuthorName (reply to a sticker)",
    execute: async (sock, m, { reply, text, config }) => {
        const media = await getMediaFromMessage(sock, m);
        if (!media || !/webp/.test(media.mimetype || "")) {
            return reply("Reply to a sticker with *.take PackName | AuthorName*");
        }

        const [pack, author] = (text || "").split("|").map((s) => s.trim());

        try {
            const sticker = new Sticker(media.buffer, {
                pack: pack || config.botName || "DarkX-Ultra",
                author: author || config.ownerName || "DarkX-Ultra",
                type: StickerTypes.FULL,
                quality: 70,
            });
            const buffer = await sticker.toBuffer();
            await sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m });
        } catch (e) {
            reply("❌ Failed to re-brand that sticker.");
        }
    }
};
