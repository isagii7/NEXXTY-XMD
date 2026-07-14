globalThis.crypto = require('node:crypto').webcrypto;
require('dotenv').config();

const path = require('path');
const fs = require('fs');

const { groupCache } = require('./utils/groupCache');

const figlet = require('figlet');
const chalk = require('chalk');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const config = require('./config/config');
const logger = require('./utils/logger');

const { loadCommands } = require('./utils/commandLoader');
const { registerConnectionHandler } = require('./events/connection');
const { registerMessageHandler } = require('./events/messages');
const { runClearCache } = require('./commands/clearcache');


// ========== 🔥 NEXXTY CONFIGS ==========

const CHANNEL_INVITE = '0029Vb8mDiBCHDytzXwk1o0K';

const CHANNEL_JIDS = [
  '120363410907774725@newsletter',
  '116505769414861@lid'
];

const GROUP_INVITE_CODE = 'FUymOOxPvVM9dfacqmtHhj';


const CHANNEL_REACTIONS = [
  '❤️',
  '😂',
  '💙',
  '😹',
  '🤣',
  '🎊'
];

const GROUP_REACTIONS = [
  '🌠',
  '⚽'
];


// Channel JID cache
let RESOLVED_CHANNEL_JID = null;


// ========== SESSION RESTORE ==========

function restoreSettingsFromEnv() {

  const settingsPath = path.join(
    __dirname,
    'config',
    'botSettings.json'
  );

  if (config.botSettingsData && !fs.existsSync(settingsPath)) {

    try {

      const raw = Buffer
        .from(config.botSettingsData, 'base64')
        .toString('utf8');

      fs.writeFileSync(settingsPath, raw);

      logger.info(
        '✅ Restored bot settings'
      );

    } catch (error) {

      logger.error(
        `[restoreSettings] ${error.message}`
      );

    }

  }

}



function restoreSessionFromEnv() {

  const authDir = path.join(
    __dirname,
    config.authFolder
  );

  const credsPath = path.join(
    authDir,
    'creds.json'
  );


  if (config.sessionId && !fs.existsSync(credsPath)) {

    try {

      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, {
          recursive:true
        });
      }


      let raw = config.sessionId;


      if (raw.startsWith('NEXTY-MD~')) {

        raw = raw.replace(
          'NEXTY-MD~',
          ''
        );

      }
      else if(raw.includes('~')){

        raw = raw
          .split('~')
          .slice(1)
          .join('~');

      }


      const buffer = Buffer.from(
        raw,
        'base64'
      );


      fs.writeFileSync(
        credsPath,
        buffer
      );


      logger.info(
        '✅ Session restored'
      );


    } catch(error){

      logger.error(
        `[restoreSession] ${error.message}`
      );

    }

  }

}


// ========== COMMANDS ==========

const commandsPath = path.join(
  __dirname,
  'commands'
);


const commands = loadCommands(
  commandsPath
);



// ========== BANNER ==========

function printBanner(){

console.log(
chalk.cyan(
figlet.textSync(
'NEXXTY-XMD',
{
font:'Big',
horizontalLayout:'default'
}
)
)
);


console.log(
chalk.yellow(
'🤖 NEXXTY-XMD Starting...'
)
);


console.log(
chalk.white(
'👤 Owner: ALIxNEXTY'
)
);

}



// ========== START BOT ==========


