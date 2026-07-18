module.exports = {
    command: ["gdesc"],
    category: "group",
    isGroup: true,
    description: "Show the current group description",
    execute: async (sock, m, { reply, groupMetadata }) => {
        reply(`📝 *Group Description:*\n${groupMetadata.desc || "_No description set._"}`);
    }
};
