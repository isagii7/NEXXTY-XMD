/**
 * commands/groupstatus.js
 * --------------------------
 * Shows this group's per-group settings (antilink, welcome, etc.).
 * Usage: .groupstatus
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'groupstatus',
  description: "Shows this group's current settings.",
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    const settingsPath = path.join(__dirname, '../config/groupSettings.json');
    const allSettings = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      : {};
    const settings = allSettings[jid] || {};

    const onOff = (v) => (v ? '✅ ON' : '❌ OFF');

    const text = `⚙️ *Group Settings*\n\n` +
      `┣ Antilink: ${onOff(settings.antilink)}\n` +
      `┣ Welcome: ${onOff(settings.welcome)}\n` +
      `┣ Goodbye: ${onOff(settings.goodbye)}\n` +
      `┣ Anticall: ${onOff(settings.anticall)}\n` +
      `┗ Antiword: ${onOff(settings.antiword)}`;

    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
