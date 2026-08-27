"use strict";

/**
 * Subscription engine v2.
 *
 * Pricing model:
 *   - FREE FOREVER, for everyone, no plan needed: auto-view-status and
 *     auto-typing (these are plain settings toggles handled in index.js
 *     and were never gated here -- nothing to do for them in this file).
 *   - Every other command must be unlocked, in one of two ways:
 *       1. A time-limited PLAN (weekly or monthly) unlocks ALL commands
 *          for the duration of the plan only ("limited" -- access ends
 *          when the plan expires).
 *       2. A one-off COMMAND PACK purchase (default: 5 commands for a
 *          flat price) permanently unlocks exactly the commands the
 *          user picked -- "unlimited" in the sense it never expires,
 *          but it only covers those specific commands.
 *   - An admin PROMO ("offer") can also grant temporary full access to
 *     one number or to everyone, independent of plan/commands -- used
 *     for giveaways / campaigns.
 *   - Prices (weekly, monthly, command-pack) and the command-pack size
 *     are admin-editable at runtime (see getPricing/setPricing) so the
 *     admin can set custom pricing later without a code change.
 *
 * Everything lives in MongoDB (collection "accounts", plus a single
 * "pricing" config document) so it survives restarts/redeploys.
 */

const fs = require("fs");
const path = require("path");
const { getDb } = require("./mongo");

// Static plan metadata (label / duration / bot-connection limit).
// Prices are NOT here -- they live in the admin-editable pricing doc,
// see getPricing()/setPricing() below.
const PLANS = {
    starter: { label: "Starter", days: null, maxBots: 1 },
    weekly: { label: "Weekly", days: 7, maxBots: 1 },
    monthly: { label: "Monthly", days: 30, maxBots: 3 },
};

const DEFAULT_PRICING = {
    weeklyPrice: 1000,
    monthlyPrice: 3000,
    commandPackPrice: 500,
    commandPackSize: 5,
};

const PLUGIN_DIR = path.join(__dirname, "..", "plugins");
// Commands in this category are always free for everyone (the menu/help
// command itself), regardless of plan, purchases, or promo status.
const ALWAYS_ALLOWED_CATEGORIES = ["main"];

const STARTER_SESSION_HOURS = 5;

function normalize(number) {
    return String(number || "").replace(/[^0-9]/g, "");
}

async function col() {
    const db = await getDb();
    return db.collection("accounts");
}

async function pricingCol() {
    const db = await getDb();
    return db.collection("pricing");
}

// -----------------------------------------------------------------------
// Pricing (admin-editable)
// -----------------------------------------------------------------------

async function getPricing() {
    const c = await pricingCol();
    let doc = await c.findOne({ _id: "config" });
    if (!doc) {
        doc = { _id: "config", ...DEFAULT_PRICING };
        await c.insertOne(doc);
    }
    // Backfill any field that might be missing (e.g. after an upgrade).
    return { ...DEFAULT_PRICING, ...doc };
}

/** Admin-only: update one or more prices / the command-pack size. Any
 * field left out keeps its current value. */
