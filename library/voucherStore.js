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

async function generate({ plan, durationDays, maxUses }) {
    if (!PLANS[plan] || plan === "starter") throw new Error("Voucher must grant lite or pro.");
    const c = await col();
    const voucher = {
        _id: generateCode(),
        plan,
        durationDays: Number(durationDays) || 30,
        maxUses: Number(maxUses) || 1,
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
    if (voucher.usedBy.includes(num)) throw new Error("You've already redeemed this voucher.");
    if (voucher.usedBy.length >= voucher.maxUses) throw new Error("This voucher has already reached its usage limit.");

    await setPlan(num, voucher.plan, voucher.durationDays);
    await c.updateOne({ _id: id }, { $push: { usedBy: num } });
    return { plan: voucher.plan, durationDays: voucher.durationDays };
}

async function deactivate(code) {
    const c = await col();
    await c.updateOne({ _id: String(code).toUpperCase() }, { $set: { active: false } });
}

module.exports = { generate, list, redeem, deactivate };
