// Base by : Mr Pasqua
//ᴄᴏɴᴛᴀᴄᴛ :- 2348082369566
//ᴛᴇʟᴇɢʀᴀᴍ :- t.me/DevPasqua
// ʙɪʟʟɪᴇ ᴍᴅ
//ᴡᴀɴɴᴀ ᴄʟᴏɴᴇ ᴍʏ sʜɪɪɪɪɪ??? 
//ᴅᴏɴ'ᴛ ғᴏʀɢᴇᴛ ᴛᴏ ɢɪᴠᴇ ᴍᴇ ᴄʀᴇᴅɪᴛs

const fs = require("fs");
const path = require("path");
const pino = require("pino");
const chalk = require("chalk");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  makeCacheableSignalKeyStore,
  jidDecode,
  DisconnectReason
} = require("@trashcore/baileys");

const messageHandler = require("./DevPasqua");
const { loadSettings } = require("./BillieSettings");
const ModerationFeatures = require("./moderation");
const config = require("./config");

class WhatsAppManager {
  constructor(options = {}) {
    this.sessionDir = options.sessionDir || path.join(__dirname, "sessions");
    this.clients = new Map();
    // Create moderation features instance for each session
    this.moderationInstances = new Map();
    this.reconnectAttempts = new Map(); // Track reconnect attempts per user
    this.connectionStatus = new Map(); // Track connection status per user

    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    this.log = (msg, level = "info") =>
      console.log(
        chalk.yellow("[WA-MANAGER]"),
        chalk[level === "error" ? "red" : "cyan"](msg)
      );
  }

  async pair(telegramUserId, phoneNumber) {
    const userKey = String(telegramUserId);
    const sessionPath = path.join(this.sessionDir, userKey);

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    return this.startSession(userKey, phoneNumber);
  }

