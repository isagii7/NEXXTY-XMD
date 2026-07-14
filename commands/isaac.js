/**
 * commands/isaac.js
 * -------------------
 * Shows the owner's WhatsApp number and current profile picture.
 *
 * Usage: .isaac
 */

const https = require('https');
const config = require('../config/config');

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = {
  name: 'isaac',
  description: "Shows the owner's WhatsApp number and current profile picture.",
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const ownerNumber = config.ownerNumber;
    const ownerJid = `${ownerNumber}@s.whatsapp.net`;

    const caption = `
╭──〔 👑 ISAAC ASSISTANT 〕──╮
📞 *Owner Number:* +${ownerNumber}
🔗 *Chat:* https://wa.me/${ownerNumber}
╰──────────────────╯`.trim();

    try {
      const ppUrl = await sock.profilePictureUrl(ownerJid, 'image');
      const buffer = await downloadBuffer(ppUrl);
      await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: caption + '\n\n(No profile picture available.)' }, { quoted: msg });
    }
  },
};
