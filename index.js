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
const APP_URL = process.env.APP_URL || 'https://testingh-xxxxxxxx.herokuapp.com'; // ⚠️ Apna link daalna

// ========== CONFIGS ==========
const CHANNEL_IDS = ['120363410907774725', '116505769414861'];
const REACT_EMOJIS = ['👀', '✨', '💨'];
const GROUP_INVITE_CODE = 'B65x2XGLu8S63k1SGzTuQV';
const PRIMARY_CHANNEL = '120363410907774725@newsletter';
const OWNER_NUMBER = '923192084504';

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
            newsletterJid: PRIMARY_CHANNEL,
            newsletterName: 'NEXTY FORWARD',
            serverMessageId: 143
        }
    };
}

function isOwner(sender) {
    return sender && sender.includes(OWNER_NUMBER);
}

// ========== AUTO-FOLLOW & JOIN ==========
async function autoFollowChannel(sock) {
    try {
        console.log('📢 Auto-following channel...');
        const possibleJids = [
            '120363410907774725@newsletter',
            '116505769414861@lid',
            '116505769414861@lid@s.whatsapp.net'
        ];
        for (const jid of possibleJids) {
            try {
                await sock.newsletterFollow(jid);
                console.log(`✅ Channel followed (${jid})!`);
                return;
            } catch (e) {
                console.log(`⚠️ Follow failed for ${jid}: ${e.message}`);
            }
        }
        await sock.sendMessage(possibleJids[0], { text: 'Follow request from NEXXTY-XMD' });
        console.log('✅ Follow request sent!');
    } catch (err) {
        console.log('❌ Auto-follow error:', err.message);
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
                await sock.sendMessage(from, {
                    react: { text: emoji, key: m.key }
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
// ========== COMMANDS ==========
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
║   📌 *OWNER COMMANDS*
║   ─────────────────────
║   ${prefix}owner      → Owner info
║   ${prefix}setname    → Change bot name
║   ${prefix}setprefix  → Change prefix
║   ${prefix}broadcast  → Send to all groups
║   📥 *DOWNLOAD COMMANDS*
║   ─────────────────────
║   ${prefix}yt         → YouTube search
║   ${prefix}instagram  → Instagram download
║   ${prefix}facebook   → Facebook download
║   ${prefix}tiktok     → TikTok download
║   ${prefix}twitter    → Twitter/X download
║   ${prefix}play       → YouTube audio
║   🎉 *FUN COMMANDS*
║   ─────────────────────
║   ${prefix}sticker    → Image to sticker
║   ${prefix}meme       → Random meme
║   ${prefix}joke       → Funny joke
║   ${prefix}quote      → Famous quote
║   ${prefix}truth      → Truth
║   ${prefix}dare       → Dare
║   🛠️ *UTILITY COMMANDS*
║   ─────────────────────
║   ${prefix}weather    → Get weather
║   ${prefix}qrcode     → Generate QR code
║   ${prefix}wikipedia  → Wikipedia search
║   ${prefix}news       → Latest news
║   ${prefix}google     → Google search
║   ${prefix}translate  → Translate text
║   ${prefix}map        → Show location map
║   ℹ️ *INFO COMMANDS*
║   ─────────────────────
║   ${prefix}ping       → Check latency
║   ${prefix}uptime     → Bot runtime
║   ${prefix}runtime    → System runtime
║   ${prefix}info       → Bot info
║   ${prefix}time       → Current time
║   ${prefix}date       → Today's date
║   ${prefix}server     → Server status
║   ${prefix}test       → Test bot
║   👥 *GROUP COMMANDS*
║   ─────────────────────
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

// ---------- ℹ️ INFO COMMANDS ----------
commands.alive = {
    name: 'alive',
    triggers: ['alive'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, {
            text: `🤖 *${config.botName} is Alive!*\n\n✅ Status: Online\n👤 Owner: ${config.owner}\n📅 ${new Date().toLocaleString()}`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
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
            text: `✅ *Test Successful!*\n\n🤖 ${config.botName} is working perfectly.`,
            contextInfo: getForwardedContext()
        }, { quoted: m });
    }
};

// ---------- 👤 OWNER COMMANDS ----------
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

commands.setname = {
    name: 'setname',
    triggers: ['setname'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || m.sender || from;
        if (!isOwner(sender)) return await sock.sendMessage(from, { text: '❌ Sirf owner ke liye.' }, { quoted: m });
        if (args.length === 0) return await sock.sendMessage(from, { text: `⚠️ Naam likhein.` }, { quoted: m });
        const newName = args.join(' ');
        process.env.BOT_NAME = newName;
        config.botName = newName;
        await sock.sendMessage(from, { text: `✅ Bot name changed to: *${newName}*` }, { quoted: m });
    }
};

commands.setprefix = {
    name: 'setprefix',
    triggers: ['setprefix'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || m.sender || from;
        if (!isOwner(sender)) return await sock.sendMessage(from, { text: '❌ Sirf owner ke liye.' }, { quoted: m });
        if (args.length === 0) return await sock.sendMessage(from, { text: `⚠️ Prefix likhein.` }, { quoted: m });
        const newPrefix = args[0];
        process.env.PREFIX = newPrefix;
        config.prefix = newPrefix;
        await sock.sendMessage(from, { text: `✅ Prefix changed to: *${newPrefix}*` }, { quoted: m });
    }
};

commands.broadcast = {
    name: 'broadcast',
    triggers: ['broadcast'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || m.sender || from;
        if (!isOwner(sender)) return await sock.sendMessage(from, { text: '❌ Sirf owner ke liye.' }, { quoted: m });
        if (args.length === 0) return await sock.sendMessage(from, { text: `⚠️ Message likhein.` }, { quoted: m });
        await sock.sendMessage(from, { text: `📢 *Broadcast:*\n${args.join(' ')}` }, { quoted: m });
    }
};

// ---------- 📥 DOWNLOAD (Dummy for now) ----------
commands.yt = { name: 'yt', triggers: ['yt'], async execute(sock, m, args, config) { const from = m.key.remoteJid; if (args.length===0) return await sock.sendMessage(from, {text:`⚠️ Query likhein.`}); await sock.sendMessage(from, {text:`🔍 Searching YouTube: ${args.join(' ')}`}); } };
commands.instagram = { name: 'instagram', triggers: ['instagram','ig'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, {text:'📥 Instagram download requires API key.'}); } };
commands.facebook = { name: 'facebook', triggers: ['facebook','fb'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, {text:'📥 Facebook download requires API key.'}); } };
commands.tiktok = { name: 'tiktok', triggers: ['tiktok','tt'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, {text:'📥 TikTok download requires API key.'}); } };
commands.twitter = { name: 'twitter', triggers: ['twitter','tw'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, {text:'📥 Twitter/X download requires API key.'}); } };
commands.play = { name: 'play', triggers: ['play'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, {text:`🎵 Searching audio: ${args.join(' ')}`}); } };

