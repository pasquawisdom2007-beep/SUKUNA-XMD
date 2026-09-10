// Billie MD — Pair Site server
// Standalone Express app that requests WhatsApp pairing codes using the
// existing WhatsAppManager (../whatsapp.js) and serves the web UI.
//
// Run locally:  node pair-site/server.js
// Deploy:       see pair-site/README.md

const path = require("path");
const express = require("express");
const chalk = require("chalk");

const WhatsAppManager = require("../whatsapp.js");
const config = require("../config.js");

const PORT = process.env.PORT || 3000;
const MAX_PAIRED_USERS = config.MAX_PAIRED_USERS || 20;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const whatsAppManager = new WhatsAppManager({
  sessionDir: path.join(__dirname, "..", "sessions"),
});

// ---------------------------------------------------------------------------
// Very small in-memory guard rails. Pairing hits WhatsApp's real servers, so
// we don't want a page refresh loop or a bot spamming this endpoint.
// ---------------------------------------------------------------------------
const lastRequestByPhone = new Map(); // phone -> timestamp
const requestsByIp = new Map(); // ip -> [timestamps]

const PHONE_COOLDOWN_MS = 60_000; // 1 code request per number per minute
const IP_WINDOW_MS = 10 * 60_000; // 10 minute window
const IP_MAX_REQUESTS = 8; // per window

function sanitizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function ipAllowed(ip) {
  const now = Date.now();
  const hits = (requestsByIp.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  hits.push(now);
  requestsByIp.set(ip, hits);
  return hits.length <= IP_MAX_REQUESTS;
}

app.post("/api/pair", async (req, res) => {
  try {
    const phone = sanitizePhone(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ error: "Enter a valid phone number with country code." });
    }

    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
    if (!ipAllowed(ip)) {
      return res.status(429).json({ error: "Too many requests. Please wait a few minutes and try again." });
    }

    const lastReq = lastRequestByPhone.get(phone);
    if (lastReq && Date.now() - lastReq < PHONE_COOLDOWN_MS) {
      const wait = Math.ceil((PHONE_COOLDOWN_MS - (Date.now() - lastReq)) / 1000);
      return res.status(429).json({ error: `Please wait ${wait}s before requesting another code for this number.` });
    }

    if (whatsAppManager.clients.size >= MAX_PAIRED_USERS) {
      return res.status(503).json({ error: "Billie MD is at capacity right now. Please try again later." });
    }

    lastRequestByPhone.set(phone, Date.now());

    // Session id keyed off the phone number itself — this is a public pairing
    // site, not tied to Telegram, so the number is the natural key.
    const sessionId = `web-${phone}`;
    const code = await whatsAppManager.pair(sessionId, phone);

    if (!code) {
      // Session already registered/connected — nothing further to do.
      return res.json({ code: null, alreadyConnected: true, sessionId });
    }

    return res.json({ code, sessionId });
  } catch (err) {
    console.error(chalk.red("[PAIR-SITE] pair error:"), err.message);
    return res.status(500).json({ error: "Couldn't generate a code right now. Please try again." });
  }
});

app.get("/api/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const client = whatsAppManager.getSession(sessionId);
  const status = whatsAppManager.connectionStatus.get(sessionId);

  if (!client) {
    return res.json({ connected: false, exists: false });
  }

  const connected = typeof client.isConnected === "function" ? client.isConnected() : !!status?.connected;
  return res.json({ connected, exists: true, lastSeen: status?.lastSeen || null });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, botName: config.botName, paired: whatsAppManager.clients.size, max: MAX_PAIRED_USERS });
});

app.listen(PORT, () => {
  console.log(chalk.cyan(`[PAIR-SITE] Billie MD pairing site running on port ${PORT}`));
});

module.exports = app;
