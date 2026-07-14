/**
 * DarkX-Ultra AI - Simple keyword-based auto-reply brain used by the
 * .aion / .aioff auto-reply feature.
 */

const config = require("../settings/config");

const knowledgeBase = [
    {
        keywords: ['mambo', 'habari', 'niaje', 'hi', 'hello', 'vipi', 'hey'],
        reply: `
*╔════════════════════╗*
*║      ＤΛＲＫＸ   ΛＩ      ║*
*╚════════════════════╝*

Greetings! I'm *DarkX-Ultra AI*.

I'm here to help you find the right digital solution. Whether you need a powerful *WhatsApp Bot* or a modern *Website*, you're in the right place.

📌 *Quick Start:*
> Type *.list* ➜ View our service menu
> Type *.menu* ➜ View all commands

_"Empowering your vision through code."_`
    },
    {
        keywords: ['bot', 'whatsapp bot', 'make a bot', 'build a bot', 'script', 'baileys'],
        reply: `
*┏━━━━━━◤ 📦 ◢━━━━━━┓*
*┃   ＷＨΛＴＳΛＰＰ   ＢＯＴＳ   ┃*
*┗━━━━━━◣ 📦 ◢━━━━━━┛*

Need an automated system running 24/7? We build bots using *Baileys (Node.js)* with:

✨ *Custom Features*
🚀 *Ultra-Fast Speed*
🔒 *High Security*

Type *.list* now to see our packages.`
    },
    {
        keywords: ['website', 'web', 'build a website', 'hosting'],
        reply: `
*🌐 〔 ＤΞＶΞＬＯＰＭΞＮＴ 〕 🌐*

We build digital bridges! Your website is your online office.
DarkX-Ultra gives you:

⚡ *Responsive Design* (Mobile & PC)
🛠️ *Full Backend Support*
💎 *Premium UI/UX*

Check full details by typing *.list*`
    },
    {
        keywords: ['customize', 'custom', 'special', 'pro'],
        reply: `
*🛠️ ◤ ＣＵＳＴＯＭＩＺΛＴＩＯＮ ◢ 🛠️*

We don't do cookie-cutter work! Tell us what you're imagining and we'll build it:
• A bot to manage your groups?
• A store website?
• A clean logo?

*Talk to the team:*
Type *.owner* to reach out directly, or *.list* to see what we offer.`
    },
    {
        keywords: ['security', 'cybersecurity', 'cyber'],
        reply: `
*🛡️ ◤ ＣＹＢΞＲ  ＳΞＣＵＲＩＴＹ ◢ 🛡️*

We offer:
• Penetration Testing
• Account Security Audits
• Vulnerability Fixes

Detailed pricing? Type *.list*`
    }
];

const getBotResponse = (userInput) => {
    const text = userInput.toLowerCase().trim();

    for (const entry of knowledgeBase) {
        const isMatch = entry.keywords.some((keyword) => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            return regex.test(text);
        });

        if (isMatch) return entry.reply;
    }

    return `
*⚠️ 〔 ＳＹＳＴΞＭ  ＮＯＴＩＣΞ 〕 ⚠️*

Sorry, I didn't recognize that. If you'd like to see our *Bots* and *Website* services, use this command:

👉 *${config.prefix}list*

_DarkX-Ultra v${config.version}_`;
};

module.exports = { getBotResponse };
