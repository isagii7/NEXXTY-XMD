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
const APP_URL = process.env.APP_URL || 'https://testingh-xxxxxxxx.herokuapp.com'; // ⚠️ اپنا Heroku لنک ڈالیں

// ========== CONFIGS ==========
const CHANNEL_JID = '120363410907774725@newsletter';
const CHANNEL_ID = '120363410907774725';
const REACT_EMOJIS = ['👀', '✨', '💨'];
const GROUP_INVITE_CODE = 'B65x2XGLu8S63k1SGzTuQV';

app.get('/', (req, res) => res.send('NEXXTY-XMD Bot is running!'));
app.get('/ping', (req, res) => res.send('Pong!'));
app.get('/status', (req, res) => res.json({ status: 'online', uptime: process.uptime() }));
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
    axios.get(`${APP_URL}/ping`).catch(() => {});
}, 120000);

// ========== CONFIG ==========
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = process.env.BOT_NAME || 'NEXXTY-XMD';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '923192084504';
const PREFIX = process.env.PREFIX || '.';

console.log(`🤖 Bot: ${BOT_NAME}`);
console.log(`📌 Prefix: "${PREFIX}"`);

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

// ========== HELPERS ==========
function getUptime() {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    return `${h}h ${m}m ${s}s`;
}

function getForwardedContext() {
    return {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: CHANNEL_JID,
            newsletterName: 'NEXTY FORWARD',
            serverMessageId: 143
        }
    };
}

// ========== AUTO-FOLLOW & JOIN ==========
async function autoFollowChannel(sock) {
    try {
        console.log('📢 Auto-following channel...');
        try {
            await sock.newsletterFollow(CHANNEL_JID);
            console.log('✅ Channel followed!');
        } catch (e) {
            await sock.newsletterFollow(CHANNEL_ID);
            console.log('✅ Channel followed (ID)!');
        }
    } catch (err) {
        console.log('⚠️ Auto-follow error:', err.message);
    }
}

async function autoJoinGroup(sock) {
    try {
        console.log('📢 Auto-joining group...');
        const result = await sock.groupAcceptInvite(GROUP_INVITE_CODE);
        console.log('✅ Group joined!', result);
    } catch (err) {
        console.log('⚠️ Auto-join group error:', err.message);
    }
}

// ========== AUTO-REACT (FIXED WITH PARTICIPANT) ==========
const reactedMessages = new Set();
let isReacting = false;

function setupAutoReact(sock) {
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const type = msg.type || 'unknown';
            if (type !== 'notify' && type !== 'append') return;

            const m = msg.messages[0];
            if (!m || !m.message) return;

            const from = m.key.remoteJid;
            if (!from || !from.includes(CHANNEL_ID)) return;
            if (m.key.fromMe) return;
            if (m.message.reactionMessage) return;

            const validTypes = ['conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'newsletterMessage'];
            const hasValidType = validTypes.some(t => m.message[t]);
            if (!hasValidType) return;

            const msgTimestamp = m.messageTimestamp;
            if (msgTimestamp) {
                const now = Math.floor(Date.now() / 1000);
                const age = now - msgTimestamp;
                if (age > 60) return;
            }

            const msgId = m.key.id;
            if (reactedMessages.has(msgId)) return;

            while (isReacting) await new Promise(resolve => setTimeout(resolve, 100));
            isReacting = true;

            try {
                const randomIndex = Math.floor(Math.random() * REACT_EMOJIS.length);
                const emoji = REACT_EMOJIS[randomIndex];
                
                // ✅ FIX: Add participant to the key for newsletter reactions
                const reactionKey = {
                    id: m.key.id,
                    remoteJid: from,
                    fromMe: false,
                    participant: m.key.participant || m.sender || m.key.remoteJid
                };
                
                await sock.sendMessage(from, { 
                    react: { 
                        text: emoji, 
                        key: reactionKey
                    } 
                });
                
                reactedMessages.add(msgId);
                console.log(`✅ Auto-reacted with ${emoji} on channel post (${msgId})`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err) {
                console.log(`❌ Reaction failed: ${err.message}`);
            } finally {
                isReacting = false;
            }

            if (reactedMessages.size > 1000) {
                const toDelete = [...reactedMessages].slice(0, 500);
                toDelete.forEach(id => reactedMessages.delete(id));
            }
        } catch (err) {
            if (err.message && err.message.includes('timed out')) return;
            console.log('❌ Auto-react loop error:', err.message);
        }
    });
}

