const { updateSettings } = require("../library/settingsStore");

module.exports = {
    command: ["antidelete"],
    category: "owner",
    isOwner: true,
    description: "Toggle anti-delete (text + media). Media is kept on disk for 5 minutes, text for 6 hours.",
    execute: async (sock, m, { args, reply, config, sessionId }) => {
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") {
            updateSettings(sessionId, { antidelete: true });
            return reply("✅ Anti-Delete has been turned ON.\nText is remembered for 6 hours, media for 5 minutes.");
        }
        if (choice === "off") {
            updateSettings(sessionId, { antidelete: false });
            return reply("📴 Anti-Delete has been turned OFF.");
        }
        return reply(`🔍 Anti-Delete is currently: *${config.antidelete ? "ON" : "OFF"}*\n\nUse:\n${config.prefix}antidelete on\n${config.prefix}antidelete off`);
    }
};
