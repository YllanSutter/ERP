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

/** Cached cleaner for immutable state; cyclic branches stay context-dependent. */
export function createSaveCleaner() {
  const cache = new WeakMap<object, any>();
  const visit = (value: any, stack: WeakSet<object>): { value: any; cyclic: boolean } => {
    if (value === null || typeof value !== 'object') return { value, cyclic: false };
    if (stack.has(value)) return { value: undefined, cyclic: true };
    if (cache.has(value)) return { value: cache.get(value), cyclic: false };
    stack.add(value);
    let cyclic = false;
    const result: any = Array.isArray(value) ? [] : {};
    for (const key of (Array.isArray(value) ? Array.from(value.keys(), String) : Object.keys(value))) {
      const child = visit(value[key], stack);
      cyclic ||= child.cyclic;
      if (child.value === undefined) continue;
      if (Array.isArray(result)) result.push(child.value); else result[key] = child.value;
    }
    stack.delete(value);
    if (!cyclic) { cache.set(value, result); cache.set(result, result); }
    return { value: result, cyclic };
  };
  return (value: any) => visit(value, new WeakSet()).value;
}
