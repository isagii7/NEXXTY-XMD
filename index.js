const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ========== EXPRESS SERVER ==========
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('NEXXTY-XMD Bot is running!'));
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// ========== CONFIG ==========
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = process.env.BOT_NAME || 'NEXXTY-XMD';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '923001234567';
const PREFIX = process.env.PREFIX || '.';

console.log(`🤖 Bot: ${BOT_NAME}`);
console.log(`🔑 Session: ${SESSION_ID ? '✅ Provided' : '❌ Missing'}`);

// ========== SESSION HANDLER (NEXTY-MD~ FORMAT) ==========
const sessionDir = './session';
if (SESSION_ID && SESSION_ID.startsWith('NEXTY-MD~')) {
    try {
        const base64Data = SESSION_ID.replace('NEXTY-MD~', '');
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        const sessionData = JSON.parse(jsonString);

        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);
        
        for (const [key, value] of Object.entries(sessionData)) {
            const filePath = path.join(sessionDir, key);
            fs.writeFileSync(filePath, typeof value === 'string' ? value : JSON.stringify(value));
        }
        console.log('✅ Session restored successfully from NEXTY-MD~ format');
    } catch (err) {
        console.log('❌ Failed to parse session:', err.message);
    }
}

// ========== LOAD COMMANDS ==========
const commands = {};
const cmdFiles = fs.readdirSync('./plugins').filter(f => f.endsWith('.js'));
for (const file of cmdFiles) {
    const cmd = require(`./plugins/${file}`);
    if (cmd.name && cmd.execute) {
        commands[cmd.name] = cmd;
        if (cmd.triggers) cmd.triggers.forEach(t => commands[t] = cmd);
        console.log(`✅ Loaded: ${cmd.name}`);
    }
}

// ========== START BOT ==========
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['NEXXTY-XMD', 'Chrome', '1.0.0'],
        printQRInTerminal: !SESSION_ID,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr && !SESSION_ID) {
            require('qrcode-terminal').generate(qr, { small: true });
        }
        if (connection === 'open') console.log(`✅ ${BOT_NAME} is online!`);
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
            else console.log('❌ Logged out. Restart required.');
        }
    });

    sock.ev.on('messages.upsert', async (msg) => {
        const m = msg.messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!text.startsWith(PREFIX)) return;

        const args = text.slice(PREFIX.length).trim().split(/\s+/);
        const cmdName = args.shift().toLowerCase();
        const cmd = commands[cmdName];
        if (cmd) {
            try {
                console.log(`🔍 Command: ${cmdName} from ${from}`);
                await cmd.execute(sock, m, args, { botName: BOT_NAME, owner: OWNER_NUMBER, prefix: PREFIX });
                console.log(`✅ Executed: ${cmdName}`);
            } catch (err) {
                console.log(`❌ Error: ${err.message}`);
                await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: m });
            }
        }
    });
}

startBot().catch(err => console.log('Fatal:', err));
