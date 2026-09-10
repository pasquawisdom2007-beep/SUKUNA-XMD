const fs = require('fs');
const path = require('path');
const englishWordsArray = require('an-array-of-english-words');
// Convert to Set for much faster lookups (prevents the 'silent' lag)
const englishWords = new Set(englishWordsArray);
const config = require('../config.js');


const dbDir = path.join(__dirname, '../database');
const wcgPath = path.join(dbDir, 'wcgRooms.json');
const roundPath = path.join(dbDir, 'activeRounds.json');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(wcgPath)) fs.writeFileSync(wcgPath, '{}');
if (!fs.existsSync(roundPath)) fs.writeFileSync(roundPath, '{}');

function loadJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return {};
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const wcgRooms = loadJSON(wcgPath);
const activeRounds = loadJSON(roundPath);

/* ================= HELPERS ================= */

const letters = 'abcdefghijklmnopqrstuvwxyz';

function getRandomLetter() {
    return letters[Math.floor(Math.random() * letters.length)];
}

function getName(id) {
    return '@' + id.split('@')[0];
}

async function sendReact(chat, key, emoji, MrPasqua) {
    try {
        await MrPasqua.sendMessage(chat, {
            react: { text: emoji, key }
        });
    } catch {}
}

const timeouts = {};
const joinTimers = {};

/* ================= START GAME (INITIAL COMMAND) ================= */

async function handleWCG(m, MrPasqua) {
    if (wcgRooms[m.from] || activeRounds[m.from]) {
        return MrPasqua.sendMessage(
            m.from,
            { text: '🚫 A Word Chain Game is already running here.' },
            { quoted: m }
        );
    }

    wcgRooms[m.from] = {
        players: [m.sender],
        time: Date.now(),
        announcementSent: { '40': true, '20': false, '10': false }
    };
    saveJSON(wcgPath, wcgRooms);

    await MrPasqua.sendMessage(
        m.from,
        {
            text: `🎮 *WORD CHAIN GAME ANNOUNCEMENT!*

⏳ Game will start in *40 seconds*!
👥 Current players: 1

Type *${config.prefix}joinwcg* to join the game!`,
            mentions: [m.sender]
        }
    );

    startJoinCountdown(m.from, MrPasqua);
}

/* ================= UPDATED COUNTDOWN REMINDERS ================= */

function startJoinCountdown(chatId, MrPasqua) {
    let secondsLeft = 40;
    if (joinTimers[chatId]) clearInterval(joinTimers[chatId]);
    
    joinTimers[chatId] = setInterval(async () => {
        secondsLeft -= 1;
        const room = wcgRooms[chatId];
        if (!room) {
            clearInterval(joinTimers[chatId]);
            return;
        }
        
        // Dynamic Reminder Text
        const reminderText = (time) => `⏳ *${time} SECONDS REMAINING!*

👥 Players joined: *${room.players.length}*
📝 Type *${config.prefix}joinwcg* to join ASAP! 🏃‍♂️💨`;

        if (secondsLeft === 20 && !room.announcementSent['20']) {
            room.announcementSent['20'] = true;
            await MrPasqua.sendMessage(chatId, { text: reminderText(20) });
        }
        
        if (secondsLeft === 10 && !room.announcementSent['10']) {
            room.announcementSent['10'] = true;
            await MrPasqua.sendMessage(chatId, { text: `⚠️ *ONLY 10 SECONDS LEFT!* ⚠️\n\n👥 Players: ${room.players.length}\nLast chance! Type *${config.prefix}joinwcg* now!` });
        }
        
        if (secondsLeft <= 0) {
            clearInterval(joinTimers[chatId]);
            delete joinTimers[chatId];
            startGame(chatId, MrPasqua);
        }
    }, 1000);
}

async function startGame(chatId, MrPasqua) {
    const room = wcgRooms[chatId];
    if (!room) return;

    if (room.players.length < 2) {
        delete wcgRooms[chatId];
        saveJSON(wcgPath, wcgRooms);
        return MrPasqua.sendMessage(chatId, { text: '❌ Game cancelled (need at least 2 players). 📉' });
    }

    activeRounds[chatId] = {
        players: room.players,
        activePlayers: [...room.players],
        eliminatedPlayers: [],
        turn: 0,
        startLetter: getRandomLetter(),
        roundNumber: 1,
        usedWords: [],
        startTime: Date.now(),
        attempts: {},
        longestWord: { word: '', length: 0, sender: null }
    };

    delete wcgRooms[chatId];
    saveJSON(wcgPath, wcgRooms);
    saveJSON(roundPath, activeRounds);

    const round = activeRounds[chatId];
    const currentPlayer = round.activePlayers[0];
    round.attempts[currentPlayer] = 0;

    await MrPasqua.sendMessage(chatId, {
        text: `🎮 *GAME STARTED!*
━━━━━━━━━━━━━━
🎯 *TURN: ${getName(currentPlayer)}*
🔤 Start with letter: *${round.startLetter.toUpperCase()}*
⏱️ Time: *15 seconds*
━━━━━━━━━━━━━━`,
        mentions: room.players
    });

    setTurnTimeout(chatId, MrPasqua);
}

