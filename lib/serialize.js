const { proto, getContentType, downloadMediaMessage } = require("@trashcore/baileys");
const pino = require('pino');

/**
 * @param {import('@whiskeysockets/baileys').WASocket} MrPasqua The Baileys client object.
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} m The raw message object.
 * @returns {Promise<import('@whiskeysockets/baileys').proto.IWebMessageInfo>}
 */


const smsg = async (MrPasqua, m) => {
    if (!m) return m;

    // --- Key Information ---
    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
        m.from = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.from.endsWith('@g.us');
        m.sender = MrPasqua.decodeJid(
            m.fromMe && MrPasqua.user.id ||
            m.participant ||
            m.key.participant ||
            m.from ||
            ''
        );
    }

    // --- Message Content & Type ---
    if (m.message) {
        m.mtype = getContentType(m.message);
        m.msg =
            m.mtype === 'viewOnceMessageV2'
                ? m.message.viewOnceMessageV2.message[getContentType(m.message.viewOnceMessageV2.message)]
                : m.message[m.mtype];

        m.body = (
            m.mtype === "conversation" ? m.message.conversation :
            m.mtype === "imageMessage" ? m.msg.caption :
            m.mtype === "videoMessage" ? m.msg.caption :
            m.mtype === "extendedTextMessage" ? m.msg.text :
            m.mtype === "buttonsResponseMessage" ? m.msg.selectedButtonId :
            m.mtype === "listResponseMessage" ? m.msg.singleSelectReply?.selectedRowId :
            m.mtype === "templateButtonReplyMessage" ? m.msg.selectedId :
            (m.mtype === "interactiveResponseMessage" && m.msg?.nativeFlowResponseMessage)
                ? (() => {
                    try {
                        return JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson).id;
                    } catch {
                        return "";
                    }
                })()
                : ""
        );

        // --- QUOTED MESSAGE HANDLER ---
        let rawQuoted = m.msg?.contextInfo?.quotedMessage || null; // 🔥 PRESERVE RAW
        let quoted = m.quoted = rawQuoted;

        if (m.quoted) {

            let type = getContentType(rawQuoted);
            m.quoted = rawQuoted[type];

            if (typeof m.quoted === 'string')
                m.quoted = { text: m.quoted };

            m.quoted.mtype = type;
            m.quoted.id = m.msg.contextInfo.stanzaId;
            m.quoted.chat = m.msg.contextInfo.remoteJid || m.from;
            m.quoted.sender = MrPasqua.decodeJid(m.msg.contextInfo.participant);
            m.quoted.fromMe =
                m.quoted.sender === MrPasqua.decodeJid(MrPasqua.user.id);

            m.quoted.text =
                m.quoted.text ||
                m.quoted.caption ||
                m.quoted.conversation ||
                '';

            // ===============================
            // 🔥 CORRECT PROTO WRAPPER (USES RAW)
            // ===============================
            m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
                key: {
                    remoteJid: m.quoted.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id
                },
                message: rawQuoted,
                ...(m.isGroup ? { participant: m.quoted.sender } : {})
            });

            // Delete quoted message
            m.quoted.delete = () =>
                MrPasqua.sendMessage(m.quoted.chat, {
                    delete: m.quoted.fakeObj.key
                });

            // Copy & Forward quoted message
            m.quoted.copyNForward = (
                jid,
                forceForward = false,
                options = {}
            ) =>
                MrPasqua.copyNForward(
                    jid,
                    m.quoted.fakeObj,
                    forceForward,
                    options
                );

            // Media download
            m.quoted.download = async () =>
                await downloadMediaMessage(
                    {
                        key: {
                            remoteJid: m.from,
                            id: m.quoted.id,
                            fromMe: m.quoted.fromMe,
                            participant: m.quoted.sender
                        },
                        message: rawQuoted
                    },
                    'buffer',
                    {},
                    { logger: pino({ level: 'silent' }) }
                );
        }
    }

    // --- Direct Media Download ---
    m.download = async () =>
        await downloadMediaMessage(
            m,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }) }
        );

    // --- MESSAGE LEVEL copyNForward ---
    m.copyNForward = (
        jid = m.from,
        forceForward = false,
        options = {}
    ) =>
        MrPasqua.copyNForward(jid, m, forceForward, options);

    return m;
};

module.exports = { smsg };