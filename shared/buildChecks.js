/** Catch initialization-order regressions in the generated, statically imported graph. */
export function assertProductionBuild(results) {
  const output = (Array.isArray(results) ? results : [results]).flatMap(result => result.output || []);
  const chunks = new Map(output.filter(file => file.type === 'chunk').map(chunk => [chunk.fileName, chunk]));
  if (!chunks.size) throw new Error('Build verification: no JavaScript chunks generated');
  for (const chunk of chunks.values()) {
    if (chunk.code.includes('Download the React DevTools')) throw new Error(`Development React runtime in production build: ${chunk.fileName}`);
  }
  const active = new Set(), done = new Set(), path = [];
  const visit = name => {
    if (active.has(name)) throw new Error(`Circular build chunks: ${[...path.slice(path.indexOf(name)), name].join(' -> ')}`);
    if (done.has(name) || !chunks.has(name)) return;
    active.add(name); path.push(name);
    for (const imported of chunks.get(name).imports) visit(imported);
    path.pop(); active.delete(name); done.add(name);
  };
  for (const name of chunks.keys()) visit(name);
}
