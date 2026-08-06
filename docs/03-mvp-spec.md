# MVP Spec — screens, flows, edge cases

Four screens + onboarding. Push back on any screen sprawl beyond this.

## S0. Onboarding (one-time)
1. Phone number → OTP → session.
2. "Create a flat" or "Join with link".
   - Create: flat name → dietary profile form (diet type, Jain toggle, allergy multi-select) → cook details (name, phone, language) → poll timings (prefilled defaults) → invite link share sheet.
   - Join: deep link opens app → dietary profile form → done.
3. Request push-notification permission with a one-line why ("so you can vote in 5 seconds").

Edge cases: joining a flat that already has today's poll → user sees the live poll immediately; cook details editable later by any member (log who changed it in `audit_note` column).

## S1. Today (home) — the vote
- Header: date + "Dinner for <flat name>" + headcount pill ("3 eating tonight").
- "I'm out today" toggle at top. Toggling after poll close but before dispatch still updates headcount + cook message; after dispatch, show "already sent to cook — tell the flat group" notice.
- Poll open: 3 dish cards (name, cuisine tag, veg/non-veg dot, hero image optional/local asset). Tap = vote. Selected card highlighted. Avatars of voters shown per card (social proof). Countdown to close.
- Poll closed: winner card + "N votes" + buttons: [Grocery list] [Preview cook message] [Add note for cook] (note editable until dispatch).
- Yesterday's 👍/👎 feedback chip at top until answered.

States: no poll yet today (before open time) → show "options coming at 09:00"; all members marked out → poll auto-cancels, no dispatch, banner "no dinner today"; poll with zero votes at close → winner auto-picked, labeled "auto-picked (no votes)".

## S2. Grocery list
- Winner name + headcount + regenerate note ("scaled for 3").
- Checklist grouped: Vegetables / Dairy / Staples check-line / Other. Items show buyable quantity ("2 medium onions", "200 g paneer").
- Tick = "we already have it" (persisted per poll, synced realtime so two flatmates don't double-buy).
- Footer: unticked count + [Copy list] [Share to WhatsApp].
- Share text format:
  ```
  🛒 Tonight: Palak Paneer (3 people)
  To buy:
  - Palak (spinach) — 2 bunches
  - Paneer — 200 g
  - Curd — 1 small packet (200 g)
  Check at home: turmeric, jeera, garam masala
  ```
- Stretch: item row → chevron opens Blinkit search URL for the item name.

## S3. Settings
- My dietary profile (edit).
- Flat: members list, invite link, cook card (name/phone/language — changing language takes effect next dispatch), poll timings, meal (locked to Dinner, shown greyed for expectation-setting).
- Danger: leave flat.
- Send feedback (free text → `feedback` table).

## S4. Cook message preview (modal from S1)
- Shows the exact translated message that will be / was sent, with English original toggle.
- Pre-dispatch: [Edit flat note] visible.
- Post-dispatch: delivery status (sent/delivered/read/failed). Failed → [Send it yourself] button → wa.me/<cookphone>?text=<urlencoded translated message>.

## Daily pipeline (server, IST)
1. `create_poll` (per-flat open time): pick 3 options (filters: diet ∪ allergies as hard excludes; exclude dishes served to this flat in last 10 days; variety heuristic: not all 3 same cuisine or same base ingredient) → insert poll + options → push "Vote for tonight's dinner".
2. `close_poll` (per-flat close time): compute winner (votes → least-recently-eaten tie-break) → push winner announcement.
3. `dispatch_cook` (per-flat dispatch time): recompute headcount (out-toggles counted now), compose English payload (dish, headcount, scaled ingredients, instructions, flat note), fetch cached reviewed translation or call Translate, render into approved template variables, call BSP (or mock), write `dispatch_log` with status; webhook updates delivery status.
4. Failure at any stage → row in `pipeline_errors` + alert webhook to founder.

## Push notifications (Expo)
- Poll open, poll closed/winner, dispatch failed (to all members), morning feedback prompt. All deep-link to relevant screen. Respect per-user mute toggle (settings) except dispatch-failed.
