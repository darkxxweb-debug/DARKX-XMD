module.exports = {
    command: ["setwarnlimit"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Set how many warnings a member can get before action is taken",
    execute: async (sock, m, { args, reply }) => {
        const group = global.db.groups[m.chat];
        const n = parseInt(args[0], 10);

        if (!n || n < 1) return reply(`Current warn limit: *${group.warnLimit ?? 3}*\n\nUsage: .setwarnlimit 5`);
        group.warnLimit = n;
        reply(`✅ Warn limit set to *${n}*.`);
    }
};
