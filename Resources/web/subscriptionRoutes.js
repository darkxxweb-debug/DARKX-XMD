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
        const plans = await sub.getPlansWithPricing();
        res.json({
            plan: acc.plan,
            planLabel: plans[acc.plan].label,
            planExpiresAt: acc.planExpiresAt,
            fullAccess: sub.hasFullAccess(acc),
            promoExpiresAt: acc.promoExpiresAt,
            purchasedCommands: acc.purchasedCommands || [],
            allowedCommands: sub.allowedCommands(acc), // null = unlimited (full access)
            starterSessionDeadline: deadline,
            maxBots: plans[acc.plan].maxBots,
            linkedBots: acc.linkedBots || [],
            referralCode: acc._id,
            referralStats: acc.referralStats,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pricing + purchasable command catalog — used to render the Subscribe
// screen (weekly/monthly cards + the "pick 5 commands" picker).
router.get("/pricing", requireLogin, async (req, res) => {
    try {
        const pricing = await sub.getPricing();
        const commands = sub.listPurchasableCommands();
        res.json({ pricing, commands });
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
        const { plan, transactionRef, payerNumber } = req.body || {};
        const tx = await transactions.createPlanRequest(req.number, plan, transactionRef, payerNumber);
        res.json({ ok: true, message: "Your payment request was submitted. Please wait for admin verification.", transaction: tx });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Buy a one-off command pack: user picks up to `commandPackSize` commands,
// pays `commandPackPrice`, and — once admin approves the transaction —
// those commands are permanently unlocked (no expiry).
router.post("/commands/request", requireLogin, async (req, res) => {
    try {
        const { commands, transactionRef, payerNumber } = req.body || {};
        const tx = await transactions.createCommandsRequest(req.number, commands, transactionRef, payerNumber);
        res.json({ ok: true, message: "Your command pack request was submitted. Please wait for admin verification.", transaction: tx });
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
