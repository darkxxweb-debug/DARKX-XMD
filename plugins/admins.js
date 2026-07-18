module.exports = {
    command: ["admins", "listadmins"],
    category: "group",
    isGroup: true,
    description: "List all admins in this group",
    execute: async (sock, m, { reply, groupMetadata }) => {
        const admins = groupMetadata.participants.filter((p) => p.admin);
        if (!admins.length) return reply("This group has no admins listed.");

        let text = `👮 *GROUP ADMINS (${admins.length})*\n\n`;
        admins.forEach((a, i) => { text += `${i + 1}. @${a.id.split("@")[0]}\n`; });

        await sock.sendMessage(m.chat, { text, mentions: admins.map((a) => a.id) }, { quoted: m });
    }
};
