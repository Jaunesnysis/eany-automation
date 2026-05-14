import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';
import { createHash, randomBytes } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { CONFIG } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = join(__dirname, 'tokens.json');

function loadTokens() {
  try { return JSON.parse(readFileSync(TOKENS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveTokens(data) {
  writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
}

function generateVerifier() {
  return randomBytes(64).toString('base64url').slice(0, 96);
}

function generateChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function registerClient() {
  const res = await fetch(`${CONFIG.authBase}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'eany-rfs-automation',
      redirect_uris: [CONFIG.redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const data = await res.json();
  if (!data.client_id) throw new Error('Client registration failed');
  console.log('✅ OAuth client registered:', data.client_id);
  return data.client_id;
}

async function getBrowserCode(clientId, verifier) {
  const challenge = generateChallenge(verifier);
  const url = `${CONFIG.authBase}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(CONFIG.redirectUri)}&scope=read:rfs&code_challenge=${challenge}&code_challenge_method=S256`;
  console.log('\n🌐 Opening browser — please click "Allow Access"\n');
  exec(`open "${url}"`);
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const code = new URL(req.url, 'http://localhost:8080').searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>✅ Done! You can close this tab.</h2>');
      server.close();
      code ? resolve(code) : reject(new Error('No code in callback'));
    });
    server.listen(8080);
    setTimeout(() => { server.close(); reject(new Error('Auth timeout')); }, 120000);
  });
}

async function exchangeCode(clientId, code, verifier) {
  const res = await fetch(`${CONFIG.authBase}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: CONFIG.redirectUri,
      code,
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(data));
  return data;
}

async function refreshAccessToken(clientId, refreshToken) {
  const res = await fetch(`${CONFIG.authBase}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh failed');
  return data;
}

export async function getAccessToken() {
  let tokens = loadTokens();

  if (tokens.access_token && tokens.expires_at && Date.now() < tokens.expires_at - 60000) {
    console.log('✅ Using cached access token');
    return { accessToken: tokens.access_token, clientId: tokens.client_id };
  }

  if (tokens.refresh_token && tokens.client_id) {
    try {
      console.log('🔄 Refreshing access token...');
      const data = await refreshAccessToken(tokens.client_id, tokens.refresh_token);
      tokens = {
        ...tokens,
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokens.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      saveTokens(tokens);
      console.log('✅ Token refreshed');
      return { accessToken: tokens.access_token, clientId: tokens.client_id };
    } catch (e) {
      console.log('⚠️  Refresh failed, doing full auth:', e.message);
    }
  }

  const clientId = tokens.client_id || await registerClient();
  const verifier = generateVerifier();
  const code = await getBrowserCode(clientId, verifier);
  const data = await exchangeCode(clientId, code, verifier);
  tokens = {
    client_id: clientId,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  saveTokens(tokens);
  console.log('✅ Access token obtained');
  return { accessToken: tokens.access_token, clientId };
}
