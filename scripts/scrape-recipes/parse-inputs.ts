import { readFileSync } from 'node:fs';

export interface TargetDish {
  slug: string;
  description: string;
  batch: string;
}

// Parses data/expansion-backlog.md's `N. dish-slug (description)` list
// items under `## Batch ...` headings. Not a general markdown parser —
// tied to this file's exact format, which is fine since it's a single
// hand-maintained document, not external input.
export function parseExpansionBacklog(path: string): TargetDish[] {
  const text = readFileSync(path, 'utf-8');
  const lines = text.split('\n');
  const dishes: TargetDish[] = [];
  let currentBatch = '';

  for (const line of lines) {
    const batchMatch = /^##\s+(.+)$/.exec(line.trim());
    if (batchMatch) {
      currentBatch = batchMatch[1].trim();
      continue;
    }
    const itemMatch = /^\d+\.\s+([a-z0-9-]+(?:\s*\/\s*[a-z0-9-]+)?)\s*(?:\((.+)\))?/i.exec(line.trim());
    if (itemMatch) {
      dishes.push({
        slug: itemMatch[1].split('/')[0].trim(),
        description: itemMatch[2]?.trim() ?? '',
        batch: currentBatch,
      });
    }
  }
  return dishes;
}

export interface RecipeSite {
  name: string;
  domain: string;
  focus: string;
}

// Parses docs/recipe_websites.csv (No.,Website Name,Domain,Primary Focus).
// Uses the same minimal quoted-field splitter as
// supabase/seed/seed-recipes.ts for consistency, though this file has no
// quoted commas in practice.
export function parseRecipeSites(path: string): RecipeSite[] {
  const text = readFileSync(path, 'utf-8').trim();
  const [, ...lines] = text.split('\n'); // drop header row
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const cells = line.split(',');
      return { name: cells[1]?.trim() ?? '', domain: cells[2]?.trim() ?? '', focus: cells[3]?.trim() ?? '' };
    })
    .filter((s) => s.domain);
}

// Turns a dish slug into search keywords for discover-urls.ts — the slug
// itself (hyphens read as spaces by the slugify-and-substring-match logic
// there) plus, when the slug has a description, no extra keywords are
// derived from it (descriptions are parenthetical asides like "Mangalorean"
// or "spicy, tamarind base", not alternate names — using them as search
// terms would produce false matches).
export function keywordsForDish(dish: TargetDish): string[] {
  return [dish.slug.replace(/-/g, ' ')];
}
