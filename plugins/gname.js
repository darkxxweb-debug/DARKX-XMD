module.exports = {
    command: ["gname"],
    category: "group",
    isGroup: true,
    description: "Show the current group name",
    execute: async (sock, m, { reply, groupMetadata }) => {
        reply(`📛 *Group Name:* ${groupMetadata.subject}`);
    }
};
