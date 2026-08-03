"use strict";

/**
 * Subscription engine: plans, per-plan command access, per-account bot
 * connection limits, starter session time limit (+ referral bonus hours),
 * and referral bookkeeping. Everything lives in MongoDB (collection
 * "accounts") so it survives restarts/redeploys on Render.
 */

const { getDb } = require("./mongo");

const PLANS = {
    starter: { label: "Starter", price: 0, days: null, maxBots: 1 },
    lite: { label: "Lite", price: 1000, days: 30, maxBots: 1 },
    pro: { label: "Pro", price: 3000, days: 30, maxBots: 3 },
};

// Starter (free) plan: only these commands work. Everything else shows
// the "please subscribe" message.
const STARTER_COMMANDS = ["ping", "repo", "quran", "list", "yts"];

// Lite plan unlocks these on top of the starter set (hand-picked mix).
const LITE_EXTRA_COMMANDS = [
    "sticker", "toimg", "toaudio", "tovideo", "qc", "attp",
    "igdl", "igdl2", "fb", "video", "movie", "weather",
    "tagall", "hidetag", "poll", "groupinfo", "welcome", "goodbye",
];

const STARTER_SESSION_HOURS = 5;

function normalize(number) {
    return String(number || "").replace(/[^0-9]/g, "");
}

async function col() {
    const db = await getDb();
    return db.collection("accounts");
}

function defaultAccount(id) {
    return {
        _id: id,
        plan: "starter",
        planExpiresAt: null,
        linkedBots: [],
        referredBy: null,
        freeBonusHours: 0,
        referralStats: { invited: 0, freeBonusHoursEarned: 0, paidBonusDaysEarned: 0 },
        sessionStartedAt: null, // set each time the starter bot connects
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

async function getAccount(number) {
    const id = normalize(number);
    const c = await col();
    let acc = await c.findOne({ _id: id });
    if (!acc) {
        acc = defaultAccount(id);
        await c.insertOne(acc);
    }
    // Auto-downgrade if a paid plan expired
    if (acc.plan !== "starter" && acc.planExpiresAt && new Date(acc.planExpiresAt) < new Date()) {
        acc.plan = "starter";
        acc.planExpiresAt = null;
        await c.updateOne({ _id: id }, { $set: { plan: "starter", planExpiresAt: null, updatedAt: new Date() } });
    }
    return acc;
}

/** Sets/extends a paid plan for `number`, adding `days` from now (or from
 * the current expiry if it hasn't lapsed yet, so renewals stack). */
async function setPlan(number, plan, days) {
    const id = normalize(number);
    const c = await col();
    const acc = await getAccount(id);
    const base = acc.plan === plan && acc.planExpiresAt && new Date(acc.planExpiresAt) > new Date()
        ? new Date(acc.planExpiresAt)
        : new Date();
    const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await c.updateOne({ _id: id }, { $set: { plan, planExpiresAt: expires, updatedAt: new Date() } });
    return getAccount(id);
}

/** Adds bonus days onto whatever plan the account currently has. If the
 * account is still on the free "starter" plan, bonus days are converted
 * into bonus hours on the starter session clock instead. */
async function addBonusDays(number, days) {
    const id = normalize(number);
    const acc = await getAccount(id);
    if (acc.plan === "starter") {
        return addBonusHours(id, Math.round(days * 24));
    }
    return setPlan(id, acc.plan, days);
}

async function addBonusHours(number, hours) {
    const id = normalize(number);
    const c = await col();
    await c.updateOne(
        { _id: id },
        { $inc: { freeBonusHours: hours, "referralStats.freeBonusHoursEarned": hours }, $set: { updatedAt: new Date() } }
    );
    return getAccount(id);
}

/** Registers `newNumber` as referred by `refNumber` (only once), and
 * instantly grants the referrer +1 free hour, per the referral program. */
async function recordReferralSignup(refNumber, newNumber) {
    const ref = normalize(refNumber);
    const id = normalize(newNumber);
    if (!ref || !id || ref === id) return null;

    const c = await col();
    const existing = await getAccount(id);
    if (existing.referredBy) return existing; // already attributed, don't double count

    await c.updateOne({ _id: id }, { $set: { referredBy: ref, updatedAt: new Date() } });
    await c.updateOne({ _id: ref }, { $inc: { "referralStats.invited": 1 } });
    await addBonusHours(ref, 1);
    return getAccount(id);
}

/** Called after an admin approves a paid transaction. Applies the buyer's
 * own 3% bonus, then — if the buyer was referred — the referrer's 50%-of-
 * amount bonus (converted to bonus days). */
async function applyPurchaseBonuses(buyerNumber, plan, amount) {
    const buyer = normalize(buyerNumber);
    const info = PLANS[plan];
    if (!info) return;

    const buyerBonusDays = Math.max(1, Math.round(info.days * 0.03));
    await setPlan(buyer, plan, info.days + buyerBonusDays);

    const acc = await getAccount(buyer);
    if (acc.referredBy) {
        const pricePerDay = info.price / info.days;
        const referrerBonusDays = Math.max(1, Math.round((amount / 2) / pricePerDay));
        await addBonusDays(acc.referredBy, referrerBonusDays);
        const c = await col();
        await c.updateOne({ _id: acc.referredBy }, { $inc: { "referralStats.paidBonusDaysEarned": referrerBonusDays } });
    }
}

function allowedCommands(plan) {
    if (plan === "pro") return null; // null = no restriction, everything allowed
    if (plan === "lite") return [...STARTER_COMMANDS, ...LITE_EXTRA_COMMANDS];
    return STARTER_COMMANDS;
}

function isCommandAllowed(plan, command) {
    const list = allowedCommands(plan);
    if (list === null) return true;
    return list.includes(String(command || "").toLowerCase());
}

/** Marks the moment a starter-plan session connects, so we can enforce the
 * 5-hour (+ bonus hours) rolling window before auto-disconnecting it. */
async function markSessionStarted(number) {
    const id = normalize(number);
    const c = await col();
    await c.updateOne({ _id: id }, { $set: { sessionStartedAt: new Date(), updatedAt: new Date() } }, { upsert: false });
}

/** Returns null if the account is unrestricted (paid plan, or no session
 * started yet); otherwise the Date at which the starter session should be
 * force-disconnected. */
async function getStarterSessionDeadline(number) {
    const acc = await getAccount(number);
    if (acc.plan !== "starter") return null;
    if (!acc.sessionStartedAt) return null;
    const totalHours = STARTER_SESSION_HOURS + (acc.freeBonusHours || 0);
    return new Date(new Date(acc.sessionStartedAt).getTime() + totalHours * 60 * 60 * 1000);
}

async function canConnectAnotherBot(number) {
    const acc = await getAccount(number);
    const info = PLANS[acc.plan];
    return (acc.linkedBots || []).length + 1 < info.maxBots; // +1 counts the primary number itself
}

async function addLinkedBot(number, botNumber) {
    const id = normalize(number);
    const c = await col();
    await c.updateOne({ _id: id }, { $addToSet: { linkedBots: normalize(botNumber) }, $set: { updatedAt: new Date() } });
    return getAccount(id);
}

module.exports = {
    PLANS,
    STARTER_COMMANDS,
    LITE_EXTRA_COMMANDS,
    getAccount,
    setPlan,
    addBonusDays,
    addBonusHours,
    recordReferralSignup,
    applyPurchaseBonuses,
    allowedCommands,
    isCommandAllowed,
    markSessionStarted,
    getStarterSessionDeadline,
    canConnectAnotherBot,
    addLinkedBot,
};