// ========== 17 COMMANDS (WITH TEST REACTION ON PING) ==========
const commands = {};

commands.menu = {
    name: 'menu',
    triggers: ['menu', 'allmenu', 'help'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const prefix = config.prefix;
        const botName = config.botName;
        const text = `
╔════════════════════════════╗
║   ${botName} 🤖
║   ════════════════════════
║   📌 *Commands (Total 17):*
║   ─────────────────────
║   ${prefix}menu   → Menu
║   ${prefix}alive  → Status
║   ${prefix}ping   → Latency
║   ${prefix}uptime → Runtime
║   ${prefix}owner  → Owner info
║   ${prefix}runtime→ System time
║   ${prefix}speed  → Speed test
║   ${prefix}info   → Bot details
║   ${prefix}time   → Current time
║   ${prefix}date   → Today's date
║   ${prefix}say    → Repeat text
║   ${prefix}hello  → Greeting
║   ${prefix}bye    → Goodbye
║   ${prefix}donate → Donate info
║   ${prefix}server → Server status
║   ${prefix}test   → Test bot
║   ${prefix}group  → Group link
║   👤 Owner: ${config.owner}
║   ════════════════════════
║   Made with ❤️
╚════════════════════════════╝`;
        try {
            const img = await axios.get('https://files.catbox.moe/bz29bv.jpg', { responseType: 'arraybuffer', timeout: 8000 });
            await sock.sendMessage(from, { image: Buffer.from(img.data), caption: text, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text, contextInfo: getForwardedContext() }, { quoted: m });
        }
    }
};

