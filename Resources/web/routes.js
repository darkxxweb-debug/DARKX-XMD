"use strict";

/**
 * REST endpoints backing the "Login / Settings" panel on the web
 * dashboard. Separate from the pairing socket.io flow in socket.js.
 *
 * Flow:
 *   1. POST /api/login/request  { number } -> sends a 6-digit code to
 *      that number's own WhatsApp (it must already be linked/connected).
 *   2. POST /api/login/verify   { number, code } -> returns a session
 *      token if the code matches.
 *   3. GET  /api/settings       (Authorization: Bearer <token>) -> current
 *      settings for that number.
 *   4. POST /api/settings       (Authorization: Bearer <token>) -> updates
 *      settings (owner number, owner name, bot name, status emojis,
 *      anti-link, etc.)
 */

const express = require('express');
const { activeSockets } = require('../../index');
const {
    getSettings,
    updateSettings,
    createLoginCode,
    verifyLoginCode,
    resolveToken,
} = require('../../library/settingsStore');

const router = express.Router();

function normalizeNumber(raw) {
    return String(raw || '').replace(/[^0-9]/g, '');
}

function getTokenFromRequest(req) {
    const header = req.headers['authorization'] || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
    return req.body?.token || req.query?.token || null;
}

router.get('/status/:number', (req, res) => {
    const number = normalizeNumber(req.params.number);
    res.json({ connected: !!activeSockets[number] });
});

router.post('/login/request', async (req, res) => {
    const number = normalizeNumber(req.body?.number);
    if (!number || number.length < 9) {
        return res.status(400).json({ error: 'Please enter a valid phone number with country code.' });
    }

    const sock = activeSockets[number];
    if (!sock) {
        return res.status(404).json({ error: 'This number is not linked yet. Please link it first using the "Link Device" tab.' });
    }

    try {
        const code = createLoginCode(number);
        await sock.sendMessage(number + '@s.whatsapp.net', {
            text: `🔐 *DarkX-Ultra Login*\n\nYour verification code is: *${code}*\nThis code expires in 5 minutes.\n\nIf you did not request this, you can ignore this message.`,
        });
        res.json({ ok: true, message: 'A verification code has been sent to your WhatsApp.' });
    } catch (err) {
        console.error('Login code send error:', err.message);
        res.status(500).json({ error: 'Could not send the verification code. Please try again.' });
    }
});

router.post('/login/verify', (req, res) => {
    const number = normalizeNumber(req.body?.number);
    const code = req.body?.code;
    if (!number || !code) {
        return res.status(400).json({ error: 'Number and code are required.' });
    }

    const token = verifyLoginCode(number, code);
    if (!token) {
        return res.status(401).json({ error: 'Invalid or expired code.' });
    }

    res.json({ token, number });
});

router.get('/settings', (req, res) => {
    const token = getTokenFromRequest(req);
    const number = token && resolveToken(token);
    if (!number) return res.status(401).json({ error: 'Please log in again.' });

    res.json({ number, connected: !!activeSockets[number], settings: getSettings(number) });
});

router.post('/settings', (req, res) => {
    const token = getTokenFromRequest(req);
    const number = token && resolveToken(token);
    if (!number) return res.status(401).json({ error: 'Please log in again.' });

    const updated = updateSettings(number, req.body || {});
    res.json({ ok: true, settings: updated });
});

module.exports = router;
