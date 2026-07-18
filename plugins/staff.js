module.exports = {
    command: ["staff", "tagadmins"],
    category: "group",
    isGroup: true,
    description: "Tag only the group admins",
    execute: async (sock, m, { reply, groupMetadata, text }) => {
        const admins = groupMetadata.participants.filter((p) => p.admin);
        if (!admins.length) return reply("This group has no admins listed.");

        const message = text?.trim() ? text : "Attention admins:";
        let out = `${message}\n\n`;
        admins.forEach((a) => { out += `@${a.id.split("@")[0]}\n`; });

        await sock.sendMessage(m.chat, { text: out, mentions: admins.map((a) => a.id) }, { quoted: m });
    }
};
