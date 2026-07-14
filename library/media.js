"use strict";

/**
 * Small helper that finds the media (image/video/audio) attached to the
 * current message OR to the message it is replying to (quoted), then
 * downloads it as a Buffer using Baileys' own downloader.
 */
const getMediaFromMessage = async (sock, m) => {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

    let target = null;
    let mimetype = null;

    if (m.msg?.mimetype) {
        target = m;
        mimetype = m.msg.mimetype;
    } else if (m.quoted?.mimetype) {
        target = { key: m.quoted.key, message: m.quoted.message };
        mimetype = m.quoted.mimetype;
    }

    if (!target) return null;

    const buffer = await downloadMediaMessage(target, 'buffer', {});
    return { buffer, mimetype };
};

module.exports = { getMediaFromMessage };
