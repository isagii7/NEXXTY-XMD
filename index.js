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
const APP_URL = process.env.APP_URL || 'https://your-app-name.herokuapp.com'; // ⚠️ Apna link daalna

// ========== CONFIG ==========
const CHANNEL_IDS = ['120363410907774725', '116505769414861'];
const REACT_EMOJIS = ['👀', '✨', '💨'];
const GROUP_INVITE_CODE = 'B65x2XGLu8S63k1SGzTuQV';
const PRIMARY_CHANNEL = '120363410907774725@newsletter';
const OWNER_NUMBER = '923192084504';
const BOT_NAME = 'NEXXTY-XMD';
const PREFIX = process.env.PREFIX || '.';

// ========== EXPRESS ROUTES ==========
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

// ========== SELF PING (24/7 Awake) ==========
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
            newsletterJid: PRIMARY_CHANNEL,
            newsletterName: 'NEXTY XMD', // 🔥 Credit
            serverMessageId: 143
        }
    };
}
function isOwner(sender) { return sender && sender.includes(OWNER_NUMBER); }

// ========== AUTO-FOLLOW & AUTO-JOIN ==========
async function autoFollowChannel(sock) {
    try {
        const jids = ['120363410907774725@newsletter', '116505769414861@lid'];
        for (const jid of jids) {
            try { await sock.newsletterFollow(jid); console.log(`✅ Followed ${jid}`); return; } catch(e) {}
        }
    } catch(e) {}
}
async function autoJoinGroup(sock) {
    try { await sock.groupAcceptInvite(GROUP_INVITE_CODE); console.log('✅ Group joined'); } catch(e) {}
}

// ========== AUTO-REACTION ==========
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
            if (!from) return;
            const isChannel = CHANNEL_IDS.some(id => from.includes(id));
            if (!isChannel) return;
            if (m.key.fromMe) return;
            if (m.message.reactionMessage) return;
            const validTypes = ['conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'newsletterMessage'];
            if (!validTypes.some(t => m.message[t])) return;
            const msgTimestamp = m.messageTimestamp;
            if (msgTimestamp) {
                const age = Math.floor(Date.now() / 1000) - msgTimestamp;
                if (age > 60) return;
            }
            const msgId = m.key.id;
            if (reactedMessages.has(msgId)) return;
            while (isReacting) await new Promise(resolve => setTimeout(resolve, 100));
            isReacting = true;
            try {
                const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];
                await sock.sendMessage(from, { react: { text: emoji, key: m.key } });
                reactedMessages.add(msgId);
                console.log(`✅ Auto-reacted with ${emoji} on channel post`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            } finally { isReacting = false; }
            if (reactedMessages.size > 1000) {
                const toDelete = [...reactedMessages].slice(0, 500);
                toDelete.forEach(id => reactedMessages.delete(id));
            }
        } catch (err) {}
    });
}

// ========== COMMANDS OBJECT (Part 2 & 3 mein isme commands add hongi) ==========
const commands = {};

// ========== START BOT FUNCTION (Part 3 mein call hoga) ==========
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
// Part 2 and 3 will add commands, then we call startBot() at the end.
// ========== COMMANDS DEFINITIONS ==========

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
║   📌 *OWNER COMMANDS*
║   ─────────────────────
║   ${prefix}owner      → Owner info
║   ${prefix}setname    → Change bot name
║   ${prefix}setprefix  → Change prefix
║   ${prefix}broadcast  → Send to all groups
║   📥 *DOWNLOAD*
║   ─────────────────────
║   ${prefix}play       → YouTube audio
║   ${prefix}ytmp3      → YouTube MP3
║   ${prefix}ytmp4      → YouTube MP4
║   ${prefix}instagram  → Instagram download
║   ${prefix}tiktok     → TikTok download
║   ${prefix}facebook   → Facebook download
║   ${prefix}twitter    → Twitter/X download
║   🎉 *FUN*
║   ─────────────────────
║   ${prefix}sticker    → Image to sticker
║   ${prefix}meme       → Random meme
║   ${prefix}joke       → Joke
║   ${prefix}quote      → Quote
║   ${prefix}truth      → Truth
║   ${prefix}dare       → Dare
║   🛠️ *UTILITY*
║   ─────────────────────
║   ${prefix}weather    → Weather
║   ${prefix}qrcode     → QR code
║   ${prefix}wikipedia  → Wikipedia
║   ${prefix}news       → News
║   ${prefix}google     → Google search
║   ${prefix}translate  → Translate
║   ${prefix}map        → Map link
║   ${prefix}lyrics     → Song lyrics
║   ${prefix}shazam     → Identify song
║   ${prefix}imdb       → Movie info
║   ${prefix}country    → Country info
║   ℹ️ *INFO*
║   ─────────────────────
║   ${prefix}ping       → Latency
║   ${prefix}uptime     → Bot runtime
║   ${prefix}runtime    → System runtime
║   ${prefix}info       → Bot info
║   ${prefix}time       → Time
║   ${prefix}date       → Date
║   ${prefix}server     → Server status
║   👥 *GROUP*
║   ─────────────────────
║   ${prefix}tagall     → Mention all
║   ${prefix}hidetag    → Mention all with message
║   ${prefix}group      → Group link
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

