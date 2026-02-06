import { Heading } from "@tiptap/extension-heading"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { HeadingNode } from "@/components/tiptap-node/heading-node/heading-node"

export const CollapsibleHeading = Heading.extend({
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
    return ReactNodeViewRenderer(HeadingNode)
  },
})

export default CollapsibleHeading