  async startSession(userKey, phoneNumber, reconnectAttempt = 0) {
    const MAX_RECONNECT_ATTEMPTS = 10;
    const BASE_DELAY = 3000;
    
    // If client already exists and is healthy, don't recreate
    if (this.clients.has(userKey)) {
        const existing = this.clients.get(userKey);
        if (existing.sock && existing.isConnected && existing.sock.user) {
            return null;
        }
        // Clean up old client if exists but not healthy
        if (existing.sock) {
            try {
                existing.sock.ev.removeAllListeners();
                if (existing.heartbeatInterval) clearInterval(existing.heartbeatInterval);
                await existing.sock.logout().catch(() => {});
            } catch(e) {}
        }
        this.clients.delete(userKey);
        this.moderationInstances.delete(userKey);
    }

    const sessionPath = path.join(this.sessionDir, userKey);
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const store = makeInMemoryStore({});
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      browser: ["Ubuntu", "Edge", "20.0.04"],
      // Use Cacheable Store for better pairing stability
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      // Add connection options for better stability
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000, // Send ping every 30 seconds
      connectTimeoutMs: 60000,
    });

    store.bind(sock.ev);
    sock.ev.on("creds.update", saveCreds);

    // Add connection health flag
    let isConnected = false;
    let heartbeatInterval = null;

    sock.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        const d = jidDecode(jid) || {};
        return d.user && d.server ? `${d.user}@${d.server}` : jid;
      }
      return jid;
    };

    // Create moderation instance for this session
    const moderationInstance = new ModerationFeatures(sock);
    this.moderationInstances.set(userKey, moderationInstance);

    sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    try {
        if (connection === "open") {
            isConnected = true;
            this.connectionStatus.set(userKey, { connected: true, lastSeen: Date.now() });
            this.log(`✅ WhatsApp connected for ${userKey}`);
            
            // Start heartbeat monitor
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(async () => {
                if (!isConnected) return;
                try {
                    // Send presence update as heartbeat
                    await sock.sendPresenceUpdate("available").catch(() => {});
                    this.connectionStatus.set(userKey, { 
                        connected: true, 
                        lastSeen: Date.now(),
                        lastHeartbeat: Date.now()
                    });
                } catch (err) {
                    this.log(`Heartbeat failed for ${userKey}: ${err.message}`, "error");
                    isConnected = false;
                }
            }, 45000); // Every 45 seconds

            // =============== SEND DM TO OWNER ===============
            setTimeout(async () => {
                try {
                    const botNumber = sock.user.id.split(":")[0];
                    const ownerJid = `${botNumber}@s.whatsapp.net`;

                    const message = `
╭─❏ 𝗕𝗜𝗟𝗟𝗜𝗘 𝗠𝗗 𝗢𝗡𝗟𝗜𝗡𝗘
│
│ 🤖 Bot      : ${config.botName}
│ 👤 Session  : ${userKey}
│ 📦 Version  : ${config.version || '2.0.0'}
│ ⚙️ Prefix   : ${config.prefix}
│
╰─❏
› Ready • Stable • Linked

Type *${config.prefix}menu* to start
`.trim();

                    await sock.sendMessage(ownerJid, { text: message });
                    this.log(`DM sent to paired number (${botNumber})`);
                } catch (err) {
                    this.log("DM Fail: " + err.message);
                }
            }, 3000);

            // =============== AUTO JOIN GROUP ===============
            const inviteCode =
                config.AUTO_JOIN_GROUP_INVITE || "JL12qqokjISCf2yNTiXdK8";

            setTimeout(async () => {
                try {
                    const cleanCode = inviteCode
                        .replace("https://chat.whatsapp.com/", "")
                        .trim();

                    await sock.groupAcceptInvite(cleanCode);
                    this.log("✅ Auto-joined group!");
                } catch (err) {
                    // silently ignore
                }
            }, 5000);

            sock.public = true;
            
            // Reset reconnect attempts on successful connection
            this.reconnectAttempts.delete(userKey);
        }
        else if (connection === "close") {
            isConnected = false;
            this.connectionStatus.set(userKey, { connected: false, lastSeen: Date.now() });
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason =
                lastDisconnect?.error?.output?.payload?.message ||
                lastDisconnect?.error?.message ||
                "Unknown";

            this.log(`Connection closed for ${userKey} | Status: ${statusCode} | Reason: ${reason}`);

            // ================================
            // 🚫 REAL LOGOUT (Manual Logout Only)
            // ================================
            if (statusCode === DisconnectReason.loggedOut) {
                this.log(`⚠️ Session ${userKey} logged out from WhatsApp.`);
                // DO NOT DELETE SESSION FILES
                // Just remove active socket from memory
                this.clients.delete(userKey);
                this.moderationInstances.delete(userKey);
                this.reconnectAttempts.delete(userKey);
                this.connectionStatus.delete(userKey);
                return;
            }

            // ================================
            // ♻️ Restart Required (515)
            // ================================
            if (statusCode === DisconnectReason.restartRequired) {
                this.log(`♻️ Restart required for ${userKey}`);
            }

            // Remove old listeners to prevent memory leaks
            sock.ev.removeAllListeners();
            
            // Delete client from memory
            this.clients.delete(userKey);
            this.moderationInstances.delete(userKey);

            // Get current reconnect attempt count
            const currentAttempt = this.reconnectAttempts.get(userKey) || 0;
            if (currentAttempt >= MAX_RECONNECT_ATTEMPTS) {
                this.log(`❌ Max reconnect attempts reached for ${userKey}. Giving up.`, "error");
                this.reconnectAttempts.delete(userKey);
                return;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(BASE_DELAY * Math.pow(2, currentAttempt), 60000);
            this.log(`🔄 Reconnecting ${userKey} in ${delay/1000}s (Attempt ${currentAttempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            
            this.reconnectAttempts.set(userKey, currentAttempt + 1);

            setTimeout(() => {
                this.startSession(userKey, phoneNumber, currentAttempt + 1).catch(err => {
                    this.log(`Reconnect failed: ${err.message}`, "error");
                });
            }, delay);
        }
    } catch (error) {
        this.log("Connection handler error: " + error.message, "error");
    }
});

    sock.ev.on("messages.upsert", async ({ messages }) => {
      if (!isConnected) return; // Skip if not connected
      
      try {
        const m = messages?.[0];
        if (!m || !m.message) return;

        const settings = loadSettings(userKey);
        const isGroup = m.key.remoteJid.endsWith("@g.us");

        if (m.key.remoteJid === 'status@broadcast') {
          try {
            // 👀 Auto view status
            await sock.readMessages([m.key]);

            // ❤️ Auto react (like)
            await sock.sendMessage(
              'status@broadcast',
              {
                react: {
                  key: m.key,
                  text: '💚'
                }
              }
            );
          } catch {
            // 🔕 SILENT MODE (NO LOGS)
          }

          return; // ⛔ Stop here, don't pass status to command handler
        }

        if (settings?.autoread?.enabled && !isGroup) {
          await sock.readMessages([m.key]).catch(() => {});
        }

        if (settings?.autotyping?.enabled && !isGroup) {
          await sock.sendPresenceUpdate("composing", m.key.remoteJid).catch(() => {});
        }

        if (settings?.autorecord?.enabled && !isGroup) {
          await sock.sendPresenceUpdate("recording", m.key.remoteJid).catch(() => {});
        }

        // Process moderation features
        if (isGroup) {
          const groupMetadata = await sock.groupMetadata(m.key.remoteJid).catch(() => null);
          const isAdmin = groupMetadata?.participants?.some(p => p.id === m.key.participant && p.admin) || false;
          const isAdminUser = m.key.participant === sock.user.id;
          const isBotAdmin = groupMetadata?.participants?.some(p => p.id === sock.user.id && p.admin) || false;
          
          const messageText = m.message?.conversation || 
                             m.message?.extendedTextMessage?.text || 
                             m.message?.imageMessage?.caption || 
                             m.message?.videoMessage?.caption || 
                             '';
          
          await moderationInstance.processMessage(
            m, 
            m.key.remoteJid, 
            m.key.participant || m.key.remoteJid, 
            messageText, 
            isGroup, 
            isAdmin, 
            isAdminUser, 
            isBotAdmin
          );
        }

        /* ───── ⚙️ MAIN MESSAGE / COMMAND HANDLER ───── */
        await messageHandler(sock, m, { telegramUserId: userKey, messages });

      } catch (err) {
        // 🔕 FULLY SILENT FAILSAFE
        this.log(`Message error: ${err.message}`, "error");
      }
    });

    // Add ping listener to check connection health
    sock.ev.on("messaging-history.set", () => {
        isConnected = true;
        this.connectionStatus.set(userKey, { connected: true, lastSeen: Date.now() });
    });

sock.ev.on('group-participants.update', async (update) => { 
    try {
        const { id, participants, action } = update;
        
        const metadata = await sock.groupMetadata(id).catch(() => null);
        if (!metadata) return;
        
        const groupId = id;
        const botNumber = sock.decodeJid(sock.user?.id || '');
        const isBotAdmin = metadata.participants?.some(p => p.id === botNumber && p.admin) || false;
        // Get moderation instance for this session
        const moderationInstance = this.moderationInstances.get(userKey);
        const settings = moderationInstance ? moderationInstance.getGroupSettings(groupId) : null;
        
       /* const botNumber = sock.decodeJid(sock.user?.id || '');
        const isBotAdmin = metadata.participants?.some(p => p.id === botNumber && p.admin) || false;*/
        
        // ================= ANTI-PROMOTE =================
        if (action === "promote") {
            for (const user of participants) {
                if (user === botNumber) continue;
                if (moderationInstance) {
                    const handled = await moderationInstance.handleGroupPromote(groupId, user, isBotAdmin);
                    if (handled) continue;
                }
                // Fallback if moderation instance not available
                if (settings?.antiPromote?.enabled && user !== botNumber) {
                    await sock.sendMessage(groupId, {
                        text: `🚫 *Unauthorized Promotion!*\n@${user.split("@")[0]} was promoted without permission.`,
                        mentions: [user]
                    });
                    await sock.groupParticipantsUpdate(groupId, [user], "demote");
                }
            }
        }
        
        // ================= ANTI-DEMOTE =================
        if (action === "demote") {
            for (const user of participants) {
                if (user === botNumber) continue;
                if (moderationInstance) {
                    const handled = await moderationInstance.handleGroupDemote(groupId, user, isBotAdmin);
                    if (handled) continue;
                }
                // Fallback if moderation instance not available
                if (settings?.antiDemote?.enabled && user !== botNumber) {
                    await sock.sendMessage(groupId, {
                        text: `🚫 *Unauthorized Demotion!*\n@${user.split("@")[0]} was demoted without permission.`,
                        mentions: [user]
                    });
                    await sock.groupParticipantsUpdate(groupId, [user], "promote");
                }
            }
        }
        
        // ================= WELCOME / GOODBYE =================
        if ((action === 'add' && settings?.welcome) || (action === 'remove' && settings?.goodbye)) {
            for (const participant of participants) {
                let profilePic;
                try {
                    profilePic = await sock.profilePictureUrl(participant, 'image');
                } catch {
                    profilePic = 'https://files.catbox.moe/5kv07a.jpg';
                }
                
                if (action === 'add') {
                    const welcomeText = `Hello @${participant.split('@')[0]} and welcome to *${metadata.subject}*! We now have ${metadata.participants.length} members.\n> powered by ${config.botName}`;
                    await sock.sendMessage(id, { 
                        image: { url: profilePic }, 
                        caption: welcomeText, 
                        mentions: [participant] 
                    });
                } else if (action === 'remove') {
                    const goodbyeText = `Goodbye @${participant.split('@')[0]}! You will be missed.\n> powered by ${config.botName}`;
                    await sock.sendMessage(id, { 
                        image: { url: profilePic }, 
                        caption: goodbyeText, 
                        mentions: [participant] 
                    });
                }
            }
        }
        
    } catch (err) {
        console.log('Group participants handler error:', err);
    }
});
 
    // =================================================
    // 🔥 PAIRING LOGIC 
    // =================================================
    if (!sock.authState.creds.registered) {
      await new Promise(r => setTimeout(r, 2000)); // Increased wait for stability
      const pairingCode = await sock.requestPairingCode(phoneNumber, "BILLIEMD");
      
      this.clients.set(userKey, { sock, number: phoneNumber, store, isConnected: () => isConnected, heartbeatInterval });
      return pairingCode;
    }

    this.clients.set(userKey, { sock, number: phoneNumber, store, isConnected: () => isConnected, heartbeatInterval });
    return null;
  }

  // Helper Methods
  getSession(tgId) { return this.clients.get(String(tgId)); }

  async logout(telegramUserId) {
    const id = String(telegramUserId);
    const client = this.clients.get(id);
    if (client?.sock) {
        if (client.heartbeatInterval) clearInterval(client.heartbeatInterval);
        await client.sock.logout().catch(() => {});
    }
    this.clients.delete(id);
    this.moderationInstances.delete(id);
    this.reconnectAttempts.delete(id);
    this.connectionStatus.delete(id);
    const sessionPath = path.join(this.sessionDir, id);
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  listPairs() {
    if (!this.clients.size) return "No users paired.";
    return [...this.clients.entries()].map(([id, c]) => {
        const status = c.isConnected ? "🟢 Online" : "🔴 Offline";
        return `👤 ${id} → +${c.number} [${status}]`;
    }).join("\n");
  }
 
  async broadcast(message) {
    let ok = 0, fail = 0;
    for (const { sock } of this.clients.values()) {
      try {
        const jid = sock.decodeJid(sock.user.id);
        await sock.sendMessage(jid, { text: message });
        ok++;
      } catch { fail++; }
    }
    return `Broadcast done → ✅ ${ok} | ❌ ${fail}`;
  }
}

module.exports = WhatsAppManager;