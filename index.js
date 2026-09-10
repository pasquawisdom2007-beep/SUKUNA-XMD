const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const WhatsAppManager = require('./whatsapp.js');
const TelegramBotController = require('./telegram.js');
const config = require('./config.js');

console.log(chalk.cyan('🚀 Starting BILLIE MD v2 TeleXWa System...'));

try {
    const whatsAppManager = new WhatsAppManager();
    const token = config.TELEGRAM_BOT_TOKEN;

    if (!token || token === "YOUR_TELEGRAM_BOT_TOKEN") {
        throw new Error("TELEGRAM_BOT_TOKEN is not defined in your config.js file!");
    }
    
    const telegramBot = new TelegramBotController(token, whatsAppManager);
    
    console.log(chalk.green('✅ System Online. Telegram Bot is listening for commands.'));


    setInterval(async () => {
        for (const [userId, client] of whatsAppManager.clients) {
            try {
                // Check if client is dead (not connected or no user object)
                if (!client.sock || !client.isConnected || !client.sock.user) {
                    console.log(chalk.yellow(`⚠️ Session ${userId} appears dead, attempting reconnect...`));
                    
                    // Get the phone number from client
                    let phoneNumber = client.number;
                    
                    // If phone number not in client, try to read from session files
                    if (!phoneNumber) {
                        const sessionPath = path.join(whatsAppManager.sessionDir, userId);
                        if (fs.existsSync(sessionPath)) {
                            try {
                                const credsPath = path.join(sessionPath, 'creds.json');
                                if (fs.existsSync(credsPath)) {
                                    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                                    phoneNumber = creds.me?.id?.split(':')[0];
                                }
                            } catch(e) {
                                console.log(chalk.red(`Failed to read phone number for ${userId}: ${e.message}`));
                            }
                        }
                    }
                    
                    if (phoneNumber) {
                        // Clean up old client
                        if (client.heartbeatInterval) clearInterval(client.heartbeatInterval);
                        whatsAppManager.clients.delete(userId);
                        whatsAppManager.moderationInstances.delete(userId);
                        
                        // Restart session after short delay
                        setTimeout(() => {
                            whatsAppManager.startSession(userId, phoneNumber).catch(err => {
                                console.log(chalk.red(`Failed to restart session ${userId}: ${err.message}`));
                            });
                        }, 1000);
                    } else {
                        console.log(chalk.red(`Cannot restart session ${userId}: No phone number found`));
                    }
                } else {
                    // Update last seen timestamp
                    if (!whatsAppManager.connectionStatus.has(userId)) {
                        whatsAppManager.connectionStatus.set(userId, {});
                    }
                    const status = whatsAppManager.connectionStatus.get(userId);
                    status.lastChecked = Date.now();
                    whatsAppManager.connectionStatus.set(userId, status);
                }
            } catch (err) {
                console.log(chalk.red(`Health check error for ${userId}: ${err.message}`));
            }
        }
        
        // Log connection status summary every hour
        const now = Date.now();
        const statusSummary = [];
        for (const [userId, client] of whatsAppManager.clients) {
            const isHealthy = client.isConnected && client.sock && client.sock.user;
            statusSummary.push(`${userId}: ${isHealthy ? '🟢' : '🔴'}`);
        }
        if (statusSummary.length > 0) {
            console.log(chalk.cyan(`[HEALTH CHECK] Sessions: ${statusSummary.join(' | ')}`));
        }
    }, 300000); // Check every 5 minutes

    // 🔥 GRACEFUL SHUTDOWN HANDLER

    const gracefulShutdown = async () => {
        console.log(chalk.yellow('\n🛑 Shutting down gracefully...'));
        
        // Logout all WhatsApp sessions
        for (const [userId, client] of whatsAppManager.clients) {
            try {
                if (client.heartbeatInterval) clearInterval(client.heartbeatInterval);
                if (client.sock) {
                    await client.sock.logout().catch(() => {});
                    console.log(chalk.green(`✅ Logged out session ${userId}`));
                }
            } catch (err) {
                console.log(chalk.red(`Failed to logout ${userId}: ${err.message}`));
            }
        }
        
        console.log(chalk.green('✅ Graceful shutdown complete'));
        process.exit(0);
    };

    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

} catch (error) {
    console.error(chalk.red('[FATAL STARTUP ERROR]'), error.message);
    process.exit(1);
}

// ==================================================
// 🔥 BILLIE MD GLOBAL ANTI-CRASH ENGINE
// ==================================================
process.on("uncaughtException", (err) => {
    console.error("🔥 UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("🔥 UNHANDLED REJECTION:", reason);
});
process.on("rejectionHandled", (promise) => {
    console.warn("⚠️ Rejection handled:", promise);
});
 

// ---------------------- Hot-reload watcher ----------------------
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.greenBright(`\n[UPDATE] '${__filename}' has been updated. Reloading...\n`));
    delete require.cache[file];
    require(file);
});