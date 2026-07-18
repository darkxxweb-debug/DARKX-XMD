module.exports = {
    command: ["revoke", "resetlink"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    description: "Reset the group's invite link (invalidates the old one)",
    execute: async (sock, m, { reply }) => {
        try {
            await sock.groupRevokeInvite(m.chat);
            const code = await sock.groupInviteCode(m.chat);
            reply(`✅ Invite link has been reset.\n\n🔗 New link:\nhttps://chat.whatsapp.com/${code}`);
        } catch (e) {
            reply("❌ Failed to reset the invite link.");
        }
    }
};
