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

/** Unwraps viewOnceMessage / viewOnceMessageV2 / viewOnceMessageV2Extension
 * wrappers down to the actual imageMessage/videoMessage inside. */
function unwrapViewOnce(message) {
    if (!message) return null;
    const type = Object.keys(message)[0];
    if (type === "viewOnceMessage" || type === "viewOnceMessageV2" || type === "viewOnceMessageV2Extension") {
        return unwrapViewOnce(message[type].message);
    }
    return message;
}

/** Downloads the media buffer directly out of a raw view-once wrapped
 * message object (as received on messages.upsert), without needing a
 * reply/quote. Returns null if it isn't a view-once photo/video. */
async function getViewOnceMedia(sock, rawMessage) {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const inner = unwrapViewOnce(rawMessage);
    if (!inner) return null;

    const innerType = Object.keys(inner)[0];
    if (!["imageMessage", "videoMessage"].includes(innerType)) return null;

    const buffer = await downloadMediaMessage(
        { message: { [innerType]: inner[innerType] } },
        'buffer',
        {}
    );
    return {
        buffer,
        mimetype: inner[innerType].mimetype,
        caption: inner[innerType].caption || "",
        type: innerType,
    };
}

module.exports = { getMediaFromMessage, unwrapViewOnce, getViewOnceMedia };
