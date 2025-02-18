/**
 * Convenience function, may not be used anywhere in the codebase but is sometimes useful for debug
 * or to see how an asyncronous UI changes if you add delay.
 */
export const asyncSleep = async (duration: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
