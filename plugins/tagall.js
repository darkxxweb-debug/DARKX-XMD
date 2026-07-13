module.exports = {
    command: ['tagall', 'everyone', 'all'],
    category: 'admin',
    description: 'Tag members wote wa group',
    isGroup: true,
    isAdmin: true,
    execute: async (sock, m, { participants, text, reply }) => {
        try {
            // Ujumbe wa ziada kama upo (mfano: .tagall Amkeni!)
            let messageText = `🔊 *TAG ALL BY DARKX-MINI*\n\n`;
            messageText += `*Message:* ${text ? text : 'No message provided'}\n\n`;

            // Kutengeneza list ya ma-tag
            for (let mem of participants) {
                messageText += `🔹 @${mem.id.split('@')[0]}\n`;
            }

            // Kutuma meseji huku tukizitambua mentions
            await sock.sendMessage(m.chat, {
                text: messageText,
                mentions: participants.map((p) => p.id)
            }, { quoted: m });

        } catch (error) {
            console.error('Error in tagall:', error);
            reply('❌ Imeshindwa ku-tag members wote.');
        }
    }
};
