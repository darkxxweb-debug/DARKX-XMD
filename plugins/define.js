const axios = require("axios");

module.exports = {
    command: ["define", "dict", "urban"],
    category: "search",
    description: "Search a word on Urban Dictionary",
    execute: async (sock, m, { text, reply }) => {
        const query = text?.trim();

        if (!query) {
            return reply("*Please provide a word to search for.*\nExample: .define hello");
        }

        try {
            const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(query)}`;
            const { data: json } = await axios.get(url);

            if (!json?.list || json.list.length === 0) {
                return reply("❌ Word not found in the dictionary.");
            }

            const firstEntry = json.list[0];
            const definition = firstEntry.definition || "No definition available";
            const example = firstEntry.example ? `*Example:* ${firstEntry.example}` : "";

            const caption = `🔍 *Dictionary*\n\n*Word:* ${query}\n*Definition:* ${definition}\n${example}`;

            await sock.sendMessage(m.chat, { text: caption }, { quoted: m });
        } catch (err) {
            console.error("[DEFINE] Error:", err.message);
            reply("❌ Failed to fetch definition.");
        }
    },
};
