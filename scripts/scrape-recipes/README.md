# Recipe scraper

Sources *candidate* recipe data from `docs/recipe_websites.csv`'s 101
Indian recipe blogs for dishes listed in `data/expansion-backlog.md`. This
is a research/sourcing tool, not a dataset writer — it never touches
`data/recipes.csv`, `data/ingredients.csv`, or `data/generate_dataset.py`.
Turning a scraped candidate into a real dataset entry (per-person buyable
quantities, imperative ≥25-word cook instructions, glossary-checked
ingredient names — see `data/README.md`'s rules) is a separate, human
step.

## Usage

```bash
# Scrape every dish in data/expansion-backlog.md
npx tsx scripts/scrape-recipes/scrape-recipes.ts

# Scrape specific dishes only
npx tsx scripts/scrape-recipes/scrape-recipes.ts chicken-korma andhra-chicken-curry

# Tune how hard it searches per dish (defaults: 8 sites, 3 candidates)
MAX_SITES_PER_DISH=20 MAX_CANDIDATES_PER_DISH=5 npx tsx scripts/scrape-recipes/scrape-recipes.ts vangi-bath
```

Output lands in `data/scraped/` (gitignored — working material, not source
of truth):
- `<domain>__<dish-slug>.json` per successful candidate — the extracted
  name, ingredients (raw strings, as published), instructions (flattened
  to an ordered step list), yield, prep/cook time, cuisine.
- `run-log.csv` — every (dish, site) attempt this run, with a status
  (`ok` / `no-candidate-url` / `no-jsonld` / `no-recipe-node` /
  `fetch-failed` / `disallowed`) so you can see coverage gaps without
  opening every file.
- `.cache/` — raw HTML of every fetched page, keyed by URL hash, so a
  re-run after fixing a parsing bug doesn't re-hit sites for pages already
  fetched.

## How it works

1. **Discovery** (`discover-urls.ts`) — fetches a site's
   `/sitemap_index.xml`, walks any sub-sitemaps, and matches the target
   dish's name against URL slugs. No full-site crawling; a couple of
   sitemap requests per site.
2. **Fetch** (`fetch-page.ts`) — checks `robots.txt` first
   (`robots.ts`), applies a 1.5s minimum delay between requests to the same
   domain, and caches successful fetches to disk.
3. **Extract** (`extract-jsonld.ts`) — looks for
   `<script type="application/ld+json">` blocks (tolerating extra
   attributes on the tag, e.g. Rank Math's `class="rank-math-schema-pro"`),
   walks any `@graph` wrapper, and pulls out `schema.org/Recipe` nodes.
   Verified against real pages during development: this JSON-LD-first
   approach worked on every site tried so far (vegrecipesofindia.com,
   hebbarskitchen.com, ministryofcurry.com) — recipe blogs near-universally
   embed this markup for Google's Rich Results, since it's standard
   practice for WordPress recipe plugins (WP Recipe Maker, Tasty Recipes,
   etc.). Sites without it get logged as `no-jsonld`, not scraped via
   brittle CSS-selector guessing — there's no per-site scraping logic here,
   deliberately, since hand-writing 101 site-specific scrapers isn't
   maintainable.
4. **Write** (`scrape-recipes.ts`, the orchestrator) — one JSON file per
   successful (dish, site) match, plus the run log.

## Politeness

- Identifies itself with a real `User-Agent` (see `robots.ts`'s
  `USER_AGENT` constant) rather than spoofing a browser.
- Respects `robots.txt`'s `User-agent: *` rules on every domain touched.
- 1.5s minimum delay between requests to the same domain.
- Caps how many sites it searches and how many candidates it keeps per
  dish (both configurable) — this sources a few dozen target dishes, not a
  bulk crawl, so there's no reason to hit any site harder than needed to
  find 2-3 good candidates.

## Known limitations

- Sitemap-slug matching can both miss real matches (if a site's URL slug
  doesn't contain the dish name in a recognizable form) and, in principle,
  false-positive on an unrelated post whose slug happens to contain the
  keyword — the run log's URLs make both cases easy to spot on review.
- Only the first sitemap match per site is fetched — a site's other
  articles about the same dish (e.g. multiple regional variations) aren't
  all collected. This is deliberate: the review step downstream needs a
  couple of good references per dish, not every published take on it.
- No fallback extraction for sites without JSON-LD Recipe markup. Given the
  size of the target site list (101), this hasn't been a real constraint
  in practice — there's always been another site with structured data for
  a given dish.
