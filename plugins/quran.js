const axios = require('axios');

const SURAH_NAMES = {
    1: 'Al-Fatihah', 2: 'Al-Baqarah', 3: 'Ali Imran', 4: 'An-Nisa', 5: 'Al-Maidah',
    6: 'Al-Anam', 7: 'Al-Araf', 8: 'Al-Anfal', 9: 'At-Tawbah', 10: 'Yunus',
    11: 'Hud', 12: 'Yusuf', 13: 'Ar-Rad', 14: 'Ibrahim', 15: 'Al-Hijr',
    16: 'An-Nahl', 17: 'Al-Isra', 18: 'Al-Kahf', 19: 'Maryam', 20: 'Ta-Ha',
    21: 'Al-Anbiya', 22: 'Al-Hajj', 23: 'Al-Muminun', 24: 'An-Nur', 25: 'Al-Furqan',
    26: 'Ash-Shuara', 27: 'An-Naml', 28: 'Al-Qasas', 29: 'Al-Ankabut', 30: 'Ar-Rum',
    31: 'Luqman', 32: 'As-Sajdah', 33: 'Al-Ahzab', 34: 'Saba', 35: 'Fatir',
    36: 'Ya-Sin', 37: 'As-Saffat', 38: 'Sad', 39: 'Az-Zumar', 40: 'Ghafir',
    41: 'Fussilat', 42: 'Ash-Shura', 43: 'Az-Zukhruf', 44: 'Ad-Dukhan', 45: 'Al-Jathiyah',
    46: 'Al-Ahqaf', 47: 'Muhammad', 48: 'Al-Fath', 49: 'Al-Hujurat', 50: 'Qaf',
    51: 'Adh-Dhariyat', 52: 'At-Tur', 53: 'An-Najm', 54: 'Al-Qamar', 55: 'Ar-Rahman',
    56: 'Al-Waqiah', 57: 'Al-Hadid', 58: 'Al-Mujadila', 59: 'Al-Hashr', 60: 'Al-Mumtahanah',
    61: 'As-Saf', 62: 'Al-Jumuah', 63: 'Al-Munafiqun', 64: 'At-Taghabun', 65: 'At-Talaq',
    66: 'At-Tahrim', 67: 'Al-Mulk', 68: 'Al-Qalam', 69: 'Al-Haqqah', 70: 'Al-Maarij',
    71: 'Nuh', 72: 'Al-Jinn', 73: 'Al-Muzzammil', 74: 'Al-Muddaththir', 75: 'Al-Qiyamah',
    76: 'Al-Insan', 77: 'Al-Mursalat', 78: 'An-Naba', 79: 'An-Naziat', 80: 'Abasa',
    81: 'At-Takwir', 82: 'Al-Infitar', 83: 'Al-Mutaffifin', 84: 'Al-Inshiqaq', 85: 'Al-Buruj',
    86: 'At-Tariq', 87: 'Al-Ala', 88: 'Al-Ghashiyah', 89: 'Al-Fajr', 90: 'Al-Balad',
    91: 'Ash-Shams', 92: 'Al-Layl', 93: 'Ad-Duha', 94: 'Ash-Sharh', 95: 'At-Tin',
    96: 'Al-Alaq', 97: 'Al-Qadr', 98: 'Al-Bayyinah', 99: 'Az-Zalzalah', 100: 'Al-Adiyat',
    101: 'Al-Qariah', 102: 'At-Takathur', 103: 'Al-Asr', 104: 'Al-Humazah', 105: 'Al-Fil',
    106: 'Quraysh', 107: 'Al-Maun', 108: 'Al-Kawthar', 109: 'Al-Kafirun', 110: 'An-Nasr',
    111: 'Al-Masad', 112: 'Al-Ikhlas', 113: 'Al-Falaq', 114: 'An-Nas'
};

module.exports = {
    command: ['quran', 'ayah', 'surah'],
    category: 'religious',
    description: 'Tafuta aya za Quran kwa namba au neno',
    execute: async (sock, m, { text, reply }) => {
        const BASE = 'https://api.alquran.cloud/v1';
        const input = text.trim();

        if (!input) {
            return reply(`📖 *Quran Menu*\n\n*1. Kwa Aya:* .quran 2:255\n*2. Kwa Surah:* .quran 112\n*3. Search:* .quran paradise`);
        }

        try {
            // Case 1: Surah:Ayah format (mfano: 2:255)
            if (/^\d+:\d+$/.test(input)) {
                const [surahNum, ayahNum] = input.split(':');
                const [arRes, enRes, audRes] = await Promise.all([
                    axios.get(`${BASE}/ayah/${input}/quran-uthmani`),
                    axios.get(`${BASE}/ayah/${input}/en.asad`),
                    axios.get(`${BASE}/ayah/${input}/ar.alafasy`)
                ]);

                const ar = arRes.data.data;
                const en = enRes.data.data;
                const audioUrl = audRes.data.data.audio;
                const surahName = SURAH_NAMES[parseInt(surahNum)] || ar.surah.englishName;

                const quranText = `📖 *Surah ${surahName} — Aya ${ayahNum}*\n\n` +
                    `*Arabic:* \n${ar.text}\n\n` +
                    `*Translation:* \n_${en.text}_\n\n` +
                    `📍 Juz: ${ar.juz} | Page: ${ar.page}`;

                await reply(quranText);
                // Kutuma audio ya aya
                await sock.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: 'audio/mp4', ptt: true }, { quoted: m });
            } 
            // Case 2: Full Surah (mfano: .quran 112)
            else if (/^\d+$/.test(input)) {
                const res = await axios.get(`${BASE}/surah/${input}/en.asad`);
                const arRes = await axios.get(`${BASE}/surah/${input}/quran-uthmani`);
                const data = res.data.data;
                const arData = arRes.data.data;

                const verses = data.ayahs.slice(0, 5).map((a, i) => `*${i + 1}.* ${arData.ayahs[i].text}\n_${a.text}_`).join('\n\n');

                reply(`📖 *Surah ${data.englishName} (${data.name})*\n` +
                    `_${data.englishNameTranslation}_ — ${data.numberOfAyahs} verses\n\n` +
                    `${verses}\n\n` +
                    `_Showing first 5 verses. Use .quran ${input}:6 for more_`);
            } 
            // Case 3: Keyword Search
            else {
                const res = await axios.get(`${BASE}/search/${encodeURIComponent(input)}/all/en`);
                const matches = res.data.data.matches;

                if (!matches || matches.length === 0) return reply(`❌ Sikuweza kupata aya yenye neno: *${input}*`);

                const results = matches.slice(0, 5).map(m => {
                    const sName = SURAH_NAMES[m.surah.number] || m.surah.englishName;
                    return `📍 *${sName} ${m.surah.number}:${m.numberInSurah}*\n_${m.text}_`;
                }).join('\n\n');

                reply(`📖 *Quran Search: "${input}"*\n\n${results}`);
            }
        } catch (e) {
            console.error(e);
            reply("❌ Hitilafu imetokea. Hakikisha namba ya surah/aya ipo sahihi.");
        }
    }
};
