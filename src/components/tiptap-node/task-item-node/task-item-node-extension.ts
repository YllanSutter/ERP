import { TaskItem } from "@tiptap/extension-list"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { TaskItemNode } from "@/components/tiptap-node/task-item-node/task-item-node"

export const CollapsibleTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-collapsed") === "true",
        renderHTML: (attributes) =>
          attributes.collapsed ? { "data-collapsed": "true" } : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskItemNode)
  },
})

export default CollapsibleTaskItem
