// lib/agnesAI.js
//
// Thin client for the Agnes AI gateway (OpenAI-compatible), used by
// Billie's natural-language AI mode (see lib/billieAI.js).
//
//   Chat:  POST {baseUrl}/chat/completions   { model, messages, ... }
//   Image: POST {baseUrl}/images/generations { model, prompt, size, extra_body }
//
// SECURITY NOTE: never commit a real API key into a public repo. The key
// used here comes from config.agnes.apiKey (env var AGNES_API_KEY takes
// priority) — rotate it at apihub.agnes-ai.com if it's ever exposed.

const axios = require('axios');
const config = require('../config.js');

const AGNES = config.agnes || {};
const BASE_URL = (AGNES.baseUrl || 'https://apihub.agnes-ai.com/v1').replace(/\/+$/, '');
const API_KEY = AGNES.apiKey || '';
const TEXT_MODEL = AGNES.textModel || 'agnes-2.5-flash';
const IMAGE_MODEL = AGNES.imageModel || 'agnes-image-2.1-flash';

const CHAT_TIMEOUT_MS = 25000;
const IMAGE_TIMEOUT_MS = 90000;

function authHeaders() {
    return {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Chat completion.
 * @param {{messages: Array<{role:string,content:string}>, model?: string, temperature?: number, max_tokens?: number}} opts
 * @returns {Promise<string|null>}
 */
async function chat({ messages, model = TEXT_MODEL, temperature = 0.8, max_tokens = 400 }) {
    if (!API_KEY) throw new Error('Agnes API key is not configured (set AGNES_API_KEY or config.agnes.apiKey)');
    if (!messages || !messages.length) return null;

    const { data, status } = await axios.post(
        `${BASE_URL}/chat/completions`,
        { model, messages, temperature, max_tokens },
        { headers: authHeaders(), timeout: CHAT_TIMEOUT_MS, validateStatus: () => true }
    );

    if (status < 200 || status >= 300) {
        throw new Error((data && data.error && data.error.message) || `Agnes chat HTTP ${status}`);
    }

    const text = data?.choices?.[0]?.message?.content;
    return (text && String(text).trim()) || null;
}

/**
 * Text-to-image generation, or image-to-image editing when `images` is passed.
 * @param {{prompt: string, size?: string, images?: string[] (public URLs or data: URIs), model?: string}} opts
 * @returns {Promise<Buffer|null>}
 */
async function generateImage({ prompt, size = '1024x1024', images = null, model = IMAGE_MODEL }) {
    if (!API_KEY) throw new Error('Agnes API key is not configured (set AGNES_API_KEY or config.agnes.apiKey)');
    if (!prompt || !String(prompt).trim()) return null;

    const body = {
        model,
        prompt: String(prompt).trim(),
        size,
        extra_body: { response_format: 'url' },
    };
    if (images && images.length) {
        body.extra_body.image = images;
    }

    const { data, status } = await axios.post(
        `${BASE_URL}/images/generations`,
        body,
        { headers: authHeaders(), timeout: IMAGE_TIMEOUT_MS, validateStatus: () => true }
    );

    if (status < 200 || status >= 300) {
        throw new Error((data && data.error && data.error.message) || `Agnes image HTTP ${status}`);
    }

    const entry = data?.data?.[0];
    if (!entry) return null;

    if (entry.b64_json) {
        return Buffer.from(entry.b64_json, 'base64');
    }
    if (entry.url) {
        const res = await axios.get(entry.url, { responseType: 'arraybuffer', timeout: IMAGE_TIMEOUT_MS });
        return Buffer.from(res.data);
    }
    return null;
}

module.exports = { chat, generateImage, TEXT_MODEL, IMAGE_MODEL, BASE_URL };
