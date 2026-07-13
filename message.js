"use strict";

/**
 * Project: DarkX Ultra
 * Owner: MrX Dev
 * Fix: Enabled command execution for the bot's own number (Self-command)
 * Feature: Anti-Delete - Detects and logs deleted messages
 */

const config = require("./settings/config");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { synchronizeData } = require("./library/database");

// Store for deleted messages cache
const deletedMessages = new Map();

module.exports = async (sock, m, chatUpdate) => {
    try {
        const { type, fromMe, chat, sender, body, pushName } = m;
        
        // --- 1. PARSING SYSTEM ---
        const prefix = config.prefix || '.';
        const isCmd = body?.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : "";
        const args = body?.trim().split(/ +/).slice(1) || [];
        const text = args.join(" ");
        const q = text;

        if (!body) return;

        // --- 2. ANTI-DELETE: Store message before processing ---
        if (m.key && !fromMe) {
            const msgId = m.key.id;
            const chatId = m.key.remoteJid || chat;
            const storageKey = `${chatId}_${msgId}`;
            
            // Store message data for anti-delete
            deletedMessages.set(storageKey, {
                message: m,
                body: body,
                sender: sender,
                pushName: pushName,
                timestamp: Date.now(),
                chat: chat,
                key: m.key
            });

            // Clean old entries (older than 10 minutes)
            setTimeout(() => {
                deletedMessages.delete(storageKey);
            }, 600000); // 10 minutes
        }

        // --- 3. ANTI-DELETE: Handle delete events ---
        // Hii inashughulikia ujumbe unapofutwa
        if (chatUpdate && chatUpdate.type === 'notify') {
            try {
                // Check if there's a deleted message in the update
                const msg = chatUpdate.messages?.[0];
                if (msg?.message?.protocolMessage?.type === 0) { // 0 = DELETE
                    const deleteKey = msg.message.protocolMessage.key;
                    const deleteChat = deleteKey.remoteJid;
                    const deleteId = deleteKey.id;
                    const deleteSender = msg.message.protocolMessage.sender || deleteKey.participant;
                    
                    const storageKey = `${deleteChat}_${deleteId}`;
                    const deletedData = deletedMessages.get(storageKey);
                    
                    if (deletedData && config.antiDelete) {
                        const deletedBody = deletedData.body || "📝 *No text content*";
                        const deletedSender = deletedData.sender || deleteSender;
                        const deletedName = deletedData.pushName || "Unknown";
                        
                        // Format anti-delete message
                        const antiDeleteMsg = `⚠️ *MESSAGE DELETED DETECTED!*\n\n` +
                                             `👤 *Sender:* ${deletedName}\n` +
                                             `📱 *Number:* ${deletedSender.split('@')[0]}\n` +
                                             `📝 *Message:* ${deletedBody}\n` +
                                             `🕐 *Deleted at:* ${new Date().toLocaleTimeString()}`;
                        
                        // Send to chat where message was deleted
                        await sock.sendMessage(deleteChat, {
                            text: antiDeleteMsg
                        });
                        
                        // Also send to owner if configured
                        if (config.antiDeleteNotifyOwner) {
                            const ownerJid = (config.ownerNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                            await sock.sendMessage(ownerJid, {
                                text: `🔴 *ANTI-DELETE REPORT*\n\n${antiDeleteMsg}`
                            });
                        }
                        
                        // Remove from cache after processing
                        deletedMessages.delete(storageKey);
                    }
                }
            } catch (deleteError) {
                console.error(chalk.red("Anti-Delete Error:"), deleteError.message);
            }
        }

        // --- 4. SELF-RESPONSE LOGIC ---
        if (fromMe && !isCmd) return;

        // Synchronize Database
        if (global.db) synchronizeData(m, sock);

        // --- 5. PERMISSIONS & METADATA ---
        const isGroup = chat.endsWith('@g.us');
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        let groupMetadata, participants, groupAdmins, isAdmin, isBotAdmin;
        if (isGroup) {
            groupMetadata = await sock.groupMetadata(chat).catch(() => null);
            if (groupMetadata) {
                participants = groupMetadata.participants || [];
                groupAdmins = participants.filter(v => v.admin !== null).map(v => v.id);
                isAdmin = groupAdmins.includes(sender);
                isBotAdmin = groupAdmins.includes(botId);
            }
        }

        // Namba ya Owner kutoka config
        const ownerJid = (config.ownerNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
        const isOwner = fromMe || [ownerJid, botId].includes(sender);

        const reply = (teks) => {
            return sock.sendMessage(chat, { text: teks }, { quoted: m });
        };

        // --- 6. PLUGIN ENGINE ---
        if (isCmd && command) {
            const pluginFolder = path.join(__dirname, "plugins");
            if (!fs.existsSync(pluginFolder)) return;

            const pluginFiles = fs.readdirSync(pluginFolder).filter(file => file.endsWith(".js"));

            for (const file of pluginFiles) {
                try {
                    const filePath = path.join(pluginFolder, file);
                    delete require.cache[require.resolve(filePath)];
                    const plugin = require(filePath);

                    const cmdMatch = Array.isArray(plugin.command) 
                        ? plugin.command.some(c => c.toLowerCase() === command) 
                        : plugin.command?.toLowerCase() === command;

                    if (cmdMatch) {
                        // Pre-execution Security Checks
                        if (plugin.isOwner && !isOwner) return reply(config.msg?.owner || "Owner Only!");
                        if (plugin.isGroup && !isGroup) return reply(config.msg?.group || "Group Only!");
                        if (plugin.isAdmin && !isAdmin) return reply(config.msg?.admin || "Admin Only!");
                        if (plugin.isBotAdmin && !isBotAdmin) return reply(config.msg?.botAdmin || "Make me Admin!");

                        // Execution
                        await plugin.execute(sock, m, {
                            args, text, q, reply, config, chatUpdate, isGroup, 
                            isAdmin, isBotAdmin, isOwner, participants, groupMetadata, pushName, command
                        });
                        return; 
                    }
                } catch (err) {
                    console.error(chalk.red(`[PLUGIN ERROR] ${file}:`), err.message);
                    continue; 
                }
            }
        }
    } catch (err) {
        console.error(chalk.red("CRITICAL ERROR in message.js:"), err);
    }
};