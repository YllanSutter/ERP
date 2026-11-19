// Merge independently acknowledged versions without losing another user's history.
function apply(snapshot, patch = {}) {
  const next = { ...snapshot, ...patch.set };
  for (const key of patch.unset || []) delete next[key];
  for (const [key, [start, count, inserted]] of Object.entries(patch.deltas || {})) {
    const original = JSON.stringify(snapshot[key]);
    next[key] = JSON.parse(original.slice(0, start) + inserted + original.slice(start + count));
  }
  return next;
}
export const historyVersionIdentity = version => version.id || JSON.stringify([version.ts, version.userId, version.action, version.userName]);
export function mergePersistentHistory(currentValue, incomingValue) {
  if (!currentValue) return incomingValue;
  const current = JSON.parse(currentValue);
  const incoming = JSON.parse(incomingValue);
  const known = new Set(current.versions.map(historyVersionIdentity));
  let source = incoming.base;
  for (const version of incoming.versions) {
    source = apply(source, version.patch);
    if (known.has(historyVersionIdentity(version)) || (version.action === 'baseline' && current.versions.length)) continue;
    // Convert string deltas using their original baseline. Replaying those
    // offsets directly against a concurrently modified document corrupts it.
    const patch = version.patch || {};
    const set = { ...patch.set };
    for (const key of Object.keys(patch.deltas || {})) set[key] = source[key];
    current.versions.push({ ...version, patch: { set, unset: patch.unset || [] } });
    known.add(historyVersionIdentity(version));
  }
  return JSON.stringify(current);
}
