import { expect, it, vi } from 'vitest';
import { monitorSession } from './sessionMonitor';

it('detects expired sessions on reads and writes without consuming their response', async () => {
  const original = vi.fn(async () => new Response('{"error":"Unauthenticated"}', { status: 401 }));
  const target = { fetch: original as typeof fetch, location: { href: 'https://erp.example/' } as Location };
  const expired = vi.fn();
  const stop = monitorSession(target, '/api', expired);
  const response = await target.fetch('/api/state', { method: 'POST' });
  expect(expired).toHaveBeenCalledTimes(1);
  expect(await response.json()).toEqual({ error: 'Unauthenticated' });
  await target.fetch(new Request('https://erp.example/api/auth/me'));
  expect(expired).toHaveBeenCalledTimes(2);
  stop();
  expect(target.fetch).toBe(original);
});

it('ignores login failures, unrelated URLs, permission errors and network failures', async () => {
  const original = vi.fn(async () => new Response(null, { status: 401 }));
  const target = { fetch: original as typeof fetch, location: { href: 'https://erp.example/' } as Location };
  const expired = vi.fn();
  monitorSession(target, 'https://erp.example/api/', expired);
  for (const url of ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api-other/state', 'https://other.example/api/state']) await target.fetch(url);
  original.mockImplementationOnce(async () => new Response(null, { status: 403 }));
  await target.fetch('/api/state');
  original.mockRejectedValueOnce(new TypeError('offline'));
  await expect(target.fetch('/api/state')).rejects.toThrow('offline');
  expect(expired).not.toHaveBeenCalled();
});
