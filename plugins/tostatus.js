const { getMediaFromMessage } = require("../library/media");

module.exports = {
    command: ["tostatus", "tosw"],
    category: "sticker",
    isOwner: true,
    description: "Post an image/video/sticker (or replied text) as your own WhatsApp status",
    execute: async (sock, m, { reply, text, quoted, config }) => {
        try {
            const media = await getMediaFromMessage(sock, m);

            if (media) {
                const isVideo = /video/.test(media.mimetype);
                await sock.sendMessage("status@broadcast", {
                    [isVideo ? "video" : "image"]: media.buffer,
                    caption: text || `Posted via ${config.watermark}`,
                });
                return reply("✅ Posted to your WhatsApp status.");
            }

            const statusText = text || quoted?.body;
            if (!statusText) return reply("Send/reply to an image, video, or text with *.tostatus* to post it as your status.");

            await sock.sendMessage("status@broadcast", {
                text: statusText,
                backgroundColor: "#7b2ff7",
                font: 1,
            });
            reply("✅ Posted to your WhatsApp status.");
        } catch (e) {
            console.error("tostatus error:", e);
            reply("❌ Failed to post to status.");
        }
    }
};