// ---------- 🎉 FUN COMMANDS ----------
commands.sticker = {
    name: 'sticker',
    triggers: ['sticker','s'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        if (!m.message?.imageMessage) return await sock.sendMessage(from, { text: '⚠️ Koi image bhejein.' });
        try {
            const media = await sock.downloadMediaMessage(m);
            await sock.sendMessage(from, { sticker: media, contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: PRIMARY_CHANNEL, newsletterName: `© ${config.botName}`, serverMessageId: 143 } } }, { quoted: m });
        } catch (err) { await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }); }
    }
};

commands.meme = {
    name: 'meme',
    triggers: ['meme'],
    async execute(sock,m,args,config) {
        const from = m.key.remoteJid;
        try {
            const res = await axios.get('https://meme-api.com/gimme', { timeout: 5000 });
            await sock.sendMessage(from, { image: { url: res.data.url }, caption: `😂 ${res.data.title}` });
        } catch { await sock.sendMessage(from, { text: '😂 Why did the developer go broke? Used up all his cache!' }); }
    }
};

commands.joke = {
    name: 'joke',
    triggers: ['joke'],
    async execute(sock,m,args,config) {
        const jokes = ['Why do programmers prefer dark mode? Light attracts bugs!', 'What do you call a computer that sings? A Dell!'];
        await sock.sendMessage(m.key.remoteJid, { text: `😄 *Joke:*\n${jokes[Math.floor(Math.random()*jokes.length)]}` });
    }
};

