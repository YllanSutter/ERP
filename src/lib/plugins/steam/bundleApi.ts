export const STEAM_API = `${import.meta.env.VITE_API_URL || '/api'}/plugins/steam`;
export async function bundleRequest(path: string, options?: RequestInit) {
  const response = await fetch(`${STEAM_API}/${path}`, { credentials: 'include', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Opération impossible.');
  return data;
}

/** Older catalogues expose only summaries; obtain the already-public grouping metadata. */
export async function loadPublicBundles() {
  const entries = await bundleRequest('public-bundles');
  const result: any[] = [];
  for (let offset = 0; offset < entries.length; offset += 8) {
    result.push(
      ...(await Promise.all(
        entries.slice(offset, offset + 8).map(async (entry: any) => {
          if (entry.bundle && Array.isArray(entry.bundleProperties)) return entry;
          const snapshot = await bundleRequest(
            `public-bundles/${encodeURIComponent(entry.id)}?format=json`,
          );
          return { ...entry, bundle: snapshot.bundle, bundleProperties: snapshot.bundleProperties };
        }),
      )),
    );
  }
  return result;
}
