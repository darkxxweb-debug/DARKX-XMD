module.exports = {
    command: ["gsettings", "groupsettings"],
    category: "group",
    isGroup: true,
    isAdmin: true,
    description: "View a summary of this group's protection settings",
    execute: async (sock, m, { reply }) => {
        const g = global.db.groups[m.chat];
        reply(
            `⚙️ *GROUP SETTINGS*\n\n` +
            `🔒 Closed (admins only): ${g.mute ? "ON" : "OFF"}\n` +
            `🔗 Anti-Link: ${g.antilink ? "ON" : "OFF"}\n` +
            `🤖 Anti-Bot: ${g.antibot ? "ON" : "OFF"}\n` +
            `🕵️ Anti-Fake: ${g.antifake ? "ON" : "OFF"}\n` +
            `🚫 Anti-Spam: ${g.antispam ? "ON" : "OFF"}\n` +
            `👋 Welcome messages: ${g.welcome ? "ON" : "OFF"}\n` +
            `👋 Goodbye messages: ${g.goodbye ? "ON" : "OFF"}\n` +
            `⚠️ Warn limit: ${g.warnLimit ?? 3}\n` +
            `🔇 Muted members: ${g.mutedUsers?.length || 0}`
        );
    }
};
