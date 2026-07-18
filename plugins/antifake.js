module.exports = {
    command: ["antifake"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Toggle auto-removal of numbers joining with a foreign/unexpected country code",
    execute: async (sock, m, { args, reply }) => {
        const group = global.db.groups[m.chat];
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") { group.antifake = true; return reply("✅ Anti-Fake protection is ON."); }
        if (choice === "off") { group.antifake = false; return reply("📴 Anti-Fake protection is OFF."); }
        reply(`Anti-Fake is currently: *${group.antifake ? "ON" : "OFF"}*\n\nUse:\n.antifake on\n.antifake off`);
    }
};
