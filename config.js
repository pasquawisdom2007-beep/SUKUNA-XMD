// Base by : Mr Pasqua
//ᴄᴏɴᴛᴀᴄᴛ :- 2348082369566
//ᴛᴇʟᴇɢʀᴀᴍ :- t.me/DevPasqua
// ʙɪʟʟɪᴇ ᴍᴅ
//ᴡᴀɴɴᴀ ᴄʟᴏɴᴇ ᴍʏ sʜɪɪɪɪɪ??? 
//ᴅᴏɴ'ᴛ ғᴏʀɢᴇᴛ ᴛᴏ ɢɪᴠᴇ ᴍᴇ ᴄʀᴇᴅɪᴛs
const fs = require("fs-extra");
const chalk = require("chalk");

module.exports = {
  botName: "ʙɪʟʟɪᴇ ᴍᴅ ²⁰²⁶",
  ownerName: "Mr Pasqua",
  version: "2.0.0",
  hosting: "Tele Pair",
 owner: "2349028711461",
  ownerNumbers: [
    "2348114674609"
  ],
  AUTO_JOIN_GROUP: true,
  auto: {
    react: false,
    online: false,
  },

  prefix: "",
  menuImages: (() => {
    const path = require("path");
    const imagesDir = path.join(__dirname, "assets", "images");
    return [
      "menu1.jpg", "menu2.jpg", "menu3.jpg", "menu4.jpg", "menu5.jpg",
      "menu6.jpg", "menu7.jpg", "menu8.jpg", "menu9.jpg", "menu10.jpg", "menu11.jpg"
    ].map(file => path.join(imagesDir, file));
  })(),

  packname: "Billie MD",
  author: "Created by DevPasqua",

  // -------- AGNES AI (powers Billie's natural-language AI mode) --------
  // NOTE: prefer setting AGNES_API_KEY as an environment variable in
  // production. The inline fallback below was supplied directly by the
  // bot owner — if this file is ever shared or pushed to a public repo,
  // rotate/revoke the key at apihub.agnes-ai.com and swap in a new one.
  agnes: {
    apiKey: process.env.AGNES_API_KEY || "sk-cUkrugERrYFxXWfYhAxrBW9k7mUeLMTVW2aAbD5qeN1unvW2",
    baseUrl: process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1",
    textModel: "agnes-2.5-flash",
    imageModel: "agnes-image-2.1-flash",
  },

  // -------- ANTI-LINK --------
  antilink: false,
  antilinkMode: "warn", // warn | kick | delete
  maxWarnings: 3,

  // -------- ANTI-BOT --------
  antibot: true,
   antibotMode: "delete", // kick | delete
   botWhitelist: [
  "234xxxxxxxxxx@s.whatsapp.net"
],

  // -------- ANTI-PROMOTE --------
  antipromote: false, // blocks unauthorized promotions

  // -------- ANTI-DEMODE --------
  antidemote: false, // blocks unauthorized demotions

  // -------- ANTI-FOREIGN --------
  antiforeign: false,
  allowedCountryCode: "234", // Nigeria

  // -------- ANTI-BADWORD --------
  antibadword: false,
  badwords: [
    "fuck",
    "bitch",
    "shit",
    "asshole"
  ],

  // -------- ANTI-TAG --------
  antitag: false,
  antitagMode: "warn", // warn | kick | delete

  // -------- ANTI-TAG ADMIN --------
  antitagadmin: false,
  antitagadminMode: "delete", // delete | kick | warn

  // -------- ANTI-GROUP MENTION --------
  antigroupmention: false,
  antigroupmentionMode: "warn", // warn | kick | delete

  // ==================================================
  // 💬 DEFAULT BOT MESSAGES
  // ==================================================
  mess: {
    wait: "⏳ Please wait, processing your request...",
    success: "✅ Success!",
    group: "👥 Groups only!",
    admin: "🛡️ Group admins only!",
    botAdmin: "🤖 I need admin privilege!",
    owner: "👑 Bot owner only!",
    creator: "👑 Bot owner only!",
    error: {
      api: "❌ An API error occurred. Please try again later.",
      owner: "👑 Bot owner only!",
      group: "👥 Groups only!",
      admin: "🛡️ Group admins only!",
      botAdmin: "🤖 I need admin privilege!"
    }
  },
  
    MAX_PAIRED_USERS: 20, 
    AUTO_JOIN_GROUP_INVITE: 'EFk2U3OTFIwFzP7kRav4O', 
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.greenBright(`\n[UPDATE] '${__filename}' has been updated. Reloading...\n`));
    delete require.cache[file];
    require(file);
});
