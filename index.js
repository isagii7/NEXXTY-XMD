import express from "express";
import fs from "fs";
import path from "path";
import pino from "pino";
import axios from "axios";
import yts from 'yt-search';
import {
    makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason,
    downloadMediaMessage
} from "@whiskeysockets/baileys";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || 'https://your-app-name.herokuapp.com'; // ⚠️ Apna Heroku link daalein

// ========== CONFIG ==========
const CHANNEL_ID_NUM = '120363410907774725';
const CHANNEL_JID = '120363410907774725@newsletter';
const GROUP_INVITE_CODE = 'B65x2XGLu8S63k1SGzTuQV';
const REACT_EMOJIS = ['👀', '✨', '💨'];
const OWNER_NUMBER = '923192084504';
const BOT_NAME = 'NEXXTY-XMD';
const PREFIX = process.env.PREFIX || '.';

// ========== EXPRESS ==========
app.get('/', (req, res) => res.send(`${BOT_NAME} Bot is running!`));
app.get('/ping', (req, res) => res.send('Pong!'));
app.get('/sessionid', (req, res) => {
    const credsPath = join(__dirname, 'session', 'creds.json');
    if (fs.existsSync(credsPath)) {
        try {
            const data = fs.readFileSync(credsPath, 'utf-8');
            const base64 = Buffer.from(data).toString('base64');
            const sessionString = `NEXTY-MD~${base64}`;
            res.send(`<h2>✅ Active Session ID</h2><textarea rows="5" cols="80">${sessionString}</textarea>`);
        } catch { res.send('❌ Session file nahi mili.'); }
    } else { res.send('⏳ Session generate nahi hui.'); }
});
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// ========== SELF PING ==========
setInterval(() => {
    axios.get(APP_URL).catch(()=>{});
    axios.get(`${APP_URL}/ping`).catch(()=>{});
}, 120000);

// ========== SESSION RESTORE ==========
const SESSION_ID = process.env.SESSION_ID || null;
console.log(`🤖 Bot: ${BOT_NAME}`);
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
    } catch (err) { console.log('❌ Session error:', err.message); }
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
            newsletterName: 'NEXTY XMD',
            serverMessageId: 143
        }
    };
}
function isOwner(sender) { return sender && sender.includes(OWNER_NUMBER); }

// ========== AUTO-FOLLOW ==========
async function autoFollowChannel(sock) {
    try {
        console.log('📢 Auto-following channel...');
        try {
            await sock.newsletterFollow(CHANNEL_JID);
            console.log('✅ Channel followed!');
        } catch (e) {
            if (e.message && e.message.includes('already following')) {
                console.log('✅ Already following channel.');
            } else {
                console.log('⚠️ Follow error:', e.message);
            }
        }
    } catch (err) {
        console.log('❌ Auto-follow error:', err.message);
    }
}

// ========== AUTO-JOIN GROUP ==========
async function autoJoinGroup(sock) {
    try {
        console.log('📢 Auto-joining group...');
        const result = await sock.groupAcceptInvite(GROUP_INVITE_CODE);
        console.log('✅ Group joined!', result);
    } catch (err) {
        console.log('⚠️ Auto-join error:', err.message);
    }
}

// ========== AUTO-REACTION (using newsletterReactMessage) ==========
const reactedMessages = new Set();

function setupAutoReact(sock) {
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m || !m.message) return;

            const from = m.key.remoteJid;
            if (!from || !from.includes(CHANNEL_ID_NUM)) return;
            if (m.key.fromMe) return;
            if (m.message.reactionMessage) return;

            const msgId = m.key.id;
            if (reactedMessages.has(msgId)) return;

            const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];

            try {
                const metadata = await sock.newsletterMetadata("invite", CHANNEL_ID_NUM);
                await sock.newsletterReactMessage(metadata.id, msgId, emoji);
                reactedMessages.add(msgId);
                console.log(`✅ Auto-reacted with ${emoji} on channel post (${msgId})`);
            } catch (reactErr) {
                console.log('⚠️ Reaction failed:', reactErr.message);
            }

            if (reactedMessages.size > 5000) {
                const toDelete = [...reactedMessages].slice(0, 2500);
                toDelete.forEach(id => reactedMessages.delete(id));
            }
        } catch (err) {
            console.log('⚠️ Auto-react loop error:', err.message);
        }
    });
}

