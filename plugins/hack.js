module.exports = {
    command: ['hack', 'fakehack', 'prankhack'],
    category: 'fun',
    description: 'Simulate a hack sequence (fun prank)',
    execute: async (sock, m, { args, reply }) => {
        const target = args?.[0] || (m.quoted ? m.quoted.sender.split('@')[0] : 'target');
        
        // Helper function ya delay
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Progress bar helper
        const displayProgressBar = async (taskName, steps) => {
            const progressBarLength = 15;
            for (let i = 1; i <= steps; i++) {
                const progress = Math.round((i / steps) * progressBarLength);
                const bar = '█'.repeat(progress) + '░'.repeat(progressBarLength - progress);
                // Tunatumia sock.sendMessage badala ya reply ili kuonyesha mabadiliko
                await sock.sendMessage(m.chat, { text: `*${taskName}:* [${bar}] ${Math.round((i/steps)*100)}%` }, { quoted: m });
                await delay(800);
            }
        };

        try {
            await reply(`*💻 Initializing hack sequence on ${target}...*`);
            await delay(1500);
            
            await reply('*🔌 Establishing secure connection...*');
            await delay(1200);
            
            await displayProgressBar('Bypassing firewalls', 4);
            
            await reply('*🔐 Gaining access to encrypted database...*');
            await delay(1500);
            
            await displayProgressBar('Cracking encryption', 5);
            
            await reply('*📥 Downloading sensitive data...*');
            await delay(1500);
            
            await reply(`*💥 Hack complete! 🎯 Target "${target}" compromised.*`);
            await delay(1000);
            
            await reply('*🤖 Mission accomplished. Logging off...*');
        } catch (error) {
            console.error('Error in hack sequence:', error);
            reply('*⚠️ Sequence failed. Firewall too strong!*');
        }
    }
};
