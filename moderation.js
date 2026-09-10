// 👨‍💻 Developer: DevPasqua
// 💬 WhatsApp  :- wa.me/2349028711461

// moderation.js
const fs = require('fs');
const path = require('path');

class ModerationFeatures {
    constructor(sock) {
        this.sock = sock;
        this.sessionId = sock.user?.id?.split(':')[0] || 'default';
        this.dataPath = path.join(__dirname, 'moderation_data');
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
        
        // Session-specific data files
        this.mutedUsersFile = path.join(this.dataPath, `${this.sessionId}_mutedUsers.json`);
        this.groupSettingsFile = path.join(this.dataPath, `${this.sessionId}_groupSettings.json`);
        this.warnsFile = path.join(this.dataPath, `${this.sessionId}_warns.json`);
        this.badWordsFile = path.join(this.dataPath, `${this.sessionId}_badWords.json`);
        this.spamTracker = new Map();
        
        // Load data
        this.mutedUsers = this.loadJSON(this.mutedUsersFile, {});
        this.groupSettings = this.loadJSON(this.groupSettingsFile, {});
        this.warns = this.loadJSON(this.warnsFile, {});
        this.badWords = this.loadJSON(this.badWordsFile, [
            'fuck', 'shit', 'bitch', 'asshole', 'damn', 'stupid', 
            'idiot', 'dumb', 'pussy', 'dick', 'cock', 'whore',
            'slut', 'cunt', 'nigga', 'nigger'
        ]);
    }
    
    loadJSON(file, defaultValue) {
        try {
            if (fs.existsSync(file)) {
                return JSON.parse(fs.readFileSync(file, 'utf8'));
            }
        } catch (error) {
            console.error(`Error loading ${file}:`, error);
        }
        return defaultValue;
    }
    
