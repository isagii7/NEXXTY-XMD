const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ========== EXPRESS SERVER (Heroku ke liye zaroori) ==========
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('✅ NEXXTY-XMD Bot is running!'));
app.get('/sessionid', (req, res) => {
    const credsPath = path.join('./session', 'creds.json');
    if (fs.existsSync(credsPath)) {
        try {
            const data = fs.readFileSync(credsPath, 'utf-8');
            const base64 = Buffer.from(data).toString('base64');
            const sessionString = `NEXTY-MD~${base64}`;
            res.send(`
                <h2>✅ Active Session ID</h2>
                <textarea rows="5" cols="80" style="width:100%;">${sessionString}</textarea>
                <p>📌 Isko copy karke Heroku Config Vars mein <b>SESSION_ID</b> mein paste karein.</p>
            `);
        } catch (err) {
            res.send('❌ Session file nahi mili. Pehle QR scan karein.');
        }
    } else {
        res.send('⏳ Session abhi generate nahi hui. QR scan karein.');
    }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// ========== CONFIG (Environment Variables) ==========
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = process.env.BOT_NAME || 'NEXXTY-XMD';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '923001234567';
const PREFIX = process.env.PREFIX || '.'; // Default prefix "."

console.log(`🤖 Bot: ${BOT_NAME}`);
console.log(`📌 Prefix: "${PREFIX}"`);
console.log(`🔑 Session: ${SESSION_ID ? '✅ Provided' : '❌ Missing (QR Mode)'}`);

// ========== SESSION HANDLER (NEXTY-MD~ Format) ==========
const sessionDir = './session';
if (SESSION_ID && SESSION_ID.startsWith('NEXTY-MD~')) {
    try {
        const base64Data = SESSION_ID.replace('NEXTY-MD~', '');
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        const sessionData = JSON.parse(jsonString);
        
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        
        if (sessionData.noiseKey) {
            fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(sessionData, null, 2));
            console.log('✅ creds.json successfully restored!');
        } else {
            for (const [key, value] of Object.entries(sessionData)) {
                fs.writeFileSync(path.join(sessionDir, key), typeof value === 'string' ? value : JSON.stringify(value));
            }
            console.log('✅ Session files restored!');
        }
    } catch (err) {
        console.log('❌ Session parse error:', err.message);
    }
}

// ========== HELPER FUNCTIONS ==========
function getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}

// ========== 📌 ALL COMMANDS (HARDCODED - No plugins folder needed) ==========
const commands = {};

// 1. MENU COMMAND
commands.menu = {
    name: 'menu',
    triggers: ['menu', 'allmenu', 'help'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const prefix = config.prefix;
        const botName = config.botName;

        const menuText = `
╔══════════════════════╗
║   ${botName} 🤖
║   ════════════════
║
║   📌 *Commands:*
║   ─────────────
║   ${prefix}menu  → Show Menu
║   ${prefix}alive → Bot Status
║   ${prefix}ping  → Check Latency
║   ${prefix}uptime→ Bot Runtime
║
║   👤 Owner: ${config.owner}
║   ════════════════
║   Made with ❤️
╚══════════════════════╝`;

        try {
            // 📸 Aapki di hui image
            const imageUrl = 'https://files.catbox.moe/bz29bv.jpg';
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            await sock.sendMessage(from, {
                image: Buffer.from(response.data),
                caption: menuText
            }, { quoted: m });
        } catch (error) {
            // Agar image na aaye toh sirf text bhejein (Koi error nahi dikhega)
            console.log('⚠️ Image nahi mili, text menu bhej raha hoon.');
            await sock.sendMessage(from, { text: menuText }, { quoted: m });
        }
    }
};

// 2. ALIVE COMMAND
commands.alive = {
    name: 'alive',
    triggers: ['alive', 'Alive'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const text = `🤖 *${config.botName} is Alive!*\n\n✅ Status: Online\n👤 Owner: ${config.owner}\n📅 Date: ${new Date().toLocaleString()}`;
        await sock.sendMessage(from, { text }, { quoted: m });
    }
};

// 3. PING COMMAND
commands.ping = {
    name: 'ping',
    triggers: ['ping', 'Ping'],
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

// 4. UPTIME COMMAND
commands.uptime = {
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

console.log('✅ All 4 commands (menu, alive, ping, uptime) loaded successfully!');

// ========== 🚀 START BOT ==========
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'error' }), // Error dikhne ke liye
        browser: ['NEXXTY-XMD', 'Chrome', '1.0.0'],
        printQRInTerminal: !SESSION_ID, // Agar session nahi toh QR dikhao
    });

    // Credentials save karo
    sock.ev.on('creds.update', saveCreds);

    // Connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !SESSION_ID) {
            console.log('📱 WhatsApp mein ja kar QR code scan karein:');
            require('qrcode-terminal').generate(qr, { small: true });
            console.log('🔗 Scan karne ke baad /sessionid route se session copy karein.');
        }

        if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} ab WhatsApp se ONLINE hai! Ab .ping command chala kar dekhein.`);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Connection close. Code: ${statusCode}`);
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting...');
                startBot();
            } else {
                console.log('❌ Logged out. Session delete karke new QR scan karein.');
            }
        }
    });

    // Messages handler
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const text = m.message.conversation || 
                         m.message.extendedTextMessage?.text || 
                         m.message.imageMessage?.caption || '';

            if (!text.startsWith(PREFIX)) return;

            const args = text.slice(PREFIX.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();

            const cmd = commands[cmdName];
            if (cmd) {
                console.log(`🔍 Command received: ${cmdName} from ${from}`);
                await cmd.execute(sock, m, args, { 
                    botName: BOT_NAME, 
                    owner: OWNER_NUMBER, 
                    prefix: PREFIX 
                });
                console.log(`✅ ${cmdName} executed successfully!`);
            }
        } catch (err) {
            console.log('❌ Error in messages handler:', err.message);
        }
    });
}

// ========== BOOT KARO ==========
startBot().catch(err => {
    console.log('❌ Fatal Error:', err);
});