async function setPricing(update) {
    const current = await getPricing();
    const next = { ...current };

    for (const key of ["weeklyPrice", "monthlyPrice", "commandPackPrice", "commandPackSize"]) {
        if (update[key] === undefined || update[key] === null || update[key] === "") continue;
        const n = Number(update[key]);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid value for ${key}.`);
        next[key] = key === "commandPackSize" ? Math.max(1, Math.round(n)) : Math.round(n);
    }

    const c = await pricingCol();
    await c.updateOne({ _id: "config" }, { $set: next }, { upsert: true });
    return getPricing();
}

/** Convenience: PLANS merged with live prices, for display purposes
 * (web UI, menu.js labels, etc). */
async function getPlansWithPricing() {
    const pricing = await getPricing();
    return {
        starter: { ...PLANS.starter, price: 0 },
        weekly: { ...PLANS.weekly, price: pricing.weeklyPrice },
        monthly: { ...PLANS.monthly, price: pricing.monthlyPrice },
    };
}

// -----------------------------------------------------------------------
// Plugin metadata (which commands exist, and their category)
// -----------------------------------------------------------------------

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

/** Commands a user is allowed to individually purchase (everything
 * except the always-free "main"/menu category). Used to render the
 * command picker in the Subscribe UI and to validate purchase requests. */
function listPurchasableCommands() {
    return loadPluginMeta().filter((p) => !ALWAYS_ALLOWED_CATEGORIES.includes(p.category));
}

// -----------------------------------------------------------------------
// Accounts
// -----------------------------------------------------------------------

function defaultAccount(id) {
    return {
        _id: id,
        plan: "starter",
        planExpiresAt: null,
        purchasedCommands: [], // individually-bought commands -- permanent, never expire
        promoExpiresAt: null, // admin-granted temporary full access (offers/campaigns)
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
    // Backfill fields for accounts created before v2.
    if (acc.purchasedCommands === undefined || acc.promoExpiresAt === undefined) {
        acc.purchasedCommands = acc.purchasedCommands || [];
        acc.promoExpiresAt = acc.promoExpiresAt || null;
        await c.updateOne(
            { _id: id },
            { $set: { purchasedCommands: acc.purchasedCommands, promoExpiresAt: acc.promoExpiresAt } }
        );
    }
    // Auto-downgrade if a paid plan expired
    if (acc.plan !== "starter" && acc.planExpiresAt && new Date(acc.planExpiresAt) < new Date()) {
        acc.plan = "starter";
        acc.planExpiresAt = null;
        await c.updateOne({ _id: id }, { $set: { plan: "starter", planExpiresAt: null, updatedAt: new Date() } });
    }
    return acc;
}

/** Sets/extends a paid plan for `number` ("weekly" or "monthly"), adding
 * that plan's fixed duration from now (or from the current expiry if it
 * hasn't lapsed yet, so renewals stack). */
async function setPlan(number, plan, days) {
    const id = normalize(number);
    const c = await col();
    const acc = await getAccount(id);
    const duration = days != null ? Number(days) : PLANS[plan]?.days;
    if (!duration) throw new Error("Invalid plan.");

    const base = acc.plan === plan && acc.planExpiresAt && new Date(acc.planExpiresAt) > new Date()
        ? new Date(acc.planExpiresAt)
        : new Date();
    const expires = new Date(base.getTime() + duration * 24 * 60 * 60 * 1000);
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

/** Called after an admin approves a paid PLAN transaction. Applies the
 * buyer's own 3% bonus, then -- if the buyer was referred -- the referrer's
 * 50%-of-amount bonus (converted to bonus days). */
async function applyPurchaseBonuses(buyerNumber, plan, amount) {
    const buyer = normalize(buyerNumber);
    const info = PLANS[plan];
    if (!info || !info.days) return;

    const buyerBonusDays = Math.max(1, Math.round(info.days * 0.03));
    await setPlan(buyer, plan, info.days + buyerBonusDays);

    const acc = await getAccount(buyer);
    if (acc.referredBy) {
        const pricePerDay = amount / info.days;
        const referrerBonusDays = pricePerDay > 0 ? Math.max(1, Math.round((amount / 2) / pricePerDay)) : 1;
        await addBonusDays(acc.referredBy, referrerBonusDays);
        const c = await col();
        await c.updateOne({ _id: acc.referredBy }, { $inc: { "referralStats.paidBonusDaysEarned": referrerBonusDays } });
    }
}

/** Called after an admin approves a COMMAND PACK transaction. Permanently
 * unlocks the chosen commands for that number (never expires). */
async function purchaseCommands(number, commands) {
    const id = normalize(number);
    const pricing = await getPricing();
    const valid = new Set(listPurchasableCommands().map((p) => p.name));
    const chosen = Array.from(new Set((commands || []).map((c) => String(c).toLowerCase().trim())))
        .filter((c) => valid.has(c));

    if (!chosen.length) throw new Error("No valid commands were selected.");
    if (chosen.length > pricing.commandPackSize) {
        throw new Error(`You can only pick up to ${pricing.commandPackSize} commands per pack.`);
    }

    const c = await col();
    await c.updateOne(
        { _id: id },
        { $addToSet: { purchasedCommands: { $each: chosen } }, $set: { updatedAt: new Date() } }
    );
    return getAccount(id);
}

// -----------------------------------------------------------------------
// Admin promo / offers -- grant temporary full command access
// -----------------------------------------------------------------------

/** Extends (or starts) an account's promo window by `days`, stacking on
 * top of any still-active promo. */
async function grantPromoDays(number, days) {
    const id = normalize(number);
    const c = await col();
    const acc = await getAccount(id);
    const base = acc.promoExpiresAt && new Date(acc.promoExpiresAt) > new Date()
        ? new Date(acc.promoExpiresAt)
        : new Date();
    const expires = new Date(base.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    await c.updateOne({ _id: id }, { $set: { promoExpiresAt: expires, updatedAt: new Date() } });
    return expires;
}

/** Admin "offer" action: grant `days` of full access to a single number,
 * or to every known account when `target` is "all". Returns how many
 * accounts were affected. */
async function addPromoOffer(target, days) {
    const numDays = Number(days);
    if (!numDays || numDays <= 0) throw new Error("Please provide a valid number of days.");

    if (String(target).toLowerCase() === "all") {
        const c = await col();
        const ids = await c.find({}, { projection: { _id: 1 } }).toArray();
        for (const { _id } of ids) {
            await grantPromoDays(_id, numDays);
        }
        return { count: ids.length };
    }

    const id = normalize(target);
    if (!id) throw new Error("Please provide a valid number.");
    await grantPromoDays(id, numDays);
    return { count: 1 };
}

// -----------------------------------------------------------------------
// Access checks
// -----------------------------------------------------------------------

function hasFullAccess(account) {
    const now = new Date();
    if (account.promoExpiresAt && new Date(account.promoExpiresAt) > now) return true;
    if (account.plan !== "starter" && account.planExpiresAt && new Date(account.planExpiresAt) > now) return true;
    return false;
}

/** Returns null when the account has full access (unlimited); otherwise
 * the list of commands it may run (always-free "main" commands + any
 * individually purchased commands). */
function allowedCommands(account) {
    const meta = loadPluginMeta();
    const freeAlways = meta
        .filter((p) => ALWAYS_ALLOWED_CATEGORIES.includes(p.category))
        .map((p) => p.name);

    if (hasFullAccess(account)) return null;

    return Array.from(new Set([...freeAlways, ...(account.purchasedCommands || [])]));
}

function isCommandAllowed(account, command) {
    const cmd = String(command || "").toLowerCase();
    const meta = loadPluginMeta();
    const info = meta.find((p) => p.name === cmd);
    if (info && ALWAYS_ALLOWED_CATEGORIES.includes(info.category)) return true;

    if (hasFullAccess(account)) return true;
    return (account.purchasedCommands || []).includes(cmd);
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
    getPricing,
    setPricing,
    getPlansWithPricing,
    listPurchasableCommands,
    getAccount,
    setPlan,
    addBonusDays,
    addBonusHours,
    recordReferralSignup,
    applyPurchaseBonuses,
    purchaseCommands,
    addPromoOffer,
    hasFullAccess,
    allowedCommands,
    isCommandAllowed,
    markSessionStarted,
    getStarterSessionDeadline,
    canConnectAnotherBot,
    addLinkedBot,
};
