"use strict";

const { updateSettings } = require("../library/settingsStore");

module.exports = {
    command: ["autoviewonce", "avo"],
    category: "owner",
    isOwner: true,
    description: "Auto-forward every view-once photo/video straight to your DM, silently (no reply in the chat).",
    execute: async (sock, m, { args, reply, config, sessionId }) => {
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") {
            updateSettings(sessionId, { autoViewOnce: true });
            return reply("✅ Auto View-Once is now ON — every view-once media will be forwarded to your DM automatically.");
        }
        if (choice === "off") {
            updateSettings(sessionId, { autoViewOnce: false });
            return reply("📴 Auto View-Once is now OFF.");
        }
        return reply(
            `🔍 Auto View-Once is currently: *${config.autoViewOnce ? "ON" : "OFF"}*\n\n` +
            `Use:\n${config.prefix}autoviewonce on\n${config.prefix}autoviewonce off`
        );
    },
};
