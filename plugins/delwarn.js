module.exports = {
    command: ["delwarn", "resetwarn"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Reset a member's warning count (tag or reply to them)",
    execute: async (sock, m, { reply, quoted }) => {
        const target = m.mentionedJid?.[0] || quoted?.sender;
        if (!target) return reply("Tag or reply to the member whose warnings you want to reset.");

        if (!global.db.users[target]) global.db.users[target] = {};
        global.db.users[target].warn = 0;
        reply(`✅ Warnings for @${target.split("@")[0]} have been reset.`);
    }
};
