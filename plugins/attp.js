const Jimp = require("jimp");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");

module.exports = {
    command: ["attp"],
    category: "sticker",
    description: "Turn short text into a sticker. Usage: .attp Your text here",
    execute: async (sock, m, { text, reply, config }) => {
        if (!text) return reply("Write some text, e.g. .attp Hello World");
        if (text.length > 30) return reply("Please keep the text under 30 characters.");

        try {
            await sock.sendMessage(m.chat, { react: { text: "✍️", key: m.key } });

            const size = 512;
            const image = new Jimp(size, size, 0x00000000); // transparent background
            const font = await Jimp.loadFont(
                text.length > 14 ? Jimp.FONT_SANS_32_WHITE : Jimp.FONT_SANS_64_WHITE
            );

            const textWidth = Jimp.measureText(font, text);
            const textHeight = Jimp.measureTextHeight(font, text, size);
            image.print(
                font,
                (size - textWidth) / 2,
                (size - textHeight) / 2,
                { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
                size
            );

            const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

            const sticker = new Sticker(buffer, {
                pack: config.botName || "DarkX-Ultra",
                author: config.ownerName || "DarkX-Ultra",
                type: StickerTypes.FULL,
                quality: 90,
            });

            await sock.sendMessage(m.chat, { sticker: await sticker.toBuffer() }, { quoted: m });
        } catch (e) {
            console.error("attp error:", e);
            reply("❌ Failed to create the text sticker.");
        }
    }
};
