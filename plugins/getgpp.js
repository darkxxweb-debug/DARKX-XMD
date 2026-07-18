module.exports = {
    command: ["getgpp", "gpp"],
    category: "group",
    isGroup: true,
    description: "Get the group's current profile picture",
    execute: async (sock, m, { reply }) => {
        try {
            const url = await sock.profilePictureUrl(m.chat, "image");
            await sock.sendMessage(m.chat, { image: { url }, caption: "🖼️ Current group picture" }, { quoted: m });
        } catch (e) {
            reply("❌ This group doesn't have a profile picture.");
        }
    }
};
