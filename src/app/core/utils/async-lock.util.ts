export class AsyncLock {
  private queue: Promise<void> = Promise.resolve();

  acquire<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const nextQueue = this.queue.then(() => new Promise<void>(res => (release = res)));
    const result = this.queue.then(fn).finally(() => release());
    this.queue = nextQueue;
    return result;
  }
}
