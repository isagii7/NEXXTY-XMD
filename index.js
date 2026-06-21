import express from "express";
import fs from "fs";
import path from "path";
import pino from "pino";
import axios from "axios";
import {
    makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason
} from "@whiskeysockets/baileys";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ========== EXPRESS SERVER ==========
const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `https://necyyy-1633d37c9d33.herokuapp.com`; // ⚠️ اپنا لنک یہاں ڈالیں

app.get('/', (req, res) => res.send('NEXXTY-XMD Bot is running!'));
app.get('/sessionid', (req, res) => {
    const credsPath = join(__dirname, 'session', 'creds.json');
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
            res.send('❌ Session file nahi mili.');
        }
    } else {
        res.send('⏳ Session abhi generate nahi hui.');
    }
});

const server = app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// ========== SELF PING (تاکہ ڈائنو کبھی نہ سوئے) ==========
setInterval(() => {
    axios.get(APP_URL)
        .then(() => console.log('🔄 Self-ping successful - Dyno is awake!'))
        .catch(() => console.log('⚠️ Self-ping failed'));
}, 300000); // ہر 5 منٹ بعد خود کو ہٹ کرتا ہے (300,000 milliseconds)

// ========== CONFIG ==========
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = process.env.BOT_NAME || 'NEXXTY-XMD';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '923001234567';
const PREFIX = process.env.PREFIX || '.';

console.log(`🤖 Bot: ${BOT_NAME}`);
console.log(`📌 Prefix: "${PREFIX}"`);
console.log(`🔑 Session: ${SESSION_ID ? '✅ Provided' : '❌ Missing (QR Mode)'}`);

// ========== SESSION HANDLER ==========
const sessionDir = join(__dirname, 'session');
if (SESSION_ID && SESSION_ID.startsWith('NEXTY-MD~')) {
    try {
        const base64Data = SESSION_ID.replace('NEXTY-MD~', '');
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        const sessionData = JSON.parse(jsonString);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        if (sessionData.noiseKey) {
            fs.writeFileSync(join(sessionDir, 'creds.json'), JSON.stringify(sessionData, null, 2));
            console.log('✅ creds.json successfully restored!');
        }
    } catch (err) {
        console.log('❌ Session parse error:', err.message);
    }
}

// ========== COMMANDS ==========
function getUptime() {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    return `${h}h ${m}m ${s}s`;
}

const commands = {};

commands.menu = {
    name: 'menu',
    triggers: ['menu', 'allmenu', 'help'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const prefix = config.prefix;
        const botName = config.botName;
        const text = `
╔══════════════════════╗
║   ${botName} 🤖
║   ════════════════
║   📌 *Commands:*
║   ─────────────
║   ${prefix}menu  → Menu
║   ${prefix}alive → Status
║   ${prefix}ping  → Latency
║   ${prefix}uptime→ Runtime
║   👤 Owner: ${config.owner}
║   ════════════════
║   Made with ❤️
╚══════════════════════╝`;
        try {
            const img = await axios.get('https://files.catbox.moe/bz29bv.jpg', { responseType: 'arraybuffer', timeout: 8000 });
            await sock.sendMessage(from, { image: Buffer.from(img.data), caption: text }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text }, { quoted: m });
        }
    }
};

commands.alive = {
    name: 'alive',
    triggers: ['alive', 'Alive'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, { 
            text: `🤖 *${config.botName} is Alive!*\n\n✅ Status: Online\n👤 Owner: ${config.owner}\n📅 ${new Date().toLocaleString()}`
        }, { quoted: m });
    }
};

commands.ping = {
    name: 'ping',
    triggers: ['ping', 'Ping'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...' }, { quoted: m });
        const end = Date.now();
        await sock.sendMessage(from, { 
            text: `🏓 *Pong!*\n⏱️ Latency: ${end - start}ms\n📡 Excellent`
        }, { quoted: m });
    }
};

commands.uptime = {
    name: 'uptime',
    triggers: ['uptime'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, { 
            text: `⏳ *Uptime*\n🕒 ${getUptime()}\n🤖 ${config.botName}`
        }, { quoted: m });
    }
};

console.log('✅ All 4 commands loaded!');

// ========== START BOT ==========
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        logger: pino({ level: "fatal" }),
        browser: Browsers.windows("Chrome"),
        printQRInTerminal: !SESSION_ID,
        markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr && !SESSION_ID) {
            console.log('📱 WhatsApp mein QR scan karein:');
            require('qrcode-terminal').generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} ab WhatsApp se ONLINE hai!`);
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Connection close. Code: ${code}`);
            if (code !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting...');
                startBot();
            }
        }
    });

    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message || m.key.fromMe) return;
            const from = m.key.remoteJid;
            const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
            if (!text.startsWith(PREFIX)) return;
            const args = text.slice(PREFIX.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands[cmdName];
            if (cmd) {
                console.log(`🔍 Command: ${cmdName}`);
                await cmd.execute(sock, m, args, { botName: BOT_NAME, owner: OWNER_NUMBER, prefix: PREFIX });
                console.log(`✅ Executed: ${cmdName}`);
            }
        } catch (err) {
            console.log('❌ Messages error:', err.message);
        }
    });
}

startBot().catch(err => console.log('Fatal:', err));
