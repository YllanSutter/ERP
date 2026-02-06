import { TaskList } from "@tiptap/extension-list"

export const CollapsibleTaskList = TaskList.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      collapsedByHeading: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute("data-collapsed-by-heading") === "true",
        renderHTML: (attributes) =>
          attributes.collapsedByHeading
            ? { "data-collapsed-by-heading": "true" }
            : {},
      },
    }
  },
})

export default CollapsibleTaskList
