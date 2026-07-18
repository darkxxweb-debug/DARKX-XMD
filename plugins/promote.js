module.exports = {
    command: ["promote"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    description: "Promote a member to group admin (tag or reply to them)",
    execute: async (sock, m, { reply, quoted, sender: _s, args, participants }) => {
        const mentioned = m.mentionedJid?.[0];
        const target = mentioned || quoted?.sender;
        if (!target) return reply("Tag or reply to the member you want to promote.");

        try {
            await sock.groupParticipantsUpdate(m.chat, [target], "promote");
            reply(`✅ @${target.split("@")[0]} is now an admin.`);
        } catch (e) {
            reply("❌ Failed to promote. Make sure I'm an admin and that user is in the group.");
        }
    }
};
