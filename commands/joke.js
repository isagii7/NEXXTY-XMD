/**
 * commands/joke.js
 * ----------------
 * Fetches a random joke from a free public API (no key required) and
 * sends it to the chat.
 *
 * Usage: !joke
 */
module.exports = {
  name: 'joke',
  description: 'Sends a random joke.',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    try {
      const response = await fetch('https://official-joke-api.appspot.com/random_joke');
      const data = await response.json();
      const text = `${data.setup}\n\n${data.punchline} 😂`;
      await sock.sendMessage(jid, { text }, { quoted: msg });
    } catch (error) {
      await sock.sendMessage(
        jid,
        { text: '❌ Could not fetch a joke right now, try again in a moment.' },
        { quoted: msg }
      );
    }
  },
};
