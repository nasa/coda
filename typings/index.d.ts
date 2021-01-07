export {};
declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Tests that two Dates are within 1 second of each other
       */
      toHappenAround(expected: Date, message?: string): R;
    }
  }
}
