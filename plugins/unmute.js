const { resolveIdentities } = require("../library/groupGuard");

module.exports = {
    command: ["unmute"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Unmute a previously muted member (tag or reply)",
    execute: async (sock, m, { reply, quoted }) => {
        const target = m.mentionedJid?.[0] || quoted?.sender;
        if (!target) return reply("Tag or reply to the member you want to unmute.");

        const group = global.db.groups[m.chat];
        if (!Array.isArray(group.mutedUsers)) group.mutedUsers = [];

        const identities = await resolveIdentities(sock, target);
        group.mutedUsers = group.mutedUsers.filter((jid) => !identities.includes(jid));

        reply(`🔊 @${target.split("@")[0]} has been unmuted.`);
    }
};
