const { getMediaFromMessage } = require("../library/media");

module.exports = {
    command: ["groupstatus", "gstatus", "poststatus", "statuspost"],
    category: "group",
    isOwner: true,
    description: "Post text or media (reply to it) as your own WhatsApp Status",
    execute: async (sock, m, { text, reply, quoted, pushName, config }) => {
        try {
            const caption = text || "";

            // --- TEXT STATUS ---
            if (!quoted && caption) {
                await sock.sendMessage("status@broadcast", {
                    text:
`╭━━〔 ${config.botName} 〕━━⬣
┃ 👤 User: ${pushName || "Unknown"}
┃ ⏰ Time: ${new Date().toLocaleString()}
┃
┃ 💬 Message:
┃ ${caption}
╰━━━━━━━━━━━━━━━━⬣`
                });
                return reply("✅ Text status posted successfully.");
            }

            if (!quoted) {
                return reply(
                    "❌ Reply to an image, video, audio, or sticker.\n\nExample:\n.groupstatus Hello World"
                );
            }

            const media = await getMediaFromMessage(sock, m);
            if (!media) return reply("❌ Couldn't download that media. Please try again.");

            const footer =
`👤 Posted By: ${pushName || "Unknown"}
🕒 ${new Date().toLocaleString()}

${caption || "No Caption"}`;

            // --- IMAGE ---
            if (quoted.mtype === "imageMessage") {
                await sock.sendMessage("status@broadcast", {
                    image: media.buffer,
                    caption: `📸 ${config.botName}\n\n${footer}`,
                });
                return reply("✅ Image status posted.");
            }

            // --- VIDEO ---
            if (quoted.mtype === "videoMessage") {
                await sock.sendMessage("status@broadcast", {
                    video: media.buffer,
                    caption: `🎥 ${config.botName}\n\n${footer}`,
                });
                return reply("✅ Video status posted.");
            }

            // --- AUDIO ---
            if (quoted.mtype === "audioMessage") {
                await sock.sendMessage("status@broadcast", {
                    audio: media.buffer,
                    mimetype: "audio/mp4",
                    ptt: false,
                });
                return reply("✅ Audio status posted.");
            }

            // --- STICKER ---
            if (quoted.mtype === "stickerMessage") {
                await sock.sendMessage("status@broadcast", { sticker: media.buffer });
                return reply("✅ Sticker status posted.");
            }

            return reply("❌ Unsupported media type.");
        } catch (err) {
            console.error("GROUPSTATUS ERROR:", err);
            return reply(`❌ ${config.botName} STATUS ERROR\n\n${err.message}`);
        }
    }
};
