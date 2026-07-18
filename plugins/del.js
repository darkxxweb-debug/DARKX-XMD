module.exports = {
    command: ["del", "delete"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    description: "Delete a message for everyone (reply to the message you want removed)",
    execute: async (sock, m, { reply, quoted }) => {
        if (!quoted) return reply("Reply to the message you want me to delete.");

        try {
            await sock.sendMessage(m.chat, { delete: quoted.key });
        } catch (e) {
            reply("❌ Couldn't delete that message.");
        }
    }
};
