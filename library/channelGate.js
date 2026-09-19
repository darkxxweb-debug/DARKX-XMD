"use strict";

/**
 * Channel gate — every linked number must follow the bot's WhatsApp channel
 * (config.channelJid, default 120363412629669812@newsletter).
 *
 *   1. When a session connects, we check whether that WhatsApp account
 *      already follows the channel. If not, we follow it automatically.
 *   2. Every few minutes we re-check all connected sessions. If a number
 *      has unfollowed, it is warned and then disconnected (its session is
 *      deleted, so it must re-link — and re-linking auto-follows again).
 *
 * Safety rails (so a wrong reading can never wipe out your users):
 *   - We only ever disconnect on a POSITIVE "not following" answer.
 *     Errors / timeouts / unrecognised replies count as "unknown" and are
 *     ignored.
 *   - A session must be "not following" for FOLLOW_STRIKES checks in a row
 *     (default 2) before it is disconnected.
 *   - Nobody is disconnected until at least one account has been READ BACK
 *     as "following" since the server started. If WhatsApp's reply format
 *     is not what this file expects, the check never confirms and the
 *     monitor stays harmless (users are still auto-followed).
 *
 * Environment variables (all optional):
 *   REQUIRE_CHANNEL_FOLLOW=false   turn the whole requirement off
 *   FOLLOW_CHECK_MINUTES=2         how often connected sessions are re-checked
 *   FOLLOW_STRIKES=2               consecutive "not following" checks before disconnect
 *   CHANNEL_JID=...                overrides config.channelJid
 */

const chalkImport = require('chalk');
const chalk = chalkImport.default || chalkImport;
const config = require('../settings/config');

const FOLLOWER_ROLES = new Set(['SUBSCRIBER', 'ADMIN', 'OWNER']);

const isEnabled = () => String(process.env.REQUIRE_CHANNEL_FOLLOW ?? 'true').toLowerCase() !== 'false';
const checkEveryMs = () => Math.max(1, Number(process.env.FOLLOW_CHECK_MINUTES) || 2) * 60_000;
const strikesToKick = () => Math.max(1, Number(process.env.FOLLOW_STRIKES) || 2);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

const connectedAt = new Map(); // sessionId -> timestamp of last 'open'
const strikes = new Map(); // sessionId -> consecutive "not following" checks
const loggedFirstRead = new Set(); // sessions whose first raw reading was already logged
let detectionConfirmed = false; // true once any account has been read back as "following"
let running = false;

/**
 * Returns 'following' | 'not_following' | 'unknown' for this socket's account.
 */
async function getFollowState(sock, sessionId) {
    try {
        const meta = await withTimeout(sock.newsletterMetadata('jid', config.channelJid), 25_000, 'newsletterMetadata');
        if (!meta || !meta.id) return 'unknown';

        const vm = meta.viewer_metadata;
        let state = 'unknown';

        if (vm === null) {
            state = 'not_following';
        } else if (vm && typeof vm === 'object') {
            const role = String(vm.role || '').toUpperCase();
            if (role === 'GUEST') state = 'not_following';
            else if (FOLLOWER_ROLES.has(role) || 'mute' in vm) state = 'following';
        }

        if (sessionId && !loggedFirstRead.has(sessionId)) {
            loggedFirstRead.add(sessionId);
            console.log(chalk.cyan(`📢 Channel check for ${sessionId}: ${state} (viewer_metadata=${JSON.stringify(vm)})`));
        }
        return state;
    } catch (err) {
        console.log(chalk.gray(`📢 Channel check failed for ${sessionId || 'session'}: ${err.message}`));
        return 'unknown';
    }
}

/**
 * Makes sure this account follows the channel: checks first, follows if needed,
 * then reads the result back. Returns the final state.
 */
