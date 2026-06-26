#!/usr/bin/env node
/**
 * Astranov Decentralized Server — Astranov Sites sync relay
 * Run on Windows / Mac / Linux: node server.mjs
 * Default: http://0.0.0.0:8787/superbooking/sync
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ASTRANOV_NODE_PORT || 8787);
const HOST = process.env.ASTRANOV_NODE_HOST || '0.0.0.0';
const DATA_DIR = process.env.ASTRANOV_NODE_DATA || path.join(__dirname, 'data');
const SYNC_FILE = path.join(DATA_DIR, 'superbooking-sync.jsonl');
const CENTRAL_RELAY = process.env.ASTRANOV_CENTRAL_RELAY_URL
  || process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? `${process.env.SUPABASE_URL}/rest/v1/rpc/astranov_superbooking_sync_ingest`
    : '';
const CENTRAL_RELAY_KEY = process.env.SUPABASE_ANON_KEY || process.env.ASTRANOV_CENTRAL_ANON_KEY || '';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2_000_000) reject(new Error('payload too large')); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function relayToCentral(payload) {
  if (!CENTRAL_RELAY) return { relayed: false };
  try {
    const headers = { 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    if (CENTRAL_RELAY_KEY) {
      headers.apikey = CENTRAL_RELAY_KEY;
      headers.Authorization = 'Bearer ' + CENTRAL_RELAY_KEY;
    }
    const r = await fetch(CENTRAL_RELAY, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_payload: payload })
    });
    return { relayed: r.ok, status: r.status };
  } catch (e) {
    return { relayed: false, error: String(e.message || e) };
  }
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'astranov-decentral-server', port: PORT, platform: process.platform }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/superbooking/sync') {
    const lines = fs.existsSync(SYNC_FILE) ? fs.readFileSync(SYNC_FILE, 'utf8').trim().split('\n').filter(Boolean) : [];
    const tail = lines.slice(-100).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, count: tail.length, events: tail }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/superbooking/sync') {
    try {
      const payload = await readJson(req);
      const record = { ...payload, receivedAt: new Date().toISOString(), server: 'astranov-decentral' };
      fs.appendFileSync(SYNC_FILE, JSON.stringify(record) + '\n', 'utf8');
      const relay = await relayToCentral(record);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, stored: true, relay }));
      return;
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found', paths: ['/health', '/superbooking/sync'] }));
});

server.listen(PORT, HOST, () => {
  console.log(`Astranov Decentralized Server listening on http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
  console.log(`Astranov Sites sync: POST http://127.0.0.1:${PORT}/superbooking/sync`);
});