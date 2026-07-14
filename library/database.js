"use strict";

/**
 * Project: DarkX Ultra
 * Owner: MrX Dev
 * Engineer: Senior Node.js WhatsApp Bot Engineer
 * Lightweight JSON Database System
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const dbPath = path.join(__dirname, '../database.json');

// --- DATABASE STRUCTURE ---
const defaultData = {
    users: {},      // User data (like level, xp, ban status)
    groups: {},     // Group data (like welcome message, anti-link)
    settings: {     // General bot settings
        self: false,
        autoRead: false,
        public: true,
        online: true
    },
    others: {}      // Miscellaneous data
};

/**
 * Reads data from the JSON file.
 * If the file doesn't exist, creates a new one with defaultData.
 */
const loadDatabase = () => {
    try {
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
            console.log(chalk.green("✅ New database created!"));
            return defaultData;
        }
        const data = fs.readFileSync(dbPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error(chalk.red("❌ Error reading database:"), err);
        return defaultData;
    }
};

/**
 * Saves all changed data back to the JSON file.
 */
const saveDatabase = (data) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(chalk.red("❌ Error saving database:"), err);
    }
};

/**
 * Ensures a user or group exists in the DB, creating it if missing.
 */
const synchronizeData = (m, sock) => {
    const db = global.db; // Using global so it's accessible everywhere
    if (!db) return;

    const isGroup = m.chat.endsWith('@g.us');
    const sender = m.sender;

    // 1. Synchronize User
    if (sender) {
        let user = db.users[sender];
        if (typeof user !== 'object') db.users[sender] = {};
        if (user) {
            if (!('name' in user)) user.name = m.pushName || "User";
            if (!('banned' in user)) user.banned = false;
            if (!('premium' in user)) user.premium = false;
            if (!('warn' in user)) user.warn = 0;
            if (!('limit' in user)) user.limit = 20; // Daily command limit
        } else {
            db.users[sender] = {
                name: m.pushName || "User",
                banned: false,
                premium: false,
                warn: 0,
                limit: 20
            };
        }
    }

    // 2. Synchronize Group
    if (isGroup) {
        let group = db.groups[m.chat];
        if (typeof group !== 'object') db.groups[m.chat] = {};
        if (group) {
            if (!('mute' in group)) group.mute = false;
            if (!('welcome' in group)) group.welcome = true;
            if (!('antilink' in group)) group.antilink = false;
            if (!('setWelcome' in group)) group.setWelcome = '';
        } else {
            db.groups[m.chat] = {
                mute: false,
                welcome: true,
                antilink: false,
                setWelcome: ''
            };
        }
    }

    // 3. Synchronize Bot Settings
    let settings = db.settings;
    if (typeof settings !== 'object') db.settings = defaultData.settings;
};

// Initialize Database globally
global.db = loadDatabase();

// Auto-save every 30 seconds to avoid losing data if the bot shuts down suddenly
setInterval(() => {
    if (global.db) saveDatabase(global.db);
}, 30000);

module.exports = {
    loadDatabase,
    saveDatabase,
    synchronizeData,
    dbPath
};
