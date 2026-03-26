export function isEmptyTiptapDoc(doc: any): boolean {
  if (!doc || doc.type !== 'doc') return false;
  const hasText = (node: any): boolean => {
    if (!node) return false;
    if (typeof node.text === 'string' && node.text.trim() !== '') return true;
    if (Array.isArray(node.content)) return node.content.some(hasText);
    return false;
  };
  return !hasText(doc);
}

export function isEmptyValue(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return true;
    try {
      const parsed = JSON.parse(trimmed);
      if (isEmptyTiptapDoc(parsed)) return true;
    } catch {
      // ignore JSON parse errors
    }
    return false;
  }
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object' && isEmptyTiptapDoc(val)) return true;
  return false;
}
