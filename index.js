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
const APP_URL = process.env.APP_URL || 'https://tesster-b01b03c2361e.herokuapp.com';

app.get('/', (req, res) => res.send('Mini Bot is running!'));
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = 'Mini-NEXXTY';
const OWNER_NUMBER = '923192084504';
const PREFIX = '.';

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
    } catch (err) {
        console.log('❌ Session parse error:', err.message);
    }
}

const commands = {};
commands.ping = {
    name: 'ping',
    triggers: ['ping'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, { text: '🏓 Pong!' });
    }
};
commands.menu = {
    name: 'menu',
    triggers: ['menu'],
    async execute(sock, m, args, config) {
        const from = m.key.remoteJid;
        await sock.sendMessage(from, { text: 'Menu: .ping, .menu' });
    }
};
console.log('✅ Minimal commands loaded');

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
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (u) => {
        const { connection, qr } = u;
        if (qr && !SESSION_ID) {
            console.log('📱 Scan QR:');
            require('qrcode-terminal').generate(qr, { small: true });
        }
        if (connection === 'open') console.log(`✅ ${BOT_NAME} ONLINE!`);
    });
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m || !m.message) return;
            const from = m.key.remoteJid;
            let text = '';
            if (m.message?.conversation) text = m.message.conversation;
            else if (m.message?.extendedTextMessage?.text) text = m.message.extendedTextMessage.text;
            if (!text || !text.startsWith(PREFIX)) return;
            const args = text.slice(PREFIX.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands[cmdName];
            if (cmd) {
                console.log(`🔍 Command: ${cmdName}`);
                await cmd.execute(sock, m, args, {});
                console.log(`✅ ${cmdName} executed`);
            }
        } catch (err) {
            console.log('❌ Messages error:', err.message);
        }
    });
}
startBot().catch(err => console.log('Fatal:', err));
