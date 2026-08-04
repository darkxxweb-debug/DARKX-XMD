module.exports = {
    command: ['tagall', 'everyone', 'all'],
    category: 'admin',
    description: 'Tag members wote wa group',
    isGroup: true,
    isAdmin: true,
    execute: async (sock, m, { participants, text, reply }) => {
        try {
            // Optional extra message (e.g. .tagall Wake up!)
            let messageText = `🔊 *TAG ALL — DarkX Ultimate*\n\n`;
            messageText += `*Message:* ${text ? text : 'No message provided'}\n\n`;

            // Kutengeneza list ya ma-tag
            for (let mem of participants) {
                messageText += `🔹 @${mem.id.split('@')[0]}\n`;
            }

            // Send the message while tagging everyone as mentions
            await sock.sendMessage(m.chat, {
                text: messageText,
                mentions: participants.map((p) => p.id)
            }, { quoted: m });

        } catch (error) {
            console.error('Error in tagall:', error);
            reply('❌ Failed to tag all members.');
        }
    }
};
