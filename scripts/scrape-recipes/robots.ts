// Minimal robots.txt fetch + parse + allow-check, scoped to what this
// scraper needs: does `User-agent: *` (this scraper doesn't identify as
// any specific named bot) disallow a given path on a given domain. Not a
// full robots.txt spec implementation (no wildcard/`$` path matching, no
// per-bot rule sets beyond `*`) — those aren't needed for the sites this
// scraper targets, and adding them speculatively would be unused
// complexity.

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

const cache = new Map<string, RobotsRules>();

async function fetchRobots(origin: string): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached) return cached;

  const rules: RobotsRules = { disallow: [], allow: [] };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) {
      const text = await res.text();
      rules.disallow.push(...parseDirectives(text, 'disallow'));
      rules.allow.push(...parseDirectives(text, 'allow'));
    }
    // Non-OK (404 etc.) is treated as "no restrictions" — the conventional
    // interpretation when a site has no robots.txt at all.
  } catch {
    // Fetch failure (DNS, timeout, etc.) — same conservative "no
    // restrictions from robots.txt" fallback; the page fetch itself will
    // fail on its own if the site is genuinely unreachable.
  }

  cache.set(origin, rules);
  return rules;
}

// Parses only the `User-agent: *` block(s) — this scraper doesn't claim to
// be a named crawler (Googlebot etc.), so only the wildcard rules apply to
// it, per standard robots.txt semantics.
function parseDirectives(text: string, directive: 'disallow' | 'allow'): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const results: string[] = [];
  let inWildcardBlock = false;

  for (const line of lines) {
    if (/^user-agent:\s*/i.test(line)) {
      const agent = line.replace(/^user-agent:\s*/i, '').trim();
      inWildcardBlock = agent === '*';
      continue;
    }
    if (!inWildcardBlock) continue;

    const match = new RegExp(`^${directive}:\\s*(.*)$`, 'i').exec(line);
    if (match && match[1].trim()) {
      results.push(match[1].trim());
    }
  }
  return results;
}

export const USER_AGENT = 'FlatMealRecipeResearchBot/1.0 (+https://github.com/nulllvoid/flatmeal; recipe dataset research, low-volume, contact via repo issues)';

// True if `url`'s path is not disallowed for User-agent: * on its origin.
// Longest-matching-rule-wins is the de facto convention when both an Allow
// and a Disallow prefix match; implemented here since Rank Math and some
// WP robots.txt setups mix both directives.
export async function isAllowed(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const rules = await fetchRobots(parsed.origin);
  const path = parsed.pathname + parsed.search;

  const matchingDisallow = rules.disallow.filter((p) => p && path.startsWith(p));
  const matchingAllow = rules.allow.filter((p) => p && path.startsWith(p));

  const longestDisallow = Math.max(0, ...matchingDisallow.map((p) => p.length));
  const longestAllow = Math.max(0, ...matchingAllow.map((p) => p.length));

  if (longestDisallow === 0) return true;
  return longestAllow >= longestDisallow;
}
