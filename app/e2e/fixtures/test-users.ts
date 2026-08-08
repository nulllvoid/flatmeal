import { createHmac , randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { dbQuery } from './db';

// Fixed IDs for the 3 synthetic flatmates seeded for this suite (see
// e2e/README.md "Test data setup"). All three are real flat_members of
// TEST_FLAT_ID so multi-user vote/tally/realtime scenarios reflect actual
// RLS-authenticated behavior, not mocked state.
export const TEST_FLAT_ID = 'b584e7a0-2da7-4e46-8ab2-2ddebf20704b';

export const TEST_USERS = {
  owner: { id: 'f5dd623e-f486-4009-9385-7e5b15396f54', email: 'shivik2541@gmail.com', displayName: 'shivik2541@gmail.com' },
  priya: { id: '11111111-1111-1111-1111-111111111111', email: 'test-flatmate-1@flatmeal.test', displayName: 'Priya (test)' },
  rahul: { id: '22222222-2222-2222-2222-222222222222', email: 'test-flatmate-2@flatmeal.test', displayName: 'Rahul (test)' },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

interface SessionData {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: { id: string; email: string; role: string };
}

function b64url(input: string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readJwtSecret(): string {
  // Read directly from app/.env — never printed, never written elsewhere.
  // Missing this is a hard stop: there is no fallback path (real magic-link
  // login is unavailable — see e2e/README.md "Why forged sessions").
  const envPath = join(__dirname, '..', '..', '.env');
  const envText = readFileSync(envPath, 'utf-8');
  const line = envText.split('\n').find((l) => l.startsWith('SUPA_JWT='));
  if (!line) {
    throw new Error(
      'SUPA_JWT not found in app/.env. This suite mints test-session JWTs locally using the ' +
        "project's JWT secret (Dashboard -> Settings -> API -> JWT Settings) since real magic-link " +
        'email delivery is unavailable in this environment. Add SUPA_JWT=<secret> to app/.env to run these tests.'
    );
  }
  return line.slice('SUPA_JWT='.length).trim();
}

// Mints a session for an existing auth.users row by signing a JWT with the
// project's JWT secret and backing it with a real auth.sessions row (GoTrue
// validates session_id against that table for some checks). Only usable in
// this dev/test environment; the secret never leaves app/.env.
export function mintSession(userKey: TestUserKey): SessionData {
  const user = TEST_USERS[userKey];
  const secret = readJwtSecret();
  const sessionId = randomUUID();

  dbQuery(
    `insert into auth.sessions (id, user_id, created_at, updated_at, not_after, aal)
     values ('${sessionId}', '${user.id}', now(), now(), now() + interval '8 hours', 'aal1');`
  );

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'authenticated',
    exp: now + 8 * 3600,
    iat: now,
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    session_id: sessionId,
  };

  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return {
    access_token: `${signingInput}.${signature}`,
    token_type: 'bearer',
    expires_in: 8 * 3600,
    expires_at: now + 8 * 3600,
    refresh_token: 'e2e-fixture-not-a-real-refresh-token',
    user: { id: user.id, email: user.email, role: 'authenticated' },
  };
}

export function sessionStorageEntry(session: SessionData): { key: string; value: SessionData } {
  return { key: `sb-${PROJECT_REF}-auth-token`, value: session };
}

export const PROJECT_REF = 'pcmtsfcjzoivagpslpch';