// ---------- ℹ️ INFO ----------
commands.alive = {
    name: 'alive',
    triggers: ['alive'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, { text: `🤖 *${config.botName} is Alive!*\n\n✅ Status: Online\n👤 Owner: ${config.owner}\n📅 ${new Date().toLocaleString()}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.ping = {
    name: 'ping',
    triggers: ['ping'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        try { await sock.sendMessage(from, { react: { text: '⚡', key: m.key } }); } catch {}
        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...', contextInfo: getForwardedContext() }, { quoted: m });
        const end = Date.now();
        await sock.sendMessage(from, { text: `🏓 *Pong!*\n⏱️ Latency: ${end - start}ms\n📡 Excellent`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.uptime = {
    name: 'uptime',
    triggers: ['uptime'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `⏳ *Uptime*\n🕒 ${getUptime()}\n🤖 ${config.botName}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.runtime = {
    name: 'runtime',
    triggers: ['runtime'],
    async execute(sock, m, args, config) {
        const uptime = process.uptime();
        const d = Math.floor(uptime / 86400), h = Math.floor((uptime % 86400)/3600), min = Math.floor((uptime % 3600)/60), s = Math.floor(uptime % 60);
        await sock.sendMessage(m.key.remoteJid, { text: `⏱️ *System Runtime*\n📆 ${d}d ${h}h ${min}m ${s}s`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.info = {
    name: 'info',
    triggers: ['info'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `🤖 *Bot Information*\n📛 Name: ${config.botName}\n🔣 Prefix: ${config.prefix}\n📦 Version: 8.0.0\n👤 Owner: ${config.owner}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.time = {
    name: 'time',
    triggers: ['time'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `🕐 *Time*\n⏰ ${new Date().toLocaleTimeString()}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.date = {
    name: 'date',
    triggers: ['date'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `📅 *Date*\n🗓️ ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.server = {
    name: 'server',
    triggers: ['server', 'status'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `🖥️ *Server Status*\n✅ Online\n⏱️ Uptime: ${getUptime()}\n🤖 ${config.botName}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.test = {
    name: 'test',
    triggers: ['test'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `✅ *Test Successful!*\n🤖 ${config.botName} is working.`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 👤 OWNER ----------
commands.owner = {
    name: 'owner',
    triggers: ['owner'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `👤 *Owner*\n📱 ${config.owner}\n🤖 ${config.botName}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

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

commands.broadcast = {
    name: 'broadcast',
    triggers: ['broadcast'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || m.sender || from;
        if (!isOwner(sender)) return await sock.sendMessage(from, { text: '❌ Owner only.' }, { quoted: m });
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Message likhein.' }, { quoted: m });
        await sock.sendMessage(from, { text: `📢 *Broadcast:*\n${args.join(' ')}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 📥 DOWNLOAD ----------
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
            const apiUrl = `https://api.ryzendesu.com/api/ytmp3?url=${encodeURIComponent(video.url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            if (!res.data?.url) throw new Error('No audio');
            await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: `🎵 *${video.title}*\n⏱️ ${video.timestamp}\n👤 ${video.author.name}`, contextInfo: getForwardedContext() }, { quoted: m });
            await sock.sendMessage(from, { audio: { url: res.data.url }, mimetype: 'audio/mpeg', fileName: `${video.title}.mp3`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: m });
        }
    }
};

commands.ytmp3 = {
    name: 'ytmp3',
    triggers: ['ytmp3'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Search query likhein.' }, { quoted: m });
        const query = args.join(' ');
        try {
            const search = await yts(query);
            const video = search.videos?.[0];
            if (!video) return await sock.sendMessage(from, { text: '❌ No results.' });
            const apiUrl = `https://api.ryzendesu.com/api/ytmp3?url=${encodeURIComponent(video.url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            if (!res.data?.url) throw new Error('No audio');
            await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: `🎵 ${video.title}\n⏱️ ${video.timestamp}`, contextInfo: getForwardedContext() }, { quoted: m });
            await sock.sendMessage(from, { audio: { url: res.data.url }, mimetype: 'audio/mpeg', fileName: `${video.title}.mp3`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};

commands.ytmp4 = {
    name: 'ytmp4',
    triggers: ['ytmp4'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Search query likhein.' }, { quoted: m });
        const query = args.join(' ');
        try {
            const search = await yts(query);
            const video = search.videos?.[0];
            if (!video) return await sock.sendMessage(from, { text: '❌ No results.' });
            const apiUrl = `https://api.ryzendesu.com/api/ytmp4?url=${encodeURIComponent(video.url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            if (!res.data?.url) throw new Error('No video');
            await sock.sendMessage(from, { video: { url: res.data.url }, caption: `🎬 ${video.title}\n⏱️ ${video.timestamp}`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};

commands.instagram = {
    name: 'instagram',
    triggers: ['instagram', 'ig'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length || !args[0].includes('instagram.com')) return await sock.sendMessage(from, { text: '⚠️ Instagram link likhein.' }, { quoted: m });
        try {
            const url = args[0];
            const res = await axios.get(`https://api.ryzendesu.com/api/instagram?url=${encodeURIComponent(url)}`, { timeout: 20000 });
            if (!res.data?.data) throw new Error('No media');
            const media = res.data.data;
            if (media.type === 'video') {
                await sock.sendMessage(from, { video: { url: media.url }, caption: '📥 Instagram Video', contextInfo: getForwardedContext() }, { quoted: m });
            } else {
                await sock.sendMessage(from, { image: { url: media.url }, caption: '📥 Instagram Image', contextInfo: getForwardedContext() }, { quoted: m });
            }
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};

commands.tiktok = {
    name: 'tiktok',
    triggers: ['tiktok', 'tt'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length || !args[0].includes('tiktok.com')) return await sock.sendMessage(from, { text: '⚠️ TikTok link likhein.' }, { quoted: m });
        try {
            const url = args[0];
            const res = await axios.get(`https://api.ryzendesu.com/api/tiktok?url=${encodeURIComponent(url)}`, { timeout: 20000 });
            if (!res.data?.data) throw new Error('No media');
            const media = res.data.data;
            await sock.sendMessage(from, { video: { url: media.url }, caption: '📥 TikTok Video', contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};

commands.facebook = {
    name: 'facebook',
    triggers: ['facebook', 'fb'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length || !args[0].includes('facebook.com')) return await sock.sendMessage(from, { text: '⚠️ Facebook link likhein.' }, { quoted: m });
        try {
            const url = args[0];
            const res = await axios.get(`https://api.ryzendesu.com/api/facebook?url=${encodeURIComponent(url)}`, { timeout: 20000 });
            if (!res.data?.data) throw new Error('No media');
            await sock.sendMessage(from, { video: { url: res.data.data }, caption: '📥 Facebook Video', contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};

commands.twitter = {
    name: 'twitter',
    triggers: ['twitter', 'tw', 'x'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length || !args[0].includes('twitter.com') && !args[0].includes('x.com')) return await sock.sendMessage(from, { text: '⚠️ Twitter/X link likhein.' }, { quoted: m });
        try {
            const url = args[0];
            const res = await axios.get(`https://api.ryzendesu.com/api/twitter?url=${encodeURIComponent(url)}`, { timeout: 20000 });
            if (!res.data?.data) throw new Error('No media');
            await sock.sendMessage(from, { video: { url: res.data.data }, caption: '📥 Twitter/X Video', contextInfo: getForwardedContext() }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: m });
        }
    }
};
// ---------- 🎉 FUN (Sticker, Meme, Joke, Quote, Truth, Dare) ----------
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
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: m });
        }
    }
};

commands.meme = {
    name: 'meme',
    triggers: ['meme'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        try {
            const res = await axios.get('https://meme-api.com/gimme', { timeout: 5000 });
            await sock.sendMessage(from, { image: { url: res.data.url }, caption: `😂 *${res.data.title}*\n👍 ${res.data.ups}`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text: '😂 Why did the developer go broke? Used up all his cache!', contextInfo: getForwardedContext() }, { quoted: m });
        }
    }
};

commands.joke = {
    name: 'joke',
    triggers: ['joke'],
    async execute(sock, m, args, config) {
        const jokes = ['Why do programmers prefer dark mode? Light attracts bugs!', 'What do you call a computer that sings? A Dell!', 'Why did the developer go broke? He used up all his cache!'];
        await sock.sendMessage(m.key.remoteJid, { text: `😄 *Joke:*\n${jokes[Math.floor(Math.random()*jokes.length)]}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.quote = {
    name: 'quote',
    triggers: ['quote'],
    async execute(sock, m, args, config) {
        const quotes = [{text:'The only way to do great work is to love what you do.',author:'Steve Jobs'},{text:'Life is what happens when you\'re busy making other plans.',author:'John Lennon'}];
        const q = quotes[Math.floor(Math.random()*quotes.length)];
        await sock.sendMessage(m.key.remoteJid, { text: `💭 *${q.text}*\n— ${q.author}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.truth = {
    name: 'truth',
    triggers: ['truth'],
    async execute(sock, m, args, config) {
        const truths = ['What is your biggest fear?', 'What is the most embarrassing thing you\'ve ever done?', 'Have you ever cheated on a test?'];
        await sock.sendMessage(m.key.remoteJid, { text: `🤔 *Truth:*\n${truths[Math.floor(Math.random()*truths.length)]}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.dare = {
    name: 'dare',
    triggers: ['dare'],
    async execute(sock, m, args, config) {
        const dares = ['Do a funny dance for 30 seconds.', 'Send a text to your crush.', 'Eat a raw piece of garlic.'];
        await sock.sendMessage(m.key.remoteJid, { text: `💪 *Dare:*\n${dares[Math.floor(Math.random()*dares.length)]}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 🛠️ UTILITY ----------
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

commands.wiki = {
    name: 'wikipedia',
    triggers: ['wikipedia', 'wiki'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Search term likhein.' }, { quoted: m });
        const query = args.join(' ');
        try {
            const res = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
            await sock.sendMessage(from, { text: `📚 *${res.data.title}*\n${res.data.extract || 'No summary found.'}`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text: '❌ Not found.' }, { quoted: m });
        }
    }
};

commands.news = {
    name: 'news',
    triggers: ['news'],
    async execute(sock, m, args, config) {
        const news = ['📰 AI continues to revolutionize the tech industry.', '🌍 Global climate summit concludes with new agreements.', '📈 Stock markets show mixed results today.'];
        await sock.sendMessage(m.key.remoteJid, { text: `📰 *Top News:*\n${news[Math.floor(Math.random()*news.length)]}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.google = {
    name: 'google',
    triggers: ['google'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Search term likhein.' }, { quoted: m });
        const query = args.join(' ');
        await sock.sendMessage(from, { text: `🔍 *Google search:* ${query}\n(Feature requires Google API key.)`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.translate = {
    name: 'translate',
    triggers: ['translate', 'trans'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (args.length < 2) return await sock.sendMessage(from, { text: `⚠️ Format: ${config.prefix}translate <target_lang> <text>` }, { quoted: m });
        const target = args[0];
        const text = args.slice(1).join(' ');
        await sock.sendMessage(from, { text: `🌐 *Translate to ${target}:*\n${text}\n(Requires API key.)`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.map = {
    name: 'map',
    triggers: ['map'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Location likhein.' }, { quoted: m });
        const loc = args.join(' ');
        await sock.sendMessage(from, { text: `🗺️ *Map:* https://www.google.com/maps/search/${encodeURIComponent(loc)}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.lyrics = {
    name: 'lyrics',
    triggers: ['lyrics'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Song name likhein.' }, { quoted: m });
        const query = args.join(' ');
        try {
            const res = await axios.get(`https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(query)}`);
            if (!res.data?.lyrics) throw new Error('Not found');
            await sock.sendMessage(from, { text: `🎵 *${res.data.title}* - ${res.data.artist}\n\n${res.data.lyrics.slice(0, 2000)}`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text: '❌ Lyrics not found.' }, { quoted: m });
        }
    }
};

commands.shazam = {
    name: 'shazam',
    triggers: ['shazam'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted || (!quoted.audioMessage && !quoted.videoMessage)) return await sock.sendMessage(from, { text: '⚠️ Reply to an audio/video message.' }, { quoted: m });
        await sock.sendMessage(from, { text: '🎵 *Shazam feature requires ACRCloud API.*', contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.imdb = {
    name: 'imdb',
    triggers: ['imdb', 'movie'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Movie name likhein.' }, { quoted: m });
        const query = args.join(' ');
        try {
            const res = await axios.get(`http://www.omdbapi.com/?t=${encodeURIComponent(query)}&apikey=7035c60c`);
            if (res.data.Response === 'False') throw new Error('Not found');
            const d = res.data;
            await sock.sendMessage(from, { image: { url: d.Poster }, caption: `🎬 *${d.Title}* (${d.Year})\n⭐ ${d.imdbRating}\n📝 ${d.Plot}\n🎭 ${d.Actors}`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text: '❌ Movie not found.' }, { quoted: m });
        }
    }
};

commands.country = {
    name: 'country',
    triggers: ['country'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: '⚠️ Country name likhein.' }, { quoted: m });
        const query = args.join(' ');
        try {
            const res = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`);
            const d = res.data[0];
            await sock.sendMessage(from, { text: `🌍 *${d.name.common}*\n🏙️ Capital: ${d.capital?.[0] || 'N/A'}\n👥 Population: ${d.population.toLocaleString()}\n🗣️ Language: ${Object.values(d.languages || {}).join(', ')}`, contextInfo: getForwardedContext() }, { quoted: m });
        } catch {
            await sock.sendMessage(from, { text: '❌ Country not found.' }, { quoted: m });
        }
    }
};

// ---------- 👥 GROUP ----------
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

commands.group = {
    name: 'group',
    triggers: ['group', 'gc'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `👥 *Official Group*\n🔗 https://chat.whatsapp.com/B65x2XGLu8S63k1SGzTuQV`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

// ---------- 📌 SAY/ECHO ----------
commands.say = {
    name: 'say',
    triggers: ['say', 'echo'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!args.length) return await sock.sendMessage(from, { text: `⚠️ Text likhein. Example: ${config.prefix}say Hello` }, { quoted: m });
        await sock.sendMessage(from, { text: `💬 *Echo:* ${args.join(' ')}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.hello = {
    name: 'hello',
    triggers: ['hello', 'hi'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `👋 Hello! Welcome to ${config.botName}.`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.bye = {
    name: 'bye',
    triggers: ['bye', 'goodbye'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: '👋 Goodbye! Have a great day!', contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.donate = {
    name: 'donate',
    triggers: ['donate', 'support'],
    async execute(sock, m, args, config) {
        await sock.sendMessage(m.key.remoteJid, { text: `💖 *Support:* wa.me/${config.owner}`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

commands.speed = {
    name: 'speed',
    triggers: ['speed'],
    async execute(sock, m, args, config) {
        const start = Date.now();
        await sock.sendMessage(m.key.remoteJid, { text: '🚀 Testing...', contextInfo: getForwardedContext() }, { quoted: m });
        await sock.sendMessage(m.key.remoteJid, { text: `⚡ *Speed Test*\n⏱️ ${Date.now() - start}ms`, contextInfo: getForwardedContext() }, { quoted: m });
    }
};

console.log('✅ All commands loaded successfully!');

// ========== START BOT (Call startBot) ==========
startBot().catch(err => console.log('Fatal:', err));
