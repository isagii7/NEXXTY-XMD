/**
 * commands/groupinfo.js
 * ---------------------
 * Displays basic information about the current group: name, description,
 * member count, and the list of admins.
 *
 * Usage: !groupinfo
 */
module.exports = {
  name: 'groupinfo',
  description: 'Shows info about the current group.',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;

    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      return;
    }

    const metadata = await sock.groupMetadata(jid);
    const admins = metadata.participants.filter(
      (p) => p.admin === 'admin' || p.admin === 'superadmin'
    );

    const adminList = admins.map((a) => `• @${a.id.split('@')[0]}`).join('\n') || 'None';

    const text =
      `📋 *${metadata.subject}*\n\n` +
      `${metadata.desc ? metadata.desc + '\n\n' : ''}` +
      `👥 Members: ${metadata.participants.length}\n` +
      `👑 Admins:\n${adminList}\n\n` +
      `🆔 Group ID: ${jid}`;

    await sock.sendMessage(
      jid,
      { text, mentions: admins.map((a) => a.id) },
      { quoted: msg }
    );
  },
};
