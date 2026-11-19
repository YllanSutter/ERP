import { describe, expect, it, vi } from 'vitest'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { sinkListItem, liftListItem } from '@tiptap/pm/schema-list'
import { history, undo, redo } from '@tiptap/pm/history'
import { Slice, Fragment } from '@tiptap/pm/model'
import { CollapsibleHeading } from '@/components/tiptap-node/heading-node/heading-node-extension'
import { blockRange, enterAfterCollapsed, moveBlock, plainTaskList } from './block-hierarchy'
import { OutlineEditing, outlineDecorations, taskPaste } from './outline-editing'

const schema = getSchema([OutlineEditing, StarterKit.configure({ heading: false }), CollapsibleHeading, TaskList,
  TaskItem.extend({ addAttributes() { return { ...this.parent?.(), collapsed: { default: false } } } }).configure({ nested: true })])
const p = (text = '') => schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)
const task = (text: string, children: any[] = [], collapsed = false) => schema.nodes.taskItem.create({ checked: false, collapsed }, [p(text), ...children])
const tasks = (...nodes: any[]) => schema.nodes.taskList.create(null, nodes)
const heading = (text: string, collapsed = false, level = 2) => schema.nodes.heading.create({ level, collapsed }, schema.text(text))
const doc = (...nodes: any[]) => schema.nodes.doc.create(null, nodes)
const stateAt = (document: any, text: string) => {
  let pos = 0
  document.descendants((node: any, offset: number) => { if (node.isText && node.text === text) pos = offset + node.nodeSize })
  return EditorState.create({ schema, doc: document, selection: TextSelection.create(document, pos) })
}

