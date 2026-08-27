"use strict";

/**
 * Pending/approved/rejected payment requests. User submits a mobile-money
 * transaction reference, admin manually verifies it against their TigoPesa
 * account and approves or rejects it from the admin panel.
 *
 * Two kinds of request, distinguished by `type`:
 *   - "plan"     : buying the weekly/monthly full-access plan.
 *   - "commands" : buying a one-off command pack (specific commands chosen
 *                  by the user, unlocked permanently once approved).
 */

const crypto = require("crypto");
const { getDb } = require("./mongo");
const { PLANS, getPricing, setPlan, applyPurchaseBonuses, purchaseCommands } = require("./subscriptionStore");

async function col() {
    const db = await getDb();
    return db.collection("transactions");
}

function normalize(number) {
    return String(number || "").replace(/[^0-9]/g, "");
}

async function createPlanRequest(number, plan, transactionRef, payerNumber) {
    const info = PLANS[plan];
    if (!info || !info.days) throw new Error("Invalid package selected.");
    const pricing = await getPricing();
    const amount = plan === "weekly" ? pricing.weeklyPrice : pricing.monthlyPrice;

    const tx = {
        _id: crypto.randomBytes(8).toString("hex"),
        type: "plan",
        number: normalize(number),
        payerNumber: payerNumber ? normalize(payerNumber) : normalize(number),
        plan,
        commands: [],
        amount,
        transactionRef: String(transactionRef || "").trim(),
        status: "pending",
        createdAt: new Date(),
        resolvedAt: null,
    };
    if (!tx.transactionRef) throw new Error("Please enter your mobile money transaction number.");

    const c = await col();
    await c.insertOne(tx);
    return tx;
}

async function createCommandsRequest(number, commands, transactionRef, payerNumber) {
    const pricing = await getPricing();
    const chosen = Array.from(new Set((commands || []).map((c) => String(c).toLowerCase().trim()))).filter(Boolean);
    if (!chosen.length) throw new Error("Please choose at least one command.");
    if (chosen.length > pricing.commandPackSize) {
        throw new Error(`You can only pick up to ${pricing.commandPackSize} commands per pack.`);
    }

    const tx = {
        _id: crypto.randomBytes(8).toString("hex"),
        type: "commands",
        number: normalize(number),
        payerNumber: payerNumber ? normalize(payerNumber) : normalize(number),
        plan: null,
        commands: chosen,
        amount: pricing.commandPackPrice,
        transactionRef: String(transactionRef || "").trim(),
        status: "pending",
        createdAt: new Date(),
        resolvedAt: null,
    };
    if (!tx.transactionRef) throw new Error("Please enter your mobile money transaction number.");

    const c = await col();
    await c.insertOne(tx);
    return tx;
}

async function list(status) {
    const c = await col();
    const query = status ? { status } : {};
    return c.find(query).sort({ createdAt: -1 }).limit(200).toArray();
}

async function approve(id) {
    const c = await col();
    const tx = await c.findOne({ _id: id });
    if (!tx) throw new Error("Transaction not found.");
    if (tx.status !== "pending") throw new Error("This transaction was already resolved.");

    if (tx.type === "commands") {
        await purchaseCommands(tx.number, tx.commands);
    } else {
        await applyPurchaseBonuses(tx.number, tx.plan, tx.amount);
    }
    await c.updateOne({ _id: id }, { $set: { status: "approved", resolvedAt: new Date() } });
    return { ...tx, status: "approved" };
}

async function reject(id, reason) {
    const c = await col();
    const tx = await c.findOne({ _id: id });
    if (!tx) throw new Error("Transaction not found.");
    if (tx.status !== "pending") throw new Error("This transaction was already resolved.");

    await c.updateOne({ _id: id }, { $set: { status: "rejected", resolvedAt: new Date(), reason: reason || "" } });
    return { ...tx, status: "rejected" };
}

module.exports = { createPlanRequest, createCommandsRequest, list, approve, reject };
