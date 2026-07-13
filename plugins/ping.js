const { performance } = require('perf_hooks');

module.exports = {
    command: ['ping'],
    execute: async (sock, m, { reply }) => {
        const start = performance.now();
        const { key } = await reply("Testing speed...");
        const end = performance.now();
        const speed = (end - start).toFixed(4);
        
        await sock.sendMessage(m.chat, { 
            text: `🚀 *Pong!* \nKasi: ${speed} ms`, 
            edit: key 
        });
    }
};
