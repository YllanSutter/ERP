import { Extension } from '@tiptap/core'
import { Fragment, Slice, type Node as PMNode, type NodeType } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { blockRange, enterAfterCollapsed, moveBlock, plainTaskList, selectedBlock, splitOutlineBoundaryLists, taskPasteSliceContent, type BlockRange } from './block-hierarchy'

const key = new PluginKey('outlineEditing')
const itemTypes = ['taskItem', 'listItem']
const listTypes = ['taskList', 'bulletList', 'orderedList']

function listItemType(state: EditorState): string | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if (itemTypes.includes($from.node(depth).type.name)) return $from.node(depth).type.name
  }
  return null
}

export function outlineDecorations(doc: PMNode, editable: boolean): DecorationSet {
  const decorations: Decoration[] = []
  const hidden: { from: number; to: number }[] = []
  doc.descendants((node, pos, parent) => {
    if (!node.isBlock || hidden.some(range => pos >= range.from && pos < range.to)) return false
    const range = blockRange(doc, pos)
    if (node.type.name === 'heading' && range) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-section-size': String(range.to - range.from) }))
      if (node.attrs.collapsed) {
        const from = pos + node.nodeSize
        hidden.push({ from, to: range.to })
        let offset = from
        while (offset < range.to) {
          const child = doc.nodeAt(offset)!
          decorations.push(Decoration.node(offset, offset + child.nodeSize, { class: 'rte-outline-hidden' }, { outlineHidden: true }))
          offset += child.nodeSize
        }
      }
    }
    const movable = !listTypes.includes(node.type.name) && (
      itemTypes.includes(node.type.name) || parent?.type.name === 'doc'
    )
    if (editable && movable && range) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, {
        class: 'rte-movable-block', 'data-rte-block': String(pos),
      }))
      // The handle lives in the first textblock, but selects/moves the entire subtree.
      let anchor = node.isLeaf ? pos : pos + 1
      if (!node.isTextblock) {
        let found = false
        node.descendants((child, offset) => {
          if (!found && child.isTextblock) { anchor = pos + offset + 2; found = true }
          return !found
        })
      }
      decorations.push(Decoration.widget(anchor, () => {
        const handle = document.createElement('button')
        handle.type = 'button'
        handle.className = 'rte-block-handle'
        handle.contentEditable = 'false'
        handle.draggable = true
        handle.dataset.rteHandle = String(pos)
        handle.setAttribute('aria-label', 'Déplacer le bloc et ses enfants')
        handle.title = 'Glisser pour déplacer · Alt + ↑ / ↓'
        handle.textContent = '⠿'
        if (node.isLeaf) {
          const wrapper = document.createElement('span')
          wrapper.className = 'rte-atom-handle'
          wrapper.contentEditable = 'false'
          wrapper.append(handle)
          return wrapper
        }
        return handle
      }, { side: -1, key: `handle-${node.type.name}-${pos}`, stopEvent: event => !event.type.startsWith('drag') && event.type !== 'drop' }))
    }
    return !(node.type.name === 'taskItem' && node.attrs.collapsed)
  })
  return DecorationSet.create(doc, decorations)
}

/** Convert rich clipboard lists to tasks only when pasting inside an existing task. */
export function taskPaste(state: EditorState, slice: Slice, text: string, preferPlain: boolean): Slice | null {
  if (listItemType(state) !== 'taskItem') return null
  const plain = preferPlain ? plainTaskList(text, state.schema) : null
  const nodes: PMNode[] = []
  slice.content.forEach(node => nodes.push(node))
  const content = plain ? Fragment.from(plain) : taskPasteSliceContent(nodes, state.schema)
  // A single inline paste must retain the normal text/mark behavior.
  if (!plain && nodes.length === 1 && nodes[0].type.name === 'paragraph' &&
      !Array.from({ length: nodes[0].childCount }, (_, index) => nodes[0].child(index)).some(node => node.type.name === 'hardBreak')) return null
  return content ? Slice.maxOpen(content) : null
}

export type BlockDropTarget = { pos: number; wrapIn?: NodeType }

export function headingDropTarget(state: EditorState, source: BlockRange, headingPos: number, after: boolean): BlockDropTarget | null {
  const target = blockRange(state.doc, headingPos)
  if (target?.node.type.name !== 'heading' || !itemTypes.includes(source.node.type.name)) return null
  let offset = headingPos + target.node.nodeSize
  while (offset < target.to) {
    const node = state.doc.nodeAt(offset)!
    if (node.type.name === (source.node.type.name === 'taskItem' ? 'taskList' : 'bulletList') ||
        (source.node.type.name === 'listItem' && node.type.name === 'orderedList')) {
      return { pos: after ? offset + node.nodeSize - 1 : offset + 1 }
    }
    offset += node.nodeSize
  }
  return { pos: headingPos + target.node.nodeSize, wrapIn: state.doc.resolve(source.from).parent.type }
}

function dropDestination(view: EditorView, event: DragEvent, source: BlockRange): BlockDropTarget | null {
  const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-rte-block]') : null
  if (!element || !view.dom.contains(element)) return null
  const pos = Number(element.dataset.rteBlock)
  const target = blockRange(view.state.doc, pos)
  if (!target) return null
  const firstLine = element.querySelector('p, .tt-heading-content') || element
  const rect = firstLine.getBoundingClientRect()
  const after = event.clientY >= rect.top + rect.height / 2
  // Drop an item on a heading to put it at the beginning/end of that section's list.
  if (itemTypes.includes(source.node.type.name) && target.node.type.name === 'heading') {
    return headingDropTarget(view.state, source, pos, after)
  }
  return { pos: after ? target.to : target.from }
}

