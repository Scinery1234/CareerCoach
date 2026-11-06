# Known bugs and fixes needed

Found during the November 2026 product audit (full notes: `docs/market-research-notes/our_product_audit.md`). Ordered by user impact.

## Visible to every user

1. **Literal "null" rendered on step 2 ("Who are you?").** `heading(i, title, lead)` returns `null` as its third element when there is no lead (`public/app.js:155`), and `w.append(...heading(...))` stringifies it (`public/app.js:183`). Fix: filter nulls in `heading()` (e.g. `.filter(Boolean)`) or make `h()`-style append skip null.
2. **Summary "Values" line collapses into a run-on sentence.** Items are joined with spaces that HTML collapses (`public/app.js:389`). The "I am" block below uses `white-space:pre-line` and renders correctly. Fix: render values as a list or use the same `pre-line` style.
3. **"I am" statements not case-normalised.** Typing "Learner" gives "I am a Learner" (`iam()`, `public/app.js:79`). Fix: lower-case the first letter unless the word looks like a proper noun or acronym.
4. **Strengths card placeholders truncate** at the 210px column minimum ("e.g. Gardening, N"). Fix: shorten the placeholders or let them wrap.
5. **Step heading clipped after adding a tag.** Focus-driven scroll leaves the h2 under the header on the Strengths step. Fix: add `scroll-margin-top` to step headings or scroll the workspace rather than the input into view.

## Safety

6. **Crisis message still sent to Claude.** When a crisis keyword opens the support dialog, `send()` does not pause, so the message goes to the model anyway (`public/app.js:417-418`). Fix: wait for "I'm safe, continue" before sending, or drop the send.
7. **Keyword detection is substring-based** and false-positives on ordinary frustration ("I can't go on in this job", "end it all"). Fix: word-boundary matching and a tighter list; consider letting the model's own safety instruction handle ambiguous cases.

## Accessibility

8. **No focus trap in either modal** (consent, crisis), and the crisis dialog has no Esc handling.
9. **`--faint` hint colour fails AA contrast** (#8aa3ad on #eef4f6, roughly 2.6:1). Used for hints and kickers. Darken to at least 4.5:1.
10. **Tap targets under 44px on mobile:** step pills 31px, rank arrows 32px, chips 37px.

## Code hygiene

11. **Dead dark-mode CSS.** `:root[data-theme="dark"]` rules exist (`public/styles.css:21-26`) but nothing sets `data-theme`.
12. **Vestigial storage key.** `purposefields_goals` is written in `saveGoals()` but never read.
13. **Near-duplicate trios in Mix.** `makeTrios` balances by usage count but with few strengths repeats are common; de-duplicate on two shared slots.
14. **Rate limiter is in-memory**, so it covers a single instance only (documented in README; fine until there is more than one instance).
