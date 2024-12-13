import productionDeepEqual from "lodash/isEqual";
import {
  // eslint-disable-next-line no-restricted-imports
  shallowEqual as productionShallowEqual,
  // eslint-disable-next-line no-restricted-imports
  useSelector,
} from "react-redux";
import type { RootState } from "store";

export type EqualityFn = <T>(a: T, b: T) => boolean;

/**
 * Same as react-redux built in type TypedUseSelectorHook, except equalityFn is required
 */
export type CodaTypedUseSelectorHook = <TSelected>(
  selector: (state: RootState) => TSelected,
  equalityFn: EqualityFn
) => TSelected;

export const useAppSelector: CodaTypedUseSelectorHook = <TSelected>(
  selector: (state: RootState) => TSelected,
  equalityFn: EqualityFn
): TSelected => {
  return useSelector(selector, equalityFn) as TSelected;
};

const productionRefEqual: EqualityFn = (a, b) => a === b;

/*
For testing can replace refEqual with this function to help find places where refEqual should be
shallowEqual or deepEqual. For now this is just left as commented-out code to be enabled when
useful, but ultimately could/should be made a more full-featured option to be enabled during
some/all development, and perhaps to be enabled during CI (to find inefficient selectors)
*/

const isPrimitive = (arg: unknown): boolean => {
  const type = typeof arg;
  return type !== "object" && type !== "function";
};

// @ts-ignore unused declaration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const devRefEqual: EqualityFn = (a, b) => {
  if (
    a !== null &&
    a !== undefined &&
    b !== null &&
    b !== undefined &&
    (!isPrimitive(a) || !isPrimitive(b))
  ) {
    console.error(
      new Error(
        `Redux selector using refEqual() with non-primitive values.
				shallowEqual() or deepEqual() probably desired`
      ),
      { a, b }
    );
  }
  return productionRefEqual(a, b);
};

// @ts-ignore unused declaration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const devShallowEqual: EqualityFn = (a, b) => {
  if (
    a !== null &&
    a !== undefined &&
    b !== null &&
    b !== undefined &&
    (isPrimitive(a) || isPrimitive(b))
  ) {
    console.error(
      new Error(
        `Redux selector using shallowEqual() with primitive values.
				refEqual() probably desired`
      ),
      { a, b }
    );
  }
  return productionShallowEqual(a, b);
};

// @ts-ignore unused declaration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const devDeepEqual: EqualityFn = (a, b) => {
  if (
    a !== null &&
    a !== undefined &&
    b !== null &&
    b !== undefined &&
    (isPrimitive(a) || isPrimitive(b))
  ) {
    console.error(
      new Error(
        `Redux selector using deepEqual() with primitive values.
				refEqual() probably desired`
      ),
      { a, b }
    );
  }

  return productionDeepEqual(a, b);
};

/**
 * For dev/testing only. Just wraps an equality function and console.logs when it's invoked. Use
 * like:
 *
 * const myValue = useSelector(someSelector, selectorEqualityNotify(refEqual));
 *
 * And now the console will inform whenever the selector equality function is called and whether or
 * not it drives a re-render.
 */
// @ts-ignore unused declaration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const selectorEqualityNotify = (equalityFn: EqualityFn): EqualityFn => {
  const wrapper: EqualityFn = (prev, next) => {
    const prevAndNextEqual = equalityFn(prev, next);

    // Output if the current equality function being used triggered a re-render, but deepEquality would not have
    // Essentially, these are places where we should be using deepEqual instead of the current equalityFn
    const deepEqual = productionDeepEqual(prev, next);
    if (prevAndNextEqual !== deepEqual) {
      console.error("equalityFn not match DeepEqual", { prev, next, equalityFn });
    }

    // console.log(
    //   prevAndNextEqual ? "Selector called, no render" : "Selector called, will re-render",
    //   { prev, next, prevAndNextEqual }
    // );
    return prevAndNextEqual;
  };
  return wrapper;
};

export const refEqual = productionRefEqual;
export const shallowEqual = productionShallowEqual;
export const deepEqual = productionDeepEqual;

// Wrap the equality functions in the notify function for dev/testing
// export const refEqual = selectorEqualityNotify(productionRefEqual);
// export const shallowEqual = selectorEqualityNotify(productionShallowEqual);
// export const deepEqual = selectorEqualityNotify(productionDeepEqual);
