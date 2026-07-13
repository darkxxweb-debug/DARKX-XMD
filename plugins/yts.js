const yts = require('yt-search');
const config = require("../settings/config");

module.exports = {
    command: ["yts", "ytsearch"], // Amri zitakazotumika
    execute: async (sock, m, args) => {
        const from = m.chat;
        const query = args.join(' ');
        const prefix = config.prefix;

        if (!query) {
            return sock.sendMessage(from, {
                text: `Mfano: *${prefix}yts* Lil Peep`
            }, { quoted: m });
        }

        try {
            // Reaction ya kutafuta
            await sock.sendMessage(from, { react: { text: '🔍', key: m.key } });

            const result = await yts(query);
            const videos = result.videos.slice(0, 10); // Tunachukua video 10 za kwanza

            if (videos.length === 0) {
                return sock.sendMessage(from, { text: '❌ Sikupata matokeo yoyote.' });
            }

            let searchText = `✨ *DARKX YT SEARCH* ✨\n\n`;
            videos.forEach((v, index) => {
                searchText += `*${index + 1}.🎧 ${v.title}*\n`;
                searchText += `*⌚ Muda:* ${v.timestamp}\n`;
                searchText += `*👀 Views:* ${v.views.toLocaleString()}\n`;
                searchText += `*🔗 URL:* ${v.url}\n`;
                searchText += `──────────────────\n`;
            });

            // Inatuma picha ya video ya kwanza ikiwa na orodha ya video zote
            await sock.sendMessage(from, {
                image: { url: videos[0].image },
                caption: searchText
            }, { quoted: m });

        } catch (error) {
            console.error('YouTube Search Error:', error);
            await sock.sendMessage(from, { text: '❌ Hitilafu imetokea wakati wa kutafuta YouTube.' });
        }
    }
};
