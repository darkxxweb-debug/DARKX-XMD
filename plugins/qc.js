const Jimp = require("jimp");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");
const { getMediaFromMessage } = require("../library/media");

module.exports = {
    command: ["qc", "quote2sticker"],
    category: "sticker",
    description: "Turn a replied text message into a quote-card sticker",
    execute: async (sock, m, { reply, quoted, pushName, config }) => {
        if (!quoted || !quoted.body) return reply("Reply to a text message with *.qc* to turn it into a quote sticker.");

        try {
            await sock.sendMessage(m.chat, { react: { text: "💬", key: m.key } });

            const width = 512, height = 512;
            const card = new Jimp(width, height, "#1a1a2e");
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
            const nameFont = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

            // Wrap and center the quoted text
            const text = quoted.body.length > 180 ? quoted.body.slice(0, 180) + "..." : quoted.body;
            card.print(font, 40, 40, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT }, width - 80, height - 120);

            const name = (quoted.sender || "").split("@")[0] || "Someone";
            card.print(nameFont, 40, height - 60, `— ${name}`);

            const buffer = await card.getBufferAsync(Jimp.MIME_PNG);

            const sticker = new Sticker(buffer, {
                pack: config.botName || "DarkX-Ultra",
                author: config.ownerName || "DarkX-Ultra",
                type: StickerTypes.FULL,
                quality: 90,
            });

            await sock.sendMessage(m.chat, { sticker: await sticker.toBuffer() }, { quoted: m });
        } catch (e) {
            console.error("qc error:", e);
            reply("❌ Failed to create the quote sticker.");
        }
    }
};
