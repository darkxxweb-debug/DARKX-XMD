module.exports = {
    command: ["jid", "channeljid"],
    category: "tools",
    description: "Get a WhatsApp channel's newsletter JID from its invite link",

    execute: async (sock, m, { args, reply }) => {
        try {
            if (!args[0]) {
                return reply('❌ Please provide a channel link.\n\nExample:\n.jid https://whatsapp.com/channel/xxxx');
            }

            const link = args[0];

            // Extract the invite code from the link
            const inviteCode = link.split('/').pop();

            if (!inviteCode || inviteCode.length < 10) {
                return reply('❌ That link doesn\'t look valid.');
            }

            // Fetch channel metadata (type must be "invite" when passing an invite code)
            const data = await sock.newsletterMetadata('invite', inviteCode);

            if (!data) {
                return reply('❌ Could not find a channel for that link.');
            }

            const result =
`╔═〘 📡 CHANNEL INFO 〙
║ 📛 Name: ${data.name || 'Unknown'}
║ 🆔 JID: ${data.id}
║ 👥 Subscribers: ${data.subscribers || 'N/A'}
║ 📝 Description: ${data.description || 'None'}
╚═══════════════`;

            reply(result);

        } catch (err) {
            console.error('JID command error:', err);
            reply('❌ Failed to get the channel JID.\nMake sure:\n- The link is correct\n- The channel actually exists');
        }
    }
};
