/**
 * utils/logger.js
 * ---------------
 * Centralized logger for the whole application.
 *
 * Using a single shared logger instance means every part of the bot
 * (commands, events, core connection logic) logs in a consistent format,
 * and we only have to configure the logging library in one place.
 *
 * We use 'pino' because Baileys already depends on it internally for its
 * own internal logging, so reusing it avoids pulling in a second logging
 * library just for our application code.
 */

const pino = require('pino');

// pino-pretty is optional eye-candy for development. We try to use it,
// but fall back gracefully to plain pino output if it's not installed,
// so the bot never crashes just because of a missing dev dependency.
let transport;
try {
  require.resolve('pino-pretty');
  transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
} catch {
  transport = undefined; // pino-pretty not installed -> use default JSON output
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport,
});

module.exports = logger;
