/**
 * commands/eval.js
 * -----------------
 * Runs raw JavaScript for debugging. Owner-only — never expose this publicly.
 * Usage:
 *   .eval 1 + 1
 *   .eval await sock.sendMessage(msg.key.remoteJid, { text: 'hi' })
 */
const config = require('../config/config');
const { isOwner } = require('../utils/isOwner');
const util = require('util');

module.exports = {
  name: 'eval',
  description: 'Runs raw JavaScript for debugging (owner only).',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    if (!isOwner(msg)) {
  return sock.sendMessage(jid, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
}

    const code = args.join(' ');

    if (!code) {
      return sock.sendMessage(jid, { text: '❌ Provide code to run.\n\nUsage: *.eval 1 + 1*' }, { quoted: msg });
    }

    try {
      let result;

      if (code.includes('await')) {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AsyncFunction('sock', 'msg', 'jid', 'config', `return ${code}`);
        result = await fn(sock, msg, jid, config);
      } else {
        const fn = new Function('sock', 'msg', 'jid', 'config', `return ${code}`);
        result = fn(sock, msg, jid, config);
      }

      if (typeof result !== 'string') {
        result = util.inspect(result, { depth: 2 });
      }

      if (result.length <= 4000) {
        await sock.sendMessage(jid, { text: result }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: result.slice(0, 4000) }, { quoted: msg });
        for (let i = 4000; i < result.length; i += 4000) {
          await sock.sendMessage(jid, { text: result.slice(i, i + 4000) });
        }
      }
    } catch (error) {
      await sock.sendMessage(jid, { text: `⚠️ ${error.message}` }, { quoted: msg });
    }
  },
};
