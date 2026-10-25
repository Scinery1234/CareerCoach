// Prompts and output schemas for every Claude call the app makes.
// Prompt text lives on the server so the browser can only ask for these
// specific jobs, never send an arbitrary prompt.

export const GUIDE = `You are Wayfinder, a warm career guide inside the Purposefields Wayfinder app. You help everyday people — not just office or tech workers — find a career direction that fits their whole life.

How you work:
- The person does the thinking. You listen, reflect their own words back, and ask one gentle question at a time. Never tell them what to choose.
- Use plain, everyday Australian English. Short sentences. No jargon, no business-speak, no corporate words like "stakeholder", "leverage", "value proposition" or "pipeline".
- Never give your opinion on whether an idea is realistic, achievable, well paid or in demand. Don't rank or judge their ideas. If they ask, help them explore what they think and feel instead.
- Their values, "I am" statements and North Star are theirs. Don't write them for the person. If they ask for help with wording, offer a few options built only from words they've already used, and let them choose or change them.
- Their life matters more than their job title. Work supports the life they want.
- Keep replies short: two to five sentences, then at most one question. Plain text with **bold** only. No lists unless they ask.
- The app has a panel for each step where they type their answers. You can't change the panel; if they share something in chat that belongs there, encourage them to add it to the panel.

Safety (always): if the person mentions suicide, self-harm, crisis or danger, step out of the career conversation, respond with warmth, and share Lifeline 13 11 14, Beyond Blue 1300 22 4636, or 000 in an emergency. Never help with self-harm. This tool doesn't replace professional mental health care.

Every message from the person ends with a [Where they are] note from the app, showing the step they're on and their answers so far. Use it quietly; don't mention it.`;

const AI_RULES = `Write in plain, everyday Australian English, warm and practical. No jargon or business-speak. Do not comment on whether the direction is realistic, achievable, well paid or in demand. Build on the person's own words, strengths and values.`;

const str = v => (typeof v === "string" ? v : v == null ? "" : String(v));
const list = v => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const join = (v, sep = "; ") => list(v).join(sep);

function topIam(p) {
  return list(p.iAm)[0] || "";
}

function profileText(p) {
  const g = p.strengths || {};
  const n = p.needs || {};
  const lines = [
    `Values in order: ${join(p.values, ", ")}`,
    `"I am" statements in order: ${join(p.iAm)}`,
    `North Star (their words): ${str(p.north)}`,
    `What they need from work: lowest pay $${str(n.pay)} a year, up to ${str(n.hours)} hours a week, stress: ${str(n.stress)}, where: ${str(n.mode)}${n.location ? `, ${str(n.location)}` : ""}${n.other ? `. Also: ${str(n.other)}` : ""}`,
    `Things they know: ${join(g.know)}`,
    `Things they can do: ${join(g.do)}`,
    `Things they love: ${join(g.love)}`,
  ];
  if (list(g.other).length) lines.push(`Other things they bring: ${join(g.other)}`);
  lines.push(`Top pick direction: ${str(p.first)}`);
  if (p.second) lines.push(`Second choice: ${str(p.second)}`);
  return lines.join("\n");
}

const obj = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const S = { type: "string" };

// Each task: whether it uses the quick model, how to build the prompt from the
// request data, the JSON schema Claude must answer in, and how to read it back.
export const TASKS = {
  // One idea for a single know + do + love mix.
  mixIdea: {
    quick: true,
    prompt: d =>
      `Suggest one job or kind of work that brings together these three things from a person's own list: something they know ("${str(d.know)}"), something they can do ("${str(d.do)}") and something they love ("${str(d.love)}"). It can be from any field. Plain everyday words. Don't repeat these ideas: ${join(d.avoid) || "none"}. Don't comment on how realistic or well paid it is.`,
    schema: obj({ idea: S }),
    read: r => ({ idea: str(r.idea).trim() }),
  },

  // Five ideas that mix the person's strengths.
  ideas: {
    quick: false,
    prompt: p => {
      const g = p.strengths || {};
      return `A person is exploring career ideas. Using ONLY their own words below, suggest 5 job or career ideas they haven't listed. Each idea combines one thing they know, one thing they can do and one thing they love (copy those words exactly). Ideas can be from any field: trades, care, community, creative, outdoors, health, education, business, government, self-employment and more. Plain everyday words. Do not comment on how realistic, well paid, in demand or achievable any idea is.

Things they know: ${join(g.know)}
Things they can do: ${join(g.do)}
Things they love: ${join(g.love)}
Their values in order: ${join(p.values, ", ")}
Their #1 "I am": ${topIam(p)}
Their North Star: ${str(p.north)}
Ideas they already have (don't repeat these): ${join(p.ideas) || "none"}

For each idea give a short job or work name, the know / do / love words it combines, and "why": one short plain sentence linking it to their values or North Star.`;
    },
    schema: obj({
      ideas: { type: "array", items: obj({ title: S, know: S, do: S, love: S, why: S }) },
    }),
    read: r => ({
      ideas: (Array.isArray(r.ideas) ? r.ideas : [])
        .filter(x => x && typeof x.title === "string" && x.title.trim())
        .slice(0, 6)
        .map(x => ({ title: x.title.trim(), know: str(x.know), do: str(x.do), love: str(x.love), why: str(x.why) })),
    }),
  },

  // A four-stage path toward the top pick.
  plan: {
    quick: false,
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
    prompt: p =>
      `Suggest three small first steps this person could take in the next two weeks toward their top pick, based on the "Now" part of their plan. ${AI_RULES} Each step takes under two hours, is specific, starts with a doing word (call, write, visit, sign up…), and is one short sentence.

${profileText(p)}
Their plan for now: ${str(p.planNow)}`,
    schema: obj({ steps: { type: "array", items: S } }),
    read: r => ({ steps: list(r.steps).map(s => s.trim()).filter(Boolean).slice(0, 3) }),
  },
};
