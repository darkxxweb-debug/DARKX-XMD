"use strict";

/**
 * Project: DarkX Ultra
 * Owner: MrX Dev
 * Configuration File with Session ID Support
 */

module.exports = {
    // --- BASIC BOT INFO ---
    botName: "DarkX Ultra",
    ownerName: "MrX Dev",
    ownerNumber: "255775710774",
    prefix: ".",
    
    // --- SESSION MANAGEMENT ---
    SESSION_ID: process.env.SESSION_ID || "DarkX-Ultra~WEKA_ID_YAKO_HAPA", 
    sessionName: "session",
    
    // --- BOT MODES & BEHAVIOR ---
    public: true,
    online: true,
    
    // --- SECURITY & LIMITS ---
    limitCount: 20,
    adminOnly: false,
    
    // ============================================
    // ===== ANTI-DELETE FEATURE =====
    // ============================================
    antiDelete: false,              // true: Detect deleted messages | false: Ignore
    antiDeleteNotifyOwner: true,   // true: Send report to owner | false: Don't
    
    // ============================================
    // ===== AUTO FEATURES - ZOTE ZIMETENGWA =====
    // ============================================
    
    // --- AUTO STATUS FEATURES ---
    autoViewStatus: true,
    autoReactStatus: true,
    
    // --- AUTO CHAT FEATURES ---
    autoReadChat: false,
    autoReactChat: true,
    
    // --- AUTO PRESENCE FEATURES ---
    autoTyping: true,
    autoRecording: false,
    
    // --- AUTO AI FEATURES ---
    autoAi: false,
    
    // --- VISUALS & METADATA ---
    version: "6.0.0",
    worktype: "public",
    footer: "© 2026 DarkX Ultra - Developed by MrX Dev",
    thumb: "https://telegra.ph/file/a0f3d45e45c71b6d05494.jpg",
    
    // --- MESSAGES ---
    msg: {
        owner: "🚫 Amri hii ni kwa ajili ya *MrX Dev* pekee!",
        group: "👥 Samahani, hii amri inafanya kazi kwenye Magroup tu.",
        admin: "👮 Amri hii inahitaji uwe *Admin* wa group.",
        botAdmin: "🤖 Tafadhali nifanye niwe *Admin* kwanza ili nitekeleze hili.",
        wait: "⏳ *DarkX Ultra inashughulikia...* Tafadhali subiri.",
        error: "❌ *Error!* Kuna hitilafu imetokea kwenye mfumo."
    }
};
