const { getMediaFromMessage } = require("../library/media");
const { convertBuffer } = require("../library/ffmpeg");

module.exports = {
    command: ["tovid", "tovideo", "togif"],
    category: "sticker",
    description: "Convert an animated sticker into a video/gif (reply to the sticker)",
    execute: async (sock, m, { reply, command }) => {
        const media = await getMediaFromMessage(sock, m);
        if (!media || !/webp/.test(media.mimetype || "")) {
            return reply("Reply to an *animated* sticker with *.tovid* to convert it.");
        }

        try {
            await sock.sendMessage(m.chat, { react: { text: "🎞️", key: m.key } });
            const mp4 = await convertBuffer(media.buffer, "webp", "mp4", ["-pix_fmt", "yuv420p", "-movflags", "+faststart"]);
            await sock.sendMessage(m.chat, { video: mp4, caption: "✅ Converted by DarkX-Ultra", gifPlayback: command === "togif" }, { quoted: m });
        } catch (e) {
            console.error("tovideo error:", e);
            reply("❌ Failed to convert. Make sure it's an animated sticker.");
        }
    }
};
