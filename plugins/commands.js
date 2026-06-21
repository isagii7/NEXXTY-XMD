const axios = require('axios');

// ========== HELPERS ==========
function getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}

// ========== MENU COMMAND ==========
module.exports = {
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
            // Fetch image from your link with timeout
            const imageUrl = 'https://files.catbox.moe/bz29bv.jpg';
            const response = await axios.get(imageUrl, { 
                responseType: 'arraybuffer',
                timeout: 10000 
            });
            
            // Send image with menu text as caption
            await sock.sendMessage(from, {
                image: Buffer.from(response.data),
                caption: menuText
            }, { quoted: m });
            
        } catch (error) {
            // If image fails, send only text (NO ERROR WILL BE SHOWN TO USER)
            console.log('⚠️ Image fetch failed, sending text menu only.');
            await sock.sendMessage(from, { text: menuText }, { quoted: m });
        }
    }
};

// ========== ALIVE COMMAND ==========
module.exports = {
    name: 'alive',
    triggers: ['alive'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const text = `🤖 *${config.botName} is Alive!*\n\n✅ Status: Online\n👤 Owner: ${config.owner}\n📅 Date: ${new Date().toLocaleString()}`;
        await sock.sendMessage(from, { text }, { quoted: m });
    }
};

// ========== PING COMMAND ==========
module.exports = {
    name: 'ping',
    triggers: ['ping'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...' }, { quoted: m });
        const end = Date.now();
        const ms = end - start;
        await sock.sendMessage(from, { 
            text: `🏓 *Pong!*\n⏱️ Latency: ${ms}ms\n📡 Status: Excellent`
        }, { quoted: m });
    }
};

// ========== UPTIME COMMAND ==========
module.exports = {
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
