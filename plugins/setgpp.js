module.exports = {
    command: ["setgpp", "setgpic", "grouppp"],
    execute: async (sock, m, args, { reply }) => {
        try {
            if (!m.isGroup) return reply("❌ Amri hii ni kwa ajili ya magroup pekee!");

            // 1. Uhakiki wa Admin
            const groupMetadata = await sock.groupMetadata(m.chat);
            const participants = groupMetadata.participants;
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = participants.find(p => p.id === botId)?.admin !== null;

            if (!isBotAdmin) return reply("❌ Nifanye niwe *Admin* kwanza ili nibadili picha ya group.");

            // 2. Uhakiki wa Media (Reply kwenye picha pekee)
            const quoted = m.msg?.contextInfo?.quotedMessage;
            if (!quoted || !quoted.imageMessage) {
                return reply("❌ Tafadhali reply kwenye *Picha* ukitumia amri ya .setgpp");
            }

            await sock.sendMessage(m.chat, { react: { text: "🖼️", key: m.key } });

            // 3. Download picha kwa kutumia function yetu ya index.js
            const media = await sock.downloadMediaMessage({
                msg: quoted.imageMessage,
                mtype: 'imageMessage'
            });

            // 4. Update Profile Picture moja kwa moja kutoka kwenye Buffer
            await sock.updateProfilePicture(m.chat, media);

            await sock.sendMessage(m.chat, { 
                text: "✅ *Group Profile Picture imebadilishwa kikamilifu!*" 
            }, { quoted: m });

        } catch (err) {
            console.error("Error kwenye setgpp:", err);
            reply("❌ Imeshindwa kubadili picha. Hakikisha picha ni sahihi na bot ni admin.");
        }
    }
};
