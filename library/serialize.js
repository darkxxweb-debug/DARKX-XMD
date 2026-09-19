const { jidDecode } = require('@whiskeysockets/baileys');

const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    }
    return jid;
};

/**
 * Turns a raw Baileys message into a friendly "m" object used across
 * message.js and every plugin. Adds quoted-message support and mentions,
 * which the rest of the bot depends on (kick, warn, sticker, tagall, etc).
 */
const smsg = (sock, m) => {
    if (!m) return m;

    const key = m.key;
    if (key) {
        m.id = key.id;
        m.isBaileys = !!(m.id && m.id.startsWith('BAE5') && m.id.length === 16);
        m.chat = key.remoteJid;
        m.fromMe = key.fromMe;
        m.isGroup = !!(m.chat && m.chat.endsWith('@g.us'));
        m.sender = decodeJid((m.fromMe && sock.user.id) || key.participant || m.chat || '');
    }

    if (m.message) {
        m.mtype = Object.keys(m.message)[0];
        m.msg = m.message[m.mtype];

        m.body =
            m.message.conversation ||
            m.msg?.caption ||
            m.msg?.text ||
            (m.mtype === 'listResponseMessage' && m.msg?.singleSelectReply?.selectedRowId) ||
            (m.mtype === 'buttonsResponseMessage' && m.msg?.selectedButtonId) ||
            (m.mtype === 'templateButtonReplyMessage' && m.msg?.selectedId) ||
            '';

        // --- Quoted message support ---
        const contextInfo = m.msg?.contextInfo;
        if (contextInfo && contextInfo.quotedMessage) {
            const qParticipant = contextInfo.participant;
            const qMtype = Object.keys(contextInfo.quotedMessage)[0];
            const qMsg = contextInfo.quotedMessage[qMtype];

            m.quoted = {
                key: {
                    remoteJid: m.chat,
                    fromMe: qParticipant ? decodeJid(qParticipant) === decodeJid(sock.user.id) : false,
                    id: contextInfo.stanzaId,
                    participant: qParticipant,
                },
                message: contextInfo.quotedMessage,
                mtype: qMtype,
                msg: qMsg,
                sender: decodeJid(qParticipant),
                body: contextInfo.quotedMessage.conversation || qMsg?.caption || qMsg?.text || '',
                mimetype: qMsg?.mimetype || null,
            };
        } else {
            m.quoted = null;
        }

        // --- Mentions ---
        m.mentionedJid = contextInfo?.mentionedJid || [];
    }

    return m;
};

module.exports = { smsg, decodeJid };
