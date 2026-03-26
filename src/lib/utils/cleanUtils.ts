/**
 * Nettoie récursivement un objet pour supprimer les cycles.
 * Préserve les clés commençant par _ (ex: _eventSegments).
 */
export function cleanForSave(obj: any, stack: WeakSet<object> = new WeakSet()): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (stack.has(obj)) return undefined;

  if (Array.isArray(obj)) {
    stack.add(obj);
    const arr = obj.map((item) => cleanForSave(item, stack)).filter((v) => v !== undefined);
    stack.delete(obj);
    return arr;
  }

  stack.add(obj);
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const val = cleanForSave(obj[key], stack);
    if (val !== undefined) result[key] = val;
  }
  stack.delete(obj);
  return result;
}
