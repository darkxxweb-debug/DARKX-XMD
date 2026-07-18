module.exports = {
    command: ["setgdesc"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    description: "Change the group's description",
    execute: async (sock, m, { text, reply }) => {
        if (!text) return reply("Write the new description, e.g. .setgdesc Welcome to our community!");
        try {
            await sock.groupUpdateDescription(m.chat, text);
            reply("✅ Group description updated.");
        } catch (e) {
            reply("❌ Failed to update the description.");
        }
    }
};
