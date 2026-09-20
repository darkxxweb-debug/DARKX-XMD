module.exports = {
    command: ["groupinfo", "gcinfo"],
    execute: async (sock, m, args) => {
        if (!m.isGroup) return sock.sendMessage(m.chat, { text: "This command only works in groups!" });
        
        try {
            const groupMetadata = await sock.groupMetadata(m.chat);
            const participants = groupMetadata.participants;
            const admins = participants.filter(p => !!p.admin).length;
            
            let info = `乂  *G R O U P  I N F O* 乂\n\n`;
            info += `📌 *Name:* ${groupMetadata.subject}\n`;
            info += `🆔 *ID:* ${groupMetadata.id}\n`;
            info += `👥 *Wanachama:* ${participants.length}\n`;
            info += `👮 *Admins:* ${admins}\n`;
            info += `📅 *Iliundwa:* ${new Date(groupMetadata.creation * 1000).toLocaleString()}\n`;
            info += `📝 *Description:* \n${groupMetadata.desc || 'No description.'}`;

            await sock.sendMessage(m.chat, { text: info }, { quoted: m });
        } catch (e) {
            console.error(e);
        }
    }
};
