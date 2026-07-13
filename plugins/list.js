const config = require("../settings/config");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["list", "price", "1", "2", "3", "4", "5"],
    category: "business",
    execute: async (sock, m, { args, reply }) => {
        try {
            // Kusafisha input ili kusoma namba au amri
            const input = m.body.trim().replace(config.prefix, ""); 
            const imagePath = path.resolve(__dirname, "../media/repo.jpg");
            const audioPath = path.resolve(__dirname, "../media/repo.mp3");

            // 1. MAIN BUSINESS CATALOG (Detailed & Fancy Fonts)
            if (input === "list" || input === "price") {
                const businessList = `
┏━━━━━━━◥◣◆◢◤━━━━━━━┓
     *DΛЯKX SӨᄂЦƬIӨПS*
┗━━━━━━━◥◣◆◢◤━━━━━━━┛

*〔 👤 Oᴡɴᴇʀ 〕:* ${config.ownerName}
*〔 📊 Sᴛᴀᴛᴜs 〕:* ᴀᴄᴛɪᴠᴇ ✅
*〔 🛠️ Exᴘᴇʀᴛɪsᴇ 〕:* ᴅᴇᴠᴇʟᴏᴘᴍᴇɴᴛ

*SΞLΞCƬ Λ SΞЯVICΞ BΞLӨW:*
_Reply with the number to view more info_

⒈ ➜ 𝖣𝖺𝗋𝗄𝖷 𝖮𝖿𝖿𝗂𝖼𝗂𝖺𝗅 𝖡𝗈𝗍 𝖬𝗈𝖽
⒉ ➜ 𝖠𝖽-𝖥𝗋𝖾𝖾 𝖡𝗈𝗍 𝖤𝗑𝗉𝖾𝗋𝗂𝖾𝗇𝖼𝖾
⒊ ➜ 𝖯𝗋𝖾𝗆𝗂𝗎𝗆 𝖶𝖾𝖻𝗌𝗂𝗍𝖾 𝖣𝖾𝗏𝖾𝗅𝗈𝗉𝗆𝖾𝗇𝗍
⒋ ➜ 𝖠𝖽𝗏𝖺𝗇𝖼𝖾𝖽 𝖢𝗒𝖻𝖾𝗋-𝖲𝖾𝖼𝗎𝗋𝗂𝗍𝗒
⒌ ➜ 𝖶𝖾𝖻 𝖢𝗋𝖾𝖺𝗍𝗂𝗈𝗇 𝖬𝖺𝗌𝗍𝖾𝗋𝖼𝗅𝖺𝗌𝗌

> *“Innovation is our language, Excellence is our standard.”*
_Powered by DarkX Ultra v6.0.0_`;

                let msgOptions = { 
                    image: fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : { url: "https://files.catbox.moe/pc5uec.png" },
                    caption: businessList 
                };
                
                return await sock.sendMessage(m.chat, msgOptions, { quoted: m });
            }

            // 2. DETAILED PRODUCT REPLIES
            let details = "";
            let selectedProduct = "";

            if (input === "1") {
                selectedProduct = "DARKX OFFICIAL BOT";
                details = `*◤ 𝖣𝖺𝗋𝗄𝖷 𝖮𝖿𝖿𝗂𝖼𝗂𝖺𝗅 𝖡𝗈𝗍 𝖬𝗈𝖽 ◢*\n\n*ＤＥＳＣＲＩＰＴＩＯＮ:*\nA highly optimized WhatsApp automation framework. Built for speed, security, and multiple features.\n\n*ＫΞＹ ＦΞΛＴＵＲΞＳ:*\n• Antilink & Antidelete System\n• AI Integration (Gemini/ChatGPT)\n• Media Downloader (YT/FB/TT)\n\n*ＩＮＶΞＳＴＭΞＮＴ:*\n💰 10,000 TZS\n\n_Quality is never an accident._`;
            } 
            else if (input === "2") {
                selectedProduct = "AD-FREE EXPERIENCE";
                details = `*◤ 𝖠𝖽-𝖥𝗋𝖾𝖾 𝖡𝗈𝗍 𝖤𝗑𝗉𝖾𝗋𝗂𝖾𝗇𝖼𝖾 ◢*\n\n*ＤＥＳＣＲＩＰＴＩＯＮ:*\nComplete removal of all external advertisements and promotional watermarks from your bot.\n\n*ＢΞＮΞＦＩＴＳ:*\n• Full Branding Control\n• Clean User Interface\n• Faster Response Times\n\n*ＩＮＶΞＳＴＭΞＮＴ:*\n💰 25,000 TZS`;
            } 
            else if (input === "3") {
                selectedProduct = "WEBSITE DEVELOPMENT";
                details = `*◤ 𝖯𝗋𝖾𝗆𝗂𝗎𝗆 𝖶𝖾𝖻𝗌𝗂𝗍𝖾 𝖣𝖾𝗏 ◢*\n\n*ＤＥＳＣＲＩＰＴＩＯＮ:*\nCustom web solutions ranging from Portfolio sites to E-commerce systems.\n\n*ＴＩΞＲＳ:*\n• *Standard (Ads):* 50,000 TZS (Starting)\n• *Enterprise (Clean):* 100,000 TZS\n\n_Build your digital empire today._`;
            } 
            else if (input === "4") {
                selectedProduct = "CYBER-SECURITY";
                details = `*◤ 𝖠𝖽𝗏𝖺𝗇𝖼𝖾𝖽 𝖧𝖺𝖼𝗄𝗂𝗇𝗀/𝖲𝖾𝖼𝗎𝗋𝗂𝗍𝗒 ◢*\n\n*ＳΞＲＶＩＣΞＳ:*\n• Penetration Testing\n• Account Recovery Audits\n• System Hardening\n\n*ＩＮＶΞＳＴＭΞＮＴ:*\n💰 Negotiable (Consultation Required)`;
            } 
            else if (input === "5") {
                selectedProduct = "WEB CREATION COURSE";
                details = `*◤ 𝖶𝖾𝖻 𝖢𝗋𝖾𝖺𝗍𝗂𝗈𝗇 𝖬𝖺𝗌𝗍𝖾𝗋𝖼𝗅𝖺𝗌𝗌 ◢*\n\n*ＬΞΛＲＮＩＮＧ ＰΛＴＨ:*\nLearn Frontend & Backend development from scratch. No coding experience needed.\n\n*ＩＮＶΞＳＴＭΞＮＴ:*\n💰 Negotiable`;
            }

            if (details) {
                // Tuma Text Details
                await sock.sendMessage(m.chat, { text: details }, { quoted: m });

                // Tuma Audio (vuta repo.mp3 moja kwa moja)
                if (fs.existsSync(audioPath)) {
                    await sock.sendMessage(m.chat, { 
                        audio: fs.readFileSync(audioPath), 
                        mimetype: 'audio/mpeg', // Inasoma mp3 vizuri zaidi
                        fileName: 'DarkX_Audio.mp3'
                    }, { quoted: m });
                }
            }

        } catch (err) {
            console.error("Business List Error:", err);
        }
    }
};
