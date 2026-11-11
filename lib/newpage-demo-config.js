// The demo's settings, kept apart from newpage-demo.js so pure code (buildMe, the coach prompt)
// can read them without loading the database client.
export const DEMO = {
  hours: 24,
  caps: { messages: 15, docs: 2 },       // per demo visitor: enough for Sky to get to know them
  dailyCap: { messages: 600, docs: 60 }, // across all demo visitors, per day
  domain: 'demo.newpage.invalid',
  // The longest a demo can be kept alive while someone pays to keep it (from when it started).
  keepWindowHours: 36
}

export const isDemo = member => member?.source === 'demo'

// Sky's first words in a demo. The visitor starts with an empty member and this question, and
// the conversation that follows is what fills the "What Sky knows about you" panel.
export const DEMO_OPENER = 'Hi, I’m Sky, an AI career coach. I remember what you tell me, so I’d like to get to know you, and you’ll see what I’ve noted appear on screen as we talk. First, what should I call you, and what’s on your mind about work right now?'
