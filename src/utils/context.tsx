/**
 * Function that composes multiple useContext providers into a single provider by nesting them.
 * Removes the unsightly mess of nested providers in the App.tsx file.
 *
 * @param providers array of useContext providers
 * @returns A nested provider component that wraps all the providers in the array around the children.
 */
export const composeProviders = (providers: Provider[]) => {
  return providers.reduce(
    (AccumulatedProviders, CurrentProvider) => {
      return ({ children }) => (
        <AccumulatedProviders>
          <CurrentProvider>{children}</CurrentProvider>
        </AccumulatedProviders>
      );
    },
    ({ children }) => <>{children}</>
  );
};