/* ================= UPDATED JOIN WITH FALLBACKS ================= */

async function handleJoinWCG(m, MrPasqua) {

    if (activeRounds[m.from]) {
        return MrPasqua.sendMessage(m.from, { text: '🚫 The game has already started! Wait for the next round. ⏳' }, { quoted: m });
    }

    const room = wcgRooms[m.from];


    if (!room) {
        return MrPasqua.sendMessage(m.from, { text: `❌ No game is currently waiting for players. Start one with *${config.prefix}wcg*! 🎮` }, { quoted: m });
    }


    if (room.players.includes(m.sender)) {
        // Fallback: Is this the person who started the game?
        if (room.players[0] === m.sender) {
            return MrPasqua.sendMessage(m.from, { text: '👑 Hey! You are the one who started this game! Just wait for others to join. 🤝' }, { quoted: m });
        } else {
            // Fallback: Just a regular member who already joined
            return MrPasqua.sendMessage(m.from, { text: '😅 Relax! You are already in the game list. Get your dictionary ready! 📖' }, { quoted: m });
        }
    }

    // Add the player
    room.players.push(m.sender);
    saveJSON(wcgPath, wcgRooms);
    
    await MrPasqua.sendMessage(m.from, { 
        text: `✅ *${getName(m.sender)} joined the battle!* ⚔️\n\n👥 Total Players: *${room.players.length}*`, 
        mentions: [m.sender] 
    });
}

function handleEndWCG(m, MrPasqua) {
    if (timeouts[m.from]) clearTimeout(timeouts[m.from]);
    if (joinTimers[m.from]) clearInterval(joinTimers[m.from]);
    delete activeRounds[m.from];
    delete wcgRooms[m.from];
    saveJSON(roundPath, activeRounds);
    saveJSON(wcgPath, wcgRooms);
    MrPasqua.sendMessage(m.from, { text: '🛑 Game ended manually by admin.' });
}

/* ================= GAME MESSAGE LOGIC ================= */

async function handleWCGMessage(m, MrPasqua) {

    if (m.key.fromMe) return;

    const round = activeRounds[m.from];
    if (!round) return;

    const currentPlayerId = round.activePlayers[round.turn];
    if (m.sender !== currentPlayerId) return;

    if (timeouts[m.from]) {
        clearTimeout(timeouts[m.from]);
        delete timeouts[m.from];
    }

    const rawText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const word = rawText.toLowerCase().trim();
    if (!word) {
        setTurnTimeout(m.from, MrPasqua);
        return;
    }

    const elapsed = Date.now() - round.startTime;
    if (elapsed > 15000) {
        eliminatePlayer(m.from, m.sender, MrPasqua, 'timeout');
        return;
    }

    if (!round.attempts) round.attempts = {};
    if (!round.attempts[m.sender]) round.attempts[m.sender] = 0;

    let errorReason = '';
    if (!word.startsWith(round.startLetter)) {
        errorReason = `❌ Word must start with *${round.startLetter.toUpperCase()}*`;
    } else if (!englishWords.has(word)) {
        errorReason = `❌ "${word}" is not in the dictionary`;
    } else if (round.usedWords.includes(word)) {
        errorReason = `❌ "${word}" has already been used`;
    }

    if (errorReason) {
        await sendReact(m.from, m.key, '❌', MrPasqua);
        round.attempts[m.sender]++;
        
        if (round.attempts[m.sender] >= 2) {
            eliminatePlayer(m.from, m.sender, MrPasqua, 'too many invalid attempts');
            return;
        }
        
        const timeLeft = Math.max(0, Math.floor((15000 - (Date.now() - round.startTime)) / 1000));
        await MrPasqua.sendMessage(m.from, { 
            text: `${errorReason}\n\n⏱️ *${timeLeft}s remaining* | Try again, ${getName(m.sender)}!` 
        });
        
        setTurnTimeout(m.from, MrPasqua);
        return;
    }

    await sendReact(m.from, m.key, '✅', MrPasqua);
    round.usedWords.push(word);
    
    if (word.length > round.longestWord.length) {
        round.longestWord = { word, length: word.length, sender: m.sender };
    }
    
    delete round.attempts[m.sender];

    const nextLetter = word.slice(-1);
    round.turn = (round.turn + 1) % round.activePlayers.length;
    round.startLetter = nextLetter;
    round.startTime = Date.now();
    round.roundNumber += 1;

    const nextPlayer = round.activePlayers[round.turn];
    if (!round.attempts) round.attempts = {};
    round.attempts[nextPlayer] = 0;

    saveJSON(roundPath, activeRounds);

    await MrPasqua.sendMessage(m.from, {
        text: `✅ *CORRECT!* (${getName(m.sender)})

━━━━━━━━━━━━━━
*ROUND ${round.roundNumber}*
━━━━━━━━━━━━━━
🎯 *TURN: ${getName(nextPlayer)}*
🔤 Start with: *${round.startLetter.toUpperCase()}*
⏱️ Time: *15 seconds*
━━━━━━━━━━━━━━
Words used: ${round.usedWords.length}`,
        mentions: [nextPlayer]
    });

    setTurnTimeout(m.from, MrPasqua);
}

