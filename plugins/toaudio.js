const { getMediaFromMessage } = require("../library/media");
const { convertBuffer } = require("../library/ffmpeg");

module.exports = {
    command: ["toaudio", "tomp3"],
    category: "sticker",
    description: "Extract the audio from a video/sticker (reply to it)",
    execute: async (sock, m, { reply }) => {
        const media = await getMediaFromMessage(sock, m);
        if (!media || !/video|webp/.test(media.mimetype || "")) {
            return reply("Reply to a video or animated sticker with *.toaudio* to extract its sound.");
        }

        try {
            await sock.sendMessage(m.chat, { react: { text: "🎧", key: m.key } });
            const inExt = /webp/.test(media.mimetype) ? "webp" : "mp4";
            const mp3 = await convertBuffer(media.buffer, inExt, "mp3", ["-vn", "-ar", "44100", "-ac", "2", "-b:a", "128k"]);
            await sock.sendMessage(m.chat, { audio: mp3, mimetype: "audio/mpeg" }, { quoted: m });
        } catch (e) {
            console.error("toaudio error:", e);
            reply("❌ That media doesn't have any audio to extract.");
        }
    }
};
