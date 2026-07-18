module.exports = {
    command: ["poll"],
    category: "group",
    isGroup: true,
    description: "Create a poll. Usage: .poll Question | Option1 | Option2 | Option3",
    execute: async (sock, m, { text, reply }) => {
        if (!text || !text.includes("|")) {
            return reply("Usage: .poll Question | Option1 | Option2 | Option3");
        }

        const parts = text.split("|").map((p) => p.trim()).filter(Boolean);
        const question = parts[0];
        const options = parts.slice(1);

        if (options.length < 2) return reply("Please give at least 2 options.");
        if (options.length > 12) return reply("A poll can have at most 12 options.");

        await sock.sendMessage(m.chat, {
            poll: { name: question, values: options, selectableCount: 1 }
        }, { quoted: m });
    }
};
