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
const transactions = require('../../library/transactionStore');
const vouchersLib = require('../../library/voucherStore');
const sub = require('../../library/subscriptionStore');
const config = require('../../settings/config');

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

// --- Channel Broadcast: post straight to the WhatsApp Channel whose JID
// is shown in the bot's menu (config.channelJid). Uses the first
// currently-connected session as the sender, since posting to a channel
// requires an active, logged-in WhatsApp socket. ---
router.post('/channel-send', requireAdmin, async (req, res) => {
    const { message, imageUrl } = req.body || {};
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message text is required.' });
    }

    const sessionIds = Object.keys(activeSockets);
    if (!sessionIds.length) {
        return res.status(400).json({ error: 'No connected bot session is available to post from. Connect at least one number first.' });
    }

    const sock = activeSockets[sessionIds[0]];
    const channelJid = config.channelJid;

    try {
        if (imageUrl && imageUrl.trim()) {
            await sock.sendMessage(channelJid, { image: { url: imageUrl.trim() }, caption: message });
        } else {
            await sock.sendMessage(channelJid, { text: message });
        }
        res.json({ ok: true, channelJid, sentFrom: sessionIds[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to post to channel: ' + err.message });
    }
});

// --- Subscription transactions ---
router.get('/transactions', requireAdmin, async (req, res) => {
    try {
        res.json({ transactions: await transactions.list(req.query.status) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/transactions/:id/approve', requireAdmin, async (req, res) => {
    try {
        res.json({ ok: true, transaction: await transactions.approve(req.params.id) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/transactions/:id/reject', requireAdmin, async (req, res) => {
    try {
        res.json({ ok: true, transaction: await transactions.reject(req.params.id, req.body?.reason) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Vouchers ---
router.get('/vouchers', requireAdmin, async (req, res) => {
    try {
        res.json({ vouchers: await vouchersLib.list() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/vouchers', requireAdmin, async (req, res) => {
    try {
        const { plan, durationDays, targetNumber } = req.body || {};
        res.json({ ok: true, voucher: await vouchersLib.generate({ plan, durationDays, targetNumber }) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/vouchers/:code/deactivate', requireAdmin, async (req, res) => {
    try {
        await vouchersLib.deactivate(req.params.code);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Pricing (admin-editable) ---
router.get('/pricing', requireAdmin, async (req, res) => {
    try {
        res.json({ pricing: await sub.getPricing() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pricing', requireAdmin, async (req, res) => {
    try {
        const { weeklyPrice, monthlyPrice, commandPackPrice, commandPackSize } = req.body || {};
        const pricing = await sub.setPricing({ weeklyPrice, monthlyPrice, commandPackPrice, commandPackSize });
        res.json({ ok: true, pricing });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Offers / promos: grant `days` of full command access to one number
// (or "all" connected accounts), independent of any plan or purchase ---
router.post('/offer', requireAdmin, async (req, res) => {
    try {
        const { target, days } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Please choose a target — "all" or a specific number.' });
        const result = await sub.addPromoOffer(target, days);
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
