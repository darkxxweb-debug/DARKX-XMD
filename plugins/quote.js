const axios = require('axios');

module.exports = {
    command: ["quote", "nukuu"],
    execute: async (sock, m, args) => {
        try {
            await sock.sendMessage(m.chat, { react: { text: "📜", key: m.key } });
            const res = await axios.get('https://api.quotable.io/random');
            const { content, author } = res.data;
            
            let text = `“${content}”\n\n— *${author}*`;
            await sock.sendMessage(m.chat, { text: text }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(m.chat, { text: "Kuna tatizo kidogo, jaribu tena baadae." });
        }
    }
};
