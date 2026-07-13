module.exports = {
    command: ['kick', 'toa'],
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    execute: async (sock, m, { reply }) => {
        let users = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null;
        if (!users) return reply("Tag au quote mtu unayetaka nimtoe!");
        
        await sock.groupParticipantsUpdate(m.chat, [users], "remove");
        reply("✅ Target ametolewa!");
    }
};
