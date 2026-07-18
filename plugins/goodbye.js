module.exports = {
    command: ["goodbye"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Toggle goodbye messages, or set a custom one (use @user as placeholder)",
    execute: async (sock, m, { args, text, reply }) => {
        const group = global.db.groups[m.chat];
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") { group.goodbye = true; return reply("✅ Goodbye messages are ON."); }
        if (choice === "off") { group.goodbye = false; return reply("📴 Goodbye messages are OFF."); }
        if (choice === "set") {
            const msg = text.slice(4).trim();
            if (!msg) return reply("Write a message, e.g. .goodbye set Bye @user, we'll miss you!");
            group.setGoodbye = msg;
            return reply("✅ Custom goodbye message saved.");
        }

        reply(
            `👋 Goodbye messages are currently: *${group.goodbye ? "ON" : "OFF"}*\n\n` +
            `Use:\n.goodbye on\n.goodbye off\n.goodbye set <message with @user>`
        );
    }
};
