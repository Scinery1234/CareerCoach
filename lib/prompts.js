// Prompts and output schemas for every Claude call the app makes.
// Prompt text lives on the server so the browser can only ask for these
// specific jobs, never send an arbitrary prompt.

export const GUIDE = `You are the Compass, a warm career guide in an app by Purposefields. You help everyday people — not just office or tech workers — find a career direction that fits their whole life.

How you work:
- The person does the thinking. You listen, reflect their own words back, and ask one gentle question at a time. Never tell them what to choose.
- Use plain, everyday Australian English. Short sentences. No jargon, no business-speak, no corporate words like "stakeholder", "leverage", "value proposition" or "pipeline".
- Never give your opinion on whether an idea is realistic, achievable, well paid or in demand. Don't rank or judge their ideas. If they ask, say plainly that this app doesn't judge ideas, then help them explore what they think and feel instead.
- Their values, "I am" statements and North Star are theirs. Don't write them for the person. If they ask for help with wording, offer a few options built only from words they've already used, and let them choose or change them.
- Their life matters more than their job title. Work supports the life they want.
- Keep replies short: two to five sentences, then at most one question. Plain text with **bold** only. No lists unless they ask.
- The app has a panel for each step where they type their answers. You can't change the panel; if they share something in chat that belongs there, encourage them to add it to the panel.

Safety (always): if the person mentions suicide, self-harm, crisis or danger, step out of the career conversation, respond with warmth, and share Lifeline 13 11 14, Beyond Blue 1300 22 4636, or 000 in an emergency. Never help with self-harm. This tool doesn't replace professional mental health care.

The newest message from the person ends with a [Where they are] note from the app, showing the step they're on and their answers so far. Use it quietly; don't mention it.`;

const AI_RULES = `Write in plain, everyday Australian English, warm and practical. No jargon or business-speak. Do not comment on whether the direction is realistic, achievable, well paid or in demand. Build on the person's own words, strengths and values.`;

const str = v => (typeof v === "string" ? v : v == null ? "" : String(v));
const list = v => (Array.isArray(v) ? v.filter(x => typeof x === "string").filter(Boolean) : []);
const join = (v, sep = "; ") => list(v).join(sep);

function topIam(p) {
  return list(p.iAm)[0] || "";
}

// What the work has to fit, in one line. Pay is left out unless asked for.
function needsText(n, { pay = true } = {}) {
  n = n || {};
  const parts = [];
  if (pay && str(n.pay)) parts.push(`lowest pay $${str(n.pay)} a year`);
  if (str(n.hours)) parts.push(`up to ${str(n.hours)} hours a week`);
  if (str(n.stress)) parts.push(`${str(n.stress).toLowerCase()} stress`);
  if (str(n.mode)) parts.push(str(n.mode).toLowerCase());
  if (str(n.location)) parts.push(str(n.location));
  let out = parts.join(", ");
  if (str(n.other)) out += `${out ? ". Also: " : ""}${str(n.other)}`;
  return out;
}

function profileText(p) {
  const g = p.strengths || {};
  const line = (label, v) => (v ? `${label}: ${v}` : "");
  const lines = [
    line("Values in order", join(p.values, ", ")),
    line('"I am" statements in order', join(p.iAm)),
    line("North Star (their words)", str(p.north)),
    line("What they need from work", needsText(p.needs)),
    line("Things they know", join(g.know)),
    line("Things they can do", join(g.do)),
    line("Things they love", join(g.love)),
    line("Other things they bring", join(g.other)),
    line("Top pick direction", str(p.first)),
    line("Second choice", str(p.second)),
  ];
  return lines.filter(Boolean).join("\n");
}

// Caps on what the browser may send, so a junk or oversized profile never
// reaches Claude. Lists keep only strings; everything else is dropped.
const MAX_ITEM = 300, MAX_TEXT = 2000, MAX_LIST = 30;
const cap = (v, n) => str(v).slice(0, n).trim();
const capList = v => list(v).slice(0, MAX_LIST).map(x => x.slice(0, MAX_ITEM).trim()).filter(Boolean);
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const seenIn = (title, lists) => lists.some(l => l.some(x => same(x, title)));

export function cleanProfile(p) {
  const g = p.strengths && typeof p.strengths === "object" ? p.strengths : {};
  const n = p.needs && typeof p.needs === "object" ? p.needs : {};
  return {
    values: capList(p.values),
    iAm: capList(p.iAm),
    north: cap(p.north, MAX_TEXT),
    needs: { pay: cap(n.pay, 20), hours: cap(n.hours, 10), stress: cap(n.stress, 40), mode: cap(n.mode, 60), location: cap(n.location, MAX_ITEM), other: cap(n.other, MAX_TEXT) },
    strengths: { know: capList(g.know), do: capList(g.do), love: capList(g.love), other: capList(g.other) },
    first: cap(p.first, MAX_ITEM),
    second: cap(p.second, MAX_ITEM),
    ideas: capList(p.ideas),
    planNow: cap(p.planNow, MAX_TEXT),
  };
}

