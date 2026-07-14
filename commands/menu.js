const os = require('os');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// ========== HELPER FUNCTIONS ==========
function formatCommand(text) {
    return `\`\`\`${text.toUpperCase()}\`\`\``;
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

// ========== FORWARDED CONTEXT (NEXTY SUPPORT CHANNEL) ==========
function getForwardedContext() {
    return {
        forwardingScore: 999, // "Forwarded many times" dikhane ke liye
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363410907774725@newsletter', // آپ کا چینل JID
            newsletterName: 'NEXTY SUPPORT', // چینل کا نام
            serverMessageId: 143
        }
    };
}

module.exports = {
    name: 'menu',
    description: 'Displays the command menu with audio and forwarded context.',
    async execute(sock, msg, args, commands) {
        const jid = msg.key.remoteJid;

        // ========== SYSTEM INFO ==========
        const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
        const freeRamGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
        const usedRamGb = (parseFloat(totalRamGb) - parseFloat(freeRamGb)).toFixed(1);
        const uptimeSeconds = process.uptime();
        const systemDate = new Date();
        const currentDate = new Intl.DateTimeFormat('en-GB', {
            timeZone: config.timezone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(systemDate);
        const currentTime = new Intl.DateTimeFormat('en-US', {
            timeZone: config.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(systemDate);

        // ========== MENU TEXT ==========
        let menuMessage = `┌──────────────────────────────┐\n`;
        menuMessage += `  🤖 *_NEXXTY-XMD_*\n`;
        menuMessage += `  ━━━━━━━━━━━━━━━━━━━━━━━\n`;
        menuMessage += `  ⚡ Prefix : [ ${config.prefix || '.'} ]\n`;
        menuMessage += `  🔒 Mode   : ${(config.WORK_TYPE || 'public').toUpperCase()}\n`;
        menuMessage += `  🕒 Time   : ${currentTime}\n`;
        menuMessage += `  🗓️ Date   : ${currentDate}\n`;
        menuMessage += `  💾 Ram    : ${usedRamGb} GB / ${totalRamGb} GB\n`;
        menuMessage += `  ⏱️ Uptime : ${formatUptime(uptimeSeconds)}\n`;
        menuMessage += `  🔌 Plugins : ${commands.size} commands\n`;
        menuMessage += `└──────────────────────────────┘\n`;

        // Categories (آپ کی تمام کیٹیگریز)
        const categories = {
            'GROUP': ['demote', 'groupinfo', 'kick', 'mute', 'promote', 'tagall', 'warn', 'add', 'invite', 'join', 'welcome', 'goodbye', 'unmute', 'amute', 'aunmute', 'ban', 'unban', 'close', 'open', 'desc', 'subject', 'link', 'revoke', 'icon', 'hidetag', 'antilink', 'setgreet', 'tag', 'disp-1', 'disp-7', 'disp-90', 'disp-off', 'approve', 'reject', 'admin', 'vcf', 'groupstatus', 'foreigners'],
            'SETTINGS': ['anticall', 'autoread', 'autorecording', 'autotyping', 'mode', 'prefix', 'autoview', 'pdm', 'zushi'],
            'DOWNLOAD': ['download', 'audio', 'spotify', 'play', 'tiktok', 'ig', 'fb', 'twitter', 'song', 'shazam', 'lyrics', 'lyrics2'],
            'GAMES': ['game', 'tictactoe', 'move', 'ttend', 'rps', 'wordguess', 'guess', 'wgend', 'mathquiz', 'mans', 'answer'],
            'WHATSAPP': ['poll', 'react', 'del', 'setstatus', 'status', 'online', 'caption', 'doc', 'antiedit', 'cinfo', 'clear', 'save1'],
            'AI': ['gemini', 'groq', 'worm', 'gpt', 'dall', 'bing', 'upscale', 'lydia', 'vision', 'void', 'claude', 'wormgpt', 'gptdm'],
            'SECURITY': ['antifake', 'antigm', 'antigstatus', 'antispam', 'antiword', 'common', 'gpp', 'gstatus'],
            'USER': ['block', 'unblock', 'pp', 'fullpp', 'jid', 'gjid', 'left', 'ison'],
            'OWNER': ['owner', 'pair', 'settings', 'kill', 'backup', 'reminder', 'task', 'update', 'updatenow', 'eval', 'gauth', 'antilinkall', 'antidelete', 'autolike', 'autobio', 'menutype', 'wapresence', 'badword', 'antibot', 'antitag', 'welcomegoodbye', 'broadcast', 'restart', 'blocklist', 'logout', 'fetch', 'shell', 'getcmd', 'getfile', 'cat', 'addsudo', 'delsudo', 'checksudo', 'clearsudos'],
            'TOOLS': ['webscan', 'apk', 'clearcache', 'qr', 'url', 'imagesearch', 'define'],
            'FOOTBALL': ['livescore', 'standings', 'table', 'bundesliga', 'epl', 'laliga', 'ligue1', 'seriea', 'ucl', 'news', 'playersearch', 'teamsearch', 'fifa', 'fifaplayoffs', 'euro', 'eplscorers', 'laligascorers', 'bundesligascorers', 'serieascorers', 'ligue1scorers', 'uclscorers'],
            'CODING': ['enc', 'gpass', 'compile-py', 'compile-js', 'compile-c', 'compile-c++'],
            'CONVERTER': ['topdf', 'toexcel', 'toword', 'tovideo', 'toaudio', 'toimg', 'ocr', 'totext', 'carbon', 'cut', 'merge'],
            'MEDIA': ['s', 'take', 'mix', 'smeme', 'vv', 'vv2', 'botpp', 'getpfp', 'removebg', 'similarimage', 'remini', 'remini2', 'save'],
            'MISC': ['isaac', 'script', 'calc', 'donate', 'alive', 'help', 'joke', 'menu', 'ping', 'quote', 'user', 'stats', 'uptime', 'time'],
        };
        for (const [categoryName, commandList] of Object.entries(categories)) {
            menuMessage += ` ╭─❏ ${categoryName} ❏\n`;
            commandList.forEach(cmd => {
                menuMessage += ` │ ${formatCommand(cmd)}\n`;
            });
            menuMessage += ` ╰─────────────────\n`;
        }

        // ========== 📤 SEND TEXT MENU WITH FORWARDED CONTEXT ==========
        await sock.sendMessage(jid, {
            text: menuMessage,
            contextInfo: getForwardedContext() // 🔥 "Forwarded from NEXTY SUPPORT"
        });

        // ========== 🎵 SEND AUDIO (assets/menu.m4a) ==========
        try {
            const audioPath = path.join(__dirname, '..', 'assets', 'menu.m4a');
            if (fs.existsSync(audioPath)) {
                const audioBuffer = fs.readFileSync(audioPath);
                await sock.sendMessage(jid, {
                    audio: audioBuffer,
                    mimetype: 'audio/mp4',
                    fileName: 'menu.m4a',
                    ptt: false // وائس نوٹ کے لیے true کریں
                });
                console.log('✅ Menu audio sent successfully.');
            } else {
                console.warn('⚠️ menu.m4a not found at', audioPath);
            }
        } catch (error) {
            console.error('❌ Error sending menu audio:', error);
        }
    }
};
