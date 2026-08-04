"use strict";

/**
 * Subscription engine: plans, per-plan command access, per-account bot
 * connection limits, starter session time limit (+ referral bonus hours),
 * and referral bookkeeping. Everything lives in MongoDB (collection
 * "accounts") so it survives restarts/redeploys on Render.
 */

const fs = require("fs");
const path = require("path");
const { getDb } = require("./mongo");

const PLANS = {
    starter: { label: "Starter", price: 0, days: null, maxBots: 1 },
    lite: { label: "Lite", price: 1000, days: 30, maxBots: 1 },
    pro: { label: "Pro", price: 3000, days: 30, maxBots: 3 },
};

// ─────────────────────────────────────────────────────────────────────
// Plan → command access is now driven directly by each plugin's
// `category` field (see /plugins/*.js), instead of a hand-maintained
// list. This keeps the menu and the actual enforcement (message.js)
// perfectly in sync — whatever the menu shows unlocked is exactly
// what will run.
//
//   • STARTER (free) → only "info"-category commands (+ the menu
//     itself), so new users can look around before subscribing.
//   • LITE             → everything EXCEPT "tools" and "download"/
//     "downloader" category commands.
//   • PRO               → everything, no restriction (null).
// ─────────────────────────────────────────────────────────────────────
const PLUGIN_DIR = path.join(__dirname, "..", "plugins");
const INFO_CATEGORIES = ["info"];
const TOOLS_DOWNLOAD_CATEGORIES = ["tools", "download", "downloader"];
const ALWAYS_ALLOWED_CATEGORIES = ["main"]; // the menu/help command itself, on every plan

function loadPluginMeta() {
    const list = [];
    let files = [];
    try {
        files = fs.readdirSync(PLUGIN_DIR).filter((f) => f.endsWith(".js"));
    } catch {
        return list;
    }
    for (const file of files) {
        try {
            const fullPath = path.join(PLUGIN_DIR, file);
            delete require.cache[require.resolve(fullPath)];
            const plugin = require(fullPath);
            if (!plugin.command) continue;
            const names = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
            const category = String(plugin.category || "").toLowerCase().trim();
            for (const name of names) {
                list.push({ name: String(name).toLowerCase(), category });
            }
        } catch {
            continue;
        }
    }
    return list;
}

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

    const meta = loadPluginMeta();

    if (plan === "lite") {
        return meta
            .filter((p) => !TOOLS_DOWNLOAD_CATEGORIES.includes(p.category))
            .map((p) => p.name);
    }

    // starter: info-category commands + the menu itself
    return meta
        .filter((p) => INFO_CATEGORIES.includes(p.category) || ALWAYS_ALLOWED_CATEGORIES.includes(p.category))
        .map((p) => p.name);
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
