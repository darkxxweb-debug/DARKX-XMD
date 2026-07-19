const axios = require("axios");

module.exports = {
    command: ["apk", "app", "playstore", "application"],
    category: "download",
    description: "Download an APK from the Play Store (via Aptoide). Usage: .apk <name>",

    execute: async (sock, m, { q, reply, config }) => {
        try {
            if (!q) {
                return reply("❌ Please tell me which app to download.\n\nExample:\n.apk WhatsApp");
            }

            const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(q)}/limit=1`;
            const { data } = await axios.get(apiUrl, { timeout: 30000 });

            if (!data || !data.datalist || !data.datalist.list.length) {
                return reply("❌ Couldn't find that app.");
            }

            const app = data.datalist.list[0];
            const appSize = (app.size / 1048576).toFixed(2);

            const caption =
`*╭━━━〔 👑 APK INFO 👑 〕━━━┈⊷*
*┃ 👑 NAME:* ${app.name.toUpperCase()}
*┃ 👑 SIZE:* ${appSize} MB
*┃ 👑 PACKAGE:* ${app.package}
*┃ 👑 VERSION:* ${app.file.vername}
*╰━━━━━━━━━━━━━━━┈⊷*

*👑 BY:* ${config.watermark}`;

            await sock.sendMessage(m.chat, { image: { url: app.icon }, caption }, { quoted: m });

            await sock.sendMessage(m.chat, {
                document: { url: app.file.path || app.file.path_alt },
                mimetype: "application/vnd.android.package-archive",
                fileName: `${app.name}.apk`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: "😍", key: m.key } });

        } catch (err) {
            console.error("APK ERROR:", err);
            reply("❌ Failed to fetch that APK. Please try again.");
        }
    }
};
