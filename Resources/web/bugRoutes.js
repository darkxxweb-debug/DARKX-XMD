"use strict";

/**
 * Public "Report a Bug" board. Anyone visiting the site can post a bug
 * report and everyone can see the list (like a public comments feed) —
 * no login required, by design.
 */

const express = require('express');
const { getDb } = require('../../library/mongo');

const router = express.Router();

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const reports = await db.collection('bugReports')
            .find({})
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();

        res.json({
            reports: reports.map((r) => ({
                id: r._id,
                name: r.name,
                message: r.message,
                createdAt: r.createdAt,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not load bug reports right now.' });
    }
});

router.post('/', async (req, res) => {
    const name = (req.body?.name || '').trim().slice(0, 40) || 'Anonymous';
    const message = (req.body?.message || '').trim().slice(0, 500);

    if (!message) {
        return res.status(400).json({ error: 'Please describe the bug before submitting.' });
    }

    try {
        const db = await getDb();
        const doc = {
            name: escapeHtml(name),
            message: escapeHtml(message),
            createdAt: new Date(),
        };
        const result = await db.collection('bugReports').insertOne(doc);
        res.json({ ok: true, report: { id: result.insertedId, ...doc } });
    } catch (err) {
        res.status(500).json({ error: 'Could not submit your report right now.' });
    }
});

module.exports = router;
