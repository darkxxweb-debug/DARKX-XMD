const config = require("../settings/config");
const { delay } = require("@whiskeysockets/baileys");

module.exports = {
    command: ["add", "invite"],
    category: "group",
    execute: async (sock, m, { args, reply, isGroup, isAdmin, isOwner }) => {
        try {
            // 1. Validation
            if (!isGroup) {
                return reply("❌ This command only works in groups!");
            }

            if (!isAdmin && !isOwner) {
                return reply("❌ You need to be an Admin to add members!");
            }

            if (args.length === 0) {
                return reply(
                    `📌 *HOW TO ADD MEMBERS*\n\n` +
                    `*Usage:* .add 2557XXXXXX, 2556XXXXXX\n` +
                    `*Limit:* Maximum 30 numbers at once.\n\n` +
                    `> Developed by 𓆩☠︎︎𓆪 𝙈𝙧𝙓 𝘿𝙚𝙫𝙚𝙡𝙤𝙥𝙚𝙧 😈`
                );
            }

            // 2. Parse and Clean Numbers
            let input = args.join(" ");
            let numbers = input.includes(",") 
                ? input.split(",").map(n => n.trim()) 
                : args;

            // Remove non-numeric characters and format for WhatsApp
            numbers = numbers
                .map(n => n.replace(/[^0-9]/g, ""))
                .filter(n => n.length >= 10 && n.length <= 15)
                .slice(0, 30);

            if (numbers.length === 0) {
                return reply("❌ No valid numbers provided!");
            }

            await reply(`⏳ *Processing ${numbers.length} numbers...*\n\n_Please wait while I add them one by one._`);

            // 3. Metadata and Tracking
            const groupMetadata = await sock.groupMetadata(m.chat);
            const groupName = groupMetadata.subject;
            let success = [];
            let failed = [];
            let alreadyIn = [];

            // 4. Processing Loop
            for (let i = 0; i < numbers.length; i++) {
                const number = numbers[i];
                const jid = number + "@s.whatsapp.net";

                // Check if user is already in the group
                const isAlreadyPresent = groupMetadata.participants.some(p => p.id === jid);
                
                if (isAlreadyPresent) {
                    alreadyIn.push(number);
                    continue;
                }

                try {
                    await sock.groupParticipantsUpdate(m.chat, [jid], "add");
                    success.push(number);
                } catch (err) {
                    // Privacy settings or other errors
                    failed.push(number);
                    
                    if (err.message?.includes('rate-overlimit')) {
                        await delay(5000); // Wait 5 seconds if being throttled
                    }
                }

                // Small delay to prevent WhatsApp spam ban
                await delay(1500);
            }

            // 5. Final Report Construction
            let finalReport = `╭━━━「 *ADD RESULTS* 」━━━╮\n`;
            finalReport += `┃\n`;
            finalReport += `┃ 👥 *Group:* ${groupName}\n`;
            finalReport += `┃ ✅ *Added:* ${success.length}\n`;
            finalReport += `┃ 👥 *Already in:* ${alreadyIn.length}\n`;
            finalReport += `┃ ❌ *Failed:* ${failed.length}\n`;
            finalReport += `┃\n`;
            
            if (failed.length > 0) {
                finalReport += `┃ _Failed numbers usually have_\n`;
                finalReport += `┃ _Privacy Settings enabled._\n`;
                finalReport += `┃\n`;
            }

            finalReport += `╰━━━━━━━━━━━━━━━━━━━╯\n\n`;
            finalReport += `> Developed by 𓆩☠︎︎𓆪 𝙈𝙧𝙓 𝘿𝙚𝙫𝙚𝙡𝙤𝙥𝙚𝙧 😈`;

            await sock.sendMessage(m.chat, { 
                text: finalReport, 
                mentions: success.map(n => n + "@s.whatsapp.net") 
            }, { quoted: m });

        } catch (error) {
            console.error("Add Command Error:", error);
            reply("❌ Failed to add participants. Check if the bot is Admin.");
        }
    }
};
