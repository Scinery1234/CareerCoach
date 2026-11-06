# AI Career Coach Apply (browser helper)

A Manifest V3 extension for Chrome and Edge. On a Seek or Indeed job page it shows how well the job fits the member, lets them put their tailored resume and cover letter into the application form, fills contact details and the employer's questions from the standard answers they wrote in the app (drafting the rest from their resume, marked for reading), and logs the application when it has been sent.

**What it never does.** It never clicks Submit, Apply, Continue or Next. It never opens a job page on its own, never paginates search results, never fetches a job board from the server. The member presses every button that moves an application forward. `extension/tests/forms.test.js` fails if any content script gains a `.click(` or `.submit(`.

## Files

| Path | What it does |
|---|---|
| `manifest.json` | Hosts: Seek, Indeed, Jora and `aicareercoach.net` only. Pairing messages are accepted from `aicareercoach.net` only. |
| `background.js` | Holds the pairing (a rotating token, hashed on the server), gets 15-minute access tokens, talks to `/api/newpage/extension`, builds Word files through the app's own builders, relays between tabs and the side panel. |
| `content/forms.js` | Shared form logic: find fields, read their labels, fill them the way typing would, attach a file through a `DataTransfer`. Exposed as `NPForms`. |
| `content/seek.js` | Reads the job page; follows Quick Apply step by step by what the page says; fills and attaches on request; logs on the confirmation page. |
| `content/indeed.js` | Reads the job page; fills visible fields only; degrades to copy-buttons when it can see fewer than half the fields it expects. Indeed's terms allow only Indeed's own tooling to apply, so it never advances a step. |
| `content/capture.js` | With the member's setting on: reads the listing cards on a search results page they are already looking at and hands them to the app to score. Off by default. |
| `sidepanel.html`, `sidepanel.js` | The panel: fit, documents, answers, status, "I applied another way, log it". |
| `tests/` | Fixture pages and the tests that run against them under `npm test`. |

## Pairing

1. In the app: Tools, Applications, "Connect this browser". The app asks the server for a pairing token (`extension_pair`), then posts it to the extension (`externally_connectable`).
2. The extension exchanges it for an access token (`ext_refresh`); the pairing token is rotated every time and the old one revoked.
3. "Disconnect" in the app, or in the panel, revokes it. Delete-my-data removes all of them.

Until the extension is on the Web Store, `window.NP_EXTENSION_ID` and `window.NP_EXTENSION_STORE` in `app/index.html` are empty and the Applications tool says so.

## Loading it unpacked

Chrome: `chrome://extensions`, Developer mode, Load unpacked, choose this folder. Then set `window.NP_EXTENSION_ID` to the id Chrome shows. The hosts in `manifest.json` and `API` in `background.js` point at production; for a dev deployment change both.

## Fixtures

`tests/fixtures/*.html` are hand-written from the public shape of each form, not recordings. When Seek or Indeed change their markup, save a real page (with personal details removed) over the fixture and fix the adapter until the tests pass again.
