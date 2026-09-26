const axios = require("axios");
const cheerio = require("cheerio");

async function mediafireDl(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        const link = $("#downloadButton").attr("href");
        const name =
            $("div.dl-info > div.promo-text").text().trim() || $(".dl-btn-label").attr("title");
        const size =
            $("#downloadButton").text().replace(/Download|[()]|\s/g, "").trim() || "Unknown";
        const ext = name.split(".").pop();
        return { name, size, link, ext };
    } catch (e) {
        return null;
    }
}

module.exports = {
    command: ["mediafire", "mfire", "mf"],
    category: "download",
    description: "Download files from MediaFire",
    execute: async (sock, m, { text, reply }) => {
        if (!text) {
            return reply(
                "❌ Provide a MediaFire URL.\n\nExample:\n.mfire https://www.mediafire.com/file/5e54xv2cislhfgb/twoxzhn.zip/file"
            );
        }

        try {
            const data = await mediafireDl(text);
            if (!data || !data.link) {
                return reply("❌ Failed to parse MediaFire page. Link might be private or broken.");
            }

            let caption = `≡ *MEDIAFIRE DOWNLOADER*\n\n`;
            caption += `▢ *File:* ${data.name}\n`;
            caption += `▢ *Size:* ${data.size}\n`;
            caption += `▢ *Extension:* ${data.ext}\n\n`;
            caption += `*Download In Progress... Please Wait ⌛*`;

            await sock.sendMessage(m.chat, { text: caption }, { quoted: m });

            const response = await axios({
                method: "get",
                url: data.link,
                responseType: "arraybuffer",
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
                    Referer: text,
                },
            });

            const buffer = Buffer.from(response.data);
            if (buffer.length < 10000) {
                return reply("❌ Error: The downloaded file is corrupt or invalid.");
            }

            const mimes = {
                zip: "application/zip",
                pdf: "application/pdf",
                apk: "application/vnd.android.package-archive",
                mp4: "video/mp4",
                mp3: "audio/mpeg",
                jpg: "image/jpeg",
                png: "image/png",
            };
            const mimeType = mimes[data.ext.toLowerCase()] || "application/octet-stream";

            await sock.sendMessage(
                m.chat,
                {
                    document: buffer,
                    fileName: data.name,
                    mimetype: mimeType,
                    caption: `✅ *Download Complete:* ${data.name}`,
                },
                { quoted: m }
            );
        } catch (err) {
            console.error("[MEDIAFIRE] Error:", err.message);
            reply(`❌ Error: ${err.message}`);
        }
    },
};
