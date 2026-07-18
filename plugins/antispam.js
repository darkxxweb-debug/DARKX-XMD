const recentBySender = new Map(); // `${chat}_${sender}` -> [timestamps]

module.exports = {
    command: ["antispam"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Toggle removal of members sending too many messages too fast",
    execute: async (sock, m, { args, reply }) => {
        const group = global.db.groups[m.chat];
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") { group.antispam = true; return reply("✅ Anti-Spam protection is ON."); }
        if (choice === "off") { group.antispam = false; return reply("📴 Anti-Spam protection is OFF."); }
        reply(`Anti-Spam is currently: *${group.antispam ? "ON" : "OFF"}*\n\nUse:\n.antispam on\n.antispam off`);
    },
    // Exposed so message.js's optional spam-check hook (if wired in) can reuse it.
    _recentBySender: recentBySender,
};
