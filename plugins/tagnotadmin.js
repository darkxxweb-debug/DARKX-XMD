module.exports = {
    command: ["tagnotadmin"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "Tag only the members who are NOT admins",
    execute: async (sock, m, { reply, groupMetadata, text }) => {
        const nonAdmins = groupMetadata.participants.filter((p) => !p.admin);
        if (!nonAdmins.length) return reply("Everyone in this group is an admin.");

        const message = text?.trim() ? text : "Attention everyone:";
        let out = `${message}\n\n`;
        nonAdmins.forEach((p) => { out += `@${p.id.split("@")[0]}\n`; });

        await sock.sendMessage(m.chat, { text: out, mentions: nonAdmins.map((p) => p.id) }, { quoted: m });
    }
};
