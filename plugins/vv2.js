"use strict";

/**
 * .vv2
 *
 * Reply to a view-once photo/video with this command and the bot will
 * unwrap it and forward a copy straight to the owner's WhatsApp DM
 * (config.ownerNumber, falling back to sock.sessionId's own number).
 *
 * Difference from .vv / .viewonce: those resend the media back into the
 * SAME chat. .vv2 sends it privately to the owner's inbox instead.
 */

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
    command: ["vv2"],
    category: "owner",
    isOwner: true,
    description: "Reply to a view-once photo/video to have the bot forward it to the owner's DM.",
    execute: async (sock, m, { reply, quoted, config }) => {
        if (!quoted) {
            return reply("Reply to the view-once message you want forwarded with *.vv2*.");
        }

        try {
            const ownerNumber = (config?.ownerNumber || sock.sessionId || "").replace(/[^0-9]/g, "");
            if (!ownerNumber) {
                return reply("❌ No owner number is set for this session yet, so I don't know where to send it.");
            }
            const ownerJid = `${ownerNumber}@s.whatsapp.net`;

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

            const originalCaption = inner[innerType].caption || "";
            const caption =
                `📥 *View-Once Forwarded*\n` +
                `👤 From: @${(quoted.sender || m.sender).split("@")[0]}\n` +
                `🕐 ${new Date().toLocaleString()}` +
                (originalCaption ? `\n\n${originalCaption}` : "");

            await sock.sendMessage(ownerJid, {
                [innerType === "imageMessage" ? "image" : "video"]: media.buffer,
                caption,
                mentions: [quoted.sender || m.sender],
            });

            if (ownerJid !== m.chat) {
                await reply("✅ Sent to your DM.");
            } else {
                await reply("✅ Sent above.");
            }
        } catch (e) {
            console.error("vv2 error:", e);
            reply("❌ Failed to forward that view-once media — it may have already expired.");
        }
    }
};
