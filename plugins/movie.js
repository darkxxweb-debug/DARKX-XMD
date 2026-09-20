const axios = require('axios');

module.exports = {
    command: ['movie', 'film', 'imdb'],
    category: 'info',
    description: 'Search movie info, cast and rating',
    execute: async (sock, m, { args, reply, text }) => {
        const OMDB_KEY = 'trilogy'; // Free OMDB key
        const input = text.trim();

        if (!input) {
            return reply(`🎬 *Movie Info*\n\n*Usage:* .movie <movie name>\n*Example:* .movie Avengers`);
        }

        await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

        try {
            // Split the year if present (example: Jawan 2023)
            const yearMatch = input.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? yearMatch[0] : '';
            const title = input.replace(/\b(19|20)\d{2}\b/, '').trim();

            let url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}&plot=full`;
            if (year) url += `&y=${year}`;

            const res = await axios.get(url);
            let data = res.data;

            // If not found by exact name, try a search
            if (data.Response === 'False') {
                const searchRes = await axios.get(`https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`);
                if (searchRes.data.Response === 'True') {
                    const firstResult = searchRes.data.Search[0];
                    const detailRes = await axios.get(`https://www.omdbapi.com/?i=${firstResult.imdbID}&apikey=${OMDB_KEY}&plot=full`);
                    data = detailRes.data;
                }
            }

            if (data.Response === 'False') {
                return reply(`❌ Could not find a movie called: *${input}*`);
            }

            // Build the rating stars (IMDB Stars)
            const imdbStars = data.imdbRating !== 'N/A' 
                ? '⭐'.repeat(Math.round(parseFloat(data.imdbRating) / 2)) 
                : 'N/A';

            const movieInfo = `🎬 *${data.Title}* (${data.Year})\n\n` +
                `🎭 *Genre:* ${data.Genre}\n` +
                `🌍 *Language:* ${data.Language}\n` +
                `🎬 *Director:* ${data.Director}\n` +
                `🎭 *Cast:* ${data.Actors}\n` +
                `⏱️ *Runtime:* ${data.Runtime}\n` +
                `🏆 *Awards:* ${data.Awards}\n\n` +
                `⭐ *Rating:* ${data.imdbRating}/10 ${imdbStars}\n\n` +
                `📝 *Plot:*\n${data.Plot}\n\n` +
                `${data.BoxOffice && data.BoxOffice !== 'N/A' ? `💰 *Box Office:* ${data.BoxOffice}\n` : ''}` +
                `🔗 https://www.imdb.com/title/${data.imdbID}\n\n` +
                `*DarkX-Mini Movie Search*`;

            // Send the poster image along with details
            if (data.Poster && data.Poster !== 'N/A') {
                await sock.sendMessage(m.chat, { 
                    image: { url: data.Poster }, 
                    caption: movieInfo 
                }, { quoted: m });
            } else {
                await reply(movieInfo);
            }

            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

        } catch (error) {
            console.error('Movie Error:', error);
            reply(`❌ An error occurred: ${error.message}`);
        }
    }
};