// ========== COMMANDS OBJECT ==========
const commands = {};
// ---------- 📌 MENU ----------
commands.menu = {
    name: 'menu',
    triggers: ['menu', 'allmenu', 'help'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const prefix = config.prefix;
        const botName = config.botName;
        const text = `
╔═══════════════════════════════════════╗
║          ${botName} 🤖
║   ═══════════════════════════════════
║   📌 *COMMANDS*
║   ─────────────────────
║   ${prefix}menu       → Menu
║   ${prefix}ping       → Latency
║   ${prefix}alive      → Bot status
║   ${prefix}uptime     → Runtime
║   ${prefix}runtime    → System runtime
║   ${prefix}owner      → Owner info
║   ${prefix}setname    → Change bot name
║   ${prefix}setprefix  → Change prefix
║   ${prefix}play       → YouTube audio
║   ${prefix}sticker    → Image to sticker
║   ${prefix}meme       → Random meme
║   ${prefix}joke       → Joke
║   ${prefix}weather    → Weather
║   ${prefix}qrcode     → QR code
║   ${prefix}tagall     → Mention all
║   ${prefix}hidetag    → Mention all with message
║   ${prefix}group      → Group link
║   ${prefix}say        → Echo message
║   👤 Owner: ${config.owner}
║   ═══════════════════════════════════
║   Made with ❤️ by ${botName}
╚═══════════════════════════════════════╝`;
        try {
            const img = await axios.get('https://files.catbox.moe/bz29bv.jpg', { responseType: 'arraybuffer', timeout: 8000 });
            await sock.sendMessage(from, { image: Buffer.from(img.data), caption: text, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text, contextInfo: getForwardedContext() }, { quoted: m });
        }
    }
};

