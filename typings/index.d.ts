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

/**
 * Response from a search on Imagery Online
 */
export interface IOResponse {
  results: {
    responseheader: any;
    facet_counts: any;
    response: {
      start: number;
      /** Info about videos from the search */
      docs: Doc[];
      numfound: number;
    };
  };
}