async function ensureFollowing(sock, sessionId) {
    if (typeof sock.newsletterFollow !== 'function') {
        console.log(chalk.yellow('📢 This Baileys version has no newsletterFollow — channel requirement skipped.'));
        return 'unknown';
    }

    let state = await getFollowState(sock, sessionId);
    if (state === 'following') {
        detectionConfirmed = true;
        return state;
    }

    try {
        await withTimeout(sock.newsletterFollow(config.channelJid), 25_000, 'newsletterFollow');
        console.log(chalk.green(`📢 ${sessionId} now follows the channel automatically.`));
    } catch (err) {
        console.log(chalk.yellow(`📢 Auto-follow failed for ${sessionId}: ${err.message}`));
        return state;
    }

    await sleep(4000);
    state = await getFollowState(sock, sessionId);
    if (state === 'following') {
        detectionConfirmed = true;
    } else {
        console.log(chalk.yellow(`📢 ${sessionId}: follow request went through but the check still says "${state}" — not enforcing until a follow is confirmed.`));
    }
    return state;
}

/**
 * Call when a session's connection opens.
 */
function onConnected(sock, sessionId) {
    if (!isEnabled()) return;
    connectedAt.set(sessionId, Date.now());
    strikes.delete(sessionId);

    // Give the socket a few seconds to settle before talking to the channel API.
    setTimeout(() => {
        ensureFollowing(sock, sessionId).catch(() => {});
    }, 8_000);
}

async function kick(sock, sessionId, { deleteSession, io }) {
    console.log(chalk.red(`📢 ${sessionId} unfollowed the channel — disconnecting.`));
    try {
        await sock.sendMessage(sessionId + '@s.whatsapp.net', {
            text:
                `🚫 *Bot disconnected*\n\nYou unfollowed *${config.channelName}*, and following the channel is required to use this bot.\n\n` +
                `Follow the channel again and re-link your number from the web panel.`,
        });
    } catch (_) {}

    strikes.delete(sessionId);
    connectedAt.delete(sessionId);
    await deleteSession(sessionId);
    if (io) io.emit('disconnected', { number: sessionId, willReconnect: false });
}

/**
 * One pass over every connected session. Exported for testing.
 */
async function checkAllOnce({ activeSockets, deleteSession, io }) {
    if (running) return;
    running = true;
    try {
        for (const sessionId of Object.keys(activeSockets)) {
            const sock = activeSockets[sessionId];
            if (!sock) continue;
            // Leave freshly-connected sessions alone: they are being auto-followed right now.
            if (Date.now() - (connectedAt.get(sessionId) || 0) < 90_000) continue;

            const state = await getFollowState(sock, sessionId);

            if (state === 'following') {
                detectionConfirmed = true;
                strikes.delete(sessionId);
            } else if (state === 'not_following' && detectionConfirmed) {
                const count = (strikes.get(sessionId) || 0) + 1;
                strikes.set(sessionId, count);

                if (count >= strikesToKick()) {
                    await kick(sock, sessionId, { deleteSession, io });
                } else {
                    const minutes = Math.round((checkEveryMs() * (strikesToKick() - count)) / 60_000);
                    try {
                        await sock.sendMessage(sessionId + '@s.whatsapp.net', {
                            text:
                                `⚠️ *Channel required*\n\nYou are no longer following *${config.channelName}*. ` +
                                `Follow it again within about ${minutes} minute(s) or this bot will be disconnected.`,
                        });
                    } catch (_) {}
                }
            }
            // 'unknown' (errors, odd replies) never changes anything.

            await sleep(1500);
        }
    } finally {
        running = false;
    }
}

/**
 * Starts the periodic re-check. Call once from startWatchdog().
 */
function startMonitor(ctx) {
    if (!isEnabled()) {
        console.log(chalk.gray('📢 Channel-follow requirement is OFF (REQUIRE_CHANNEL_FOLLOW=false).'));
        return;
    }
    console.log(chalk.cyan(`📢 Channel-follow requirement is ON for ${config.channelJid} (re-check every ${checkEveryMs() / 60_000} min, ${strikesToKick()} strike(s)).`));
    setInterval(() => {
        checkAllOnce(ctx).catch((err) => console.log(chalk.red('📢 Channel monitor error:'), err.message));
    }, checkEveryMs());
}

module.exports = { onConnected, startMonitor, checkAllOnce, ensureFollowing, getFollowState };
