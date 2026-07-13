// Plugin: anti-delete toggle
{
    command: 'antidelete',
    isOwner: true,
    execute: async (sock, m, { args, reply, config }) => {
        if (args[0] === 'on') {
            config.antiDelete = true;
            await reply('✅ Anti-Delete imewashwa!');
        } else if (args[0] === 'off') {
            config.antiDelete = false;
            await reply('📴 Anti-Delete imezimwa!');
        } else {
            await reply(`🔍 Anti-Delete: ${config.antiDelete ? 'ON' : 'OFF'}`);
        }
    }
}