    saveJSON(file, data) {
        try {
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error saving ${file}:`, error);
        }
    }
    
    saveAll() {
        this.saveJSON(this.mutedUsersFile, this.mutedUsers);
        this.saveJSON(this.groupSettingsFile, this.groupSettings);
        this.saveJSON(this.warnsFile, this.warns);
        this.saveJSON(this.badWordsFile, this.badWords);
    }
    
    // ========== MUTED USERS ==========
    isMuted(groupJid, userId) {
        return this.mutedUsers[groupJid]?.includes(userId) || false;
    }
    
    addMutedUser(groupJid, userId) {
        if (!this.mutedUsers[groupJid]) this.mutedUsers[groupJid] = [];
        if (!this.mutedUsers[groupJid].includes(userId)) {
            this.mutedUsers[groupJid].push(userId);
            this.saveJSON(this.mutedUsersFile, this.mutedUsers);
            return true;
        }
        return false;
    }
    
    removeMutedUser(groupJid, userId) {
        if (this.mutedUsers[groupJid]) {
            this.mutedUsers[groupJid] = this.mutedUsers[groupJid].filter(id => id !== userId);
            this.saveJSON(this.mutedUsersFile, this.mutedUsers);
            return true;
        }
        return false;
    }
    
    // ========== GROUP SETTINGS ==========
    getGroupSettings(groupJid) {
        if (!this.groupSettings[groupJid]) {
            this.groupSettings[groupJid] = {
                antilink: { active: false, action: 'delete' },
                antispam: { active: false, timeWindow: 5000, maxMessages: 5 },
                antibot: { active: false },
                antipromote: { active: false },
                antidemote: { active: false },
                antibadword: { active: false, action: 'delete' },
                antigm: { active: false, action: 'delete' },
                welcome: false,
                goodbye: false
            };
            this.saveJSON(this.groupSettingsFile, this.groupSettings);
        }
        return this.groupSettings[groupJid];
    }
    
    updateGroupSettings(groupJid, settings) {
        this.groupSettings[groupJid] = { ...this.getGroupSettings(groupJid), ...settings };
        this.saveJSON(this.groupSettingsFile, this.groupSettings);
    }
    
    // ========== WARN SYSTEM ==========
    addWarn(groupJid, userId) {
        const key = `${groupJid}_${userId}`;
        this.warns[key] = (this.warns[key] || 0) + 1;
        this.saveJSON(this.warnsFile, this.warns);
        return this.warns[key];
    }
    
    getWarns(groupJid, userId) {
        const key = `${groupJid}_${userId}`;
        return this.warns[key] || 0;
    }
    
    resetWarns(groupJid, userId) {
        const key = `${groupJid}_${userId}`;
        delete this.warns[key];
        this.saveJSON(this.warnsFile, this.warns);
    }
    
    // ========== BAD WORDS ==========
    getBadWords() {
        return this.badWords;
    }
    
    addBadWord(word) {
        const lowerWord = word.toLowerCase();
        if (!this.badWords.includes(lowerWord)) {
            this.badWords.push(lowerWord);
            this.saveJSON(this.badWordsFile, this.badWords);
            return true;
        }
        return false;
    }
    
    removeBadWord(word) {
        const lowerWord = word.toLowerCase();
        const index = this.badWords.indexOf(lowerWord);
        if (index !== -1) {
            this.badWords.splice(index, 1);
            this.saveJSON(this.badWordsFile, this.badWords);
            return true;
        }
        return false;
    }
    
    // ========== UTILITY FUNCTIONS ==========
    containsLink(text) {
        if (!text) return false;
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|edu|gov|io|me|xyz|club|online|site|web|app|tech|co|in|uk|us|ru|cn|jp|de|fr|br|au|za|ng|gh|ke|tz|ug|rw|zm|zw|mw|mz|na|bw|ls|sz|er|et|so|dj|km|sc|mu|re|yt|tf|gf|gp|mq|nc|pf|wf|pm|bl|mf|va|sm|li|mc|ad|es|pt|it|gr|tr|sa|ae|qa|kw|bh|om|ye|jo|il|cy|mt|is|no|se|fi|dk|nl|be|lu|ch|at|li|cz|sk|hu|pl|ro|bg|rs|hr|si|al|mk|ba|me|xk|lt|lv|ee|by|ua|md|ge|am|az|kz|uz|tm|kg|tj|mn|kp|kr|tw|hk|mo|vn|th|my|sg|ph|id|np|bd|lk|pk|af|ir|iq|sy|lb|ps|eg|ly|tn|dz|ma|mr|sn|gn|ci|bf|ml|ne|td|cf|cg|ga|gq|ao|na|zm|zw|mw|mz|mg|km|sc|mu|fj|pg|nz|au))/gi;
        return urlRegex.test(text);
    }
    
    containsGroupMention(text) {
        if (!text) return false;
        const groupMentionPatterns = [
            /@everyone/gi,
            /@all/gi,
            /@group/gi,
            /everyone\s+mention/gi,
            /group\s+mention/gi,
            /mention\s+all/gi
        ];
        return groupMentionPatterns.some(pattern => pattern.test(text));
    }
    
    isBotMessage(text) {
        if (!text) return false;
        const botPatterns = [
            /pong/i,
            /ping/i,
            /bot\s+test/i,
            /!ping/i,
            /!pong/i,
            /\.ping/i,
            /\.pong/i,
            /alive/i,
            /hello/i,
            /hi bot/i
        ];
        return botPatterns.some(pattern => pattern.test(text));
    }
    
    containsBadWord(text) {
        if (!text) return false;
        const words = text.toLowerCase().split(/\s+/);
        return words.some(word => this.badWords.includes(word));
    }
    
    async kickUser(groupJid, userId, reason) {
        try {
            await this.sock.groupParticipantsUpdate(groupJid, [userId], 'remove');
            await this.sock.sendMessage(groupJid, {
                text: `🔨 @${userId.split('@')[0]} has been kicked!\nReason: ${reason}`,
                mentions: [userId]
            });
            return true;
        } catch (error) {
            console.error('Error kicking user:', error);
            return false;
        }
    }
    
    // ========== MAIN PROCESSING FUNCTION ==========
    async processMessage(m, chatId, sender, messageText, isGroup, isAdmin, isAdminUser, isBotAdmin) {
        if (!isGroup) return false;
        if (sender === this.sock.user?.id) return false; // Ignore bot's own messages
        
        const settings = this.getGroupSettings(chatId);
        
        // Check if user is muted (owner/sudo can override)
        if (this.isMuted(chatId, sender) && !isAdminUser) {
            await this.sock.sendMessage(chatId, { delete: m.key });
            return true;
        }
        
        // Check for links
        if (settings.antilink.active && this.containsLink(messageText) && !isAdmin) {
            await this.handleAntiLink(chatId, sender, m, settings.antilink.action);
            return true;
        }
        
        // Check for group mentions
        if (settings.antigm.active && this.containsGroupMention(messageText) && !isAdmin) {
            await this.handleAntiGM(chatId, sender, m, settings.antigm.action);
            return true;
        }
        
        // Check for bot messages
        if (settings.antibot.active && this.isBotMessage(messageText) && !isAdmin) {
            await this.sock.sendMessage(chatId, { delete: m.key });
            return true;
        }
        
        // Check for bad words
        if (settings.antibadword.active && this.containsBadWord(messageText) && !isAdmin) {
            await this.handleAntiBadWord(chatId, sender, m, settings.antibadword.action);
            return true;
        }
        
        // Check for spam
        if (settings.antispam.active) {
            const isSpam = await this.handleAntiSpam(chatId, sender, m, settings.antispam);
            if (isSpam) return true;
        }
        
        return false;
    }
    
    async handleAntiLink(groupJid, sender, msg, action) {
        switch(action) {
            case 'delete':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                break;
            case 'warn':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                const warns = this.addWarn(groupJid, sender);
                await this.sock.sendMessage(groupJid, { 
                    text: `⚠️ @${sender.split('@')[0]} has been warned for sending a link!\nWarns: ${warns}/3`,
                    mentions: [sender]
                });
                if (warns >= 3) {
                    await this.kickUser(groupJid, sender, 'Exceeded maximum warns (3)');
                    this.resetWarns(groupJid, sender);
                }
                break;
            case 'kick':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                await this.kickUser(groupJid, sender, 'Sending links is not allowed!');
                break;
        }
    }
    
    async handleAntiGM(groupJid, sender, msg, action) {
        switch(action) {
            case 'delete':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                break;
            case 'warn':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                const warns = this.addWarn(groupJid, sender);
                await this.sock.sendMessage(groupJid, { 
                    text: `⚠️ @${sender.split('@')[0]} has been warned for group mentioning!\nWarns: ${warns}/3`,
                    mentions: [sender]
                });
                if (warns >= 3) {
                    await this.kickUser(groupJid, sender, 'Exceeded maximum warns (3)');
                    this.resetWarns(groupJid, sender);
                }
                break;
            case 'kick':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                await this.kickUser(groupJid, sender, 'Group mentioning is not allowed!');
                break;
        }
    }
    
    async handleAntiBadWord(groupJid, sender, msg, action) {
        switch(action) {
            case 'delete':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                break;
            case 'warn':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                const warns = this.addWarn(groupJid, sender);
                await this.sock.sendMessage(groupJid, { 
                    text: `⚠️ @${sender.split('@')[0]} has been warned for using bad words!\nWarns: ${warns}/3`,
                    mentions: [sender]
                });
                if (warns >= 3) {
                    await this.kickUser(groupJid, sender, 'Exceeded maximum warns (3) for using bad words');
                    this.resetWarns(groupJid, sender);
                }
                break;
            case 'kick':
                await this.sock.sendMessage(groupJid, { delete: msg.key });
                await this.kickUser(groupJid, sender, 'Using bad words is not allowed!');
                break;
        }
    }
    
    async handleAntiSpam(groupJid, sender, msg, spamConfig) {
        const now = Date.now();
        const userKey = `${groupJid}_${sender}`;
        
        if (!this.spamTracker.has(userKey)) {
            this.spamTracker.set(userKey, []);
        }
        
        const timestamps = this.spamTracker.get(userKey);
        timestamps.push(now);
        
        // Remove old timestamps
        const filtered = timestamps.filter(ts => now - ts < spamConfig.timeWindow);
        this.spamTracker.set(userKey, filtered);
        
        if (filtered.length > spamConfig.maxMessages) {
            await this.sock.sendMessage(groupJid, { delete: msg.key });
            await this.kickUser(groupJid, sender, `Spamming is not allowed! (${spamConfig.maxMessages} messages in ${spamConfig.timeWindow/1000}s)`);
            this.spamTracker.delete(userKey);
            return true;
        }
        return false;
    }
    
    async handleGroupPromote(groupJid, user, isBotAdmin) {
        if (!isBotAdmin) return;
        const settings = this.getGroupSettings(groupJid);
        
        if (settings.antipromote.active && user !== this.sock.user?.id) {
            await this.sock.groupParticipantsUpdate(groupJid, [user], 'demote');
            await this.sock.sendMessage(groupJid, {
                text: `🚫 @${user.split('@')[0]}, only the bot can promote members!`,
                mentions: [user]
            });
            return true;
        }
        return false;
    }
    
    async handleGroupDemote(groupJid, user, isBotAdmin) {
        if (!isBotAdmin) return;
        const settings = this.getGroupSettings(groupJid);
        
        if (settings.antidemote.active && user !== this.sock.user?.id) {
            await this.sock.groupParticipantsUpdate(groupJid, [user], 'promote');
            await this.sock.sendMessage(groupJid, {
                text: `🚫 @${user.split('@')[0]}, only the bot can demote admins!`,
                mentions: [user]
            });
            return true;
        }
        return false;
    }
}

module.exports = ModerationFeatures;
