module.exports = {
    name: "tag",
    description: "Mention everyone by replying to a text message.",

    async execute(sock, msg, args, isOwner) {
        const jid = msg.key.remoteJid;

        if (!jid.endsWith("@g.us")) {
            return sock.sendMessage(
                jid,
                { text: "❌ This command only works in groups." },
                { quoted: msg }
            );
        }

        if (!isOwner) {
            return sock.sendMessage(
                jid,
                { text: "❌ Only the bot owner can use this command." },
                { quoted: msg }
            );
        }

        const quoted =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.conversation) {
            return sock.sendMessage(
                jid,
                { text: "❌ Reply to a text message." },
                { quoted: msg }
            );
        }

        try {
            const metadata = await sock.groupMetadata(jid);

            const mentions = metadata.participants.map(p => p.id);

            await sock.sendMessage(
                jid,
                {
                    text: quoted.conversation,
                    mentions
                },
                { quoted: msg }
            );

        } catch (err) {
            console.error(err);

            await sock.sendMessage(
                jid,
                {
                    text: "❌ Failed to tag everyone.\n\n" + err.message
                },
                { quoted: msg }
            );
        }
    }
};
