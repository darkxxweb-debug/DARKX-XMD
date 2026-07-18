const { getMediaFromMessage } = require("../library/media");

function unwrapViewOnce(message) {
    if (!message) return null;
    const type = Object.keys(message)[0];
    if (type === "viewOnceMessage" || type === "viewOnceMessageV2" || type === "viewOnceMessageV2Extension") {
        return unwrapViewOnce(message[type].message);
    }
    return message;
}

module.exports = {
    command: ["vv", "viewonce"],
    category: "group",
    isOwner: true,
    description: "Resend a view-once photo/video that was sent in this chat (reply to it)",
    execute: async (sock, m, { reply, quoted }) => {
        if (!quoted) return reply("Reply to the view-once message you want to resend.");

        try {
            const inner = unwrapViewOnce(quoted.message);
            if (!inner) return reply("I couldn't read that message.");

            const innerType = Object.keys(inner)[0];
            if (!["imageMessage", "videoMessage"].includes(innerType)) {
                return reply("That's not a view-once photo or video.");
            }

            const media = await getMediaFromMessage(sock, {
                msg: inner[innerType],
                message: { [innerType]: inner[innerType] },
            });

            if (!media) return reply("❌ Couldn't download that media (it may have already expired).");

            const caption = inner[innerType].caption || "";
            if (innerType === "imageMessage") {
                await sock.sendMessage(m.chat, { image: media.buffer, caption }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { video: media.buffer, caption }, { quoted: m });
            }
        } catch (e) {
            console.error("viewonce error:", e);
            reply("❌ Failed to resend that view-once media.");
        }
    }
};
