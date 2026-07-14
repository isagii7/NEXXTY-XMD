/**
 * commands/pair.js
 * -------------------
 * Lets anyone generate their own ISAAC-MD SESSION_ID directly through the
 * bot, without needing a separate pairing website.
 * Usage: .pair 254712345678
 *
 * How it works:
 *   1. Spins up a SEPARATE, temporary Baileys socket (its own auth state,
 *      its own connection) — this is required because pairing is
 *      per-account, and we can't pair a different number onto the bot's
 *      own already-paired session.
 *   2. Requests a pairing code for the given number and sends it to the
 *      requester in chat.
 *   3. Once that temp socket reports connection === 'open' (meaning they
 *      entered the code successfully), reads its freshly-created
 *      creds.json, encodes it into the same ISAAC-MD:~<base64> SESSION_ID
 *      format connection.js already uses, and DMs it back to them.
 *   4. Disconnects the temp socket with sock.end() — NOT logout(). Logging
 *      out would revoke the linked-device session we just generated,
 *      making the SESSION_ID useless the moment it's created. end() just
 *      closes our local connection; the device stays linked on WhatsApp's
 *      side, exactly like restoreSessionFromEnv() expects to find later.
 *   5. Cleans up the temporary auth folder from disk either way.
 *
 * Only one pairing request is allowed in flight at a time — each temp
 * socket is a real, moderately heavy connection (handshake, key upload,
 * etc.), and running several at once isn't something a phone-hosted
 * deployment should be doing.
 */

const fs = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const PAIRING_TIMEOUT_MS = 3 * 60 * 1000; // give up after 3 minutes unlinked
let pairingInProgress = false;

module.exports = {
  name: 'pair',
  description: 'Generate a session for a number (owner only). Usage: .pair 254754574642',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;

    if (!msg.key.fromMe) {
      return sock.sendMessage(jid, { text: '❌ Only the owner can use this command.' }, { quoted: msg });
    }

    const number = (args[0] || '').replace(/[^0-9]/g, '');

    if (!number) {
      return sock.sendMessage(jid, { text: '❌ Usage: .pair 254754574642 (your number, country code, no +)' }, { quoted: msg });
    }

    if (pairingInProgress) {
      return sock.sendMessage(
        jid,
        { text: '❌ Another pairing is already in progress. Please wait a moment and try again.' },
        { quoted: msg }
      );
    }

    pairingInProgress = true;
    const tempAuthFolder = path.join(__dirname, '../temp_pair_sessions', `${number}_${Date.now()}`);

    let tempSock;
    let timeoutHandle;

    const cleanup = () => {
      pairingInProgress = false;
      clearTimeout(timeoutHandle);
      try {
        if (tempSock) tempSock.end(undefined); // disconnect only, never logout()
      } catch (_) {}
      try {
        fs.rmSync(tempAuthFolder, { recursive: true, force: true });
      } catch (_) {}
    };

    try {
      await sock.sendMessage(jid, { text: `⏳ Preparing a pairing code for +${number}...` }, { quoted: msg });

      const { state, saveCreds } = await useMultiFileAuthState(tempAuthFolder);
      const { version } = await fetchLatestBaileysVersion();

      tempSock = makeWASocket({
        version,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '120.0.6099.130'],
        defaultQueryTimeoutMs: 90000,
        connectTimeoutMs: 90000,
      });

      tempSock.ev.on('creds.update', saveCreds);

      let codeSent = false;

      tempSock.ev.on('connection.update', async (update) => {
        const { connection } = update;

        if (connection === 'connecting' && !codeSent) {
          codeSent = true;
          try {
            await new Promise((r) => setTimeout(r, 2000));
            const code = await tempSock.requestPairingCode(number);

            // Code goes in its own message, alone, so a tap/long-press
            // selects exactly the code with nothing else around it.
            await sock.sendMessage(jid, { text: `\`${code}\`` });

            await sock.sendMessage(
              jid,
              { text: `🔐 Enter the code above in WhatsApp on +${number} → Linked Devices → Link with phone number. You have 3 minutes.` },
              { quoted: msg }
            );
          } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Could not generate a pairing code: ' + e.message }, { quoted: msg });
            cleanup();
          }
        }

        if (connection === 'open') {
          try {
            const credsPath = path.join(tempAuthFolder, 'creds.json');
            const credsBuffer = fs.readFileSync(credsPath);
            const sessionId = `ISAAC-MD:~${credsBuffer.toString('base64')}`;

            await sock.sendMessage(
              jid,
              {
                text: `✅ *Linked successfully!*\n\n🔐 *Your SESSION_ID:*\nSave this somewhere safe — treat it like a password. Paste it into your own deployment's SESSION_ID environment variable.\n\n${sessionId}`,
              },
              { quoted: msg }
            );
          } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Linked, but could not read the session: ' + e.message }, { quoted: msg });
          } finally {
            cleanup();
          }
        }
      });

      timeoutHandle = setTimeout(async () => {
        if (pairingInProgress) {
          await sock.sendMessage(jid, { text: '⌛ Pairing timed out. Run .pair again to retry.' }, { quoted: msg });
          cleanup();
        }
      }, PAIRING_TIMEOUT_MS);
    } catch (e) {
      await sock.sendMessage(jid, { text: '❌ Could not start pairing: ' + e.message }, { quoted: msg });
      cleanup();
    }
  },
};
