"use strict";

/**
 * Admin-only tools:
 *  - simple password login (issues a short-lived token)
 *  - a global list of banned WhatsApp numbers (blocked from using the bot
 *    on ANY connected session, not just one)
 *
 * This is intentionally simple (single shared password) since it's meant
 * for one trusted operator, not a multi-admin system.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const BANNED_PATH = path.join(__dirname, '..', 'bannedNumbers.json');

function loadBanned() {
    try {
        if (!fs.existsSync(BANNED_PATH)) {
            fs.writeFileSync(BANNED_PATH, JSON.stringify([], null, 2));
            return [];
        }
        return JSON.parse(fs.readFileSync(BANNED_PATH, 'utf-8'));
    } catch (err) {
        console.error('Failed to read banned numbers file:', err.message);
        return [];
    }
}

function saveBanned(list) {
    try {
        fs.writeFileSync(BANNED_PATH, JSON.stringify(list, null, 2));
    } catch (err) {
        console.error('Failed to save banned numbers file:', err.message);
    }
}

let banned = new Set(loadBanned());

function isBanned(jidOrNumber) {
    const num = String(jidOrNumber || '').split('@')[0].replace(/[^0-9]/g, '');
    return banned.has(num);
}

function banNumber(number) {
    const num = String(number || '').replace(/[^0-9]/g, '');
    if (!num) return false;
    banned.add(num);
    saveBanned([...banned]);
    return true;
}

function unbanNumber(number) {
    const num = String(number || '').replace(/[^0-9]/g, '');
    banned.delete(num);
    saveBanned([...banned]);
    return true;
}

function listBanned() {
    return [...banned];
}

// --- Admin session tokens (in-memory) ---
const adminTokens = new Map(); // token -> expiry

function adminLogin(password) {
    if (password !== ADMIN_PASSWORD) return null;
    const token = crypto.randomBytes(24).toString('hex');
    adminTokens.set(token, Date.now() + 12 * 60 * 60 * 1000); // 12h
    return token;
}

function isAdminToken(token) {
    const expiry = adminTokens.get(token);
    if (!expiry) return false;
    if (Date.now() > expiry) {
        adminTokens.delete(token);
        return false;
    }
    return true;
}

module.exports = {
    isBanned,
    banNumber,
    unbanNumber,
    listBanned,
    adminLogin,
    isAdminToken,
};
