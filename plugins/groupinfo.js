module.exports = {
    command: ["groupinfo", "gcinfo"],
    execute: async (sock, m, args) => {
        if (!m.isGroup) return sock.sendMessage(m.chat, { text: "Amri hii inafanya kazi kwenye magroup pekee!" });
        
        try {
            const groupMetadata = await sock.groupMetadata(m.chat);
            const participants = groupMetadata.participants;
            const admins = participants.filter(p => p.admin !== null).length;
            
            let info = `乂  *G R O U P  I N F O* 乂\n\n`;
            info += `📌 *Jina:* ${groupMetadata.subject}\n`;
            info += `🆔 *ID:* ${groupMetadata.id}\n`;
            info += `👥 *Wanachama:* ${participants.length}\n`;
            info += `👮 *Ma-Admin:* ${admins}\n`;
            info += `📅 *Iliundwa:* ${new Date(groupMetadata.creation * 1000).toLocaleString()}\n`;
            info += `📝 *Maelezo:* \n${groupMetadata.desc || 'Hakuna maelezo.'}`;

            await sock.sendMessage(m.chat, { text: info }, { quoted: m });
        } catch (e) {
            console.error(e);
        }
    }
};