describe('rich text hierarchy', () => {
  it('keeps blank paragraphs, nested headings and all blocks in their heading section', () => {
    const title = heading('Thème', true)
    const document = doc(title, p(), tasks(task('Logos / Photos')), heading('Couleurs', false, 3), p('Texte'), heading('Module'), tasks(task('News')))
    const range = blockRange(document, 0)!
    expect(document.slice(range.from, range.to).content.textBetween(0, range.to)).toContain('Logos / Photos')
    expect(range.to).toBe(title.nodeSize + p().nodeSize + tasks(task('Logos / Photos')).nodeSize + heading('Couleurs', false, 3).nodeSize + p('Texte').nodeSize)
    const hidden = outlineDecorations(document, false).find().filter(decoration => decoration.spec.outlineHidden)
    expect(hidden).toHaveLength(4)
  })

  it('moves a heading and its entire section before another heading, undoable in one transaction', () => {
    const module = [heading('Module'), tasks(task('News'))]
    const tree = [heading('Arborescence', true), tasks(task('Automatismes', [tasks(task('Portes automatiques'), task('Barrières'))], true))]
    const document = doc(...module, ...tree)
    const source = blockRange(document, module.reduce((sum, node) => sum + node.nodeSize, 0))!
    let state = EditorState.create({ schema, doc: document, plugins: [history()] })
    const tr = moveBlock(state, source, 0)!
    expect(tr.doc.eq(doc(...tree, ...module))).toBe(true)
    tr.doc.check()
    state = state.apply(tr)
    undo(state, transaction => { state = state.apply(transaction) })
    expect(state.doc.eq(document)).toBe(true)
    redo(state, transaction => { state = state.apply(transaction) })
    expect(state.doc.eq(doc(...tree, ...module))).toBe(true)
  })

  it('moves Automatismes with its children before Portails', () => {
    const parent = task('Automatismes', [tasks(task('Portes automatiques'), task('Barrières'))], true)
    const document = doc(tasks(task('Accueil'), task('Portails'), parent))
    const state = stateAt(document, 'Automatismes')
    const from = 1 + task('Accueil').nodeSize + task('Portails').nodeSize
    const source = blockRange(document, from)!
    const tr = moveBlock(state, source, 1 + task('Accueil').nodeSize)!
    expect(tr.doc.eq(doc(tasks(task('Accueil'), parent, task('Portails'))))).toBe(true)
    expect(moveBlock(state, source, from + 3)).toBeNull()
  })

  it('reveals a folded destination without expanding the moved subtree', () => {
    const title = heading('Module', true)
    const existing = task('News')
    const moved = task('Automatismes', [tasks(task('Enfant'))], true)
    const document = doc(title, tasks(existing), heading('Arborescence'), tasks(moved))
    const state = stateAt(document, 'Automatismes')
    const source = blockRange(document, state.selection.from)!
    const tr = moveBlock(state, source, title.nodeSize + 1)!
    expect(tr.doc.child(0).attrs.collapsed).toBe(false)
    expect(tr.doc.child(1).child(0).attrs.collapsed).toBe(true)
    expect(tr.doc.child(1).child(0).textContent).toBe('AutomatismesEnfant')
  })

  it('moves the only nested child without leaving a phantom empty task', () => {
    const child = task('Enfant')
    const document = doc(tasks(task('Parent', [tasks(child)]), task('Destination')))
    const state = stateAt(document, 'Enfant')
    const source = blockRange(document, state.selection.from)!
    const tr = moveBlock(state, source, document.content.size - 1)!
    expect(tr.doc.eq(doc(tasks(task('Parent'), task('Destination'), child)))).toBe(true)
  })

  it('moves paragraphs and atomic blocks, rejecting incompatible list destinations', () => {
    const rule = schema.nodes.horizontalRule.create()
    const document = doc(p('Texte'), rule, tasks(task('Tâche')))
    const state = EditorState.create({ schema, doc: document })
    const range = blockRange(document, p('Texte').nodeSize)!
    expect(moveBlock(state, range, 0)!.doc.eq(doc(rule, p('Texte'), tasks(task('Tâche'))))).toBe(true)
    expect(moveBlock(state, range, p('Texte').nodeSize + rule.nodeSize + 1)).toBeNull()
    expect(outlineDecorations(document, false).find().some(decoration => decoration.spec.key?.startsWith('handle-'))).toBe(false)
  })

  it('inserts Enter after a closed heading and its descendants, leaving the heading intact', () => {
    const title = heading('Arborescence', true)
    const list = tasks(task('Accueil'), task('Automatismes', [tasks(task('Enfant'))]))
    const document = doc(title, list, heading('Module'))
    const tr = enterAfterCollapsed(stateAt(document, 'Arborescence'))!
    expect(tr.doc.eq(doc(title, list, schema.nodes.paragraph.create({ outlineBoundary: true }), heading('Module')))).toBe(true)
    expect(blockRange(tr.doc, 0)!.to).toBe(title.nodeSize + list.nodeSize)
    expect(outlineDecorations(tr.doc, false).find().filter(decoration => decoration.spec.outlineHidden)).toHaveLength(1)
    expect(tr.selection.from).toBe(title.nodeSize + list.nodeSize + 1)
  })

  it('inserts Enter after a folded task without giving its children to the new task', () => {
    const parent = task('Automatismes', [tasks(task('Enfant'))], true)
    const document = doc(tasks(parent, task('Contact')))
    const tr = enterAfterCollapsed(stateAt(document, 'Automatismes'))!
    expect(tr.doc.eq(doc(tasks(parent, task(''), task('Contact'))))).toBe(true)
  })
})

