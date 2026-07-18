module.exports = {
    command: ["members", "memberlist"],
    category: "group",
    isGroup: true,
    description: "List all members in this group",
    execute: async (sock, m, { reply, groupMetadata }) => {
        const members = groupMetadata.participants;
        let text = `👥 *GROUP MEMBERS (${members.length})*\n\n`;
        members.forEach((p, i) => { text += `${i + 1}. @${p.id.split("@")[0]}${p.admin ? " 👮" : ""}\n`; });

        await sock.sendMessage(m.chat, { text, mentions: members.map((p) => p.id) }, { quoted: m });
    }
};
