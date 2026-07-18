module.exports = {
    command: ["warnings", "checkwarn"],
    category: "group",
    isGroup: true,
    description: "Check how many warnings a member has (tag or reply to them, or check yourself)",
    execute: async (sock, m, { reply, quoted, sender }) => {
        const target = m.mentionedJid?.[0] || quoted?.sender || sender;
        const user = global.db.users[target];
        const warnCount = user?.warn || 0;
        const limit = global.db.groups[m.chat]?.warnLimit ?? 3;

        reply(`⚠️ @${target.split("@")[0]} has *${warnCount}/${limit}* warnings.`);
    }
};
