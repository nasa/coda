const noop = () => Promise.resolve();

export const createClientLogger = () => ({
  emergency: noop,
  alert: noop,
  critical: noop,
  debug: noop,
  info: noop,
  notice: noop,
  warning: noop,
  error: noop,
});