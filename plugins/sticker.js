module.exports = {
    command: ["s", "sticker"],
    execute: async (sock, m, args) => {
        if (!m.msg.mimetype) return sock.sendMessage(m.chat, { text: "Reply picha au video ukitumia amri ya .s" });
        
        try {
            await sock.sendMessage(m.chat, { react: { text: "🎨", key: m.key } });
            let media = await sock.downloadMediaMessage(m);
            
            if (/image/.test(m.msg.mimetype)) {
                await sock.sendImageAsSticker(m.chat, media, m, { packname: "DarkX-minBot", author: "MrX Dev" });
            } else if (/video/.test(m.msg.mimetype)) {
                await sock.sendVideoAsSticker(m.chat, media, m, { packname: "DarkX-minBot", author: "MrX Dev" });
            }
        } catch (e) {
            console.error(e);
            await sock.sendMessage(m.chat, { text: "❌ Imefeli kutengeneza sticker." });
        }
    }
};
