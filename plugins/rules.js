module.exports = {
    command: ["rules"],
    category: "group",
    isGroup: true,
    description: "View or set the group rules (admins can set)",
    execute: async (sock, m, { args, text, reply, isAdmin }) => {
        const group = global.db.groups[m.chat];

        if (args[0] === "set") {
            if (!isAdmin) return reply("Only an admin can set the rules.");
            const newRules = text.slice(4).trim();
            if (!newRules) return reply("Write the rules after 'set', e.g. .rules set No spamming!");
            group.rules = newRules;
            return reply("✅ Group rules updated.");
        }

        if (!group.rules) return reply("No rules have been set for this group yet.\nAn admin can set them with: .rules set <text>");
        reply(`📜 *GROUP RULES*\n\n${group.rules}`);
    }
};
