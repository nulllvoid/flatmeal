// Extracts schema.org Recipe nodes from a page's JSON-LD. Verified during
// planning against vegrecipesofindia.com (Rank Math's `@graph` array,
// `HowToSection` > `itemListElement` > `HowToStep` instructions) and
// hebbarskitchen.com. Handles the shape variance schema.org's spec and
// popular WP recipe plugins (WP Recipe Maker, Tasty Recipes, Zip Recipes)
// actually produce in practice — not a full JSON-LD/schema.org parser.

export interface ExtractedRecipe {
  name: string | null;
  recipeIngredient: string[];
  instructions: string[]; // flattened, in order, regardless of source shape
  recipeYield: string | null;
  prepTime: string | null;
  cookTime: string | null;
  recipeCuisine: string | null;
  keywords: string | null;
  sourceUrl: string;
}

// Tolerates extra attributes on the script tag (e.g.
// `class="rank-math-schema-pro"` seen on vegrecipesofindia.com) — an exact
// `type="application/ld+json">` match misses these.
const JSONLD_SCRIPT_RE = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(JSONLD_SCRIPT_RE)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // Malformed JSON-LD (rare, but seen in the wild) — skip this block
      // rather than aborting the whole page.
    }
  }
  return blocks;
}

// A JSON-LD document may be a single object, an array of top-level nodes,
// or an object with `@graph` holding the actual nodes (Rank Math's
// convention, also used by Yoast SEO) — normalize all three to a flat node
// list before searching for Recipe.
function flattenNodes(block: unknown): Record<string, unknown>[] {
  if (Array.isArray(block)) {
    return block.flatMap((item) => flattenNodes(item));
  }
  if (block && typeof block === 'object') {
    const obj = block as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
      return obj['@graph'].flatMap((item) => flattenNodes(item));
    }
    return [obj];
  }
  return [];
}

function hasRecipeType(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type === 'Recipe';
  if (Array.isArray(type)) return type.includes('Recipe');
  return false;
}

// recipeInstructions varies across the ecosystem:
//   1. array of plain strings
//   2. array of HowToStep objects with a `text` field
//   3. array of HowToSection objects, each with itemListElement:
//      HowToStep[] (WP Recipe Maker's shape when a recipe has grouped
//      steps, e.g. "Making spinach puree" / "Sautéing onions" sections)
//   4. (rare) a single string with the whole method as one block
// Flattens all of these to an ordered list of step text, dropping section
// headers — a human reviewing the staged output can see grouping was lost,
// but per-step granularity is preserved, which is what matters for
// rewriting into generate_dataset.py's single-paragraph instruction style.
function flattenInstructions(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw.trim() ? [raw.trim()] : [];
  }
  if (!Array.isArray(raw)) return [];

  const steps: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item.trim()) steps.push(stripHtml(item.trim()));
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
        steps.push(...flattenInstructions(obj.itemListElement));
      } else if (typeof obj.text === 'string') {
        steps.push(stripHtml(obj.text.trim()));
      } else if (typeof obj.name === 'string') {
        steps.push(stripHtml(obj.name.trim()));
      }
    }
  }
  return steps;
}

// Instruction text sometimes carries inline HTML entities/tags (seen:
// `&nbsp;`, `&#039;`) — strip tags and decode the handful of entities that
// actually occur in this content rather than pulling in a full HTML
// entity-decoding dependency for a handful of cases.
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

// Returns every Recipe node found on the page — a "recipe roundup" post can
// legitimately embed multiple, though single-recipe pages (the common case
// for the target dish searches) will yield exactly one.
export function extractRecipes(html: string, sourceUrl: string): ExtractedRecipe[] {
  const blocks = extractJsonLdBlocks(html);
  const nodes = blocks.flatMap((b) => flattenNodes(b));
  const recipeNodes = nodes.filter(hasRecipeType);

  return recipeNodes.map((node) => ({
    name: typeof node.name === 'string' ? node.name : null,
    recipeIngredient: Array.isArray(node.recipeIngredient)
      ? node.recipeIngredient.filter((i): i is string => typeof i === 'string')
      : [],
    instructions: flattenInstructions(node.recipeInstructions),
    recipeYield: firstString(node.recipeYield),
    prepTime: typeof node.prepTime === 'string' ? node.prepTime : null,
    cookTime: typeof node.cookTime === 'string' ? node.cookTime : null,
    recipeCuisine: firstString(node.recipeCuisine),
    keywords: typeof node.keywords === 'string' ? node.keywords : null,
    sourceUrl,
  }));
}
