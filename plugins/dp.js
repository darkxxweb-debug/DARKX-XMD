const axios = require("axios");

module.exports = {
    command: ["getpp", "getdp", "pp"],
    category: "tools",
    description: "Pata profile picture ya user (mention, reply, au namba). Usage: .getpp @user",

    execute: async (sock, m, { q, reply, config }) => {
        try {
            // Tambua target
            let targetJid;

            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;

            if (mentioned && mentioned.length > 0) {
                targetJid = mentioned[0];
            } else if (quotedParticipant) {
                targetJid = quotedParticipant;
            } else if (q) {
                targetJid = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
            } else {
                targetJid = m.sender; // default: mwenye kutuma
            }

            const DEFAULT_PIC = "https://telegra.ph/file/default-profile-pic.jpg";

            let ppUrl;
            try {
                ppUrl = await sock.profilePictureUrl(targetJid, "image");
            } catch (e) {
                ppUrl = DEFAULT_PIC; // hana DP au ame-hide
            }

            const caption =
`*╭━━━〔 📸 PROFILE PIC 〕━━━┈⊷*
*┃ 👤 USER:* @${targetJid.split("@")[0]}
*╰━━━━━━━━━━━━━━━┈⊷*

*👑 BY:* ${config.watermark}`;

            await sock.sendMessage(m.chat, {
                image: { url: ppUrl },
                caption,
                mentions: [targetJid]
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: "📸", key: m.key } });

        } catch (err) {
            console.error("GETPP ERROR:", err);
            reply("❌ Imeshindwa kupata profile picture. Jaribu tena.");
        }
    }
};
