module.exports = {
    command: ["hidetag"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Send a message that silently mentions every group member",
    execute: async (sock, m, { text, reply, groupMetadata }) => {
        if (!text) return reply("Write a message after the command, e.g. .hidetag Meeting at 8pm");

        const mentions = groupMetadata.participants.map((p) => p.id);
        await sock.sendMessage(m.chat, { text, mentions }, { quoted: m });
    }
};
