# WhatsApp integration (cook dispatch)

## Setup (start day 1 — longest lead time in the project)

1. Pick BSP: compare **AiSensy** vs **Interakt** on onboarding speed + per-message utility rate (India utility messages are cheap, roughly ₹0.12–0.35; confirm current rates). Either works; pick whichever verifies fastest.
2. Through the BSP: create Meta Business Manager, verify business, register a WhatsApp Business number (use a fresh SIM/virtual number, NOT the founder's personal number).
3. Submit the utility templates below for **hi, kn, en** and wait for approval (hours–days, occasionally longer).
4. Configure BSP webhook URL → Supabase Edge Function `wa_webhook` for delivery statuses.

## Template drafts (category: UTILITY)

Meta approves the template *shell*; variables are filled at send time with already-translated content, so one template per language is enough.

**Name:** `daily_cook_instructions` · **Language:** hi

```
नमस्ते {{1}} 🙏
आज का खाना: *{{2}}*
{{3}} लोगों के लिए बनाना है।

सामग्री: {{4}}

बनाने का तरीका:
{{5}}

नोट: {{6}}
```

**Language:** kn

```
ನಮಸ್ಕಾರ {{1}} 🙏
ಇಂದಿನ ಅಡುಗೆ: *{{2}}*
{{3}} ಜನರಿಗೆ ಮಾಡಬೇಕು.

ಬೇಕಾಗುವ ಸಾಮಗ್ರಿ: {{4}}

ಮಾಡುವ ವಿಧಾನ:
{{5}}

ಸೂಚನೆ: {{6}}
```

**Language:** en

```
Hello {{1}} 🙏
Today's meal: *{{2}}*
Please cook for {{3}} people.

Ingredients: {{4}}

Method:
{{5}}

Note: {{6}}
```

Variables: 1 cook name · 2 dish name (keep dish name as-is, transliterate only if reviewed) · 3 headcount digit · 4 scaled key-ingredient line (translated) · 5 instruction body (from `recipe_translations` reviewed cache) · 6 flat note (live-translated; default "—").

Template rules to respect: no variable at the very start or end floating alone, no promo language (must stay UTILITY category), sample values required at submission.

## Composition pipeline (in `dispatch_cook`)

1. Build English payload from winner + headcount + scaled ingredients + `flat_note`.
2. Body translation: read `recipe_translations(recipe_id, cook.language)`; if missing → Google Translate → insert with `reviewed_at = null` (flagged for human review).
3. Flat note: live Google Translate each time (short, dynamic).
4. Fill template variables → BSP send API → `dispatch_log`.
5. `DISPATCH_MODE=mock` skips step 4's network call and logs status `mocked`.

## Fallback (ships regardless of Meta approval)

If template unapproved or send fails: app shows the composed translated message with a button →
`https://wa.me/<cook_phone>?text=<urlencoded message>` — a flatmate sends it from their own WhatsApp in one tap. This also serves as the demo path on day 1.

## Quality gate before pilot

Have one native Hindi and one native Kannada speaker (or a real cook) read all ~80 cached instruction translations; fix awkward renderings; set `reviewed_by/reviewed_at`. Machine translation of cooking verbs is the most likely embarrassment point ("beat the eggs" mistranslations etc.).

## Stretch: voice note

TTS the translated body (Sarvam AI Bulbul / Google TTS hi-IN, kn-IN) → upload media via BSP → send as follow-up audio message. Only if weeks 1–3 land on time.
