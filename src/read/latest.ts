/** Starting a run makes every earlier one stale. */
export function createSequence(): () => () => boolean {
  let newest = 0;
  return () => {
    const run = ++newest;
    return () => run === newest;
  };
}
