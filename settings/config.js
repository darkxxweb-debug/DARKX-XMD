"use strict";

/**
 * Project: DarkX Ultimate
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
    botName: "DarkX Ultimate",
    ownerName: "Owner",
    ownerNumber: "",
    prefix: ".",

    // --- CONTROL PANEL / "REPO" LINK ---
    // Shown inside .repo, .menu and the newsletter-style forwarded cards.
    // Point this at wherever the web dashboard is actually deployed
    // (Render URL, custom domain, etc). Falls back to RENDER_EXTERNAL_URL
    // (which Render sets automatically) if WEB_URL isn't set.
    repoUrl: process.env.WEB_URL || process.env.RENDER_EXTERNAL_URL || "https://darkx-ultimate.onrender.com",

    // --- WHATSAPP CHANNEL (used by the menu's forwarded-look + the web
    // admin panel's "Channel Broadcast" tool, which posts straight to it) ---
    channelJid: process.env.CHANNEL_JID || "120363427307889741@newsletter",
    channelName: process.env.CHANNEL_NAME || "DARKX ULTIMATE",

    // --- SESSION MANAGEMENT (legacy single-session support) ---
    SESSION_ID: process.env.SESSION_ID || "",
    sessionName: "session",

    // --- BOT MODES & BEHAVIOR ---
    public: true,
    online: true,
    privateMode: false, // when true, the bot only responds to its owner — everyone else is ignored

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
    version: "3.0.0",
    worktype: "public",
    watermark: "DarkX Ultimate",
    footer: "© 2026 DarkX Ultimate",
    thumb: "https://telegra.ph/file/a0f3d45e45c71b6d05494.jpg",

    // --- MESSAGES (English) ---
    msg: {
        owner: "🚫 This command can only be used by the bot owner!",
        group: "👥 Sorry, this command only works in groups.",
        admin: "👮 This command requires you to be a group *Admin*.",
        botAdmin: "🤖 Please make me an *Admin* first so I can do this.",
        wait: "⏳ *DarkX Ultimate is processing...* Please wait.",
        error: "❌ *Error!* Something went wrong in the system.",
        private: "🔒 This bot is currently in *Private Mode* and only responds to its owner.",
    },
};
