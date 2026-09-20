const { updateSettings } = require("../library/settingsStore");
const { ensureGroup } = require("../library/groupGuard");

module.exports = {
    command: ["antistatusmention", "antistatus", "asm"],
    category: "group",
    description: "Anti status-mention: the 'group mentioned in a status' notice is deleted immediately. 3 times = the member is removed.",
    execute: async (sock, m, { args, reply, config, sessionId, isGroup, isAdmin, isOwner }) => {
        const choice = (args[0] || "").toLowerCase();

        if (isGroup) {
            if (!isAdmin && !isOwner) return reply(config.msg?.admin || "Admin only!");
            const group = ensureGroup(m.chat);

            if (choice === "on") {
                group.antistatusmention = true;
                return reply("✅ Anti Status-Mention is ON for this group.\nStatus-mention notices are deleted immediately. A member who does it 3 times is removed.\n\n_The bot must be a group admin._");
            }
            if (choice === "off") {
                group.antistatusmention = false;
                return reply("📴 Anti Status-Mention is OFF for this group.");
            }
            return reply(`📣 Anti Status-Mention in this group: *${group.antistatusmention ? "ON" : "OFF"}*\n(All groups switch: *${config.antiStatusMention ? "ON" : "OFF"}*)\n\nUse:\n${config.prefix}antistatusmention on\n${config.prefix}antistatusmention off`);
        }

        if (!isOwner) return reply(config.msg?.owner || "Owner only!");

        if (choice === "on") {
            updateSettings(sessionId, { antiStatusMention: true });
            return reply("✅ Anti Status-Mention is ON for all groups.");
        }
        if (choice === "off") {
            updateSettings(sessionId, { antiStatusMention: false });
            return reply("📴 Anti Status-Mention is OFF for all groups.");
        }
        return reply(`📣 Anti Status-Mention (all groups) is currently: *${config.antiStatusMention ? "ON" : "OFF"}*\n\nUse:\n${config.prefix}antistatusmention on\n${config.prefix}antistatusmention off`);
    }
};
