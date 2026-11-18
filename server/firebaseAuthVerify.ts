import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

function loadFirebaseProjectId(): string | null {
  try {
    const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    const projectId = String(parsed?.projectId || '').trim();
    if (!projectId || projectId === 'remixed-project-id') return null;
    return projectId;
  } catch {
    return null;
  }
}

export const FIREBASE_PROJECT_ID = loadFirebaseProjectId();

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now < certCache.expiresAt) {
    return certCache.certs;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`CERT_FETCH_FAILED_${res.status}`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  certCache = {
    certs,
    expiresAt: now + Math.max(60, maxAgeSec) * 1000,
  };
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const jsonStr = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(jsonStr) as T;
}

function decodeBase64UrlBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

export interface VerifiedAuthCaller {
  uid: string;
  name?: string;
  email?: string;
  verified: boolean;
}

export async function verifyFirebaseBearerToken(
  token: string | null | undefined
): Promise<VerifiedAuthCaller | null> {
  if (!FIREBASE_PROJECT_ID) {
    return null;
  }

  const trimmed = String(token || '').trim();
  if (!trimmed) {
    throw new Error('AUTH_REQUIRED');
  }

  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('INVALID_AUTH_TOKEN');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('INVALID_AUTH_TOKEN');
  }

  const certs = await getGooglePublicCerts();
  let certPem = certs[header.kid];
  if (!certPem) {
    certCache = null;
    const refreshed = await getGooglePublicCerts();
    certPem = refreshed[header.kid];
  }
  if (!certPem) {
    throw new Error('INVALID_AUTH_KID');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const isValidSig = verifier.verify(certPem, decodeBase64UrlBuffer(signatureB64));
  if (!isValidSig) {
    throw new Error('INVALID_AUTH_SIGNATURE');
  }

  const payload = decodeBase64UrlJson<{
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    name?: string;
    email?: string;
  }>(payloadB64);

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== expectedIssuer) {
    throw new Error('INVALID_AUTH_CLAIMS');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('INVALID_AUTH_SUBJECT');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 30) {
    throw new Error('AUTH_TOKEN_EXPIRED');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('INVALID_AUTH_IAT');
  }

  return {
    uid: payload.sub,
    name: payload.name,
    email: payload.email,
    verified: true,
  };
}
