const yts = require('yt-search');

module.exports = {
    command: ["yts", "ytsearch"],
    category: "downloader",
    description: "Search YouTube videos",
    execute: async (sock, m, { args, reply, prefix }) => {
        const from = m.chat;
        const query = args.join(' ');

        if (!query) {
            return reply(`Example: *${prefix}yts* Lil Peep`);
        }

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: m.key } });

            const result = await yts(query);
            const videos = result.videos.slice(0, 10);

            if (videos.length === 0) {
                return reply('❌ No results found.');
            }

            let searchText = `✨ *DARKX ULTIMATE YT SEARCH* ✨\n\n`;
            videos.forEach((v, index) => {
                searchText += `*${index + 1}. 🎧 ${v.title}*\n`;
                searchText += `*⌚ Duration:* ${v.timestamp}\n`;
                searchText += `*👀 Views:* ${v.views.toLocaleString()}\n`;
                searchText += `*🔗 URL:* ${v.url}\n`;
                searchText += `──────────────────\n`;
            });

            await sock.sendMessage(from, {
                image: { url: videos[0].image },
                caption: searchText
            }, { quoted: m });

        } catch (error) {
            console.error('YouTube Search Error:', error);
            await reply('❌ An error occurred while searching YouTube.');
        }
    }
};