const obj = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const S = { type: "string" };

// Each task: whether it uses the quick model, how to clean and check the request
// data (returns null when there isn't enough to work with), how to build the
// prompt, the JSON schema Claude must answer in, how to read the answer back,
// and (optional) when an answer counts as empty so the server retries once.
export const TASKS = {
  // One idea for a single know + do + love mix.
  mixIdea: {
    quick: true,
    clean: d => {
      const c = { know: cap(d.know, MAX_ITEM), do: cap(d.do, MAX_ITEM), love: cap(d.love, MAX_ITEM), avoid: capList(d.avoid) };
      return c.know && c.do && c.love ? c : null;
    },
    prompt: d =>
      `Suggest one job or kind of work that brings together these three things from a person's own list: something they know ("${str(d.know)}"), something they can do ("${str(d.do)}") and something they love ("${str(d.love)}"). It can be from any field. Plain everyday words. Don't repeat these ideas: ${join(d.avoid) || "none"}. Don't comment on how realistic or well paid it is.`,
    schema: obj({ idea: S }),
    read: (r, d) => {
      const idea = str(r.idea).trim();
      return { idea: seenIn(idea, [d.avoid]) ? "" : idea };
    },
    empty: r => !r.idea,
  },

  // Five ideas that mix the person's strengths.
  ideas: {
    quick: false,
    clean: p => {
      const c = cleanProfile(p);
      const g = c.strengths;
      return g.know.length && g.do.length && g.love.length ? c : null;
    },
    prompt: p => {
      const g = p.strengths || {};
      const fit = needsText(p.needs, { pay: false });
      return `A person is exploring career ideas. Using ONLY their own words below, suggest 5 job or career ideas they haven't listed. Each idea combines one thing they know, one thing they can do and one thing they love (copy those words exactly). Ideas can be from any field: trades, care, community, creative, outdoors, health, education, business, government, self-employment and more. Plain everyday words. Do not comment on how realistic, well paid, in demand or achievable any idea is.

Things they know: ${join(g.know)}
Things they can do: ${join(g.do)}
Things they love: ${join(g.love)}
Their values in order: ${join(p.values, ", ")}
Their #1 "I am": ${topIam(p)}
Their North Star: ${str(p.north)}
Ideas they already have (don't repeat these): ${join(p.ideas) || "none"}
${fit ? `Things the work has to fit: ${fit}\nOnly suggest ideas that could fit those. Don't mention pay or how in demand anything is.\n` : ""}
For each idea give a short job or work name, the know / do / love words it combines, and "why": one short plain sentence linking it to their values or North Star.`;
    },
    schema: obj({
      ideas: { type: "array", items: obj({ title: S, know: S, do: S, love: S, why: S }) },
    }),
    read: (r, p) => {
      const out = [];
      for (const x of Array.isArray(r.ideas) ? r.ideas : []) {
        if (!x || typeof x.title !== "string" || !x.title.trim()) continue;
        const title = x.title.trim();
        // Skip anything the person already has, and repeats within the answer.
        if (seenIn(title, [p.ideas, out.map(o => o.title)])) continue;
        out.push({ title, know: str(x.know), do: str(x.do), love: str(x.love), why: str(x.why) });
        if (out.length === 5) break;
      }
      return { ideas: out };
    },
    empty: r => !r.ideas.length,
  },

  // A four-stage path toward the top pick.
  plan: {
    quick: false,
    clean: p => {
      const c = cleanProfile(p);
      return c.first ? c : null;
    },
    prompt: p =>
      `Sketch a possible path for this person toward their top pick. ${AI_RULES} Two or three short sentences per stage, written to them as "you".

${profileText(p)}

Stages: now = next 3 months, building = 3 to 9 months, move = 9 to 18 months, longer = 18 months and beyond.`,
    schema: obj({ now: S, building: S, move: S, longer: S }),
    read: r => ({ now: str(r.now).trim(), building: str(r.building).trim(), move: str(r.move).trim(), longer: str(r.longer).trim() }),
  },

  // Three small first steps for the next two weeks.
  steps: {
    quick: false,
    clean: p => {
      const c = cleanProfile(p);
      return c.first && c.planNow ? c : null;
    },
    prompt: p =>
      `Suggest three small first steps this person could take in the next two weeks toward their top pick, based on the "Now" part of their plan. ${AI_RULES} Each step takes under two hours, is specific, starts with a doing word (call, write, visit, sign up…), and is one short sentence.

${profileText(p)}
Their plan for now: ${str(p.planNow)}`,
    // Three named fields rather than an array, so the schema itself guarantees three.
    schema: obj({ step1: S, step2: S, step3: S }),
    read: r => ({ steps: [r.step1, r.step2, r.step3].map(s => str(s).trim()).filter(Boolean) }),
    empty: r => r.steps.length < 3,
  },
};
