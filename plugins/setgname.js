module.exports = {
    command: ["setgname"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    description: "Change the group's name",
    execute: async (sock, m, { text, reply }) => {
        if (!text) return reply("Write the new name, e.g. .setgname My Awesome Group");
        try {
            await sock.groupUpdateSubject(m.chat, text);
            reply("✅ Group name updated.");
        } catch (e) {
            reply("❌ Failed to update the group name.");
        }
    }
};
