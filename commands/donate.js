module.exports = {
  name: 'donate',
  aliases: ['support', 'fund'],
  description: 'Support the development of ISAAC BOT.',

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    const text = `
╭━━〔 ❤️ SUPPORT ISAAC BOT 〕━━⬣

Thank you for using *ISAAC BOT*!

If you'd like to support the project and help keep it growing, you can donate using any of the methods below.

🌍 Online Donations
https://ko-fi.com/kingplayboi

🇰🇪 M-Pesa
📱 Number: 0718701810
👤 Name: ISAAC

💡 Your support helps with:
• Hosting and server costs
• New commands and features
• Bug fixes and maintenance
• Keeping ISAAC BOT free for everyone

🔗 GitHub
https://github.com/kingplayboi/ISAAC

Thank you for supporting the project! 🚀

╰━━━━━━━━━━━━━━⬣
`.trim();

    await sock.sendMessage(
      jid,
      { text },
      { quoted: msg }
    );
  }
};
