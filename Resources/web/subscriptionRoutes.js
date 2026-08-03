"use strict";

const express = require("express");
const { resolveToken } = require("../../library/settingsStore");
const sub = require("../../library/subscriptionStore");
const transactions = require("../../library/transactionStore");
const vouchers = require("../../library/voucherStore");

const router = express.Router();

function requireLogin(req, res, next) {
    const header = req.headers["authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.body?.token || req.query?.token;
    const number = token && resolveToken(token);
    if (!number) return res.status(401).json({ error: "Please log in again." });
    req.number = number;
    next();
}

router.get("/status", requireLogin, async (req, res) => {
    try {
        const acc = await sub.getAccount(req.number);
        const deadline = await sub.getStarterSessionDeadline(req.number);
        res.json({
            plan: acc.plan,
            planLabel: sub.PLANS[acc.plan].label,
            planExpiresAt: acc.planExpiresAt,
            allowedCommands: sub.allowedCommands(acc.plan), // null = unlimited
            starterSessionDeadline: deadline,
            maxBots: sub.PLANS[acc.plan].maxBots,
            linkedBots: acc.linkedBots || [],
            referralCode: acc._id,
            referralStats: acc.referralStats,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/set-referrer", requireLogin, async (req, res) => {
    try {
        const { ref } = req.body || {};
        if (!ref) return res.json({ ok: true });
        await sub.recordReferralSignup(ref, req.number);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/subscribe/request", requireLogin, async (req, res) => {
    try {
        const { plan, transactionRef } = req.body || {};
        const tx = await transactions.createRequest(req.number, plan, transactionRef);
        res.json({ ok: true, message: "Your payment request was submitted. Please wait for admin verification.", transaction: tx });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/voucher/redeem", requireLogin, async (req, res) => {
    try {
        const { code } = req.body || {};
        const result = await vouchers.redeem(code, req.number);
        res.json({ ok: true, message: `✅ Voucher redeemed! ${result.plan.toUpperCase()} unlocked for ${result.durationDays} days.`, result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