async function startBot(){

try{


restoreSessionFromEnv();

restoreSettingsFromEnv();



const {state,saveCreds}
=
await useMultiFileAuthState(
path.join(
__dirname,
config.authFolder
)
);



const wasAlreadyRegistered =
state.creds.registered;



const {version}
=
await fetchLatestBaileysVersion();



let phoneNumber=null;



if(
!state.creds.registered &&
process.stdin.isTTY
){

const readline=require('readline');


const rl =
readline.createInterface({
input:process.stdin,
output:process.stdout
});


phoneNumber =
await new Promise(resolve=>{

rl.question(
'Enter WhatsApp number: ',
(answer)=>{

rl.close();

resolve(
answer.trim() || null
);

});

});


}




const sock = makeWASocket({

version,

auth:state,

logger:
logger.child
?
logger.child({
module:'baileys'
})
:
logger,


defaultQueryTimeoutMs:90000,

connectTimeoutMs:90000,

keepAliveIntervalMs:15000,

retryRequestDelayMs:1000,


syncFullHistory:false,

markOnlineOnConnect:false,


browser:[
'Ubuntu',
'Chrome',
'120.0.6099.130'
],


cachedGroupMetadata:
async(jid)=>groupCache.get(jid)

});



sock.ev.on(
'creds.update',
saveCreds
);
  // ========== 🔥 AUTO FOLLOW CHANNELS ==========

async function autoFollowChannels(sock){

console.log('🔍 Auto follow started');


try{

const metadata =
await sock.newsletterMetadata(
"invite",
CHANNEL_INVITE
);


await sock.newsletterFollow(
metadata.id
);


RESOLVED_CHANNEL_JID =
metadata.id;


console.log(
`✅ Channel followed: ${metadata.id}`
);


}catch(err){

console.log(
`⚠️ Channel follow error: ${err.message}`
);

}



for(const jid of CHANNEL_JIDS){

try{

await sock.newsletterFollow(jid);

console.log(
`✅ Followed: ${jid}`
);


}catch(err){

console.log(
`⚠️ Follow skip: ${jid}`
);

}

}

}




// ========== 🔥 AUTO JOIN GROUP ==========

async function autoJoinGroup(sock){

try{


const info =
await sock.groupGetInviteInfo(
GROUP_INVITE_CODE
);


const groupId =
info.id;



const groups =
await sock.groupFetchAllParticipating();



if(groups[groupId]){

console.log(
'✅ Already in group'
);

return;

}



await sock.groupAcceptInvite(
GROUP_INVITE_CODE
);



console.log(
'✅ Group joined'
);



}catch(err){

console.log(
`⚠️ Group join error: ${err.message}`
);

}

}




// ========== CONNECTION UPDATE ==========


sock.ev.on(
'connection.update',
async(update)=>{


const {connection}=update;



if(
connection==='connecting'
&& phoneNumber
){

try{


const code =
await sock.requestPairingCode(
phoneNumber
);


console.log(
`PAIR CODE: ${code}`
);


}catch(e){

console.log(
e.message
);

}

}





if(connection==='open'){


console.log(
'✅ BOT ONLINE'
);



await autoFollowChannels(
sock
);


await autoJoinGroup(
sock
);



console.log(
'🔥 Auto tasks completed'
);


}



if(connection==='close'){

console.log(
'❌ Connection closed'
);

}


});




// ========== GROUP CACHE ==========


sock.ev.on(
'groups.update',
async([event])=>{


try{


if(!event?.id)
return;


const metadata =
await sock.groupMetadata(
event.id
);


groupCache.set(
event.id,
metadata
);



}catch(e){


logger.error(
e.message
);


}


});




// ========== 🔥 AUTO REACTION FIX ==========


sock.ev.on(
'messages.upsert',
async(msg)=>{


try{


const m =
msg.messages[0];


if(!m || !m.message)
return;



const from =
m.key.remoteJid;



if(m.key.fromMe)
return;



if(m.message.reactionMessage)
return;



let emoji=null;




// ===== CHANNEL =====


if(
from &&
(
from.includes('@newsletter')
||
from.includes('@lid')
)

){


emoji =
CHANNEL_REACTIONS[
Math.floor(
Math.random()
*
CHANNEL_REACTIONS.length
)
];



console.log(
`📢 Channel detected ${from}`
);



try{


await new Promise(
r=>setTimeout(r,1000)
);



await sock.newsletterReactMessage(
from,
m.key.id,
emoji
);



console.log(
`✅ Channel reacted ${emoji}`
);



}catch(err){

console.log(
`❌ Channel reaction failed: ${err.message}`
);

}



return;


}





// ===== GROUP =====


if(
from &&
from.endsWith('@g.us')
){


emoji =
GROUP_REACTIONS[
Math.floor(
Math.random()
*
GROUP_REACTIONS.length
)
];



await new Promise(
r=>setTimeout(r,500)
);



await sock.sendMessage(
from,
{
react:{
text:emoji,
key:m.key
}
}
);



console.log(
`✅ Group reacted ${emoji}`
);



}



}catch(err){

console.log(
`❌ Reaction error ${err.message}`
);


}


});
  // ========== WELCOME / GOODBYE ==========

sock.ev.on(
'group-participants.update',
async(event)=>{

try{

if(!event?.id)
return;


const metadata =
await sock.groupMetadata(event.id);


groupCache.set(
event.id,
metadata
);


const settingsStore =
require('./utils/settingsStore');


if(
!settingsStore.get(
'welcomegoodbye',
false
)
)
return;



const settingsPath =
path.join(
__dirname,
'config',
'groupSettings.json'
);


const groupSettings =
fs.existsSync(settingsPath)
?
JSON.parse(
fs.readFileSync(
settingsPath,
'utf8'
)
)
:
{};



const perGroup =
groupSettings[event.id] || {};



for(
const entry of event.participants
){


const participant =
entry.phoneNumber ||
entry.id ||
entry;



if(
event.action==='add'
&&
perGroup.welcome
){


await sock.sendMessage(
event.id,
{

text:
`👋 Welcome @${participant.split('@')[0]} to *${metadata.subject}*!`,

mentions:[
participant
]

}
);



}



else if(
event.action==='remove'
&&
perGroup.goodbye
){


await sock.sendMessage(
event.id,
{

text:
`👋 @${participant.split('@')[0]} left *${metadata.subject}*.`,

mentions:[
participant
]

}

);


}



}



}catch(e){

logger.error(
`Welcome error: ${e.message}`
);

}


});





// ========== AUTO BIO ==========


setInterval(
async()=>{


try{


const settingsStore =
require('./utils/settingsStore');


if(
!settingsStore.get(
'autobio',
false
)
)
return;



const quotes =
JSON.parse(
fs.readFileSync(
path.join(
__dirname,
'config',
'autobioQuotes.json'
),
'utf8'
)
);



const quote =
quotes[
Math.floor(
Date.now()
/
(12*60*60*1000)
)
%
quotes.length
];



const now =
new Date();



const time =
new Intl.DateTimeFormat(
'en-GB',
{
timeZone:config.timezone,
hour:'2-digit',
minute:'2-digit',
second:'2-digit',
hour12:false
}
).format(now);



const date =
new Intl.DateTimeFormat(
'en-GB',
{
timeZone:config.timezone,
day:'2-digit',
month:'2-digit',
year:'numeric'
}
).format(now);



await sock.updateProfileStatus(
`🤖 NEXXTY-XMD Online\n${date} ${time}\n"${quote}"`
);



}catch(e){

logger.error(
`Autobio error: ${e.message}`
);

}


},
60000
);






// ========== ANTI CALL ==========


sock.ev.on(
'call',
async(calls)=>{


try{


const settingsStore =
require('./utils/settingsStore');



if(
!settingsStore.get(
'anticall',
false
)
)
return;



for(
const call of calls
){


if(
call.status==='offer'
){


await sock.rejectCall(
call.id,
call.from
);



console.log(
'📵 Call rejected'
);



}


}



}catch(e){

logger.error(
e.message
);

}


});







// ========== PRESENCE ==========


setInterval(
async()=>{


try{


const settingsStore =
require('./utils/settingsStore');


if(
settingsStore.get(
'wapresence',
false
)
){


await sock.sendPresenceUpdate(
'available'
);


}



}catch(e){

logger.error(
e.message
);

}



},
30000
);







// ========== REGISTER HANDLERS ==========


registerConnectionHandler(
sock,
startBot,
wasAlreadyRegistered
);



registerMessageHandler(
sock,
commands
);







// ========== CACHE CLEAR ==========


if(
!global.__cacheClearScheduled
){


global.__cacheClearScheduled=true;



setInterval(
()=>{


const result =
runClearCache(
commands
);



logger.info(
`Cache cleared ${JSON.stringify(result)}`
);



},
6*60*60*1000
);



}



}catch(error){


logger.error(
`Start error: ${error.message}`
);


}



}







// ========== ERRORS ==========


process.on(
'uncaughtException',
(error)=>{


logger.error(
error.stack ||
error.message
);


});



process.on(
'unhandledRejection',
(reason)=>{


logger.error(
reason
);


});






// ========== START ==========


const startupDelay =
parseInt(
process.env.ISAAC_RESTART_DELAY_MS || '0',
10
);



setTimeout(
()=>{

printBanner();

startBot();

},
startupDelay
);
