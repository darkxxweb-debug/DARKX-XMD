module.exports = {
    command: ["mute"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Mute a member — their messages in this group will be deleted (tag or reply)",
    execute: async (sock, m, { reply, quoted, isBotAdmin }) => {
        const target = m.mentionedJid?.[0] || quoted?.sender;
        if (!target) return reply("Tag or reply to the member you want to mute.");
        if (!isBotAdmin) return reply("Make me an admin first so I can delete their messages.");

        const group = global.db.groups[m.chat];
        if (!group.mutedUsers.includes(target)) group.mutedUsers.push(target);
        reply(`🔇 @${target.split("@")[0]} has been muted in this group.`);
    }
};
