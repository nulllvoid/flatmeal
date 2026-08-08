// Orchestrator: for each target dish (from data/expansion-backlog.md, or a
// CLI-provided list), searches each site in docs/recipe_websites.csv for a
// matching recipe URL via its sitemap, fetches and extracts any Recipe
// JSON-LD found, and writes successful candidates to data/scraped/ plus a
// run-log.csv covering every attempt (hit or miss) for human review.
//
// This is a sourcing tool, not a dataset writer: nothing here touches
// data/recipes.csv, data/ingredients.csv, or generate_dataset.py. See
// scripts/scrape-recipes/README.md.
//
// Usage:
//   npx tsx scripts/scrape-recipes/scrape-recipes.ts [dish-slug ...]
//   (no args -> scrapes every dish in data/expansion-backlog.md)
//
// Options (env vars, kept simple rather than adding a CLI-arg parser
// dependency for a handful of knobs):
//   MAX_SITES_PER_DISH=8   how many sites to search before stopping (the
//                          full 101-site sweep for every dish is far more
//                          than needed once a few good candidates exist)
//   MAX_CANDIDATES_PER_DISH=3

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { discoverCandidateUrls } from './discover-urls';
import { extractRecipes } from './extract-jsonld';
import { fetchPage } from './fetch-page';
import { keywordsForDish, parseExpansionBacklog, parseRecipeSites, type TargetDish } from './parse-inputs';

const REPO_ROOT = join(__dirname, '..', '..');
const OUTPUT_DIR = join(REPO_ROOT, 'data', 'scraped');
const MAX_SITES_PER_DISH = Number(process.env.MAX_SITES_PER_DISH ?? 8);
const MAX_CANDIDATES_PER_DISH = Number(process.env.MAX_CANDIDATES_PER_DISH ?? 3);

interface LogRow {
  dish: string;
  site: string;
  url: string;
  status: 'ok' | 'no-jsonld' | 'no-recipe-node' | 'fetch-failed' | 'disallowed' | 'no-candidate-url';
  detail: string;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function domainSlug(domain: string): string {
  return domain.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-');
}

async function scrapeDish(dish: TargetDish, sites: ReturnType<typeof parseRecipeSites>, log: LogRow[]): Promise<number> {
  const keywords = keywordsForDish(dish);
  let candidatesFound = 0;
  let sitesSearched = 0;

  for (const site of sites) {
    if (candidatesFound >= MAX_CANDIDATES_PER_DISH) break;
    if (sitesSearched >= MAX_SITES_PER_DISH) break;
    sitesSearched += 1;

    let urls: string[];
    try {
      urls = await discoverCandidateUrls(site.domain, keywords);
    } catch (err) {
      log.push({
        dish: dish.slug,
        site: site.domain,
        url: '',
        status: 'fetch-failed',
        detail: `sitemap discovery failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    if (urls.length === 0) {
      log.push({ dish: dish.slug, site: site.domain, url: '', status: 'no-candidate-url', detail: '' });
      continue;
    }

    // Only the first match per site — a second candidate for the same
    // dish on the same site rarely adds independent signal for the human
    // review step this data feeds into.
    const url = urls[0];
    const fetched = await fetchPage(url);

    if (fetched.status === 'disallowed') {
      log.push({ dish: dish.slug, site: site.domain, url, status: 'disallowed', detail: 'robots.txt' });
      continue;
    }
    if (fetched.status === 'fetch-failed') {
      log.push({ dish: dish.slug, site: site.domain, url, status: 'fetch-failed', detail: fetched.error });
      continue;
    }

    const recipes = extractRecipes(fetched.html, url);
    if (recipes.length === 0) {
      const hasJsonLd = /application\/ld\+json/.test(fetched.html);
      log.push({
        dish: dish.slug,
        site: site.domain,
        url,
        status: hasJsonLd ? 'no-recipe-node' : 'no-jsonld',
        detail: '',
      });
      continue;
    }

    const recipe = recipes[0];
    const outPath = join(OUTPUT_DIR, `${domainSlug(site.domain)}__${dish.slug}.json`);
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          targetDishSlug: dish.slug,
          targetDishDescription: dish.description,
          sourceSite: site.domain,
          scrapedAt: new Date().toISOString(),
          ...recipe,
        },
        null,
        2
      ),
      'utf-8'
    );
    log.push({ dish: dish.slug, site: site.domain, url, status: 'ok', detail: outPath });
    candidatesFound += 1;
  }

  return candidatesFound;
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const allDishes = parseExpansionBacklog(join(REPO_ROOT, 'data', 'expansion-backlog.md'));
  const sites = parseRecipeSites(join(REPO_ROOT, 'docs', 'recipe_websites.csv'));

  const requestedSlugs = process.argv.slice(2);
  const dishes =
    requestedSlugs.length > 0 ? allDishes.filter((d) => requestedSlugs.includes(d.slug)) : allDishes;

  if (dishes.length === 0) {
    console.error('No matching dishes found. Available slugs:', allDishes.map((d) => d.slug).join(', '));
    process.exit(1);
  }

  console.log(`Scraping ${dishes.length} dish(es) across up to ${MAX_SITES_PER_DISH} sites each (of ${sites.length} total)...`);

  const log: LogRow[] = [];
  for (const dish of dishes) {
    process.stdout.write(`${dish.slug}... `);
    const found = await scrapeDish(dish, sites, log);
    console.log(`${found} candidate(s)`);
  }

  const logPath = join(OUTPUT_DIR, 'run-log.csv');
  const header = 'dish,site,url,status,detail';
  const rows = log.map((r) => [r.dish, r.site, r.url, r.status, r.detail].map(csvEscape).join(','));
  writeFileSync(logPath, [header, ...rows].join('\n') + '\n', 'utf-8');

  const okCount = log.filter((r) => r.status === 'ok').length;
  console.log(`\nDone. ${okCount} candidate(s) written to ${OUTPUT_DIR}`);
  console.log(`Full run log: ${logPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
