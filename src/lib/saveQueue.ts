export type SaveStatus = 'loading' | 'pending' | 'saving' | 'saved' | 'retrying' | 'conflict' | 'too-large';

export class SaveConflictError extends Error {}
export class SaveTooLargeError extends Error {}

type SaveTask = (context: { isLatest: () => boolean; isActive: () => boolean }) => Promise<void>;

// Une requête à la fois ; les échecs reprennent avec les données les plus récentes.
export class SaveQueue {
  private pending: SaveTask | null = null;
  private running = false;
  private disposed = false;
  private blocked = false;
  private tooLarge = false;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private onStatus: (status: SaveStatus) => void) {}

  get hasPending() { return this.running || this.pending !== null || this.blocked; }

  enqueue(task: SaveTask, delay: number) {
    if (this.disposed) return;
    this.pending = task;
    if (this.blocked) return;
    this.onStatus('pending');
    this.schedule(delay);
  }

  retryNow() {
    if (this.tooLarge) {
      this.blocked = false;
      this.tooLarge = false;
    }
    if (!this.disposed && !this.blocked && this.pending) this.schedule(0);
  }

  resumeAfterConflict() {
    if (this.disposed || !this.blocked || this.tooLarge || !this.pending) return;
    this.blocked = false;
    this.schedule(0);
  }

  dispose() {
    this.disposed = true;
    this.pending = null;
    clearTimeout(this.timer);
  }

  private schedule(delay: number) {
    clearTimeout(this.timer);
    if (!this.running) this.timer = setTimeout(() => void this.run(), delay);
  }

  private async run() {
    if (this.disposed || this.blocked || this.running || !this.pending) return;
    const task = this.pending;
    this.pending = null;
    this.running = true;
    this.onStatus('saving');
    let delay = 0;
    try {
      await task({
        isLatest: () => !this.disposed && this.pending === null,
        isActive: () => !this.disposed,
      });
      this.attempts = 0;
      if (!this.disposed) this.onStatus(this.pending ? 'pending' : 'saved');
    } catch (error) {
      if (this.disposed) return;
      this.pending ??= task;
      if (error instanceof SaveTooLargeError) {
        this.blocked = true;
        this.tooLarge = true;
        this.onStatus('too-large');
      } else if (error instanceof SaveConflictError) {
        this.blocked = true;
        this.onStatus('conflict');
      } else {
        delay = Math.min(1000 * 2 ** this.attempts++, 30000);
        this.onStatus('retrying');
      }
    } finally {
      this.running = false;
      if (!this.disposed && !this.blocked && this.pending) this.schedule(delay);
    }
  }
}
