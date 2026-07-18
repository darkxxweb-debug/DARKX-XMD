module.exports = {
    command: ["welcome"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Toggle welcome messages, or set a custom one (use @user as placeholder)",
    execute: async (sock, m, { args, text, reply }) => {
        const group = global.db.groups[m.chat];
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") { group.welcome = true; return reply("✅ Welcome messages are ON."); }
        if (choice === "off") { group.welcome = false; return reply("📴 Welcome messages are OFF."); }
        if (choice === "set") {
            const msg = text.slice(4).trim();
            if (!msg) return reply("Write a message, e.g. .welcome set Welcome @user to our group!");
            group.setWelcome = msg;
            return reply("✅ Custom welcome message saved.");
        }

        reply(
            `👋 Welcome messages are currently: *${group.welcome ? "ON" : "OFF"}*\n\n` +
            `Use:\n.welcome on\n.welcome off\n.welcome set <message with @user>`
        );
    }
};
