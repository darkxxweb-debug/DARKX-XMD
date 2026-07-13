const axios = require('axios');

module.exports = {
    command: ["weather", "halihewa"],
    execute: async (sock, m, args) => {
        const city = args.join(' ');
        if (!city) return sock.sendMessage(m.chat, { text: "Weka jina la mkoa! Mfano: .weather Kigoma" });

        try {
            await sock.sendMessage(m.chat, { react: { text: "🌦️", key: m.key } });
            // API ya wazi (Free API)
            const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=06af69666874483e03405443492f310a`);
            
            const { name, main, weather, wind } = res.data;
            let report = `乂  *W E A T H E R  R E P O R T* 乂\n\n`;
            report += `📍 *Mkoa:* ${name}\n`;
            report += `🌡️ *Joto:* ${main.temp}°C\n`;
            report += `☁️ *Hali:* ${weather[0].description}\n`;
            report += `💧 *Unyevu:* ${main.humidity}%\n`;
            report += `💨 *Upepo:* ${wind.speed} m/s`;

            await sock.sendMessage(m.chat, { text: report }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(m.chat, { text: "Sijapata mkoa huo. Hakikisha umeandika kwa usahihi." });
        }
    }
};
