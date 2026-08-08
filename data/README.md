# /data — the recipe dataset (core product asset)

## Files

- `generate_dataset.py` — **source of truth.** All recipes, ingredients, and the translation glossary live in this file as structured Python. Edit here, run `python3 generate_dataset.py`, and it validates + regenerates the CSVs. Never hand-edit the CSVs.
- `recipes.csv` — 48 dishes: slug, name, cuisine, base, diet_class, jain_ok, derived allergens, seasons, cook-facing English instructions.
- `ingredients.csv` — 451 rows: per-person quantities in buyable units, hi/kn names joined from the glossary, staples flagged.
- `ingredient-glossary.csv` — one row per unique ingredient with Hindi + Kannada names. Fix a translation once here, it propagates everywhere on regeneration.
- `expansion-backlog.md` — the next 32 dishes to reach the 80-dish target, prioritized.

## Rules (enforced by the generator's validation)

1. Quantities are PER PERSON, multiplied by headcount in-app. Units must be buyable: piece / g / ml / bunch / packet / cup / tbsp / tsp. Never "katori", never "to taste".
2. Salt is never listed — assumed present in every kitchen.
3. Spices, oil, ghee, pastes = category `staple` → collapsed into the "check you have:" line, excluded from the buy list.
4. Allergens (dairy/gluten/peanut/soy) are computed from ingredients; do not hand-tag. Ghee counts as dairy — this catches surprises like dal tadka not being dairy-free.
5. Every ingredient name must exist in the glossary; validation fails otherwise.
6. Instructions are written FOR THE COOK: imperative, include heat levels, timings, doneness cues, and mistakes to avoid ("dry bhindi fully or it turns sticky"). ≥ 25 words.
7. `base` powers the variety heuristic (never 3 paneer dishes in one poll) — keep it honest.

## Review workflow before pilot (human, non-code)

1. Founder pass: sanity-check every per-person quantity against how you'd actually order on Blinkit.
2. Cook pass: pay a real cook for an hour to review quantities + instructions for 20 random dishes; fix globally what they flag (this calibrates your whole dataset cheaply).
3. Translation pass: after `recipe_translations` are machine-generated (hi/kn), have one native speaker per language read all instruction bodies; mark `reviewed_by/reviewed_at`.

## Seeding Supabase

Seed script order: glossary (optional reference table) → recipes → ingredients (join `recipe_slug` → `recipe_id`). Idempotent upsert on slug.
