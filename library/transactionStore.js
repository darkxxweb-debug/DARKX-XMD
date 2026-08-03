"use strict";

/**
 * Pending/approved/rejected subscription payment requests. User submits a
 * mobile-money transaction reference, admin manually verifies it against
 * their TigoPesa account and approves or rejects it from the admin panel.
 */

const crypto = require("crypto");
const { getDb } = require("./mongo");
const { PLANS, setPlan, applyPurchaseBonuses } = require("./subscriptionStore");

async function col() {
    const db = await getDb();
    return db.collection("transactions");
}

function normalize(number) {
    return String(number || "").replace(/[^0-9]/g, "");
}

async function createRequest(number, plan, transactionRef, payerNumber) {
    const info = PLANS[plan];
    if (!info || !info.price) throw new Error("Invalid package selected.");

    const tx = {
        _id: crypto.randomBytes(8).toString("hex"),
        number: normalize(number),
        payerNumber: payerNumber ? normalize(payerNumber) : normalize(number),
        plan,
        amount: info.price,
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

    await applyPurchaseBonuses(tx.number, tx.plan, tx.amount);
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

module.exports = { createRequest, list, approve, reject };
