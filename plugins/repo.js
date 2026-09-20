"use strict";

/**
 * .repo — bot info card.
 *  - No audio, no local media files.
 *  - The picture is the profile picture (DP) of the person who asked.
 *    If the command replies to someone, that person's DP and name are used.
 *  - The link is the real web address of the running deployment.
 *  - The message is forwarded from the bot's channel (config.channelJid).
 */

// Finds the real public URL of this deployment (host env vars first).
function detectWebUrl(config) {
    const env = process.env;
    const clean = (u) => String(u || "").trim().replace(/\/+$/, "");
    const withHttps = (h) => (/^https?:\/\//i.test(h) ? clean(h) : `https://${clean(h)}`);

    if (env.WEB_URL) return withHttps(env.WEB_URL);
    if (env.RENDER_EXTERNAL_URL) return withHttps(env.RENDER_EXTERNAL_URL);
    if (env.RENDER_EXTERNAL_HOSTNAME) return withHttps(env.RENDER_EXTERNAL_HOSTNAME);
    if (env.RAILWAY_PUBLIC_DOMAIN) return withHttps(env.RAILWAY_PUBLIC_DOMAIN);
    if (env.HEROKU_APP_NAME) return `https://${env.HEROKU_APP_NAME}.herokuapp.com`;
    if (env.VERCEL_URL) return withHttps(env.VERCEL_URL);
    if (env.KOYEB_PUBLIC_DOMAIN) return withHttps(env.KOYEB_PUBLIC_DOMAIN);
    return clean(config.repoUrl);
}

module.exports = {
    command: ["repo", "script", "sc"],
    category: "info",

    execute: async (sock, m, { reply, config, pushName }) => {
        try {
            // Who is the card for? The person replied to, otherwise the sender.
            const target = m.quoted?.sender || m.sender;
            const isSelf = target === m.sender;
            const number = String(target).split("@")[0];
            const name = isSelf && pushName ? pushName : `@${number}`;

            // DP of that person (null if they have none or it is hidden)
            const ppUrl = await sock.profilePictureUrl(target, "image").catch(() => null);

            const repoLink = detectWebUrl(config);

            const caption =
`╭━━━〔 👑 *${String(config.botName).toUpperCase()}* 〕━━━⬣
┃ 👋 *Requested for:* ${name}${isSelf && pushName ? ` (@${number})` : ""}
┃ 👑 *Owner:* ${config.ownerName}
┃ 🚀 *Status:* Online
╰━━━━━━━━━━━━━━━━━━⬣

╭━━━〔 ⚔️ *FEATURES* 〕━━━⬣
┃ ⬡ Group management (anti-link, anti status-mention)
┃ ⬡ Anti-delete for text and media
┃ ⬡ Media downloaders
┃ ⬡ Sticker and converter tools
┃ ⬡ Web dashboard and settings
╰━━━━━━━━━━━━━━━━━━⬣

🔗 *Dashboard:*
${repoLink}

> _${config.watermark}_`;

            const contextInfo = {
                mentionedJid: [target],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.channelJid,
                    newsletterName: config.channelName,
                    serverMessageId: 1,
                },
            };

            if (ppUrl) {
                try {
                    return await sock.sendMessage(m.chat, { image: { url: ppUrl }, caption, contextInfo }, { quoted: m });
                } catch (e) {
                    console.error("REPO IMAGE SEND FAILED:", e.message);
                }
            }
            await sock.sendMessage(m.chat, { text: caption, contextInfo }, { quoted: m });
        } catch (err) {
            console.error("Repo Command Error:", err);
            reply("❌ Repo command failed.");
        }
    },
};
