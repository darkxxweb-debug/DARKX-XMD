module.exports = {
    command: ["leave", "leavegroup"],
    category: "group",
    isGroup: true,
    isOwner: true,
    description: "Make the bot leave this group",
    execute: async (sock, m, { reply }) => {
        await reply("👋 Goodbye! Leaving this group now...");
        await sock.groupLeave(m.chat);
    }
};
