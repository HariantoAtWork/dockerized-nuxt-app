/** Serialises async work (e.g. one build at a time). */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn());
    this.tail = run.then(
      () => {},
      () => {},
    );
    return run;
  }
}