async function eliminatePlayer(chatId, playerId, MrPasqua, reason) {
    const round = activeRounds[chatId];
    if (!round) return;

    if (timeouts[chatId]) {
        clearTimeout(timeouts[chatId]);
        delete timeouts[chatId];
    }

    const playerIndex = round.activePlayers.indexOf(playerId);
    if (playerIndex === -1) return;

    const eliminated = round.activePlayers.splice(playerIndex, 1)[0];
    round.eliminatedPlayers.push(eliminated);

    await MrPasqua.sendMessage(chatId, {
        text: `❌ *ELIMINATED!*\n${getName(eliminated)} has been eliminated (${reason})! 💀`,
        mentions: [eliminated]
    });


    if (round.activePlayers.length <= 1) {
        const winner = round.activePlayers[0] || null;
        // Small delay so the elimination message appears first
        setTimeout(async () => {
            await endGame(chatId, winner, round, MrPasqua);
        }, 1000);
        return;
    }

    if (round.turn >= round.activePlayers.length) {
        round.turn = 0;
    }
    
    round.startTime = Date.now();
    const nextPlayer = round.activePlayers[round.turn];
    if (!round.attempts) round.attempts = {};
    round.attempts[nextPlayer] = 0;
    
    saveJSON(roundPath, activeRounds);
    
    await MrPasqua.sendMessage(chatId, {
        text: `🎯 *YOUR TURN, ${getName(nextPlayer)}!*\n🔤 Start with: *${round.startLetter.toUpperCase()}* ⏱️`,
        mentions: [nextPlayer]
    });
    
    setTurnTimeout(chatId, MrPasqua);
}

async function endGame(chatId, winner, round, MrPasqua) {
    if (timeouts[chatId]) clearTimeout(timeouts[chatId]);
    
    let text = `🏆 *GAME OVER!* 🏆\n\n${winner ? `👑 *WINNER: ${getName(winner)}*` : `👑 *NO WINNER*`}\n━━━━━━━━━━━━━━\n📊 *STATISTICS:*`;
    text += `\n• Rounds: ${round.roundNumber}\n• Words Played: ${round.usedWords.length}`;
    if (round.longestWord.word) {
        text += `\n━━━━━━━━━━━━━━\n🏆 *LONGEST WORD*\n📝 Word: ${round.longestWord.word} (${round.longestWord.length} letters)\n👤 By: ${getName(round.longestWord.sender)}`;
    }

    await MrPasqua.sendMessage(chatId, { text, mentions: winner ? [winner] : [] });
    delete activeRounds[chatId];
    saveJSON(roundPath, activeRounds);
} 

function setTurnTimeout(chatId, MrPasqua) {
    if (timeouts[chatId]) clearTimeout(timeouts[chatId]);
    timeouts[chatId] = setTimeout(() => {
        const round = activeRounds[chatId];
        if (!round) return;
        const currentPlayer = round.activePlayers[round.turn];
        eliminatePlayer(chatId, currentPlayer, MrPasqua, 'timeout');
    }, 15000);
}

module.exports = { handleWCG, handleJoinWCG, handleEndWCG, handleWCGMessage };