const os = require('os');

module.exports = {
  name: 'stats',
  description: 'Displays detailed bot statistics.',

  async execute(sock, msg, args) {
    try {
      const jid = msg.key.remoteJid;

      // Uptime
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      // Memory usage
      const ramUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

      // CPU information (safe for Android)
      const cpuModel = 'ARM Cortex-A75 + Cortex-A55';
const cpuCores = 8;
const architecture = os.arch();
      // RAM
      const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

      // System info
      const platform = `${os.type()} ${os.release()}`;
      const nodeVersion = process.version;

      const text = `
📊 *BOT STATISTICS*

🤖 *Bot:* ISAAC
🟢 *Status:* Online

⏱ *Uptime:* ${hours}h ${minutes}m ${seconds}s
💾 *RAM Used:* ${ramUsed} MB
🧠 *Total RAM:* ${totalRam} GB
📉 *Free RAM:* ${freeRam} GB

🖥 *CPU:* ${cpuModel}
⚙️ *Cores:* ${cpuCores}
🏗 *Architecture:* ${architecture}

🌐 *System:* ${platform}
🟩 *Node.js:* ${nodeVersion}

📅 *Time:* ${new Date().toLocaleString()}
`.trim();

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error('Stats command error:', err);

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Error: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
