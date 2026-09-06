import 'server-only';

import { createVerify } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface VerifiedUser {
  uid: string;
  email: string;
  token: string;
}

interface FirebaseClaims {
  aud?: string;
  auth_time?: number;
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
  user_id?: string;
}

let cachedCertificates: Record<string, string> = {};
let certificatesExpireAt = 0;

function projectId(): string {
  return process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
}

function parseMaxAge(cacheControl: string | null): number {
  const match = cacheControl?.match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : 3600;
}

async function getFirebaseCertificates(): Promise<Record<string, string>> {
  if (Date.now() < certificatesExpireAt && Object.keys(cachedCertificates).length > 0) return cachedCertificates;
  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('AUTH_CERTIFICATES_UNAVAILABLE');
  cachedCertificates = await response.json();
  certificatesExpireAt = Date.now() + Math.max(300, parseMaxAge(response.headers.get('cache-control'))) * 1000;
  return cachedCertificates;
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

export async function verifyFirebaseUser(req: NextRequest): Promise<VerifiedUser | null> {
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const firebaseProjectId = projectId();
  if (!token || !firebaseProjectId || token.length > 4096) return null;

  try {
    const pieces = token.split('.');
    if (pieces.length !== 3) return null;
    const header = decodeJson<{ alg?: string; kid?: string }>(pieces[0]);
    const claims = decodeJson<FirebaseClaims>(pieces[1]);
    if (header.alg !== 'RS256' || !header.kid) return null;

    const certificates = await getFirebaseCertificates();
    const certificate = certificates[header.kid];
    if (!certificate) return null;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${pieces[0]}.${pieces[1]}`);
    verifier.end();
    if (!verifier.verify(certificate, Buffer.from(pieces[2], 'base64url'))) return null;

    const now = Math.floor(Date.now() / 1000);
    const uid = claims.sub || claims.user_id || '';
    if (
      claims.aud !== firebaseProjectId ||
      claims.iss !== `https://securetoken.google.com/${firebaseProjectId}` ||
      !claims.exp || claims.exp <= now ||
      !claims.iat || claims.iat > now + 300 ||
      (claims.auth_time && claims.auth_time > now + 300) ||
      !uid || uid.length > 128
    ) return null;

    return { uid, email: claims.email || '', token };
  } catch {
    return null;
  }
}

export async function requireFirebaseUser(req: NextRequest): Promise<VerifiedUser | NextResponse> {
  const user = await verifyFirebaseUser(req);
  return user || NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });
}

export function isAuthError(value: VerifiedUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
