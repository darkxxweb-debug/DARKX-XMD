const { resolveIdentities } = require("../library/groupGuard");

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
        if (!Array.isArray(group.mutedUsers)) group.mutedUsers = [];

        // Store every JID form WhatsApp knows for this person (phone-based
        // AND @lid), so the mute still applies later even if their messages
        // arrive under the other JID type than the one used here.
        const identities = await resolveIdentities(sock, target);
        for (const id of identities) {
            if (!group.mutedUsers.includes(id)) group.mutedUsers.push(id);
        }

        reply(`🔇 @${target.split("@")[0]} has been muted in this group.`);
    }
};
