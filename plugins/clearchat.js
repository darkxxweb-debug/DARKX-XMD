module.exports = {
    command: ["clearchat", "deletechat"],
    category: "owner",
    description: "Clear/delete the current chat (group admins or bot owner in groups, owner only in DM)",
    execute: async (sock, m, { reply, isGroup, isAdmin, isOwner }) => {
        // --- Permission check ---
        // Groups: admins or the bot owner. DMs: bot owner only.
        if (isGroup) {
            if (!isAdmin && !isOwner) {
                return reply("❌ Only group admins or the bot owner can clear this chat.");
            }
        } else {
            if (!isOwner) {
                return reply("❌ Only the bot owner can clear DM chats.");
            }
        }

        try {
            await sock.chatModify(
                {
                    delete: true,
                    lastMessages: [
                        {
                            key: m.key,
                            messageTimestamp: m.messageTimestamp,
                        },
                    ],
                },
                m.chat
            );

            await sock.sendMessage(m.chat, { text: "🗑️ *Chat cleared successfully!*" }, { quoted: m });
        } catch (err) {
            console.error("[CLEARCHAT] Error:", err.message);
            reply(`❌ Failed to clear chat: ${err.message}`);
        }
    },
};
