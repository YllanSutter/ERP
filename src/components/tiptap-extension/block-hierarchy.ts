import { Fragment, type Node as PMNode, type NodeType } from '@tiptap/pm/model'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'

export type BlockRange = { from: number; to: number; node: PMNode }
const items = ['taskItem', 'listItem']
const lists = ['taskList', 'bulletList', 'orderedList']

// Wrapping a boundary paragraph in a list must not make it part of a folded section.
export function startsOutlineBoundary(node: PMNode): boolean {
  if (node.attrs.outlineBoundary) return true
  return Boolean(node.firstChild?.isBlock && startsOutlineBoundary(node.firstChild))
}

// Tiptap joins adjacent lists on conversion. Split them back at explicit section boundaries.
export function splitOutlineBoundaryLists(state: EditorState): Transaction | null {
  const splits: { pos: number; type: NodeType; attrs: PMNode['attrs'] }[] = []
  state.doc.forEach((node, pos) => {
    if (!lists.includes(node.type.name)) return
    node.forEach((child, offset, index) => {
      if (index > 0 && startsOutlineBoundary(child)) {
        const attrs = node.type.name === 'orderedList'
          ? { ...node.attrs, start: (node.attrs.start ?? 1) + index } : node.attrs
        splits.push({ pos: pos + offset + 1, type: node.type, attrs })
      }
    })
  })
  if (!splits.length) return null
  const tr = state.tr
  for (const split of splits.reverse()) tr.split(split.pos, 1, [{ type: split.type, attrs: split.attrs }])
  return tr
}

// Headings own the following siblings up to the next heading of equal/higher level.
export function blockRange(doc: PMNode, pos: number): BlockRange | null {
  const $pos = doc.resolve(Math.min(pos, doc.content.size))
  // An exact item boundary identifies that item, even inside another task.
  const nextItem = $pos.nodeAfter
  if (nextItem && items.includes(nextItem.type.name)) {
    return { from: pos, to: pos + nextItem.nodeSize, node: nextItem }
  }
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (items.includes(node.type.name)) return { from: $pos.before(depth), to: $pos.after(depth), node }
  }
  const node = $pos.nodeAfter
  if (!node) return null
  let to = pos + node.nodeSize
  if (node.type.name === 'heading') {
    const parent = $pos.parent
    for (let index = $pos.index() + 1; index < parent.childCount; index++) {
      const next = parent.child(index)
      if (startsOutlineBoundary(next) || (next.type.name === 'heading' && next.attrs.level <= node.attrs.level)) break
      to += next.nodeSize
    }
  }
  return { from: pos, to, node }
}

export function selectedBlock(state: EditorState): BlockRange | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if (items.includes($from.node(depth).type.name)) return blockRange(state.doc, $from.start(depth))
  }
  return blockRange(state.doc, $from.depth ? $from.before(1) : $from.pos)
}

export function moveBlock(state: EditorState, source: BlockRange, target: number, wrapIn?: NodeType): Transaction | null {
  if (target >= source.from && target <= source.to) return null
  const movedContent = state.doc.slice(source.from, source.to).content
  const content = wrapIn ? Fragment.from(wrapIn.create(null, movedContent)) : movedContent
  const $source = state.doc.resolve(source.from)
  const removeList = items.includes(source.node.type.name) && $source.parent.childCount === 1
  const from = removeList ? $source.before() : source.from
  const to = removeList ? $source.after() : source.to
  if (target >= from && target <= to) return null
  const tr = state.tr.delete(from, to)
  const destination = tr.mapping.map(target)
  const $dest = tr.doc.resolve(destination)
  if (!$dest.parent.canReplace($dest.index(), $dest.index(), content)) return null
  tr.insert(destination, content)
  tr.setSelection(TextSelection.near(tr.doc.resolve(destination + 1)))
  // Reveal a folded destination, while keeping the moved subtree's own state.
  const $selection = tr.selection.$from
  for (let depth = 1; depth <= $selection.depth; depth++) {
    const node = $selection.node(depth)
    if (node.attrs.collapsed && $selection.before(depth) !== destination + (wrapIn ? 1 : 0)) {
      tr.setNodeMarkup($selection.before(depth), undefined, { ...node.attrs, collapsed: false })
    }
  }
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading' || !node.attrs.collapsed) return
    const range = blockRange(tr.doc, pos)!
    if (destination >= pos + node.nodeSize && destination < range.to) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, collapsed: false })
    }
  })
  return tr.scrollIntoView()
}