export const OutlineEditing = Extension.create({
  name: 'outlineEditing',
  priority: 1100,

  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        outlineBoundary: {
          default: false,
          keepOnSplit: false,
          parseHTML: element => element.getAttribute('data-outline-boundary') === 'true',
          renderHTML: attributes => attributes.outlineBoundary ? { 'data-outline-boundary': 'true' } : {},
        },
      },
    }]
  },

  addKeyboardShortcuts() {
    const indent = (outdent: boolean) => {
      const type = listItemType(this.editor.state)
      if (!type) return false
      if (outdent) this.editor.commands.liftListItem(type)
      else this.editor.commands.sinkListItem(type)
      // Indenting into a folded item must make the result visible.
      const { $from } = this.editor.state.selection
      const tr = this.editor.state.tr
      for (let depth = 1; depth <= $from.depth; depth++) {
        const node = $from.node(depth)
        if (node.attrs.collapsed) tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, collapsed: false })
      }
      if (tr.docChanged) this.editor.view.dispatch(tr)
      return true
    }
    const move = (down: boolean) => {
      const state = this.editor.state
      const source = selectedBlock(state)
      if (!source) return false
      const $pos = state.doc.resolve(source.from)
      let target: number | null = null
      if (down) {
        const next = blockRange(state.doc, source.to)
        if (next) target = next.to
      } else {
        // Find the previous sibling section/item, including all of its descendants.
        let offset = $pos.start()
        while (offset < source.from) {
          const range = blockRange(state.doc, offset)
          if (range && range.to <= source.from) target = offset
          offset = range?.to ?? offset + state.doc.nodeAt(offset)!.nodeSize
        }
      }
      if (target !== null) {
        const tr = moveBlock(state, source, target)
        if (tr) this.editor.view.dispatch(tr)
      }
      return true
    }
    return {
      Tab: () => indent(false),
      'Shift-Tab': () => indent(true),
      Enter: () => {
        const tr = enterAfterCollapsed(this.editor.state)
        if (!tr) return false
        this.editor.view.dispatch(tr)
        return true
      },
      ArrowDown: () => {
        const block = selectedBlock(this.editor.state)
        if (!block?.node.attrs.collapsed) return false
        const state = this.editor.state
        const next = TextSelection.findFrom(state.doc.resolve(block.to), 1, true)
        if (next) this.editor.view.dispatch(state.tr.setSelection(next).scrollIntoView())
        return true
      },
      'Alt-ArrowUp': () => move(false),
      'Alt-ArrowDown': () => move(true),
    }
  },

  addProseMirrorPlugins() {
    let dragging: BlockRange | null = null
    let dropMarker: HTMLElement | null = null
    const clearMarker = () => { dropMarker?.remove(); dropMarker = null }
    const editable = () => this.editor.isEditable
    return [new Plugin({
      key,
      state: {
        init: (_, state) => ({ decorations: outlineDecorations(state.doc, editable()), editable: editable() }),
        apply: (tr, previous) => tr.docChanged || previous.editable !== editable()
          ? { decorations: outlineDecorations(tr.doc, editable()), editable: editable() } : previous,
      },
      appendTransaction: (transactions, _previous, state) => transactions.some(tr => tr.docChanged)
        ? splitOutlineBoundaryLists(state) : null,
      props: {
        decorations: state => {
          const cached = key.getState(state)
          return cached?.editable === editable() ? cached.decorations : outlineDecorations(state.doc, editable())
        },
        handlePaste: (view, event, slice) => {
          if (!editable()) return false
          const text = event.clipboardData?.getData('text/plain') || ''
          const html = event.clipboardData?.getData('text/html') || ''
          const converted = taskPaste(view.state, slice, text, !html)
          if (!converted) return false
          view.dispatch(view.state.tr.replaceSelection(converted).scrollIntoView())
          return true
        },
        handleDOMEvents: {
          dragstart: (view, event) => {
            if (!editable()) return false
            const handle = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-rte-handle]') : null
            if (!handle) return false
            dragging = blockRange(view.state.doc, Number(handle.dataset.rteHandle))
            if (!dragging || !event.dataTransfer) return false
            event.dataTransfer.setData('application/x-rte-block', 'move')
            event.dataTransfer.setData('text/plain', dragging.node.textContent)
            event.dataTransfer.effectAllowed = 'move'
            const element = handle.closest('[data-rte-block]')
            if (element) event.dataTransfer.setDragImage(element, 0, 0)
            return true
          },
          dragover: (view, event) => {
            if (!dragging) return false
            clearMarker()
            const destination = dropDestination(view, event, dragging)
            if (destination !== null && moveBlock(view.state, dragging, destination.pos, destination.wrapIn)) {
              event.preventDefault()
              if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
              const rect = view.coordsAtPos(destination.pos)
              dropMarker = document.createElement('div')
              dropMarker.className = 'rte-drop-marker'
              Object.assign(dropMarker.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${Math.max(80, view.dom.getBoundingClientRect().right - rect.left)}px` })
              document.body.append(dropMarker)
            }
            return true
          },
          drop: (view, event) => {
            if (!dragging) return false
            event.preventDefault()
            const destination = dropDestination(view, event, dragging)
            const tr = destination === null ? null : moveBlock(view.state, dragging, destination.pos, destination.wrapIn)
            dragging = null
            clearMarker()
            if (tr) { view.dispatch(tr); view.focus() }
            return true
          },
          dragend: () => { dragging = null; clearMarker(); return false },
        },
      },
      view: () => ({
        update: (view, previous) => {
          // Abort stale ranges if another edit occurs during a drag.
          if (!view.state.doc.eq(previous.doc)) { dragging = null; clearMarker() }
        },
        destroy: () => { dragging = null; clearMarker() },
      }),
    })]
  },
})
