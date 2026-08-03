"use strict";

/**
 * Project: DarkX-Ultra
 * Base / default configuration.
 *
 * NOTE: these are just the defaults used the very first time a number is
 * connected. Once a number is linked, its real settings (owner number,
 * owner name, bot name, status emojis, anti-link, etc.) live in
 * sessionSettings.json via library/settingsStore.js, and can be changed
 * any time from the web settings panel. That per-number data always wins
 * over the defaults below.
 */

module.exports = {
    // --- BASIC BOT INFO ---
    botName: "DarkX-Ultra",
    ownerName: "Owner",
    ownerNumber: "",
    prefix: ".",

    // --- SESSION MANAGEMENT (legacy single-session support) ---
    SESSION_ID: process.env.SESSION_ID || "",
    sessionName: "session",

    // --- BOT MODES & BEHAVIOR ---
    public: true,
    online: true,

    // --- SECURITY & LIMITS ---
    limitCount: 20,
    adminOnly: false,
    WARN_COUNT: 3,

    // --- ANTI-DELETE FEATURE (default OFF until enabled) ---
    antiDelete: false,
    antiDeleteNotifyOwner: true,

    // --- ANTI-LINK FEATURE (default OFF until enabled) ---
    antilink: false,

    // --- AUTO STATUS FEATURES ---
    autoViewStatus: true,
    autoReactStatus: true,
    statusEmojis: ["🔥", "💎", "💜", "❤️", "💙", "💚", "💖"],

    // --- AUTO CHAT FEATURES ---
    autoReadChat: false,
    autoReactChat: true,
    chatEmojis: ["😆", "😱", "😂", "🤫", "👍"],

    // --- AUTO PRESENCE FEATURES ---
    autoTyping: true,
    autoRecording: false,

    // --- VISUALS & METADATA ---
    version: "6.0.0",
    worktype: "public",
    watermark: "DarkX-Ultra",
    footer: "© 2026 DarkX-Ultra",
    thumb: "https://telegra.ph/file/a0f3d45e45c71b6d05494.jpg",

    // --- MESSAGES (English) ---
    msg: {
        owner: "🚫 This command can only be used by the bot owner!",
        group: "👥 Sorry, this command only works in groups.",
        admin: "👮 This command requires you to be a group *Admin*.",
        botAdmin: "🤖 Please make me an *Admin* first so I can do this.",
        wait: "⏳ *DarkX-Ultra is processing...* Please wait.",
        error: "❌ *Error!* Something went wrong in the system.",
    },
};
