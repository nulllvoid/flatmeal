# Expansion backlog: 48 → 80 dishes

Add in this order (fills current gaps: more non-veg, more Karnataka/Andhra dishes, more everyday roti-sabzis). Same generator format; run validation after each batch.

## Batch 1 — non-veg depth (current set is only 17% non-veg; target ~25–30%)
1. andhra-chicken-curry (spicy, tamarind base)
2. chicken-ghee-roast (Mangalorean)
3. chicken-korma (mild, coconut-cashew)
4. mutton-curry (home style)
5. chicken-chettinad
6. egg-podimas (south-style scramble)
7. prawn-fry *(adds `shellfish` to derived-allergen sets — extend generator)*
8. chicken-65 (dry starter-style, works as dinner side)

## Batch 2 — Karnataka/local weight (pilot is Bengaluru)
9. vangi-bath (brinjal rice)
10. akki-rotti *(needs rice flour in glossary)*
11. uppittu / upma (light dinner)
12. ragi-mudde with saaru *(ragi flour)*
13. majjige-huli (buttermilk curry)
14. capsicum-palya
15. tomato-gojju
16. set-dosa with saagu

## Batch 3 — everyday North Indian rotation
17. aloo-baingan
18. sev-tamatar (quick, jain-adaptable)
19. matar-mushroom *(mushroom to glossary)*
20. malai-kofta (weekend-rich)
21. besan-chilla (light dinner)
22. dal-fry (distinct from tadka)
23. chana-masala-dry (sundal-style)
24. tawa-pulao (pav bhaji masala → glossary)

## Batch 4 — variety & light dinners
25. veg-manchurian-gravy
26. paneer-fried-rice
27. schezwan-noodles *(schezwan sauce → glossary)*
28. tomato-soup + grilled sandwich *(bread → gluten)*
29. poha (light dinner option)
30. veg-thai-green-curry *(thai paste, optional — test appetite)*
31. rajma-rice-bowl (composed)
32. dahi-aloo (fasting-friendly, jain-adaptable)

## Generator to-dos when extending
- Add `shellfish` to allergen derivation (prawns) — the fixed allergy list in PRD already includes it.
- New glossary entries needed: rice flour, ragi flour, mushroom, bread, pav bhaji masala, schezwan sauce, prawns, buttermilk.
- Keep diet ratio roughly 60% veg / 10% egg / 30% non-veg at 80 dishes.
- Re-check `base` distribution — no base should exceed ~15% of the pool or the variety heuristic starves.
