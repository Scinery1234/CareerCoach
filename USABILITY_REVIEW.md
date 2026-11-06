# The Compass: usability review

Date: 6 November 2026
Scope: `public/index.html`, `public/app.js`, `public/styles.css`, `server.js`, `lib/`
Method: read every file, ran the server and test suite (7 of 7 pass), and walked the app in headless Chromium at 1280×800, 1024×600 and 390×844, in light and dark mode.

## Summary

The app is well built: plain and fast, good copy, prompts kept server-side, a sensible "Still needed" pattern instead of greyed-out buttons, and a working fallback when no API key is set. The issues below are ranked by how much they would hurt a real user. No code was changed as part of this review.

## 1. Bugs confirmed in the browser

| # | Bug | Where | Suggested fix |
|---|-----|-------|---------------|
| 1 | **Calendar step can't be edited after "Lock it in".** Once done, clicking Calendar in the strip always shows the summary, and re-saving First steps also lands on the summary. The bar says "Edit any step from the strip at the top", but the day and time pickers are gone for good. | `app.js` `renderWork()` line 161 | Show the summary on a separate "Done" state, or add an "Edit times" button on the summary that clears the done flag for that step. |
| 2 | **Chat accepts messages when AI is off.** The Send button is disabled, but pressing Enter still posts the message into the log with no reply. | `app.js` `go()` line 449 | Have the Enter handler check the same condition as the button (`aiOn`). |
| 3 | **"I am" statements get mangled.** The input forces an article: "curious" becomes "I am a curious", "honest person" becomes "I am a honest person", "uni student" becomes "I am an uni student", "someone who cares" becomes "I am a someone who cares". | `app.js` `iam()` line 83 | Drop the automatic article. Make the fixed prefix just "I am" and let people type "a mum" or "curious" as they like. |
| 4 | **Re-saving an earlier step throws you forward one step, not back to where you were.** Editing Values from the summary and pressing Save lands on "Who I am". | `app.js` `finish()` line 125 | When the step was already reached, return to the furthest reached step after saving. |
| 5 | **Dialogs don't close on Escape and don't trap focus.** Both the crisis and consent dialogs have `role="dialog"` but not the keyboard behaviour. | `index.html`, `app.js` lines 437–444 | Handle Escape on the crisis dialog and trap Tab inside both. |
| 6 | **Crisis keyword matching has false positives.** "I can't go on working nights" and "cutting myself off from the team" both open the crisis dialog. Low harm, but it interrupts the flow. | `app.js` `CRISIS_KEYWORDS` line 28 | Match on word boundaries and tighten the ambiguous phrases, or use a softer inline support line (not a modal) for the ambiguous ones. |

## 2. Usability issues

### On phones the AI never speaks to you
Each step pushes an intro message into the chat, but on a phone the chat is behind the "Talk it through" tab with no unread indicator. The step copy says "tell me about them here" while pointing at a hidden panel.

Suggest: a small dot or count on the tab when a new message arrives, and the first time a step opens on a phone, a one-line "Stuck? Talk it through" link in the work panel.

### Cold start
The first thing a new person sees is a four-checkbox consent dialog with no idea what the tool is, how long it takes, or that they can stop and come back.

Suggest a single welcome line above the checkboxes: "Ten short steps, about 45 minutes. Your answers stay on this device, so you can close this and come back." Consider collapsing the four ticks into one: "I've read these and I'm 18 or older".

### No feedback that work is saved
People may be afraid to close the tab. A quiet "Saved on this device" in the action bar after each change would settle that.

### The safety line is almost invisible
"Not therapy · In crisis call Lifeline 13 11 14" is set at 10.5px in the faint colour (`#8aa3ad` on white, roughly 2.6:1 contrast), which fails WCAG AA. The same colour and size are used for the "Step 1 of 10" kicker, the "Suggested" source labels and the empty-state hints.

Suggest: raise the mono labels to 12px minimum and use `--muted`, not `--faint`.

### The phone header eats a fifth of the screen
Brand, two buttons, the step strip and the two tabs total 167px of an 844px viewport before any content appears.

Suggest: move "Start over" into an overflow menu or the summary, and combine the strip and tabs into one row on phones.

### "Help now" is ambiguous
Someone looking for help using the app will click it and get a crisis dialog. "Support" or "Crisis support" in the header would be clearer. The red outlined button next to "Start over" also visually pairs two unrelated destructive-looking actions.

### Mobile viewport height
The layout uses `height:100%` with `overflow:hidden` on the body. On iOS Safari the bottom action bar and the chat composer sit behind the browser chrome until the toolbar collapses.

Suggest: `height:100dvh` with a `100vh` fallback.

### The Mix step is long on a phone
Ten cards plus three more sections come to about 2,600px of scrolling.

Suggest: show five mixes with a "Show 5 more" button, and move "Ideas you already had" above the mixes so people bank their existing ideas first.

### Remix silently discards typed text
If someone has typed an idea into a mix input but not pressed Add, "Remix: 10 new mixes" wipes it. Either add the two-tap confirm already used elsewhere, or auto-add non-empty inputs first.

### Claude's extra ideas can only be kept, never dismissed
Unwanted suggestions pile up across "Suggest a few more" presses. Add a dismiss control.

### The summary omits "What I need"
The copied text includes pay, hours and location, but the on-screen map doesn't show them. The only export is "Copy my map". Add a "Download as text" option and a print stylesheet so people can keep it without relying on the clipboard.

### Mismatched minimums
The "I am" empty state says "Aim for at least five" while the bar requires three. Pick one.

### The pay field has no "not sure" path
Lowest annual pay before tax is required, and many people think in hourly or weekly terms. Allow a blank with a "Not sure yet" option, or offer per hour / per week with conversion.

### Chat error for a too-long conversation tells people to Start over
That also wipes their answers. Offer "Clear chat only" instead. The answers and the chat are stored together but could be cleared separately.

### AI error text replaces the button label
On the per-mix "Suggest an idea" button (`app.js` line 257), a failure turns the button text into the full error sentence and leaves it clickable. Show the error in a hint next to the button and restore the label.

## 3. Smaller polish items

- The chat log has `aria-live="polite"` on the whole region, so screen readers re-announce the streaming reply on every chunk. Announce only the finished message, and add `aria-live` to the "Still needed" bar hint so that warning is heard.
- The `.ics` files use `TZID` without a `VTIMEZONE` block, which Outlook desktop sometimes rejects. Floating local times or a `VTIMEZONE` block would be safer.
- The consent reappears every 90 days with no explanation. Say "It's been a while, here's a reminder".
- The `purposefields_goals` key is written on finish but never read, and "Start over" doesn't clear it.
- Chat placeholder "Type here…" could invite more: "What's on your mind about this step?"
- No UI tests exist. A Playwright smoke test that seeds `localStorage` state and walks all ten steps would have caught the Calendar bug.

## 4. Suggested order of work

1. Fix the six bugs in section 1 (Calendar edit, Enter with AI off, "I am" articles, save-return navigation, dialog keyboard handling, crisis matching). Each is a few lines.
2. Raise the small text sizes and the faint-colour contrast, and move to `100dvh`.
3. Add the phone chat indicator and the welcome line on the consent dialog.
4. Shorten the Mix step and add the Remix guard and suggestion dismiss.
5. Add "What I need" and a download option to the summary.
