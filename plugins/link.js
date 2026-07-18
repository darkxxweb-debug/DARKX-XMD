module.exports = {
    command: ["link", "grouplink"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Get the group's invite link",
    execute: async (sock, m, { reply }) => {
        try {
            const code = await sock.groupInviteCode(m.chat);
            reply(`🔗 *Group Invite Link:*\nhttps://chat.whatsapp.com/${code}`);
        } catch (e) {
            reply("❌ Failed to get the invite link. Make sure I'm an admin.");
        }
    }
};
