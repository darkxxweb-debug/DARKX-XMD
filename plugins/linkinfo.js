module.exports = {
    command: ["linkinfo"],
    category: "group",
    description: "Show info about a WhatsApp group invite link",
    execute: async (sock, m, { text, reply }) => {
        if (!text) return reply("Send a group invite link after the command, e.g.\n.linkinfo https://chat.whatsapp.com/xxxxx");

        const match = text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
        if (!match) return reply("That doesn't look like a valid WhatsApp group link.");

        try {
            const info = await sock.groupGetInviteInfo(match[1]);
            reply(
                `📋 *GROUP LINK INFO*\n\n` +
                `📛 *Name:* ${info.subject}\n` +
                `👥 *Members:* ${info.size}\n` +
                `📝 *Description:* ${info.desc || "None"}`
            );
        } catch (e) {
            reply("❌ Couldn't fetch info for that link. It may be invalid or expired.");
        }
    }
};