export function enterAfterCollapsed(state: EditorState): Transaction | null {
  if (!state.selection.empty) return null
  const block = selectedBlock(state)
  if (!block?.node.attrs.collapsed) return null
  const type = block.node.type.name
  if (type !== 'heading' && type !== 'taskItem') return null
  const paragraph = state.schema.nodes.paragraph.create(type === 'heading' ? { outlineBoundary: true } : null)
  const next = type === 'taskItem'
    ? state.schema.nodes.taskItem.create({ checked: false, collapsed: false }, paragraph)
    : paragraph
  const tr = state.tr.insert(block.to, next)
  tr.setSelection(TextSelection.create(tr.doc, block.to + (type === 'taskItem' ? 2 : 1)))
  return tr.scrollIntoView()
}

export function asTaskList(node: PMNode, schema = node.type.schema): PMNode {
  if (['bulletList', 'orderedList', 'taskList'].includes(node.type.name)) {
    const children: PMNode[] = []
    node.forEach(child => children.push(asTaskList(child, schema)))
    return schema.nodes.taskList.create(null, children)
  }
  if (items.includes(node.type.name)) {
    const children: PMNode[] = []
    node.forEach(child => children.push(asTaskList(child, schema)))
    return schema.nodes.taskItem.create({ checked: node.attrs.checked ?? false }, children)
  }
  return node
}

export function plainTaskList(text: string, schema: PMNode['type']['schema']): PMNode | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim())
  if (lines.length < 2) return null
  type Entry = { indent: number; text: string; checked: boolean; children: Entry[] }
  const roots: Entry[] = []
  const stack: Entry[] = []
  for (const line of lines) {
    const match = line.match(/^(\s*)(?:(?:[-*+•]|\d+[.)])\s+)?(?:\[([ xX])\]\s+)?(.*)$/)!
    const entry: Entry = { indent: match[1].replace(/\t/g, '    ').length, text: match[3], checked: /x/i.test(match[2] || ''), children: [] }
    while (stack.length && stack[stack.length - 1].indent >= entry.indent) stack.pop()
    ;(stack.length ? stack[stack.length - 1].children : roots).push(entry)
    stack.push(entry)
  }
  const build = (entries: Entry[]): PMNode => schema.nodes.taskList.create(null, entries.map(entry => {
    const content = [schema.nodes.paragraph.create(null, entry.text ? schema.text(entry.text) : undefined)]
    if (entry.children.length) content.push(build(entry.children))
    return schema.nodes.taskItem.create({ checked: entry.checked }, content)
  }))
  return build(roots)
}

export function taskPasteSliceContent(nodes: readonly PMNode[], schema: PMNode['type']['schema']): Fragment | null {
  const tasks: PMNode[] = []
  for (const node of nodes) {
    if (['bulletList', 'orderedList', 'taskList'].includes(node.type.name)) {
      asTaskList(node, schema).forEach(child => tasks.push(child))
    } else if (node.type.name === 'paragraph') {
      let inline: PMNode[] = []
      const flush = () => {
        tasks.push(schema.nodes.taskItem.create({ checked: false }, schema.nodes.paragraph.create(node.attrs, inline)))
        inline = []
      }
      node.forEach(child => {
        if (child.type.name === 'hardBreak') flush()
        else inline.push(child)
      })
      flush()
    } else return null
  }
  return tasks.length ? Fragment.from(schema.nodes.taskList.create(null, tasks)) : null
}
