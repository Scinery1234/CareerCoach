// The Sort step's board, kept free of the DOM so it can be tested on its own.
// The board is a list in order of pull (first = most alive). Each item is a
// group (a label and several ideas) or a single idea (one idea, no label),
// with a time: short, medium or long term.

export const WHEN = [['short', 'Short term', 'within a year'], ['medium', 'Medium term', '1 to 3 years'], ['long', 'Long term', '3+ years']]
export const whenLabel = w => (WHEN.find(x => x[0] === w) || [])[1] || ''

export const isGroup = b => b.ideas.length > 1 || !!b.label

// Match the board to the idea list: drop ideas that were removed, add new ones
// as single items at the bottom, and clear out empty items. Changes in place.
export function syncBoard(C) {
  if (!Array.isArray(C.board)) C.board = []
  const have = new Set(C.ideas)
  const placed = new Set()
  for (const b of C.board) {
    b.ideas = b.ideas.filter(v => have.has(v) && !placed.has(v) && placed.add(v))
    if (b.star && !b.ideas.includes(b.star)) b.star = ''
  }
  // In place, so buttons already on screen keep pointing at the same list.
  for (let i = C.board.length - 1; i >= 0; i--) if (!C.board[i].ideas.length) C.board.splice(i, 1)
  for (const v of C.ideas) if (!placed.has(v)) C.board.push({ label: '', ideas: [v], when: '', star: '' })
  return C.board
}

// Put item `from` on top of item `to`. The target keeps its place in the order;
// it keeps its own label and time, or takes the moved item's if it had none.
export function stack(board, from, to) {
  if (from === to || !board[from] || !board[to]) return board
  const a = board[from], b = board[to]
  b.ideas.push(...a.ideas.filter(v => !b.ideas.includes(v)))
  if (!b.label) b.label = a.label
  if (!b.when) b.when = a.when
  board.splice(from, 1)
  return board
}

// Take one idea out of a group. It goes back as a single idea just below the group.
// A group left with one idea and no label becomes a single idea again.
export function takeOut(board, i, idea) {
  const g = board[i]
  if (!g || g.ideas.length < 2) return board
  g.ideas = g.ideas.filter(v => v !== idea)
  if (g.star === idea) g.star = ''
  board.splice(i + 1, 0, { label: '', ideas: [idea], when: g.when, star: '' })
  return board
}

// Undo a group: every idea goes back as a single idea, in place.
export function unstack(board, i) {
  const g = board[i]
  if (!g) return board
  board.splice(i, 1, ...g.ideas.map(v => ({ label: '', ideas: [v], when: g.when, star: '' })))
  return board
}

export const itemName = b => (isGroup(b) ? b.label || 'Unnamed group' : b.ideas[0])

// What a chosen item is saved as, so the Plan, coach and server keep reading one line of text.
export function pickText(b) {
  if (!isGroup(b)) return b.ideas[0]
  const name = b.label || b.ideas.join(' / ')
  return (b.star ? `${name} (starting with: ${b.star})` : name).slice(0, 200)
}

// What's left to do before leaving the Sort step. Three ideas or fewer can skip it.
export function sortMissing(C) {
  if (C.ideas.length <= 3) return []
  const m = []
  const unnamed = C.board.filter(b => b.ideas.length > 1 && !b.label).length
  if (unnamed) m.push(`a label for ${unnamed} group${unnamed === 1 ? '' : 's'}`)
  const untimed = C.board.filter(b => !b.when).length
  if (untimed) m.push(`a time for ${untimed} item${untimed === 1 ? '' : 's'}`)
  return m
}
