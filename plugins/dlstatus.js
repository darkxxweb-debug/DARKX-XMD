module.exports = {
    command: ["dlstatus", "swdl", "statusdl"],
    category: "download",
    isOwner: true,
    description: "Download a quoted Status update",
    execute: async (sock, m, { reply }) => {
        const { downloadContentFromMessage } = await import("@whiskeysockets/baileys");

        const contextInfo = m.msg?.contextInfo;
        if (!contextInfo || contextInfo.remoteJid !== "status@broadcast" || !m.quoted) {
            return reply("Please reply/quote a Status update to download it.");
        }

        try {
            const quotedType = m.quoted.mtype;
            const mediaData = m.quoted.msg;

            if (quotedType === "conversation" || quotedType === "extendedTextMessage") {
                return sock.sendMessage(
                    m.chat,
                    { text: `📝 *Status Text:*\n\n${m.quoted.body}` },
                    { quoted: m }
                );
            }

            if (quotedType !== "imageMessage" && quotedType !== "videoMessage") {
                return reply("❌ This status type isn't supported for download.");
            }

            const stream = await downloadContentFromMessage(mediaData, quotedType.replace("Message", ""));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (quotedType === "imageMessage") {
                await sock.sendMessage(m.chat, { image: buffer, caption: mediaData.caption || "" }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { video: buffer, caption: mediaData.caption || "" }, { quoted: m });
            }
        } catch (err) {
            console.error("[DLSTATUS] Error:", err.message);
            reply("❌ Failed to download status media.");
        }
    },
};
