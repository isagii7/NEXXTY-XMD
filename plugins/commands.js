const axios = require('axios');

function getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}

// ========== MENU COMMAND ==========
const menuCmd = {
    name: 'menu',
    triggers: ['menu', 'allmenu', 'help'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const botName = config.botName;
        const prefix = config.prefix;

        const menuText = `
╔══════════════════════╗
║   ${botName} 🤖
║   ════════════════
║
║   📌 *Commands:*
║   ─────────────
║   ${prefix}menu  → Show this menu
║   ${prefix}alive → Check bot status
║   ${prefix}ping  → Check latency
║   ${prefix}uptime→ Bot runtime
║
║   👤 Owner: ${config.owner}
║   ════════════════
║   Made with ❤️
╚══════════════════════╝`;

        try {
            // تصویر کا لنک (آپ نے دیا تھا)
            const imageUrl = 'https://files.catbox.moe/bz29bv.jpg';
            const response = await axios.get(imageUrl, { 
                responseType: 'arraybuffer',
                timeout: 10000 
            });
            await sock.sendMessage(from, {
                image: Buffer.from(response.data),
                caption: menuText
            }, { quoted: m });
        } catch (error) {
            // اگر تصویر نہ آئی تو صرف متن بھیجیں، کوئی Error نہیں دکھے گا
            console.log('⚠️ Image fetch failed, sending text only.');
            await sock.sendMessage(from, { text: menuText }, { quoted: m });
        }
    }
};

// ========== ALIVE COMMAND ==========
const aliveCmd = {
    name: 'alive',
    triggers: ['alive'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const text = `🤖 *${config.botName} is Alive!*\n\n✅ Status: Online\n👤 Owner: ${config.owner}\n📅 Date: ${new Date().toLocaleString()}`;
        await sock.sendMessage(from, { text }, { quoted: m });
    }
};

// ========== PING COMMAND ==========
const pingCmd = {
    name: 'ping',
    triggers: ['ping'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const start = Date.now();
        // پہلا میسج
        const sentMsg = await sock.sendMessage(from, { text: '🏓 Pinging...' }, { quoted: m });
        const end = Date.now();
        const ms = end - start;
        // دوسرا میسج (پونگ)
        await sock.sendMessage(from, { 
            text: `🏓 *Pong!*\n⏱️ Latency: ${ms}ms\n📡 Status: Excellent`
        }, { quoted: m });
    }
};

// ========== UPTIME COMMAND ==========
const uptimeCmd = {
    name: 'uptime',
    triggers: ['uptime'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const uptime = getUptime();
        await sock.sendMessage(from, { 
            text: `⏳ *Bot Uptime*\n🕒 ${uptime}\n🤖 ${config.botName}`
        }, { quoted: m });
    }
};

// ========== EXPORT ALL COMMANDS AS ARRAY (تاکہ سب لوڈ ہوں) ==========
module.exports = [menuCmd, aliveCmd, pingCmd, uptimeCmd];