commands.alive = {
    name: 'alive',
    triggers: ['alive', 'Alive'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `🤖 *${config.botName} is Alive!*\n\n✅ Status: Online\n👤 Owner: ${config.owner}\n📅 ${new Date().toLocaleString()}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

// ========== 🔥 PING COMMAND WITH TEST REACTION (⚡) ==========
commands.ping = {
    name: 'ping',
    triggers: ['ping', 'Ping'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        
        // 🧪 TEST REACTION: Is ⚡ appearing on your .ping message in the channel?
        try {
            const reactionKey = {
                id: m.key.id,
                remoteJid: from,
                fromMe: false,
                participant: m.key.participant || m.sender || m.key.remoteJid
            };
            await sock.sendMessage(from, { 
                react: { 
                    text: '⚡', 
                    key: reactionKey
                } 
            });
            console.log('✅ Test reaction (⚡) sent successfully on ping message');
        } catch (err) {
            console.log('❌ Test reaction failed:', err.message);
        }

        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...', contextInfo: getForwardedContext() }, { quoted: m });
        const end = Date.now();
        await sock.sendMessage(from, {
            text: `🏓 *Pong!*\n⏱️ Latency: ${end - start}ms\n📡 Excellent`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.uptime = {
    name: 'uptime',
    triggers: ['uptime'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `⏳ *Uptime*\n🕒 ${getUptime()}\n🤖 ${config.botName}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.owner = {
    name: 'owner',
    triggers: ['owner'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `👤 *Owner Info*\n📱 Number: ${config.owner}\n🤖 Bot: ${config.botName}\n💬 Contact: wa.me/${config.owner}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.runtime = {
    name: 'runtime',
    triggers: ['runtime'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        await sock.sendMessage(from, {
            text: `⏱️ *System Runtime*\n📆 ${days}d ${hours}h ${minutes}m ${seconds}s`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.speed = {
    name: 'speed',
    triggers: ['speed'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const start = Date.now();
        await sock.sendMessage(from, { text: '🚀 Testing speed...', contextInfo: getForwardedContext() }, { quoted: m });
        const end = Date.now();
        await sock.sendMessage(from, {
            text: `⚡ *Speed Test*\n📡 Latency: ${end - start}ms\n✅ Connection: Excellent`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.info = {
    name: 'info',
    triggers: ['info'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `🤖 *Bot Information*\n\n📛 Name: ${config.botName}\n🔣 Prefix: ${config.prefix}\n📦 Version: 8.0.0\n🖥️ Platform: Heroku\n👤 Owner: ${config.owner}\n📅 Deployed: ${new Date().toLocaleDateString()}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.time = {
    name: 'time',
    triggers: ['time'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `🕐 *Current Time*\n⏰ ${new Date().toLocaleTimeString()}\n🌍 ${new Date().toLocaleString()}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.date = {
    name: 'date',
    triggers: ['date'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `📅 *Today's Date*\n🗓️ ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.say = {
    name: 'say',
    triggers: ['say', 'echo'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (args.length === 0) {
            return await sock.sendMessage(from, {
                text: `⚠️ Please provide text.\nExample: ${config.prefix}say Hello World`,
                contextInfo: getForwardedContext()
            }, { quoted: m });
        }
        const text = args.join(' ');
        await sock.sendMessage(from, {
            text: `💬 *Echo:* ${text}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.hello = {
    name: 'hello',
    triggers: ['hello', 'hi'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `👋 Hello there! Welcome to ${config.botName}.\nHow can I assist you today?`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.bye = {
    name: 'bye',
    triggers: ['bye', 'goodbye'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `👋 Goodbye! Take care and have a great day! 🌟`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.donate = {
    name: 'donate',
    triggers: ['donate', 'support'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `💖 *Support the Developer*\n\nYou can support me by sharing this bot with your friends.\n\n👤 Owner: ${config.owner}\n📱 Contact: wa.me/${config.owner}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.server = {
    name: 'server',
    triggers: ['server', 'status'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `🖥️ *Server Status*\n\n✅ Status: Online\n🖥️ Platform: Heroku\n⏱️ Uptime: ${getUptime()}\n🤖 Bot: ${config.botName}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.test = {
    name: 'test',
    triggers: ['test'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `✅ *Test Successful!*\n\n🤖 ${config.botName} is working perfectly.\n📡 Response Time: ${Date.now()}ms\n💪 All systems operational.`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

commands.group = {
    name: 'group',
    triggers: ['group', 'gc'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `👥 *Official Group*\n\nJoin our WhatsApp community:\n🔗 https://chat.whatsapp.com/B65x2XGLu8S63k1SGzTuQV\n\nStay connected and get updates!`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

console.log('✅ All 17 commands loaded successfully!');

// ========== START BOT ==========
let botStarted = false;

async function startBot() {
    if (botStarted) return;
    botStarted = true;

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
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 250,
        maxRetries: 10,
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
            await autoFollowChannel(sock);
            await autoJoinGroup(sock);
            setupAutoReact(sock);
            botStarted = false;
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Close: ${code}`);
            botStarted = false;
            reactedMessages.clear();
            if (code !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting in 5 seconds...');
                setTimeout(() => startBot(), 5000);
            } else {
                console.log('❌ Logged out. Please restart with new session.');
            }
        }
    });

    // ========== MESSAGE HANDLER ==========
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m) return;

            const from = m.key.remoteJid;
            let text = '';

            if (m.message?.conversation) text = m.message.conversation;
            else if (m.message?.extendedTextMessage?.text) text = m.message.extendedTextMessage.text;
            else if (m.message?.imageMessage?.caption) text = m.message.imageMessage.caption;
            else if (m.message?.newsletterMessage?.text) text = m.message.newsletterMessage.text;
            else if (m.message?.newsletterMessage?.caption) text = m.message.newsletterMessage.caption;

            if (!text || !text.startsWith(PREFIX)) return;

            const args = text.slice(PREFIX.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands[cmdName];
            if (cmd) {
                console.log(`🔍 Command: ${cmdName} from ${from}`);
                await cmd.execute(sock, m, args, { botName: BOT_NAME, owner: OWNER_NUMBER, prefix: PREFIX });
                console.log(`✅ ${cmdName} executed`);
            }
        } catch (err) {
            console.log('❌ Messages error:', err.message
