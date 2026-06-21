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

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || 'https://necyyy-1633d37c9d33.herokuapp.com';

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

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// ========== SELF PING ==========
setInterval(() => {
    axios.get(APP_URL).catch(() => {});
}, 300000);

// ========== CONFIG ==========
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = process.env.BOT_NAME || 'NEXXTY-XMD';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '923001234567';
const PREFIX = process.env.PREFIX || '.';

console.log(`🤖 Bot: ${BOT_NAME}`);
console.log(`📌 Prefix: "${PREFIX}"`);
console.log(`🔑 Session: ${SESSION_ID ? '✅ Provided' : '❌ Missing'}`);

// ========== SESSION RESTORE ==========
const sessionDir = join(__dirname, 'session');
if (SESSION_ID && SESSION_ID.startsWith('NEXTY-MD~')) {
    try {
        const base64Data = SESSION_ID.replace('NEXTY-MD~', '');
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        const sessionData = JSON.parse(jsonString);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        if (sessionData.noiseKey) {
            fs.writeFileSync(join(sessionDir, 'creds.json'), JSON.stringify(sessionData, null, 2));
            console.log('✅ creds.json restored');
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

console.log('✅ All commands loaded');

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
            console.log('📱 Scan QR:');
            require('qrcode-terminal').generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} ONLINE!`);
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Close: ${code}`);
            if (code !== DisconnectReason.loggedOut) startBot();
        }
    });

    // ========== MAIN MESSAGE HANDLER (Self-chat fix) ==========
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            console.log('📩 Raw message event received');

            const m = msg.messages[0];
            if (!m) return console.log('❌ No message object');

            const from = m.key.remoteJid;
            const type = m.message ? Object.keys(m.message)[0] : 'unknown';
            console.log(`📥 Message from: ${from}`);
            console.log(`📝 Message type: ${type}`);

            // Extract text from different message types
            let text = '';
            if (m.message?.conversation) text = m.message.conversation;
            else if (m.message?.extendedTextMessage?.text) text = m.message.extendedTextMessage.text;
            else if (m.message?.imageMessage?.caption) text = m.message.imageMessage.caption;

            console.log(`📄 Text: "${text}"`);

            // 🔥 FIX: Don't ignore self-chat messages
            // Only ignore if the message was sent by the bot itself (fromMe) AND it's NOT a self-chat
            // Self-chat has fromMe = true but remoteJid is the same as the sender
            // We'll check if fromMe is true and also if the message is from the bot's own JID (self-chat)
            // Actually, in self-chat, fromMe = true, so we need to allow it.
            // Easiest: Allow all messages that start with prefix, even fromMe.
            // But to avoid loops, we need to ensure we don't reply to our own replies.
            // We can check if the message is from the bot's own number and if it's a command, but we can also rely on the fact that
            // the bot will not send a message that starts with prefix unless it's a command from someone else.
            // Better: Ignore only if fromMe AND the message is a reply to a bot message? Too complex.
            // For now, we will not ignore any message based on fromMe, but we'll check if the message is from the bot's own number
            // and if it's a command, we process it.

            // But to avoid infinite loops, we can check if the message has a "quoted" message that was sent by the bot.
            // However, for simplicity, we will remove the fromMe check entirely, and let all messages through.
            // The bot will only send a message if the command is recognized, and it won't trigger itself because it won't
            // send a message that starts with prefix unless it's a response to a command, which is not a command itself.

            // So we remove the fromMe check.

            // Check if the text starts with prefix
            if (!text.startsWith(PREFIX)) {
                console.log(`⏩ Ignoring: doesn't start with prefix "${PREFIX}"`);
                return;
            }

            const args = text.slice(PREFIX.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();
            console.log(`🔍 Command detected: ${cmdName}`);

            const cmd = commands[cmdName];
            if (cmd) {
                console.log(`✅ Executing command: ${cmdName}`);
                await cmd.execute(sock, m, args, { botName: BOT_NAME, owner: OWNER_NUMBER, prefix: PREFIX });
                console.log(`✅ ${cmdName} executed`);
            } else {
                console.log(`❌ Command not found: ${cmdName}`);
            }
        } catch (err) {
            console.log('❌ Error in messages.upsert:', err.message);
        }
    });
}

startBot().catch(err => console.log('Fatal:', err));
