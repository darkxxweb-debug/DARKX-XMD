module.exports = {
    command: ["demote"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    description: "Remove admin rights from a member (tag or reply to them)",
    execute: async (sock, m, { reply, quoted }) => {
        const mentioned = m.mentionedJid?.[0];
        const target = mentioned || quoted?.sender;
        if (!target) return reply("Tag or reply to the admin you want to demote.");

        try {
            await sock.groupParticipantsUpdate(m.chat, [target], "demote");
            reply(`✅ @${target.split("@")[0]} is no longer an admin.`);
        } catch (e) {
            reply("❌ Failed to demote. Make sure I'm an admin.");
        }
    }
};
