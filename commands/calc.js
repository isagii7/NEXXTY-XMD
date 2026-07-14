/**
 * commands/calc.js
 * ----------------
 * Evaluates a basic arithmetic expression. Only allows digits, the four
 * basic operators, parentheses, and decimal points — anything else is
 * rejected before evaluation, so this can't be used to run arbitrary code.
 *
 * Usage: !calc 2 + 2 * (3 - 1)
 */
module.exports = {
  name: 'calc',
  description: 'Evaluates a basic math expression. Usage: !calc 2 + 2',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const expression = args.join(' ');

    if (!expression) {
      await sock.sendMessage(jid, { text: 'Usage: !calc 2 + 2 * (3 - 1)' }, { quoted: msg });
      return;
    }

    const isSafe = /^[0-9+\-*/().%\s]+$/.test(expression);
    if (!isSafe) {
      await sock.sendMessage(
        jid,
        { text: '❌ Only numbers and + - * / ( ) % are allowed.' },
        { quoted: msg }
      );
      return;
    }

    try {
      const result = Function(`"use strict"; return (${expression});`)();
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('Invalid result');
      }
      await sock.sendMessage(jid, { text: `🧮 ${expression} = ${result}` }, { quoted: msg });
    } catch (error) {
      await sock.sendMessage(jid, { text: '❌ That expression is not valid.' }, { quoted: msg });
    }
  },
};
