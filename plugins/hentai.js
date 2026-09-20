const axios = require('axios');

module.exports = {
    command: 'hentai',
    description: 'NSFW hentai / waifu uchi with categories (blowjob, ass, boobs, etc)',
    category: 'nsfw',
    execute: async (sock, m, { text, prefix, reply }) => {
        try {
            await sock.sendMessage(m.chat, { react: { text: "🍑", key: m.key } });

            let category = text ? text.trim().toLowerCase() : 'waifu';

            // The Fluxpoint API has many NSFW anime categories
            const validCats = ['ass', 'boobs', 'blowjob', 'pussy', 'cum', 'thighs', 'lewd', 'solo', 'tentacle'];
            if (!validCats.includes(category) && category !== 'waifu') {
                category = 'lewd'; // default
            }

            let imageUrl = '';
            try {
                const res = await axios.get(`https://api.fluxpoint.dev/nsfw/img/${category}`);
                imageUrl = res.data.url || res.data.image;
            } catch (e) {
                // Fallback
                const res2 = await axios.get(`https://api.waifu.pics/nsfw/${category === 'waifu' ? 'waifu' : 'neko'}`);
                imageUrl = res2.data.url;
            }

            if (!imageUrl) return reply("❌ That category does not exist or the request failed. Try: blowjob, ass, boobs, thighs, lewd");

            await sock.sendMessage(m.chat, {
                image: { url: imageUrl },
                caption: `🔥 ${category.toUpperCase()} Waifu Uchi\nNSFW Hentai Mode\n🍑`
            }, { quoted: m });

        } catch (error) {
            await reply("❌ Error fetching hentai image.");
        }
    }
};
