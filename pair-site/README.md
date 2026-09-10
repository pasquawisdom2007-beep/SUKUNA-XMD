# Billie MD — Pair Site

A small web front end for linking a WhatsApp number to Billie MD. A visitor
enters their number, gets an 8‑digit pairing code, and enters it in
WhatsApp's **Linked Devices**. Once linked, that number runs a live Billie
MD session on your server.

It's built on top of your existing `WhatsAppManager` (`../whatsapp.js`) —
no bot logic was duplicated, the site just calls `.pair()` and shows the
result.

## Run it locally

```bash
npm install
npm run pair
```

Open `http://localhost:3000`.

## Deploy on Render (recommended)

Render runs a real, persistent Node process, which is what a live WhatsApp
socket needs — the connection has to stay open, not spin up per request.

1. Push this repo to GitHub.
2. On Render: **New → Blueprint**, point it at the repo. It will read
   `render.yaml` at the root and set the start command to `npm run pair`.
3. Add any secrets (e.g. `AGNES_API_KEY`) in the Render dashboard's
   Environment tab — don't commit them.
4. Deploy. Your pair site is live at `https://<your-service>.onrender.com`.

After deployment, copy the exact public URL from Render and open it directly.
The web pairing site is self-contained and does not require a separate bot
service or token.

If you'd rather set it up by hand instead of the blueprint: Web Service →
Build command `npm install` → Start command `npm run pair`.

## Deploy on Vercel — read this first

Vercel's free/hobby tier runs your backend as **serverless functions**:
they spin up per request and shut down afterward. A WhatsApp pairing
session needs a socket that stays open continuously, which serverless
functions aren't designed for — the connection can drop between requests
and won't reliably stay "linked."

`vercel.json` is included and will deploy the site, and requesting a code
will generally work. But for the bot to actually stay online in someone's
chats after pairing, run the pair site on Render (or another
always‑on host — Railway, Fly.io, a small VPS). Use Vercel only if you're
comfortable with that limitation or plan to point the "connect" flow at a
separate always‑on backend.

## Notes on this build

- Sessions are stored under `../sessions/<web-phonenumber>` using a `web-`
  prefix so each browser-created session has a stable identifier.
- Basic rate limiting is built in: one code per phone number per minute,
  and a per‑IP cap over a 10‑minute window. Tune these in `server.js` if
  you expect more traffic.
- `MAX_PAIRED_USERS` (from `config.js`) is respected — once you hit that
  many active sessions, the site tells new visitors to try again later.

## One more thing worth fixing

`config.js` has a real-looking API key hardcoded as a fallback
(`agnes.apiKey`). Since this project is going in a public repo /
deployed publicly, rotate that key at its provider and set it only via
the `AGNES_API_KEY` environment variable — never commit a live key.
