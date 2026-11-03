import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveQueue, SaveConflictError, SaveTooLargeError } from './saveQueue';

afterEach(() => vi.useRealTimers());

describe('save queue', () => {
  it('retries a failed save without another user edit', async () => {
    vi.useFakeTimers();
    const status = vi.fn();
    const task = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = new SaveQueue(status);
    queue.enqueue(task, 400);
    await vi.advanceTimersByTimeAsync(400);
    expect(status).toHaveBeenLastCalledWith('retrying');
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('saved');
    queue.dispose();
  });

  it('serializes requests and keeps the latest edit while a save is running', async () => {
    vi.useFakeTimers();
    let resolve!: () => void;
    let latest!: () => boolean;
    const first = vi.fn((context) => {
      latest = context.isLatest;
      return new Promise<void>((done) => { resolve = done; });
    });
    const replaced = vi.fn();
    const last = vi.fn().mockResolvedValue(undefined);
    const status = vi.fn();
    const queue = new SaveQueue(status);
    queue.enqueue(first, 0);
    await vi.advanceTimersByTimeAsync(0);
    queue.enqueue(replaced, 0);
    queue.enqueue(last, 0);
    expect(latest()).toBe(false);
    expect(last).not.toHaveBeenCalled();
    resolve();
    await vi.runAllTimersAsync();
    expect(replaced).not.toHaveBeenCalled();
    expect(last).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith('saved');
    queue.dispose();
  });

  it('does not retry conflicts or report them as saved', async () => {
    vi.useFakeTimers();
    const status = vi.fn();
    const task = vi.fn().mockRejectedValue(new SaveConflictError());
    const queue = new SaveQueue(status);
    queue.enqueue(task, 0);
    await vi.runAllTimersAsync();
    queue.retryNow();
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledOnce();
    expect(queue.hasPending).toBe(true);
    expect(status).toHaveBeenLastCalledWith('conflict');
    queue.dispose();
  });

  it('pauses oversized saves and allows retry after the server limit is increased', async () => {
    vi.useFakeTimers();
    const status = vi.fn();
    const task = vi.fn().mockRejectedValueOnce(new SaveTooLargeError()).mockResolvedValue(undefined);
    const queue = new SaveQueue(status);
    queue.enqueue(task, 0);
    await vi.runAllTimersAsync();
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith('too-large');
    expect(queue.hasPending).toBe(true);
    queue.retryNow();
    await vi.runAllTimersAsync();
    expect(task).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('saved');
    queue.dispose();
  });

  it('cancels retries when leaving the organization', async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockRejectedValue(new Error('offline'));
    const queue = new SaveQueue(vi.fn());
    queue.enqueue(task, 0);
    await vi.advanceTimersByTimeAsync(0);
    queue.dispose();
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledOnce();
  });
});
