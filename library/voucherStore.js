"use strict";

const crypto = require("crypto");
const { getDb } = require("./mongo");
const { setPlan, PLANS } = require("./subscriptionStore");

async function col() {
    const db = await getDb();
    return db.collection("vouchers");
}

function normalize(number) {
    return String(number || "").replace(/[^0-9]/g, "");
}

function generateCode() {
    return "DX-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function generate({ plan, durationDays, targetNumber }) {
    if (!PLANS[plan] || plan === "starter") throw new Error("Voucher must grant a weekly or monthly plan.");
    const target = normalize(targetNumber);
    if (!target) throw new Error("A recipient number is required to generate a voucher.");

    const c = await col();
    const voucher = {
        _id: generateCode(),
        plan,
        durationDays: Number(durationDays) || 30,
        // Vouchers are always single-use: the code is technically public/
        // shareable, but whoever redeems it FIRST claims it exclusively —
        // it can never be redeemed a second time by anyone else.
        maxUses: 1,
        targetNumber: target, // who the admin generated this voucher for (record-keeping)
        claimedBy: null,      // set to the redeemer's number once redeemed
        usedBy: [],
        active: true,
        createdAt: new Date(),
    };
    await c.insertOne(voucher);
    return voucher;
}

async function list() {
    const c = await col();
    return c.find({}).sort({ createdAt: -1 }).limit(200).toArray();
}

async function redeem(code, number) {
    const c = await col();
    const id = String(code || "").trim().toUpperCase();
    const num = normalize(number);
    const voucher = await c.findOne({ _id: id });

    if (!voucher || !voucher.active) throw new Error("Invalid or inactive voucher code.");
    if (voucher.claimedBy) {
        throw new Error(
            voucher.claimedBy === num
                ? "You've already redeemed this voucher."
                : "This voucher has already been claimed by someone else."
        );
    }

    // First redeemer wins: the voucher is locked to them exclusively and
    // can never be used again by anyone, including the original claimant.
    await setPlan(num, voucher.plan, voucher.durationDays);
    await c.updateOne(
        { _id: id, claimedBy: null },
        { $set: { claimedBy: num, active: false }, $push: { usedBy: num } }
    );
    return { plan: voucher.plan, durationDays: voucher.durationDays };
}

async function deactivate(code) {
    const c = await col();
    await c.updateOne({ _id: String(code).toUpperCase() }, { $set: { active: false } });
}

module.exports = { generate, list, redeem, deactivate };