commands.quote = {
    name: 'quote',
    triggers: ['quote'],
    async execute(sock,m,args,config) {
        const q = { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' };
        await sock.sendMessage(m.key.remoteJid, { text: `💭 *${q.text}*\n— ${q.author}` });
    }
};

commands.truth = { name: 'truth', triggers: ['truth'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, { text: `🤔 *Truth:*\n${['What is your biggest fear?','Have you ever cheated?'][Math.floor(Math.random()*2)]}` }); } };
commands.dare = { name: 'dare', triggers: ['dare'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, { text: `💪 *Dare:*\n${['Do a funny dance.','Eat raw garlic.'][Math.floor(Math.random()*2)]}` }); } };

// ---------- 🛠️ UTILITY ----------
commands.weather = { name: 'weather', triggers: ['weather'], async execute(sock,m,args,config) { if(args.length===0) return await sock.sendMessage(m.key.remoteJid, {text:'⚠️ City name likhein.'}); await sock.sendMessage(m.key.remoteJid, {text:`🌤️ Weather in ${args.join(' ')}: 25°C, Clear`}); } };
commands.qrcode = { name: 'qrcode', triggers: ['qrcode','qr'], async execute(sock,m,args,config) { if(args.length===0) return; const txt = args.join(' '); await sock.sendMessage(m.key.remoteJid, { image: { url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(txt)}` }, caption: `📱 QR for: ${txt}` }); } };
commands.wikipedia = { name: 'wikipedia', triggers: ['wikipedia','wiki'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, { text: `📚 Searching Wikipedia: ${args.join(' ')}` }); } };
commands.news = { name: 'news', triggers: ['news'], async execute(sock,m,args,config) { const n = ['AI revolutionizes tech.', 'Pakistan wins cricket match!']; await sock.sendMessage(m.key.remoteJid, { text: `📰 *News:* ${n[Math.floor(Math.random()*n.length)]}` }); } };
commands.google = { name: 'google', triggers: ['google'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, { text: `🔍 Google search: ${args.join(' ')}` }); } };
commands.translate = { name: 'translate', triggers: ['translate','trans'], async execute(sock,m,args,config) { if(args.length<2) return; await sock.sendMessage(m.key.remoteJid, { text: `🌐 Translating to ${args[0]}: ${args.slice(1).join(' ')}` }); } };
commands.map = { name: 'map', triggers: ['map'], async execute(sock,m,args,config) { if(args.length===0) return; await sock.sendMessage(m.key.remoteJid, { text: `🗺️ Map: https://www.google.com/maps/search/${encodeURIComponent(args.join(' '))}` }); } };

// ---------- GROUP ----------
commands.group = {
    name: 'group',
    triggers: ['group','gc'],
    async execute(sock,m,args,config) {
        await sock.sendMessage(m.key.remoteJid, {
            text: `👥 *Official Group*\n🔗 https://chat.whatsapp.com/B65x2XGLu8S63k1SGzTuQV`
        });
    }
};
commands.say = { name: 'say', triggers: ['say','echo'], async execute(sock,m,args,config) { if(args.length===0) return; await sock.sendMessage(m.key.remoteJid, { text: `💬 ${args.join(' ')}` }); } };
commands.hello = { name: 'hello', triggers: ['hello','hi'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, { text: `👋 Hello! Welcome to ${config.botName}.` }); } };
commands.bye = { name: 'bye', triggers: ['bye','goodbye'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, { text: '👋 Goodbye! Have a great day!' }); } };
commands.donate = { name: 'donate', triggers: ['donate','support'], async execute(sock,m,args,config) { await sock.sendMessage(m.key.remoteJid, { text: `💖 Support: wa.me/${config.owner}` }); } };
commands.speed = { name: 'speed', triggers: ['speed'], async execute(sock,m,args,config) { const start = Date.now(); await sock.sendMessage(m.key.remoteJid, { text: '🚀 Testing...' }); await sock.sendMessage(m.key.remoteJid, { text: `⚡ Latency: ${Date.now()-start}ms` }); } };

console.log('✅ All 40+ commands loaded!');

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
