const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'script',
  aliases: ['repo', 'github'],
  description: 'Shows the ISAAC repository information.',

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    const senderName =
      msg.pushName ||
      msg.verifiedBizName ||
      'User';

    const imagePath = path.join(__dirname, '../assets/script.jpg');

    const caption = `
Hello 👋 *${senderName},*

╔═══〔 🔥 ISAAC TECH 🔥 〕═══╗
║    The Ultimate WhatsApp Bot
╚═══════════════════════════╝

🔷 *GitHub Repo:*
↳ https://github.com/kingplayboi/ISAAC
⭐ Please star and fork the repository!

👨‍💻 *Developer:*
↳ https://github.com/kingplayboi

🔗 *WhatsApp Pairing:*
↳ https://kingpin-sjlx.onrender.com
★ Save your Session-ID!

⚙️ *Requirements:*
✓ Complete all variables
✓ Keep API keys secure
✓ Deploy properly

━━━━━━━━━━━━━━━━━━━━━━
🔥 Made on Earth by Humans!
❤️ Powered by *ISAAC TECH*
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    try {
      if (fs.existsSync(imagePath)) {
        await sock.sendMessage(
          jid,
          {
            image: fs.readFileSync(imagePath),
            caption
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          jid,
          { text: caption },
          { quoted: msg }
        );
      }
    } catch (error) {
      console.error('[SCRIPT ERROR]', error);

      await sock.sendMessage(
        jid,
        {
          text: '❌ Failed to load script information.'
        },
        { quoted: msg }
      );
    }
  }
};
