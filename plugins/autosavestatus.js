"use strict";

const { updateSettings } = require("../library/settingsStore");

module.exports = {
    command: ["autosavestatus", "ass"],
    category: "owner",
    isOwner: true,
    description: "Auto-save every contact status update into your own MongoDB (requires a Mongo URL set in your settings).",
    execute: async (sock, m, { args, reply, config, sessionId }) => {
        const choice = (args[0] || "").toLowerCase();

        if (choice === "on") {
            if (!config.mongoUrl) {
                return reply(
                    "⚠️ You need to set your own MongoDB URL in the settings panel first — " +
                    "the shared bot database is text-only and can't store status media."
                );
            }
            updateSettings(sessionId, { autoSaveStatus: true });
            return reply("✅ Auto Save Status is now ON — statuses will be saved to your own database automatically.");
        }
        if (choice === "off") {
            updateSettings(sessionId, { autoSaveStatus: false });
            return reply("📴 Auto Save Status is now OFF.");
        }
        return reply(
            `🔍 Auto Save Status is currently: *${config.autoSaveStatus ? "ON" : "OFF"}*\n\n` +
            `Use:\n${config.prefix}autosavestatus on\n${config.prefix}autosavestatus off\n\n` +
            `Note: needs your own MongoDB URL set in settings (shared DB is text-only).`
        );
    },
};
