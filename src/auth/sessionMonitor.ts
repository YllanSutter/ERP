// Observe all API calls, including those made by plugins, without consuming responses.
export function monitorSession(
  target: Pick<Window, 'fetch' | 'location'>,
  apiUrl: string,
  onExpired: () => void,
) {
  const original = target.fetch;
  const base = new URL(apiUrl.replace(/\/$/, '') + '/', target.location.href);
  const wrapped: typeof fetch = async (input, init) => {
    const response = await original.call(target, input, init);
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, target.location.href);
    const publicAuth = ['auth/login', 'auth/register', 'auth/logout'].some(path => url.pathname === base.pathname + path);
    if (response.status === 401 && url.origin === base.origin && url.pathname.startsWith(base.pathname) && !publicAuth) onExpired();
    return response;
  };
  target.fetch = wrapped;
  return () => { if (target.fetch === wrapped) target.fetch = original; };
}
