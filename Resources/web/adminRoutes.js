"use strict";

/**
 * Admin-only REST endpoints: password login, session management
 * (list/delete), number banning, and the broadcast notification tool.
 * Everything here requires a valid admin token (see adminStore.js).
 */

const express = require('express');
const { activeSockets, deleteSession, listAllSessions } = require('../../index');
const { getSettings } = require('../../library/settingsStore');
const { isBanned, banNumber, unbanNumber, listBanned, adminLogin, isAdminToken } = require('../../library/adminStore');

const router = express.Router();

function requireAdmin(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.body?.token || req.query?.token;
    if (!token || !isAdminToken(token)) {
        return res.status(401).json({ error: 'Admin authentication required.' });
    }
    next();
}

router.post('/login', (req, res) => {
    const { password } = req.body || {};
    const token = adminLogin(password);
    if (!token) return res.status(401).json({ error: 'Incorrect admin password.' });
    res.json({ token });
});

router.get('/sessions', requireAdmin, async (req, res) => {
    try {
        res.json({ sessions: await listAllSessions() });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load sessions: ' + err.message });
    }
});

router.delete('/sessions/:number', requireAdmin, async (req, res) => {
    try {
        await deleteSession(req.params.number);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete session: ' + err.message });
    }
});

router.get('/banned', requireAdmin, (req, res) => {
    res.json({ banned: listBanned() });
});

router.post('/ban', requireAdmin, (req, res) => {
    const { number } = req.body || {};
    if (!number) return res.status(400).json({ error: 'Number is required.' });
    banNumber(number);
    res.json({ ok: true, banned: listBanned() });
});

router.post('/unban', requireAdmin, (req, res) => {
    const { number } = req.body || {};
    if (!number) return res.status(400).json({ error: 'Number is required.' });
    unbanNumber(number);
    res.json({ ok: true, banned: listBanned() });
});

// --- Broadcast notification: sent from every connected bot to its own owner ---
router.post('/notify', requireAdmin, async (req, res) => {
    const { message, imageUrl } = req.body || {};
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message text is required.' });
    }

    const results = [];
    for (const sessionId of Object.keys(activeSockets)) {
        const sock = activeSockets[sessionId];
        const settings = getSettings(sessionId);
        const ownerJid = settings.ownerNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

        try {
            if (imageUrl && imageUrl.trim()) {
                await sock.sendMessage(ownerJid, { image: { url: imageUrl.trim() }, caption: message });
            } else {
                await sock.sendMessage(ownerJid, { text: message });
            }
            results.push({ session: sessionId, owner: settings.ownerNumber, ok: true });
        } catch (err) {
            results.push({ session: sessionId, owner: settings.ownerNumber, ok: false, error: err.message });
        }
    }

    res.json({ ok: true, sent: results.filter((r) => r.ok).length, total: results.length, results });
});

module.exports = router;
