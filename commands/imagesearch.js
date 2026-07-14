/**
 * commands/imagesearch.js
 * Search Pexels for free stock images
 * Requires: PEXELS_API_KEY in .env
 */

require('dotenv').config();
const PEXELS_KEY = process.env.PEXELS_API_KEY;

module.exports = {
  name: 'imagesearch',
  description: 'Search for images on Pexels. Usage: .imagesearch <query>',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query) {
      return sock.sendMessage(jid, { text: '❌ Usage: .imagesearch <search term>' }, { quoted: msg });
    }

    if (!PEXELS_KEY) {
      return sock.sendMessage(jid, { text: '❌ Pexels API key not set in .env' }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: `🖼️ Searching Pexels for "${query}"...` }, { quoted: msg });

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await response.json();

      if (!data.photos?.length) {
        return sock.sendMessage(jid, { text: `❌ No images found for "${query}".` }, { quoted: msg });
      }

      let out = `🖼️ *PEXELS SEARCH: ${query.toUpperCase()}*\n\n`;
      data.photos.slice(0, 3).forEach((photo, i) => {
        out += `${i + 1}. *${photo.photographer}*\n`;
        out += `   ${photo.src.medium}\n\n`;
      });

      await sock.sendMessage(jid, { text: out });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` }, { quoted: msg });
    }
  }
};