describe('paste into tasks', () => {
  const text = '- Accueil\n- Portes de garage\n- Portails\n- Automatismes\n  - Portes automatiques\n  - Barrieres levantes\n  - Rideaux métalliques\n- Nos réalisations\n- Avis clients\n- Contact'
  it('turns every pasted line into a task and preserves indentation', () => {
    const list = plainTaskList(text, schema)!
    expect(list.childCount).toBe(7)
    expect(list.child(3).child(1).childCount).toBe(3)
    expect(list.child(3).child(1).child(0).textContent).toBe('Portes automatiques')
    list.check()
  })
  it('pastes the full plain text tree into an empty task without an extra wrapper or empty task', () => {
    const state = stateAt(doc(tasks(task(''))), '')
    const positioned = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)))
    const slice = new Slice(Fragment.from(p(text)), 1, 1)
    const converted = taskPaste(positioned, slice, text, true)!
    const tr = positioned.tr.replaceSelection(converted)
    expect(tr.doc.eq(doc(plainTaskList(text, schema)!))).toBe(true)
  })
  it('converts HTML bullet lists recursively, preserving inline marks and surrounding task text', () => {
    const bold = schema.text('Accueil', [schema.marks.bold.create()])
    const bullet = schema.nodes.bulletList.create(null, [
      schema.nodes.listItem.create(null, [schema.nodes.paragraph.create(null, bold)]),
      schema.nodes.listItem.create(null, [p('Automatismes'), schema.nodes.bulletList.create(null, schema.nodes.listItem.create(null, p('Enfant')))])])
    const state = stateAt(doc(tasks(task('Avant'))), 'Avant')
    const converted = taskPaste(state, new Slice(Fragment.from(bullet), 1, 1), '', false)!
    const result = state.tr.replaceSelection(converted).doc
    expect(result.child(0).childCount).toBe(2)
    expect(result.child(0).child(0).textContent).toBe('AvantAccueil')
    expect(result.child(0).child(0).child(0).lastChild!.marks[0].type.name).toBe('bold')
    expect(result.child(0).child(1).child(1).type.name).toBe('taskList')
    result.check()
  })
  it('turns formatted lines separated by soft breaks into separate checkboxes', () => {
    const paragraph = schema.nodes.paragraph.create(null, [schema.text('Un', [schema.marks.bold.create()]), schema.nodes.hardBreak.create(), schema.text('Deux')])
    const state = stateAt(doc(tasks(task(''))), '')
    const positioned = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)))
    const converted = taskPaste(positioned, new Slice(Fragment.from(paragraph), 1, 1), 'Un\nDeux', false)!
    const result = positioned.tr.replaceSelection(converted).doc
    expect(result.child(0).childCount).toBe(2)
    expect(result.child(0).child(0).child(0).firstChild!.marks[0].type.name).toBe('bold')
    expect(result.child(0).child(1).textContent).toBe('Deux')
  })
  it('leaves ordinary single-line pastes and pastes outside tasks alone', () => {
    const slice = new Slice(Fragment.from(p('Texte')), 1, 1)
    expect(taskPaste(stateAt(doc(tasks(task('Avant'))), 'Avant'), slice, 'Texte', true)).toBeNull()
    expect(taskPaste(stateAt(doc(p('Avant')), 'Avant'), slice, text, true)).toBeNull()
  })
})


describe('list keyboard behavior', () => {
  const shortcutsFor = (initial: EditorState) => {
    let state = initial
    const dispatch = (tr: any) => { state = state.apply(tr) }
    const editor = {
      get state() { return state },
      view: { dispatch },
      commands: {
        sinkListItem: vi.fn((type: string) => sinkListItem(schema.nodes[type])(state, dispatch)),
        liftListItem: vi.fn((type: string) => liftListItem(schema.nodes[type])(state, dispatch)),
      },
    }
    const shortcuts = (OutlineEditing.config.addKeyboardShortcuts as any).call({ editor })
    return { editor, shortcuts }
  }
  it('consumes Tab on the first item so focus stays in the editor', () => {
    const initial = stateAt(doc(tasks(task('Première'))), 'Première')
    const { editor, shortcuts } = shortcutsFor(initial)
    expect(shortcuts.Tab()).toBe(true)
    expect(editor.commands.sinkListItem).toHaveBeenCalledWith('taskItem')
    expect(editor.state.doc.eq(initial.doc)).toBe(true)
  })
  it('indents into a folded parent, reveals the result and outdents with Shift+Tab', () => {
    const initial = stateAt(doc(tasks(task('Parent', [tasks(task('Enfant'))], true), task('À indenter'))), 'À indenter')
    const { editor, shortcuts } = shortcutsFor(initial)
    expect(shortcuts.Tab()).toBe(true)
    const parent = editor.state.doc.child(0).child(0)
    expect(parent.attrs.collapsed).toBe(false)
    expect(parent.child(1).child(1).textContent).toBe('À indenter')
    expect(shortcuts['Shift-Tab']()).toBe(true)
    expect(editor.state.doc.child(0).child(1).textContent).toBe('À indenter')
  })
})
