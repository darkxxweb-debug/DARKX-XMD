"use strict";

const { updateSettings } = require("../library/settingsStore");

module.exports = {
    command: ["private", "privatemode"],
    category: "owner",
    isOwner: true,
    description: "Toggle Private Mode — when ON, the bot only responds to its owner and ignores everyone else",
    execute: async (sock, m, { args, reply, config, sessionId }) => {
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") {
            updateSettings(sessionId, { privateMode: true });
            return reply("🔒 *Private Mode* is now *ON*.\nOnly the owner can use this bot from now on.");
        }
        if (choice === "off") {
            updateSettings(sessionId, { privateMode: false });
            return reply("🌐 *Private Mode* is now *OFF*.\nThe bot is public again — everyone can use it.");
        }
        return reply(
            `🔒 Private Mode is currently: *${config.privateMode ? "ON" : "OFF"}*\n\n` +
            `Use:\n${config.prefix}private on\n${config.prefix}private off`
        );
    }
};
