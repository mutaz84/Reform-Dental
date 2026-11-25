'use strict';

/**
 * DentaBrain proxy. The app calls /api/ai/chat on its own site (with the user's sign-in token,
 * which withAuth checks). This forwards the question to the DentaBrain AI server on Railway and
 * adds a shared secret, so the AI server can refuse anyone who is not coming through here.
 *
 * Application settings (Static Web App > Settings > Environment variables):
 *   DENTABRAIN_SHARED_SECRET  a long random value. Set the SAME value as a variable on Railway
 *                             to lock the AI server. Set it here first, then on Railway.
 *   DENTABRAIN_URL            optional; AI server address (default below).
 *
 * Without DENTABRAIN_SHARED_SECRET it still works: it forwards without the secret, and the AI
 * server accepts that until the secret is set there too.
 */

const https = require('https');
const http = require('http');
const { withAuth, CORS_HEADERS } = require('../shared/auth');

const DEFAULT_URL = 'https://reform-dental-production.up.railway.app';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 40000;

// Per-user limit (kept per function instance): enough for normal use, stops runaway loops.
const WINDOW_MS = 5 * 60 * 1000;
const LIMIT_PER_WINDOW = 40;
const recent = new Map();

function allowRequest(userId) {
    const now = Date.now();
    const key = String(userId || 'unknown');
    const list = (recent.get(key) || []).filter((t) => now - t < WINDOW_MS);
    if (list.length >= LIMIT_PER_WINDOW) { recent.set(key, list); return false; }
    list.push(now);
    recent.set(key, list);
    if (recent.size > 5000) recent.clear();
    return true;
}

function forward(url, body, headers) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const lib = target.protocol === 'http:' ? http : https;
        const request = lib.request(target, {
            method: 'POST',
            headers: Object.assign({ 'Content-Length': Buffer.byteLength(body) }, headers),
            timeout: TIMEOUT_MS
        }, (response) => {
            const chunks = [];
            response.on('data', (c) => chunks.push(c));
            response.on('end', () => resolve({ status: response.statusCode || 502, text: Buffer.concat(chunks).toString('utf8') }));
        });
        request.on('timeout', () => request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

async function handler(context, req) {
    const action = String((context.bindingData && context.bindingData.action) || '').toLowerCase();
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: CORS_HEADERS };
        return;
    }
    if (action !== 'chat' || req.method !== 'POST') {
        context.res = { status: 404, headers: CORS_HEADERS, body: { detail: 'Not found' } };
        return;
    }

    const body = (typeof req.rawBody === 'string' && req.rawBody) ? req.rawBody : JSON.stringify(req.body || {});
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        context.res = { status: 413, headers: CORS_HEADERS, body: { detail: 'That request is too large for DentaBrain.' } };
        return;
    }
    if (!allowRequest(req.authUser && req.authUser.id)) {
        context.res = { status: 429, headers: CORS_HEADERS, body: { detail: 'Too many questions in a few minutes. Please wait a moment and try again.' } };
        return;
    }

    const base = String(process.env.DENTABRAIN_URL || DEFAULT_URL).trim().replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    const secret = String(process.env.DENTABRAIN_SHARED_SECRET || '').trim();
    if (secret) headers['X-DentaBrain-Key'] = secret;

    try {
        const result = await forward(`${base}/api/ai/chat`, body, headers);
        // A 401 from the AI server means the two secrets don't match. Don't pass a 401 back:
        // the app would treat it as the user's sign-in expiring and sign them out.
        if (result.status === 401 || result.status === 403) {
            context.log.warn('DentaBrain proxy: AI server refused the shared secret. Check DENTABRAIN_SHARED_SECRET on both sides.');
            context.res = { status: 502, headers: CORS_HEADERS, body: { detail: "DentaBrain isn't set up correctly right now (the AI server key doesn't match)." } };
            return;
        }
        context.res = { status: result.status, headers: CORS_HEADERS, body: result.text };
    } catch (error) {
        const slow = error && error.code === 'ETIMEDOUT';
        context.log.warn('DentaBrain proxy error:', error && error.message);
        context.res = {
            status: slow ? 504 : 502,
            headers: CORS_HEADERS,
            body: { detail: slow ? 'DentaBrain took too long to answer. Please try again.' : "DentaBrain can't be reached right now." }
        };
    }
}

module.exports = withAuth(handler);
module.exports.allowRequest = allowRequest;
