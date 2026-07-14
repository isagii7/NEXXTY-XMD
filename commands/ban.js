/**
 * commands/ban.js
 * ----------------
 * Bans a user from using any bot command. Owner-only.
 * Usage:
 *   .ban @user        (mention)
 *   .ban (as a reply to the target's message)
 */
const { isOwner } = require('../utils/isOwner');
const { banUser, isBanned } = require('../utils/banList');

module.exports = {
    name: 'ban',
    description: 'Bans a user from using bot commands (owner only).',
    async execute(sock, msg, args) {
        const jid = msg.key.remoteJid;

        if (!isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
        }

        // Resolve target: mentioned user, or the person being replied to
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const repliedTo = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const target = mentioned || repliedTo;

        if (!target) {
            return sock.sendMessage(jid, {
                text: '❌ Mention a user or reply to their message.\n\nUsage: *.ban @user* or reply to their message with *.ban*',
            }, { quoted: msg });
        }

        if (isBanned(target)) {
            return sock.sendMessage(jid, { text: `ℹ️ @${target.split('@')[0]} is already banned.`, mentions: [target] }, { quoted: msg });
        }

        banUser(target);

        await sock.sendMessage(jid, {
            text: `🚫 @${target.split('@')[0]} has been banned from using bot commands.`,
            mentions: [target],
        }, { quoted: msg });
    },
};
