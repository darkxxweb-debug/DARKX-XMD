module.exports = {
    command: ["antibot"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Toggle removal of globally-banned numbers that try to (re)join this group",
    execute: async (sock, m, { args, reply }) => {
        const group = global.db.groups[m.chat];
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") { group.antibot = true; return reply("✅ Anti-Bot protection is ON."); }
        if (choice === "off") { group.antibot = false; return reply("📴 Anti-Bot protection is OFF."); }
        reply(`Anti-Bot is currently: *${group.antibot ? "ON" : "OFF"}*\n\nUse:\n.antibot on\n.antibot off`);
    }
};