// ---------- ℹ️ ALIVE ----------
commands.alive = {
    name: 'alive',
    triggers: ['alive'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `🤖 *${config.botName} is Alive!*\n✅ Online\n👤 ${config.owner}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 🏓 PING ----------
commands.ping = {
    name: 'ping',
    triggers: ['ping'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...', contextInfo: getForwardedContext() }, { quoted: m });
        await sock.sendMessage(from, { text: `🏓 *Pong!*\n⏱️ ${Date.now() - start}ms`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- ⏳ UPTIME ----------
commands.uptime = {
    name: 'uptime',
    triggers: ['uptime'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `⏳ *Uptime*\n🕒 ${getUptime()}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- ⏱️ RUNTIME ----------
commands.runtime = {
    name: 'runtime',
    triggers: ['runtime'],
    async execute(sock, m, args, config) {
        const uptime = process.uptime();
        const d = Math.floor(uptime / 86400);
        const h = Math.floor((uptime % 86400) / 3600);
        const min = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);
        await sock.sendMessage(m.key.remoteJid, { text: `⏱️ *System Runtime*\n📆 ${d}d ${h}h ${min}m ${s}s`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 👤 OWNER ----------
commands.owner = {
    name: 'owner',
    triggers: ['owner'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `👤 *Owner*\n📱 ${config.owner}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- ✏️ SETNAME ----------
commands.setname = {
    name: 'setname',
    triggers: ['setname'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || m.sender || from;
        if (!isOwner(sender)) return await sock.sendMessage(from, { text: '❌ Owner only.' }, { quoted: m });
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Naam likhein.' }, { quoted: m });
        const newName = args.join(' ');
        process.env.BOT_NAME = newName;
        config.botName = newName;
        await sock.sendMessage(from, { text: `✅ Name changed to *${newName}*`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 🔣 SETPREFIX ----------
commands.setprefix = {
    name: 'setprefix',
    triggers: ['setprefix'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || m.sender || from;
        if (!isOwner(sender)) return await sock.sendMessage(from, { text: '❌ Owner only.' }, { quoted: m });
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Prefix likhein.' }, { quoted: m });
        const newPrefix = args[0];
        process.env.PREFIX = newPrefix;
        config.prefix = newPrefix;
        await sock.sendMessage(from, { text: `✅ Prefix changed to *${newPrefix}*`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};
// ---------- 🎵 PLAY (YouTube Audio) ----------
commands.play = {
    name: 'play',
    triggers: ['play'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Song name likhein.' }, { quoted: m });
        const query = args.join(' ');
        try {
            await sock.sendMessage(from, { text: '🔍 Searching...' }, { quoted: m });
            const search = await yts(query);
            const video = search.videos?.[0];
            if (!video) return await sock.sendMessage(from, { text: '❌ No results.' });
            const apiUrl = `https://vihangayt.me/api/ytmp3?url=${encodeURIComponent(video.url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            const audioUrl = res.data?.data?.url || res.data?.result?.url || res.data?.url;
            if (!audioUrl) throw new Error('No audio');
            await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: `🎵 *${video.title}*`, contextInfo: getForwardedContext() }, { quoted: m });
            await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: `${video.title}.mp3`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};

// ---------- 🖼️ STICKER ----------
commands.sticker = {
    name: 'sticker',
    triggers: ['sticker', 's'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isQuotedImage = quoted?.imageMessage;
        const isDirectImage = m.message?.imageMessage;
        if (!isQuotedImage && !isDirectImage) return await sock.sendMessage(from, { text: '⚠️ Koi image bhejein.' }, { quoted: m });
        try {
            const source = isQuotedImage ? { message: quoted } : { message: m.message };
            const buffer = await downloadMediaMessage(source, 'buffer', {}, { logger: console });
            const sticker = new Sticker(buffer, { pack: config.botName, author: 'NEXTY XMD', type: StickerTypes.FULL, quality: 70 });
            await sock.sendMessage(from, { sticker: await sticker.toBuffer(), contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};

// ---------- 😂 MEME ----------
commands.meme = {
    name: 'meme',
    triggers: ['meme'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        try {
            const res = await axios.get('https://meme-api.com/gimme', { timeout: 5000 });
            await sock.sendMessage(from, { image: { url: res.data.url }, caption: `😂 *${res.data.title}*`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text: '😂 Why did the developer go broke? Used up all his cache!', contextInfo: getForwardedContext() }, { quoted: m });
        }
    }
};

// ---------- 😄 JOKE ----------
commands.joke = {
    name: 'joke',
    triggers: ['joke'],
    async execute(sock, m, args, config) {
        const jokes = [
            'Why do programmers prefer dark mode? Light attracts bugs!',
            'What do you call a computer that sings? A Dell!',
            'Why did the developer go broke? He used up all his cache!'
        ];
        await sock.sendMessage(m.key.remoteJid, { text: `😄 *Joke:*\n${jokes[Math.floor(Math.random() * jokes.length)]}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 🌤️ WEATHER ----------
commands.weather = {
    name: 'weather',
    triggers: ['weather'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ City name likhein.' }, { quoted: m });
        const city = args.join(' ');
        try {
            const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=060a6bcfa19809c2cd4d97a212b19273&units=metric`);
            const data = res.data;
            await sock.sendMessage(from, { text: `🌤️ *Weather in ${data.name}*\n🌡️ ${data.main.temp}°C\n💨 ${data.wind.speed} m/s\n💧 ${data.main.humidity}%`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text: '❌ City not found.' }, { quoted: m });
        }
    }
};

// ---------- 📱 QRCODE ----------
commands.qrcode = {
    name: 'qrcode',
    triggers: ['qrcode', 'qr'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Text likhein.' }, { quoted: m });
        const text = args.join(' ');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
        await sock.sendMessage(from, { image: { url: qrUrl }, caption: `📱 *QR for:* ${text}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 👥 TAGALL ----------
commands.tagall = {
    name: 'tagall',
    triggers: ['tagall'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: m });
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants.map(p => p.id);
        const msgText = args.length ? args.join(' ') : '📢 @all';
        let mentionText = '';
        participants.forEach(p => { mentionText += `@${p.split('@')[0]} `; });
        await sock.sendMessage(from, { text: `${msgText}\n${mentionText}`, mentions: participants, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 🙈 HIDETAG ----------
commands.hidetag = {
    name: 'hidetag',
    triggers: ['hidetag'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: m });
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants.map(p => p.id);
        const msgText = args.length ? args.join(' ') : '📢 @all';
        await sock.sendMessage(from, { text: msgText, mentions: participants, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 🔗 GROUP ----------
commands.group = {
    name: 'group',
    triggers: ['group', 'gc'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `👥 *Official Group*\n🔗 https://chat.whatsapp.com/B65x2XGLu8S63k1SGzTuQV`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 💬 SAY ----------
commands.say = {
    name: 'say',
    triggers: ['say', 'echo'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: `⚠️ Text likhein.` }, { quoted: m });
        await sock.sendMessage(from, { text: `💬 ${args.join(' ')}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

console.log('✅ All commands loaded!');
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
            console.log('❌ Messages error:', err.message);
        }
    });
}

startBot().catch(err => console.log('Fatal:', err));
