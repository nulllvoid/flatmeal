# PRD — FlatMeal MVP (v1)

## 1. Problem

Flatmates who share a domestic cook spend daily effort deciding the menu, figuring out ingredients (they are not cooks and don't know what a dish needs), buying groceries, and communicating instructions to a cook who often speaks a different language. This happens across scattered WhatsApp chats and verbal instructions, causing decision fatigue, missed/duplicate purchases, and miscommunication.

## 2. Target users (pilot)

- **Primary:** 2–5 working professionals sharing a flat in Bengaluru, employing a daily home cook for lunch and/or dinner. English-speaking, Android-heavy, already use WhatsApp + Blinkit/Zepto + Splitwise.
- **Secondary (non-user beneficiary):** the domestic cook. Never installs anything; receives WhatsApp messages in their own language (Hindi/Kannada first).
- Pilot cohort: 5–10 flats recruited from founder's friends/colleagues.

## 3. Value proposition

"Vote in 5 seconds, get the exact shopping list, and your cook gets clear instructions in their language — automatically, every day."

## 4. MVP scope (exhaustive — anything absent is out of scope)

### F1. Flat onboarding
- Sign in with phone OTP (or magic link fallback).
- Create flat → shareable invite link → members join.
- Per-member dietary profile: veg / eggetarian / non-veg; Jain toggle; allergy tags (free-pick from a fixed list: peanut, dairy, gluten, shellfish, soy).
- Flat settings: cook name, cook phone (E.164), cook language (Hindi / Kannada / English v1), meal to plan (dinner only in v1), poll timings (defaults 09:00 / 11:00 / 16:00 IST).

### F2. Daily vote
- System creates a daily poll with **3 dish options** drawn from the curated recipe pool:
  - hard-filtered by the union of the flat's dietary constraints and allergies (allergy = unoverrideable veto),
  - no dish repeated within the last 10 days for that flat,
  - options span variety (not 3 dishes of the same cuisine/base) — simple heuristic, not ML.
- Push notification at poll-open time.
- Tap-to-vote; one vote per member; changeable until close; live vote counts visible (social proof).
- "I'm out today" toggle per member per day → excluded from headcount.
- At close: winner = most votes; tie-break = least-recently-eaten; zero votes = least-recently-eaten of the three. Winner is announced in-app + push.

### F3. Grocery list (core, per user insight: flatmates don't know ingredients)
- Winning dish's ingredients scaled by final headcount, displayed as a checklist grouped by category (vegetables / dairy / staples / other).
- Members tick items already in the kitchen; the remainder is "to buy."
- Staples/spices collapse into one "check you have: turmeric, jeera…" line (flagged `is_staple`), excluded from the buy list by default.
- One-tap: copy list / share to WhatsApp as plain text.
- Optional (stretch): per-item tap opens Blinkit/Zepto search page via URL scheme. No cart APIs, no pricing.

### F4. Cook dispatch
- At dispatch time (default 16:00), send the cook a WhatsApp utility-template message via BSP containing: greeting with cook name, dish name, headcount ("cook for N people"), scaled key ingredients, cooking instructions, and any flat note for the day (free-text field any member can set before dispatch, e.g., "less spicy today").
- Text is translated to the cook's language (Google Cloud Translate) at dispatch time.
- Delivery status (sent/delivered/failed) shown in-app; on failure, fall back to showing the composed message with a "share to cook on WhatsApp yourself" button (wa.me link with prefilled text).
- Stretch (week 4 only): attach a TTS voice note of the same instructions.

### F5. Feedback capture (for the pilot itself)
- After dispatch, next morning prompt: "How was yesterday's <dish>?" 👍/👎 single tap. Stored for later recommender work and pilot analysis.
- A simple in-app "send feedback" free-text form → stored in DB.

## 5. Explicitly OUT of scope for v1

Digital pantry / inventory tracking · Q-comm cart assembly, pricing, or scraping · ML/collaborative-filtering recommender · expense splitting/ledger · breakfast & lunch planning (dinner only) · cook-facing app or two-way bot · iOS App Store release (TestFlight OK if trivial) · multi-flat membership per user · web app.

## 6. Non-functional requirements

- Poll → dispatch pipeline must run unattended daily; failures alert the founder (email/Slack webhook).
- Cook messages must never contain untranslated English (except dish names/proper nouns).
- Total daily interaction per flatmate target: < 30 seconds.
- APK distributable outside Play Store; OTA-updatable (EAS Update).
- Data privacy: cook phone numbers visible only to their flat's members; no cross-flat data leakage (Postgres RLS).

## 7. Success metrics (4-week pilot)

- ≥ 60% average daily vote participation across active flats after week 1.
- ≥ 80% of dispatched cook messages rated "cook understood without follow-up call" (weekly survey to flats).
- ≥ 50% of winning meals use the in-app grocery list (checklist opened + shared/copied).
- ≥ 5 flats still active (≥ 4 polls/week) in week 4 → green light to expand.

## 8. Key risks

| Risk | Mitigation |
|---|---|
| Meta template approval delays | Submit week 1; build with mock dispatcher; wa.me manual-share fallback ships regardless |
| Machine translation reads awkward to cooks | Human-review Hindi/Kannada renderings of the 80-recipe instruction texts once; cache reviewed translations per recipe |
| Recipe data errors (wrong quantities) | Founder + one cook review pass over the dataset before pilot |
| Flats stop voting after novelty fades | Auto-fallback winner keeps cook flow alive even at zero votes; measure, don't assume |
