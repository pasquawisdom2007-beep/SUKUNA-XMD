const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config.js');
class TelegramBotController {
    constructor(token, whatsAppManager) {
        this.bot = new TelegramBot(token, { polling: true });
        this.whatsAppManager = whatsAppManager;
        this.ownerId = String(config.OWNER_TELEGRAM_ID);
        this.requiredChannels = config.REQUIRED_CHANNELS;
        this.setupListeners();
    }

    async checkMembership(chatId, userId) {
  // Channel/group membership verification is disabled for now.
  return true;
}

    setupListeners() {
this.bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || "User";
    const userTag = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    if (!await this.checkMembership(chatId, userId)) return;

    const runtimeMs = process.uptime() * 1000;
    const days = Math.floor(runtimeMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((runtimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((runtimeMs % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((runtimeMs % (60 * 1000)) / 1000);
    
    let runtimeString = '';
    if (days > 0) runtimeString += `${days}d `;
    if (hours > 0) runtimeString += `${hours}h `;
    if (minutes > 0) runtimeString += `${minutes}m `;
    runtimeString += `${seconds}s`;

    const menuText = `
╭─────────────────❏
│ ✦ ${config.botName || '✦𝗕𝗜𝗟𝗟𝗜𝗘 𝗠𝗗'}
│  
│  👑 𝗢𝘄𝗻𝗲𝗿: ${config.ownerName}
│  ⏱️ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲: ${runtimeString}
│  👤 𝗨𝘀𝗲𝗿: ${userTag}
│  🆔 𝗨𝘀𝗲𝗿 𝗜𝗗: ${userId}
│
├─────────────────❏
│  📱 𝗨𝗦𝗘𝗥 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦
│  /pair <number>  
│  /delpair        
│
├─────────────────❏
│  🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦
│  /listpair       
│  /broadcast <text>
│
╰─────────────────❏
│  𝗣𝗿𝗲𝘀𝗲𝗻𝘁𝗲𝗱 𝗯𝘆 𝗕𝗜𝗟𝗟𝗜𝗘 𝗠𝗗 𝗕𝗢𝗧 𝗜𝗡𝗖.
│  © 2026
╰─────────────────
`.trim();

    try {
        const imagePath = path.join(__dirname, 'media', 'Dick.jpg');
        const photoBuffer = fs.readFileSync(imagePath);
        
        await this.bot.sendPhoto(chatId, photoBuffer, {
            caption: menuText
        });
    } catch (imageError) {
        console.log('Local image failed, sending text menu only');
        await this.bot.sendMessage(chatId, menuText);
    }
});

        this.bot.onText(/\/pair (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const whatsappNumber = match[1].replace(/[^0-9]/g, ''); // Sanitize number

            if (!await this.checkMembership(chatId, userId)) return;

            if (this.whatsAppManager.clients.size >= config.MAX_PAIRED_USERS) {
                return this.bot.sendMessage(chatId, "⚠️ *Pairing Limit Reached!*\n\nSorry, we cannot accept new bot pairings at this time. Please try again later.");
            }

            if (!whatsappNumber) {
                return this.bot.sendMessage(chatId, "Please provide a valid WhatsApp number.\n*Example:* `/pair 2349012345678`", { parse_mode: "Markdown" });
            }

            try {
                this.bot.sendMessage(chatId, "🔄 Requesting pairing code... Please wait.");
                const code = await this.whatsAppManager.pair(userId, whatsappNumber);
                if (code) {
                    this.bot.sendMessage(chatId, `✅ *Your Pairing Code Is Ready!*

Please go to WhatsApp on your phone:
1. Tap *Settings* > *Linked Devices* > *Link a device*.
2. Choose *Link with phone number instead*.
3. Enter the following code: \`\`\`${code}\`\`\`

The code is valid for a short time.`, { parse_mode: "Markdown" });
                } else {
                     this.bot.sendMessage(chatId, "✅ Bot is already paired and is now connecting. You will be notified when it's online.");
                }
            } catch (error) {
                this.bot.sendMessage(chatId, `❌ *Pairing Failed:*\n${error.message}`);
            }
        });

        this.bot.onText(/\/delpair/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;

            if (!await this.checkMembership(chatId, userId)) return;

            try {
                await this.whatsAppManager.logout(userId);
                this.bot.sendMessage(chatId, "✅ Successfully unpaired your bot and deleted the session.");
            } catch (error) {
                this.bot.sendMessage(chatId, `❌ *Unpairing Failed:*\n${error.message}`);
            }
        });

        // --- Owner-only commands ---
        this.bot.onText(/\/listpair/, async (msg) => {
            if (String(msg.from.id) !== this.ownerId) return;
            const list = this.whatsAppManager.listPairs();
            this.bot.sendMessage(msg.chat.id, list, { parse_mode: "Markdown" });
        });

        // THE COMPLETED BROADCAST COMMAND
        this.bot.onText(/\/broadcast (.+)/, async (msg, match) => {
            if (String(msg.from.id) !== this.ownerId) return;

            const message = match[1];
            if (!message) {
                return this.bot.sendMessage(msg.chat.id, "Please provide a message to broadcast.\n*Example:* `/broadcast Hello everyone!`", { parse_mode: "Markdown" });
            }

            this.bot.sendMessage(msg.chat.id, "📢 Broadcasting message to all paired bots... Please wait.");
            const result = await this.whatsAppManager.broadcast(message);
            this.bot.sendMessage(msg.chat.id, result, { parse_mode: "Markdown" });
        });
    }
}

module.exports = TelegramBotController;