import type { FC } from "react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { blockRange } from "@/components/tiptap-extension/block-hierarchy"
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

  const position = typeof getPos === "function" ? getPos() : undefined
  const range = typeof position === "number" ? blockRange(editor.state.doc, position) : null
  const hasChildren = Boolean(range && range.to > range.from + node.nodeSize)

  return (
    <NodeViewWrapper
      as={tag}
      data-type="heading"
      data-level={level}
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      {hasChildren && (
        <button
          type="button"
          className="tt-heading-toggle"
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

      <NodeViewContent as="div" className="tt-heading-content" />
    </NodeViewWrapper>
  )
}

HeadingNode.displayName = "HeadingNode"
