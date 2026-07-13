const config = require("../settings/config");
const fs = require("fs");
const path = require("path");

// Path to store warning data locally (Self-contained fix)
const warnDbPath = path.join(__dirname, "../media/warns.json");

// Helper functions to handle warnings without external modules
const getWarnData = () => {
    if (!fs.existsSync(warnDbPath)) return {};
    return JSON.parse(fs.readFileSync(warnDbPath, "utf-8"));
};

const saveWarnData = (data) => {
    fs.writeFileSync(warnDbPath, JSON.stringify(data, null, 2));
};

module.exports = {
    command: ["warn"],
    category: "group",
    execute: async (sock, m, { args, reply, isGroup, isAdmin, isOwner }) => {
        try {
            // 1. Check if the command is used in a group
            if (!isGroup) {
                return reply("❌ This command can only be used in groups.");
            }

            // 2. Check for Admin or Owner permissions
            if (!isAdmin && !isOwner) {
                return reply("❌ You must be an admin to use this command.");
            }

            // 3. Identify the target user (must reply to a message)
            const targetUser = m.msg.contextInfo?.participant;

            if (!targetUser) {
                return reply("❌ Please reply to a user's message to warn them.");
            }

            let warnData = getWarnData();

            // Handle Reset Logic
            if (args[0] === "reset") {
                delete warnData[targetUser];
                saveWarnData(warnData);
                return reply(`✅ Warning count for @${targetUser.split("@")[0]} has been reset.`, {
                    mentions: [targetUser]
                });
            }

            // Default Warn Logic
            if (!warnData[targetUser]) {
                warnData[targetUser] = 0;
            }

            warnData[targetUser] += 1;
            saveWarnData(warnData);

            const currentWarns = warnData[targetUser];
            const warnLimit = config.WARN_COUNT || 3; 

            if (currentWarns >= warnLimit) {
                await reply(`🚫 @${targetUser.split("@")[0]} has reached the warning limit (${warnLimit}) and will be removed.`, {
                    mentions: [targetUser]
                });
                
                // Remove the user from the group
                await sock.groupParticipantsUpdate(m.chat, [targetUser], "remove");
                
                // Optional: Reset their warns after kicking
                delete warnData[targetUser];
                saveWarnData(warnData);
            } else {
                const remaining = warnLimit - currentWarns;
                await reply(`⚠️ @${targetUser.split("@")[0]} has been warned.\n\n*Current Warns:* ${currentWarns}\n*Remaining before kick:* ${remaining}`, {
                    mentions: [targetUser]
                });
            }

        } catch (error) {
            console.error("Warn Command Error:", error);
            reply("❌ System Error: Failed to process the warning.");
        }
    }
};
