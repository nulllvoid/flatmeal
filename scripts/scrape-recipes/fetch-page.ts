import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isAllowed, USER_AGENT } from './robots';

const CACHE_DIR = join(__dirname, '..', '..', 'data', 'scraped', '.cache');

// Per-domain last-request timestamp, so concurrent target-dish searches
// hitting the same domain still space out requests to it — this is a
// courtesy delay, not a queue/rate-limiter library, since scrape volume
// here is small (a handful of candidate URLs per target dish).
const lastRequestAt = new Map<string, number>();
const MIN_DELAY_MS = 1500;

function cacheKeyFor(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

function cachePathFor(url: string): string {
  return join(CACHE_DIR, `${cacheKeyFor(url)}.html`);
}

async function politeDelay(origin: string): Promise<void> {
  const last = lastRequestAt.get(origin) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestAt.set(origin, Date.now());
}

export type FetchResult =
  | { status: 'ok'; html: string; fromCache: boolean }
  | { status: 'disallowed' }
  | { status: 'fetch-failed'; error: string };

// Fetches a page's HTML, respecting robots.txt and a per-domain minimum
// delay, and caching successful fetches to disk so re-running the scraper
// after a parsing fix doesn't re-hit sites for pages already fetched.
export async function fetchPage(url: string): Promise<FetchResult> {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const cachePath = cachePathFor(url);
  if (existsSync(cachePath)) {
    return { status: 'ok', html: readFileSync(cachePath, 'utf-8'), fromCache: true };
  }

  const allowed = await isAllowed(url);
  if (!allowed) return { status: 'disallowed' };

  const origin = new URL(url).origin;
  await politeDelay(origin);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'follow',
    });
    if (!res.ok) {
      return { status: 'fetch-failed', error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    writeFileSync(cachePath, html, 'utf-8');
    return { status: 'ok', html, fromCache: false };
  } catch (err) {
    return { status: 'fetch-failed', error: err instanceof Error ? err.message : String(err) };
  }
}
