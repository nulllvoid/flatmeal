import { fetchPage } from './fetch-page';

// Finds candidate recipe URLs on a domain by matching a dish's search
// keywords against post-sitemap URL slugs — verified against
// vegrecipesofindia.com (7 post-sitemaps, ~200 URLs each, readable slugs
// like `maa-ki-dal-kaali-dal`) during planning. This avoids crawling a
// site's full archive page-by-page; sitemaps are the standard, cheap way
// to get a site's full URL list in a couple of requests.

const LOC_RE = /<loc>([^<]+)<\/loc>/g;

async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 1) return []; // index -> sub-sitemap is the only nesting seen; guard against surprises
  const result = await fetchPage(sitemapUrl);
  if (result.status !== 'ok') return [];

  const locs = [...result.html.matchAll(LOC_RE)].map((m) => m[1]);

  // A sitemap *index* lists other sitemap files (recognizable by
  // `.xml` extension); a leaf sitemap lists actual page URLs.
  const subSitemaps = locs.filter((u) => u.endsWith('.xml'));
  if (subSitemaps.length > 0 && subSitemaps.length === locs.length) {
    const nested = await Promise.all(subSitemaps.map((u) => fetchSitemapUrls(u, depth + 1)));
    return nested.flat();
  }
  return locs;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Some sites (hebbarskitchen.com confirmed) publish full translated
// mirrors of every post under a language-code path prefix (`/hi/...`,
// `/kn/...`), with slugs that still match dish-name keywords — without
// this filter, the scraper found and extracted the Kannada-language
// version of a recipe (Kannada name, Kannada ingredients/instructions)
// under the English `ragi-mudde` target, which is unusable for a dataset
// whose cook-facing instructions are written in English. generate_dataset.py
// has its own hi/kn translation step (ingredient-glossary.csv) — scraped
// candidates should be the English source, not a pre-translated one.
const LANGUAGE_PATH_PREFIXES = ['/hi/', '/kn/', '/ta/', '/te/', '/mr/', '/gu/', '/bn/', '/ml/', '/pa/'];

function isLikelyTranslatedPath(pathname: string): boolean {
  return LANGUAGE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// `keywords` are matched as substrings against the URL's last path
// segment (the slug) — e.g. keyword "chicken korma" matches
// ".../chicken-korma-recipe/" via slug "chicken-korma-recipe" containing
// "chicken-korma". Multi-word keywords are slugified before matching so
// spacing/hyphenation differences between the search term and the site's
// URL convention don't cause misses.
export async function discoverCandidateUrls(domain: string, keywords: string[]): Promise<string[]> {
  const origin = `https://${domain}`;
  const allUrls = await fetchSitemapUrls(`${origin}/sitemap_index.xml`);
  if (allUrls.length === 0) return [];

  const slugifiedKeywords = keywords.map(slugify);

  return allUrls.filter((url) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (isLikelyTranslatedPath(parsed.pathname)) return false;
    const path = slugify(parsed.pathname);
    return slugifiedKeywords.some((kw) => path.includes(kw));
  });
}
