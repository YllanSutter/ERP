import type { FC } from "react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"

export const TaskItemNode: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  editor,
}) => {
  const isCollapsed = Boolean(node.attrs?.collapsed)
  const isChecked = Boolean(node.attrs?.checked)
  const isEditable = editor?.isEditable ?? true

  const hasNestedList = (() => {
    if (!node) return false
    const childCount = node.childCount ?? 0
    for (let index = 0; index < childCount; index += 1) {
      const child = node.child(index)
      if (
        child.type.name === "taskList" ||
        child.type.name === "bulletList" ||
        child.type.name === "orderedList"
      ) {
        return true
      }
    }
    return false
  })()

  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-checked={isChecked ? "true" : "false"}
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      <label contentEditable={false}>
        <input
          type="checkbox"
          checked={isChecked}
          disabled={!isEditable}
          onChange={(event) => {
            if (!isEditable) return
            updateAttributes({ checked: event.target.checked })
          }}
        />
        <span />
      </label>

      {hasNestedList && (
        <button
          type="button"
          className="tt-task-toggle"
          aria-label={isCollapsed ? "Afficher les enfants" : "Masquer les enfants"}
          aria-pressed={isCollapsed}
          contentEditable={false}
          disabled={!isEditable}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (!isEditable) return
            updateAttributes({ collapsed: !isCollapsed })
          }}
        >
          <ChevronDownIcon />
        </button>
      )}

      <NodeViewContent as="div" className="tt-task-content" />
    </NodeViewWrapper>
  )
}

TaskItemNode.displayName = "TaskItemNode"
