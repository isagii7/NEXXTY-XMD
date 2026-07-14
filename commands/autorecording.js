const config = require('../config/config');

module.exports = {
    name: 'autorecording',
    description: 'Toggle automatic recording status for incoming messages.',
    async execute(sock, msg, args, commands) {
        if (!msg.key.fromMe) return; // Owner only

        if (args[0] === 'on') {
            config.AUTO_RECORDING = true;
            return await sock.sendMessage(msg.key.remoteJid, { text: '🎙️ *Auto-Recording:* ENABLED [🟢]' });
        } else if (args[0] === 'off') {
            config.AUTO_RECORDING = false;
            return await sock.sendMessage(msg.key.remoteJid, { text: '🎙️ *Auto-Recording:* DISABLED [🔴]' });
        }

        const status = config.AUTO_RECORDING ? 'ENABLED [🟢]' : 'DISABLED [🔴]';
        await sock.sendMessage(msg.key.remoteJid, { 
            text: `🎙️ *Auto-Recording Status:* ${status}\n\n💡 Use \`.autorecording on\` or \`.autorecording off\` to change it.` 
        });
    },
};
