import type { FC } from "react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"

export const HeadingNode: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  editor,
  getPos,
}) => {
  const level = Number(node.attrs?.level ?? 2)
  const tag = `h${level}` as keyof JSX.IntrinsicElements
  const isCollapsed = Boolean(node.attrs?.collapsed)
  const isEditable = editor?.isEditable ?? true

  const getNextTaskList = () => {
    if (!editor || typeof getPos !== "function") return null
    const pos = getPos()
    if (typeof pos !== "number") return null
    const nextPos = pos + node.nodeSize
    const resolved = editor.state.doc.resolve(nextPos)
    const nextNode = resolved.nodeAfter
    if (!nextNode || nextNode.type.name !== "taskList") return null
    return { nextNode, nextPos }
  }

  const hasFollowingTaskList = Boolean(getNextTaskList())

  return (
    <NodeViewWrapper
      as={tag}
      data-type="heading"
      data-level={level}
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      {hasFollowingTaskList && (
        <button
          type="button"
          className="tt-heading-toggle"
          aria-label={isCollapsed ? "Afficher les tâches" : "Masquer les tâches"}
          aria-pressed={isCollapsed}
          contentEditable={false}
          disabled={!isEditable}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (!isEditable) return
            const nextCollapsed = !isCollapsed
            updateAttributes({ collapsed: nextCollapsed })

            const next = getNextTaskList()
            if (next && editor) {
              const { nextNode, nextPos } = next
              const attrs = {
                ...nextNode.attrs,
                collapsedByHeading: nextCollapsed,
              }
              const tr = editor.state.tr.setNodeMarkup(
                nextPos,
                nextNode.type,
                attrs
              )
              editor.view.dispatch(tr)
            }
          }}
        >
          <ChevronDownIcon />
        </button>
      )}

      <NodeViewContent as="div" className="tt-heading-content" />
    </NodeViewWrapper>
  )
}

HeadingNode.displayName = "HeadingNode"
