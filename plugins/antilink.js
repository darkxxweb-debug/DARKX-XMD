const { updateSettings } = require("../library/settingsStore");
const { ensureGroup } = require("../library/groupGuard");

module.exports = {
    command: ["antilink"],
    category: "group",
    description: "Anti-link: links are deleted automatically (no warning). 3 links = removed. Group admins use it inside a group; the owner can use it in private chat to switch it on for every group.",
    execute: async (sock, m, { args, reply, config, sessionId, isGroup, isAdmin, isOwner }) => {
        const choice = (args[0] || "").toLowerCase();

        // ----- Inside a group: admins control this group only -----
        if (isGroup) {
            if (!isAdmin && !isOwner) return reply(config.msg?.admin || "Admin only!");
            const group = ensureGroup(m.chat);

            if (choice === "on") {
                group.antilink = true;
                return reply("✅ Anti-Link is ON for this group.\nLinks are deleted automatically. A member who sends 3 links is removed.\n\n_The bot must be a group admin._");
            }
            if (choice === "off") {
                group.antilink = false;
                return reply("📴 Anti-Link is OFF for this group.");
            }
            return reply(`🔗 Anti-Link in this group: *${group.antilink ? "ON" : "OFF"}*\n(All groups switch: *${config.antilink ? "ON" : "OFF"}*)\n\nUse:\n${config.prefix}antilink on\n${config.prefix}antilink off`);
        }

        // ----- Private chat: owner switches it for ALL groups -----
        if (!isOwner) return reply(config.msg?.owner || "Owner only!");

        if (choice === "on") {
            updateSettings(sessionId, { antilink: true });
            return reply("✅ Anti-Link is ON for all groups.\nLinks are deleted automatically. A member who sends 3 links is removed.");
        }
        if (choice === "off") {
            updateSettings(sessionId, { antilink: false });
            return reply("📴 Anti-Link is OFF for all groups.");
        }
        return reply(`🔗 Anti-Link (all groups) is currently: *${config.antilink ? "ON" : "OFF"}*\n\nUse:\n${config.prefix}antilink on\n${config.prefix}antilink off`);
    }
};
