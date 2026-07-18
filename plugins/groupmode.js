module.exports = {
    command: ["group"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    description: "Lock or unlock the group (only admins can send messages when locked)",
    execute: async (sock, m, { args, reply }) => {
        const choice = (args[0] || "").toLowerCase();
        const group = global.db.groups[m.chat];

        if (choice === "close" || choice === "lock") {
            await sock.groupSettingUpdate(m.chat, "announcement");
            group.mute = true;
            return reply("🔒 Group closed. Only admins can send messages now.");
        }
        if (choice === "open" || choice === "unlock") {
            await sock.groupSettingUpdate(m.chat, "not_announcement");
            group.mute = false;
            return reply("🔓 Group opened. Everyone can send messages now.");
        }
        reply(`Use:\n.group open — anyone can chat\n.group close — only admins can chat\n\nCurrently: *${group.mute ? "CLOSED" : "OPEN"}*`);
    }
};
